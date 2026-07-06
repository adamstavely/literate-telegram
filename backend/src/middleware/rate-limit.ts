import { rateLimit } from 'express-rate-limit';
import { config } from '../config/index.js';
import { logger } from '../logger/logger.js';

/** Prefer authenticated user id over IP so per-user budgets apply within a replica. */
export function rateLimitIdentityKey(req: { user?: { sub?: string }; ip?: string }): string {
  if (req.user?.sub) return `user:${req.user.sub}`;
  return `ip:${req.ip ?? 'unknown'}`;
}

/** Divide a cluster-wide limit across expected backend replicas (in-memory store). */
export function perReplicaLimit(clusterMax: number): number {
  return Math.max(1, Math.floor(clusterMax / config.rateLimit.replicas));
}

const rateLimitHandler = (message: string) => (req: { id?: string }, res: { status: (n: number) => { json: (b: unknown) => void } }) => {
  res.status(429).json({
    error: 'Too Many Requests',
    message,
    correlationId: req.id,
  });
};

/**
 * Global API limiter. Uses the default in-memory store (not shared across
 * replicas) — configure a Redis store at the orchestrator layer for multi-pod
 * deployments that need a cluster-wide budget.
 */
export function createGlobalRateLimiter(): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: perReplicaLimit(config.rateLimit.max),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitIdentityKey,
    skip: (req) => /^\/api\/health(\/|$)/.test(req.path),
    handler: rateLimitHandler('Rate limit exceeded. Please try again later.'),
  });
}

/** Per-user cap on entry submissions to throttle queue flooding. */
export const submitRateLimiter = rateLimit({
  windowMs: config.rateLimit.submitWindowMs,
  max: perReplicaLimit(config.rateLimit.submitMax),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitIdentityKey,
  handler: rateLimitHandler('Entry submission rate limit exceeded. Please try again later.'),
});

/**
 * Per-user cap on OpenAPI import + API try-it proxy calls. Each does an
 * outbound fetch (parse/forward), so it gets a tighter budget than the global
 * limit to bound server-initiated egress.
 */
export const outboundRateLimiter = rateLimit({
  windowMs: config.rateLimit.submitWindowMs,
  max: perReplicaLimit(Math.min(config.rateLimit.submitMax, 20)),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitIdentityKey,
  handler: rateLimitHandler('Outbound request rate limit exceeded. Please try again later.'),
});

/**
 * Tight per-IP limiter for the unauthenticated client telemetry endpoints
 * (POST /api/logs, POST /api/audit/client). Each request can bulk-index up to
 * 50 documents, so the generous global limit is not enough to stop a single
 * client from flooding Elasticsearch. A shared instance means a client's log
 * and audit ingestion draw from the same budget.
 */
export const ingestRateLimiter = rateLimit({
  windowMs: config.rateLimit.ingestWindowMs,
  max: () => perReplicaLimit(config.rateLimit.ingestMax),
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
