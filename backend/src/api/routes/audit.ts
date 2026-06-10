import { Router, Request, Response, NextFunction } from 'express';
import { query, validationResult } from 'express-validator';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { AuditEvent } from '../../types/index.js';

const router = Router();

// All audit log routes require admin
router.use(requireAuth, requireAdmin);

// GET /api/audit - query audit log
router.get(
  '/',
  [
    query('userId').optional().isString().trim(),
    query('action').optional().isString().trim(),
    query('resource').optional().isString().trim(),
    query('result').optional().isIn(['success', 'failure']),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 0 }).toInt(),
    query('size').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation Error', details: errors.array(), correlationId: req.id });
      return;
    }

    try {
      const page = parseInt(req.query['page'] as string ?? '0', 10) || 0;
      const size = parseInt(req.query['size'] as string ?? '50', 10) || 50;
      const from = page * size;

      const filterClauses: Record<string, unknown>[] = [];

      const userId = req.query['userId'] as string | undefined;
      if (userId) {
        filterClauses.push({ term: { userId } });
      }

      const action = req.query['action'] as string | undefined;
      if (action) {
        filterClauses.push({ wildcard: { action: `*${action}*` } });
      }

      const resource = req.query['resource'] as string | undefined;
      if (resource) {
        filterClauses.push({ term: { resource } });
      }

      const result = req.query['result'] as string | undefined;
      if (result) {
        filterClauses.push({ term: { result } });
      }

      const fromDate = req.query['from'] as string | undefined;
      const toDate = req.query['to'] as string | undefined;
      if (fromDate || toDate) {
        const rangeClause: Record<string, string> = {};
        if (fromDate) rangeClause['gte'] = fromDate;
        if (toDate) rangeClause['lte'] = toDate;
        filterClauses.push({ range: { timestamp: rangeClause } });
      }

      const boolQuery: Record<string, unknown> = {
        must: [{ match_all: {} }],
      };
      if (filterClauses.length > 0) {
        boolQuery['filter'] = filterClauses;
      }

      const response = await esClient.search<AuditEvent>({
        index: INDEX_NAMES.AUDIT,
        from,
        size,
        sort: [{ timestamp: { order: 'desc' } }],
        query: { bool: boolQuery },
      });

      const total = typeof response.hits.total === 'number'
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

      const hits = response.hits.hits
        .map((h) => h._source)
        .filter((s): s is AuditEvent => s !== undefined);

      res.json({ hits, total, page, size });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
