import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { requireAuth } from '../../middleware/auth.js';
import { outboundRateLimiter } from '../../middleware/rate-limit.js';
import { auditAction } from '../../middleware/audit.js';
import { HttpError } from '../../middleware/error-handler.js';
import { safeFetch } from '../../services/net-guard.js';
import { entryVisibleToCaller } from '../../services/visibility.js';
import { isEsNotFound } from '../../services/slug-locks.js';
import { Api } from '../../types/index.js';

const router = Router();

router.use(requireAuth);

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
// Only these client-supplied headers are forwarded upstream.
const FORWARDABLE_HEADERS = new Set(['authorization', 'content-type', 'accept']);
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * POST /api/proxy — execute a real request against a registered API's own host
 * on behalf of the "Try it out" console. SSRF-safe: the target is reconstructed
 * server-side from the *stored* entry baseUrl (the client only supplies a
 * relative path + values), the host is pinned, and net-guard blocks private
 * addresses. Upstream credentials are forwarded per-request and never persisted
 * or logged.
 */
router.post(
  '/',
  outboundRateLimiter,
  [
    body('entryId').isString().trim().isLength({ min: 1, max: 256 }),
    body('method').isString().trim().isLength({ max: 10 }),
    body('path').isString().isLength({ max: 4096 }),
    body('query').optional().isObject(),
    body('headers').optional().isObject(),
    body('body').optional().isString().isLength({ max: 100_000 }),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation Error', details: errors.array(), correlationId: req.id });
      return;
    }

    const {
      entryId,
      method: rawMethod,
      path,
      query,
      headers: clientHeaders,
      body: reqBody,
    } = req.body as {
      entryId: string;
      method: string;
      path: string;
      query?: Record<string, unknown>;
      headers?: Record<string, unknown>;
      body?: string;
    };

    try {
      const method = rawMethod.toUpperCase();
      if (!ALLOWED_METHODS.has(method)) {
        throw new HttpError(400, `Unsupported method: ${rawMethod}`);
      }

      // Load the registered entry and confirm the caller may see it.
      let entry: Api;
      try {
        const doc = await esClient.get<Api>({ index: INDEX_NAMES.REGISTRY, id: entryId });
        if (!doc._source) throw new HttpError(404, 'Entry not found');
        entry = doc._source;
      } catch (err) {
        if (isEsNotFound(err)) throw new HttpError(404, 'Entry not found');
        throw err;
      }
      if (entry.type !== 'api' || !entryVisibleToCaller(entry, req)) {
        throw new HttpError(404, 'Entry not found');
      }
      if (!entry.baseUrl) {
        throw new HttpError(422, 'This API has no base URL configured, so live requests are unavailable.');
      }

      // Reconstruct the target from the STORED baseUrl + a relative path. Reject
      // absolute/protocol-relative paths so the client cannot retarget the host.
      // (A `..` in the path can reach other paths on the SAME host — intentional:
      // the console proxies arbitrary paths on the registered API's own host, the
      // same as calling that API directly; the host itself is pinned below.)
      if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) {
        throw new HttpError(400, 'Path must be relative to the API base URL');
      }
      const base = new URL(entry.baseUrl);
      const basePath = base.pathname.replace(/\/$/, '');
      // Empty path (e.g. GraphQL) targets the base URL itself — no trailing slash.
      const relPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
      const target = new URL(`${base.origin}${basePath}${relPath}`);
      if (query) {
        for (const [k, v] of Object.entries(query)) {
          if (v !== undefined && v !== null) target.searchParams.append(k, String(v));
        }
      }

      // Forward only an allowlisted subset of client headers (never cookies/host).
      const forwardHeaders: Record<string, string> = {};
      if (clientHeaders) {
        for (const [k, v] of Object.entries(clientHeaders)) {
          if (FORWARDABLE_HEADERS.has(k.toLowerCase()) && typeof v === 'string') {
            forwardHeaders[k] = v;
          }
        }
      }
      const sendBody = WRITE_METHODS.has(method) ? reqBody : undefined;
      if (sendBody && !Object.keys(forwardHeaders).some((h) => h.toLowerCase() === 'content-type')) {
        forwardHeaders['Content-Type'] = 'application/json';
      }

      const started = Date.now();
      const result = await safeFetch(target.toString(), {
        method,
        headers: forwardHeaders,
        body: sendBody,
        pinnedHost: base.host,
        maxRedirects: 0, // upstream redirects off-host are not followed for the console
      });
      const ms = Date.now() - started;

      // Audit the attempt WITHOUT any credential material.
      await auditAction(req, 'API_PROXY', entryId, {
        host: base.host,
        method,
        path: relPath,
        status: result.status,
        ms,
      });

      res.json({
        status: result.status,
        statusText: result.statusText,
        headers: { 'content-type': result.headers.get('content-type') ?? undefined },
        body: result.bodyText,
        truncated: result.truncated,
        ms,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
