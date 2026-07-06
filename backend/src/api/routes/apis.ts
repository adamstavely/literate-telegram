import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../../middleware/auth.js';
import { outboundRateLimiter } from '../../middleware/rate-limit.js';
import { auditAction } from '../../middleware/audit.js';
import { config } from '../../config/index.js';
import { safeFetch } from '../../services/net-guard.js';
import { importSpecFromText } from '../../services/openapi-import.js';
import { HttpError } from '../../middleware/error-handler.js';

const router = Router();

// Authoring APIs from an existing spec is an authenticated action.
router.use(requireAuth);

// POST /api/apis/import — parse an OpenAPI 3.x / Swagger 2.0 spec (fetched from a
// URL, or pasted) into an Api draft used to pre-fill the register wizard. The
// draft is NOT persisted. URL fetches go through the SSRF-guarded safeFetch; the
// pasted-spec path is bounded by the global 1mb JSON body limit.
router.post(
  '/import',
  outboundRateLimiter,
  [
    body('url').optional().isString().trim().isLength({ max: 2048 }),
    body('spec').optional().isString().isLength({ max: 1_000_000 }),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation Error', details: errors.array(), correlationId: req.id });
      return;
    }

    const { url, spec } = req.body as { url?: string; spec?: string };
    if (!url && !spec) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Provide either a spec URL ("url") or the raw spec text ("spec").',
        correlationId: req.id,
      });
      return;
    }

    try {
      let specText: string;
      let source: string;

      if (spec) {
        specText = spec;
        source = 'paste';
      } else {
        const result = await safeFetch(url!, { maxBytes: config.outbound.maxSpecBytes });
        if (result.status >= 400) {
          throw new HttpError(502, `Could not fetch spec (upstream responded ${result.status})`);
        }
        specText = result.bodyText;
        source = new URL(result.finalUrl).host;
      }

      const draft = await importSpecFromText(specText);

      await auditAction(req, 'IMPORT_OPENAPI', draft.name ?? 'openapi', {
        source,
        endpoints: draft.endpoints.length,
        style: draft.style,
      });

      res.json({ draft });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
