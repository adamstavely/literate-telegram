import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { optionalAuth } from '../../middleware/auth.js';
import { ingestRateLimiter } from '../../middleware/rate-limit.js';
import { logger } from '../../logger/logger.js';

const router = Router();

interface ClientLogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  url: string;
  userAgent: string;
}

const MAX_CONTEXT_KEYS = 20;
const MAX_CONTEXT_VALUE_LEN = 500;

/**
 * Bound and flatten client-supplied context before it lands in the dynamically
 * mapped `meta` object. Untrusted clients could otherwise explode the index
 * mapping with unbounded keys or deeply nested values.
 */
function sanitizeLogContext(context: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!context || typeof context !== 'object') return {};
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(context)) {
    if (count >= MAX_CONTEXT_KEYS) break;
    if (key === 'stack') continue; // captured separately as a top-level field
    if (value === null || typeof value === 'boolean' || typeof value === 'number') {
      out[key] = value;
    } else if (typeof value === 'string') {
      out[key] = value.slice(0, MAX_CONTEXT_VALUE_LEN);
    } else {
      try {
        out[key] = JSON.stringify(value).slice(0, MAX_CONTEXT_VALUE_LEN);
      } catch {
        out[key] = '[unserializable]';
      }
    }
    count += 1;
  }
  return out;
}

router.post(
  '/',
  ingestRateLimiter,
  optionalAuth,
  [
    body('entries').isArray({ min: 1, max: 50 }),
    body('entries.*.level').isIn(['info', 'warn', 'error']),
    body('entries.*.message').isString().trim().isLength({ min: 1, max: 2000 }),
    body('entries.*.timestamp').isISO8601(),
    body('entries.*.url').isString(),
    body('entries.*.userAgent').isString(),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation Error', details: errors.array(), correlationId: req.id });
      return;
    }

    try {
      const entries = req.body.entries as ClientLogEntry[];
      const userId = req.user?.sub ?? null;

      const body = entries.flatMap((entry) => {
        const stack =
          typeof entry.context?.['stack'] === 'string' ? entry.context['stack'] : undefined;

        return [
          { index: { _index: INDEX_NAMES.LOGS } },
          {
            '@timestamp': entry.timestamp,
            level: entry.level,
            message: entry.message,
            correlationId: req.id,
            userId,
            service: 'interop-web',
            stack,
            meta: {
              url: entry.url,
              userAgent: entry.userAgent,
              ...sanitizeLogContext(entry.context),
            },
          },
        ];
      });

      const bulkResponse = await esClient.bulk({ refresh: false, body });

      let failed = 0;
      if (bulkResponse.errors) {
        for (const item of bulkResponse.items) {
          const status = item.index?.status ?? item.create?.status ?? 200;
          if (status >= 400) failed += 1;
        }
        logger.warn('Client log ingestion had item failures', {
          correlationId: req.id,
          failed,
          total: entries.length,
        });
      }

      res.status(202).json({ accepted: entries.length - failed, failed });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
