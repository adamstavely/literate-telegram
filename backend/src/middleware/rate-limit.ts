import { rateLimit } from 'express-rate-limit';
import { config } from '../config/index.js';
import { logger } from '../logger/logger.js';

/**
 * Tight per-IP limiter for the unauthenticated client telemetry endpoints
 * (POST /api/logs, POST /api/audit/client). Each request can bulk-index up to
 * 50 documents, so the generous global limit is not enough to stop a single
 * client from flooding Elasticsearch. A shared instance means a client's log
 * and audit ingestion draw from the same budget.
 */
export const ingestRateLimiter = rateLimit({
  windowMs: config.rateLimit.ingestWindowMs,
  max: config.rateLimit.ingestMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Ingestion rate limit exceeded', {
      correlationId: req.id,
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Ingestion rate limit exceeded. Please slow down.',
      correlationId: req.id,
    });
  },
});
