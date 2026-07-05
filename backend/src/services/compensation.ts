import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger/logger.js';
import { esClient } from '../elasticsearch/client.js';
import { INDEX_NAMES } from '../elasticsearch/indices.js';

const DEFAULT_ATTEMPTS = 3;
const BASE_DELAY_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Persist a durable reconciliation record when a compensation exhausts its
 * retries, so a diverged pair of stores isn't only visible in ephemeral logs.
 * Written to the audit index (queryable, retained) with a stable action so ops
 * alerting can key on it. Best-effort — if even this write fails, the structured
 * error log below remains the signal.
 */
async function recordReconciliation(label: string, context: Record<string, unknown>): Promise<void> {
  try {
    await esClient.index({
      index: INDEX_NAMES.AUDIT,
      document: {
        id: uuidv4(),
        userId: 'system',
        action: 'RECONCILIATION_REQUIRED',
        resource: 'compensation',
        resourceId: label,
        timestamp: new Date().toISOString(),
        ip: 'internal',
        userAgent: 'system',
        result: 'failure',
        metadata: { label, ...context },
      },
      refresh: false,
    });
  } catch (err) {
    logger.error('Failed to persist reconciliation record', {
      label,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Retry a rollback/compensation step so a transient ES failure doesn't leave
 * stores diverged. Returns true if the compensation eventually succeeded, false
 * if it exhausted its retries — on exhaustion it raises a distinct, alertable
 * signal (structured log + a durable RECONCILIATION_REQUIRED audit record) so
 * the divergence is not silent to operators. Callers should surface the failure
 * (e.g. degrade the response / flag for manual reconciliation) rather than
 * assume the rollback happened.
 */
export async function runCompensation(
  label: string,
  fn: () => Promise<void>,
  context: Record<string, unknown> = {},
): Promise<boolean> {
  for (let attempt = 1; attempt <= DEFAULT_ATTEMPTS; attempt++) {
    try {
      await fn();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Compensation attempt failed', { label, attempt, error: msg });
      if (attempt < DEFAULT_ATTEMPTS) {
        await sleep(BASE_DELAY_MS * attempt);
      }
    }
  }

  // Distinct, alertable event — stores may be diverged and need manual repair.
  logger.error('COMPENSATION_EXHAUSTED — manual reconciliation required', {
    event: 'COMPENSATION_EXHAUSTED',
    label,
    ...context,
  });
  await recordReconciliation(label, context);
  return false;
}
