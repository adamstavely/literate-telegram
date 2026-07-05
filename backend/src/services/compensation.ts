import { logger } from '../logger/logger.js';

const DEFAULT_ATTEMPTS = 3;
const BASE_DELAY_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry a rollback/compensation step so a transient ES failure doesn't leave stores diverged. */
export async function runCompensation(label: string, fn: () => Promise<void>): Promise<void> {
  for (let attempt = 1; attempt <= DEFAULT_ATTEMPTS; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Compensation attempt failed', { label, attempt, error: msg });
      if (attempt < DEFAULT_ATTEMPTS) {
        await sleep(BASE_DELAY_MS * attempt);
      }
    }
  }
  logger.error('Compensation exhausted — manual reconciliation may be required', { label });
}
