import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { ingestRateLimiter } from '../../middleware/rate-limit.js';
import {
  DOCS_VISITOR_COOKIE,
  newVisitorId,
  recordDocsFeedback,
} from '../../services/docs-feedback.js';
import { boundedIngestString, MAX_INGEST_URL_LEN } from '../../services/ingest-fields.js';

const router = Router();

const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq);
    if (key === name) return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return undefined;
}

function setVisitorCookie(res: Response, visitorId: string): void {
  res.cookie(DOCS_VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function ensureVisitor(req: Request, res: Response): string {
  const existing = readCookie(req, DOCS_VISITOR_COOKIE);
  if (existing && existing.length >= 8 && existing.length <= 64) {
    return existing;
  }
  const visitorId = newVisitorId();
  setVisitorCookie(res, visitorId);
  return visitorId;
}

/** Issue an anonymous visitor cookie for deduplicating per-page feedback. */
router.get('/session', ingestRateLimiter, (req: Request, res: Response): void => {
  ensureVisitor(req, res);
  res.status(200).json({ ready: true });
});

router.post(
  '/',
  ingestRateLimiter,
  [
    body('pagePath')
      .isString()
      .trim()
      .isLength({ min: 1, max: MAX_INGEST_URL_LEN })
      .matches(/^\/docs(\/|$)/)
      .withMessage('pagePath must be a /docs/… URL'),
    body('helpful').isIn(['yes', 'no']),
    body('message').optional().isString().trim().isLength({ max: 500 }),
    body('pageTitle').optional().isString().trim().isLength({ max: 200 }),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: errors.array(),
        correlationId: req.id,
      });
      return;
    }

    try {
      const visitorId = readCookie(req, DOCS_VISITOR_COOKIE);
      if (!visitorId) {
        res.status(400).json({
          success: false,
          error: 'Visitor session required. Please refresh and try again.',
          correlationId: req.id,
        });
        return;
      }

      const pagePath = boundedIngestString(req.body.pagePath, MAX_INGEST_URL_LEN);
      const helpful = req.body.helpful as 'yes' | 'no';
      const message =
        typeof req.body.message === 'string' ? req.body.message : undefined;
      const pageTitle =
        typeof req.body.pageTitle === 'string' ? req.body.pageTitle : undefined;

      const result = await recordDocsFeedback({
        pagePath,
        helpful,
        visitorId,
        message,
        pageTitle,
      });

      if (!result.success) {
        res.status(409).json({
          success: false,
          error: result.error,
          correlationId: req.id,
        });
        return;
      }

      res.status(201).json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
