import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { optionalAuth } from '../../middleware/auth.js';
import { ingestRateLimiter } from '../../middleware/rate-limit.js';
import { logger } from '../../logger/logger.js';
import { boundedMeta } from '../../services/sanitize-meta.js';
import {
  boundedIngestString,
  MAX_INGEST_UA_LEN,
  MAX_INGEST_URL_LEN,
} from '../../services/ingest-fields.js';

const router = Router();

interface ClientLogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  url: string;
  userAgent: string;
}

router.post(
  '/',
  ingestRateLimiter,
  optionalAuth,
  // Unauthenticated by design — bounded by ingestRateLimiter and batch size (50).
  [
    body('entries').isArray({ min: 1, max: 50 }),
    body('entries.*.level').isIn(['info', 'warn', 'error']),
    body('entries.*.message').isString().trim().isLength({ min: 1, max: 2000 }),
    body('entries.*.timestamp').optional().isISO8601(),
    body('entries.*.url').isString().trim().isLength({ min: 1, max: MAX_INGEST_URL_LEN }),
    body('entries.*.userAgent').isString().trim().isLength({ min: 1, max: MAX_INGEST_UA_LEN }),
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
        const ingestedAt = new Date().toISOString();

        return [
          { index: { _index: INDEX_NAMES.LOGS } },
          {
            '@timestamp': ingestedAt,
            level: entry.level,
            message: entry.message,
            correlationId: req.id,
            userId,
            service: 'interop-web',
            stack,
            meta: {
              url: boundedIngestString(entry.url, MAX_INGEST_URL_LEN),
              userAgent: boundedIngestString(entry.userAgent, MAX_INGEST_UA_LEN),
              ...(entry.timestamp ? { clientTimestamp: entry.timestamp } : {}),
              ...boundedMeta(entry.context, { excludeKeys: ['stack'] }),
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
