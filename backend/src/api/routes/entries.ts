import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { SortOrder } from '@elastic/elasticsearch/lib/api/types.js';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { requireAuth } from '../../middleware/auth.js';
import { auditAction } from '../../middleware/audit.js';
import {
  RegistryEntry,
  PendingEntry,
  SearchParams,
  SearchResult,
  EntryType,
  RiskLevel,
} from '../../types/index.js';
import { logger } from '../../logger/logger.js';

const router = Router();

function buildSortClause(sort?: string): Array<Record<string, { order: SortOrder }>> {
  switch (sort) {
    case 'installs':
      return [{ installs: { order: 'desc' } }];
    case 'rating':
      return [{ rating: { order: 'desc' } }, { installs: { order: 'desc' } }];
    case 'recent':
      return [{ updatedAt: { order: 'desc' } }];
    case 'name':
      return [{ 'name.keyword': { order: 'asc' } }];
    default:
      return [{ installs: { order: 'desc' } }, { updatedAt: { order: 'desc' } }];
  }
}

function assessRisk(entry: Partial<RegistryEntry>): { risk: RiskLevel; flags: string[] } {
  const flags: string[] = [];
  let riskScore = 0;

  if (entry.type === 'agent') {
    const agent = entry as { autonomy?: string };
    if (agent.autonomy === 'full') { riskScore += 3; flags.push('full-autonomy'); }
    if (agent.autonomy === 'high') { riskScore += 2; flags.push('high-autonomy'); }
  }

  if (entry.sensitivity === 'restricted') { riskScore += 3; flags.push('restricted-data'); }
  if (entry.sensitivity === 'confidential') { riskScore += 2; flags.push('confidential-data'); }

  const server = entry as { auth?: string };
  if (server.auth === 'none') { riskScore += 1; flags.push('no-auth'); }

  let risk: RiskLevel;
  if (riskScore >= 4) risk = 'critical';
  else if (riskScore >= 3) risk = 'high';
  else if (riskScore >= 1) risk = 'medium';
  else risk = 'low';

  return { risk, flags };
}

// GET /api/entries - search and list
router.get(
  '/',
  [
    query('q').optional().isString().trim(),
    query('type').optional().isIn(['server', 'tool', 'skill', 'agent', 'api']),
    query('category').optional().isString().trim(),
    query('client').optional().isString().trim(),
    query('sort').optional().isIn(['installs', 'recent', 'rating', 'name']),
    query('page').optional().isInt({ min: 0 }).toInt(),
    query('size').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation Error', details: errors.array(), correlationId: req.id });
      return;
    }

    const params: SearchParams = {
      q: req.query['q'] as string | undefined,
      type: req.query['type'] as EntryType | undefined,
      category: req.query['category'] as string | undefined,
      client: req.query['client'] as string | undefined,
      sort: req.query['sort'] as SearchParams['sort'],
      page: (req.query['page'] as unknown as number | undefined) ?? 0,
      size: (req.query['size'] as unknown as number | undefined) ?? 20,
    };

    try {
      const page = params.page ?? 0;
      const size = params.size ?? 20;
      const from = page * size;

      const mustClauses: Record<string, unknown>[] = [];
      const filterClauses: Record<string, unknown>[] = [];

      if (params.q) {
        mustClauses.push({
          multi_match: {
            query: params.q,
            fields: ['name^3', 'summary^2', 'description', 'publisher'],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        });
      }

      if (params.type) {
        filterClauses.push({ term: { type: params.type } });
      }

      if (params.category) {
        filterClauses.push({ term: { categories: params.category } });
      }

      if (params.client) {
        filterClauses.push({ term: { clients: params.client } });
      }

      const boolQuery: Record<string, unknown> = {};
      if (mustClauses.length > 0) boolQuery['must'] = mustClauses;
      if (filterClauses.length > 0) boolQuery['filter'] = filterClauses;
      if (mustClauses.length === 0) boolQuery['must'] = [{ match_all: {} }];

      const response = await esClient.search<RegistryEntry>({
        index: INDEX_NAMES.REGISTRY,
        from,
        size,
        sort: buildSortClause(params.sort),
        query: { bool: boolQuery },
      });

      const total = typeof response.hits.total === 'number'
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

      const result: SearchResult<RegistryEntry> = {
        hits: response.hits.hits
          .map((h) => h._source)
          .filter((s): s is RegistryEntry => s !== undefined),
        total,
        page,
        size,
      };

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/entries/stats - aggregate stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const response = await esClient.search({
      index: INDEX_NAMES.REGISTRY,
      size: 0,
      aggs: {
        by_type: {
          terms: { field: 'type', size: 10 },
        },
        total_installs: {
          sum: { field: 'installs' },
        },
        verified_count: {
          filter: { term: { verified: true } },
        },
      },
    });

    const aggs = response.aggregations ?? {};

    interface TermsBucket { key: string; doc_count: number }
    interface TermsAgg { buckets: TermsBucket[] }
    interface SumAgg { value: number }
    interface FilterAgg { doc_count: number }

    const byTypeBuckets = (aggs['by_type'] as TermsAgg)?.buckets ?? [];
    const totalInstalls = (aggs['total_installs'] as SumAgg)?.value ?? 0;
    const verifiedCount = (aggs['verified_count'] as FilterAgg)?.doc_count ?? 0;

    const totalByType: Record<string, number> = {};
    for (const bucket of byTypeBuckets) {
      totalByType[bucket.key] = bucket.doc_count;
    }

    const totalEntries = typeof response.hits.total === 'number'
      ? response.hits.total
      : (response.hits.total?.value ?? 0);

    res.json({
      totalByType,
      totalInstalls,
      verifiedCount,
      totalEntries,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/entries/:type/:slug - get single entry
router.get(
  '/:type/:slug',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { type, slug } = req.params as { type: string; slug: string };

    const validTypes: EntryType[] = ['server', 'tool', 'skill', 'agent', 'api'];
    if (!validTypes.includes(type as EntryType)) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Invalid type: ${type}`,
        correlationId: req.id,
      });
      return;
    }

    try {
      const response = await esClient.search<RegistryEntry>({
        index: INDEX_NAMES.REGISTRY,
        size: 1,
        query: {
          bool: {
            filter: [
              { term: { type } },
              { term: { slug } },
            ],
          },
        },
      });

      const hit = response.hits.hits[0];
      if (!hit?._source) {
        res.status(404).json({
          error: 'Not Found',
          message: `Entry not found: ${type}/${slug}`,
          correlationId: req.id,
        });
        return;
      }

      res.json(hit._source);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/entries - submit new entry
router.post(
  '/',
  requireAuth,
  [
    body('type').isIn(['server', 'tool', 'skill', 'agent', 'api']).withMessage('Invalid entry type'),
    body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('slug').isString().trim().matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase alphanumeric with hyphens'),
    body('publisher').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Publisher is required'),
    body('summary').isString().trim().isLength({ min: 10, max: 500 }).withMessage('Summary must be 10-500 characters'),
    body('description').isString().trim().isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
    body('sensitivity').isIn(['public', 'internal', 'confidential', 'restricted']).withMessage('Invalid sensitivity level'),
    body('categories').isArray({ min: 1 }).withMessage('At least one category required'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: 'Validation Error', details: errors.array(), correlationId: req.id });
      return;
    }

    try {
      const now = new Date().toISOString();
      const entryId = uuidv4();

      const partialEntry: Partial<RegistryEntry> = {
        ...(req.body as Partial<RegistryEntry>),
        id: entryId,
        verified: false,
        installs: 0,
        createdAt: now,
        updatedAt: now,
      };

      const { risk, flags } = assessRisk(partialEntry);

      const pending: PendingEntry = {
        id: uuidv4(),
        entry: partialEntry,
        submittedBy: req.user!.sub,
        submittedAt: now,
        status: 'pending',
        risk,
        flags,
      };

      await esClient.index({
        index: INDEX_NAMES.PENDING,
        id: pending.id,
        document: pending,
        refresh: 'wait_for',
      });

      await auditAction(req, 'SUBMIT_ENTRY', pending.id, {
        entryType: partialEntry.type,
        name: partialEntry.name,
        risk,
      });

      logger.info('New entry submitted', {
        correlationId: req.id,
        userId: req.user?.sub,
        pendingId: pending.id,
        entryType: partialEntry.type,
        risk,
      });

      res.status(202).json({
        id: pending.id,
        status: 'pending',
        risk,
        flags,
        message: 'Entry submitted for review',
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
