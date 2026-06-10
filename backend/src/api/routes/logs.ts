import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { optionalAuth } from '../../middleware/auth.js';

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
              ...entry.context,
            },
          },
        ];
      });

      await esClient.bulk({ refresh: false, body });

      res.status(202).json({ accepted: entries.length });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
