import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { SortOrder } from '@elastic/elasticsearch/lib/api/types.js';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';
import { auditAction } from '../../middleware/audit.js';
import {
  RegistryEntry,
  PendingEntry,
  SearchParams,
  SearchResult,
  EntryType,
} from '../../types/index.js';
import { logger } from '../../logger/logger.js';
import { getPolicy, assessRiskWithPolicy, applySubmissionPolicy, reviewDueAt } from '../../services/policy.js';
import { sanitizeSubmission } from '../../services/entry-dto.js';
import { slugTaken, claimSlug, releaseSlug } from '../../services/slug-locks.js';
import { claimOrOwnRegistrySlug, releaseRegistrySlug } from '../../services/registry-slugs.js';
import { runCompensation } from '../../services/compensation.js';
import { submitRateLimiter } from '../../middleware/rate-limit.js';
import { registryVisibilityFilter, entryVisibleToCaller } from '../../services/visibility.js';
import { clampPage, paginationFrom } from '../../services/pagination.js';

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

// GET /api/entries - search and list
router.get(
  '/',
  optionalAuth,
  [
    query('q').optional().isString().trim().isLength({ max: 200 }),
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
      const size = params.size ?? 20;
      const page = clampPage(params.page ?? 0, size);
      const from = paginationFrom(page, size);

      const mustClauses: Record<string, unknown>[] = [];
      const filterClauses: Record<string, unknown>[] = [];

      if (params.q) {
        const qMatch: Record<string, unknown> = {
          query: params.q,
          fields: ['name^3', 'summary^2', 'description', 'publisher'],
          type: 'best_fields',
        };
        // Short queries produce noisy fuzzy matches — require exact tokens.
        if (params.q.length >= 3) {
          qMatch['fuzziness'] = 'AUTO';
        }
        mustClauses.push({ multi_match: qMatch });
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

      filterClauses.push(registryVisibilityFilter(req));

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
router.get('/stats', optionalAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const response = await esClient.search({
      index: INDEX_NAMES.REGISTRY,
      size: 0,
      query: { bool: { filter: [registryVisibilityFilter(req)] } },
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
  optionalAuth,
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
              registryVisibilityFilter(req),
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

      if (!entryVisibleToCaller(hit._source, req)) {
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
  submitRateLimiter,
  [
    body('type').isIn(['server', 'tool', 'skill', 'agent', 'api']).withMessage('Invalid entry type'),
    body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('slug').isString().trim().matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase alphanumeric with hyphens'),
    body('publisher').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Publisher is required'),
    body('summary').isString().trim().isLength({ min: 10, max: 500 }).withMessage('Summary must be 10-500 characters'),
    body('description').isString().trim().isLength({ min: 20, max: 10000 }).withMessage('Description must be 20-10000 characters'),
    body('sensitivity').isIn(['public', 'internal', 'confidential', 'restricted']).withMessage('Invalid sensitivity level'),
    body('categories').isArray({ min: 1, max: 20 }).withMessage('Provide 1-20 categories'),
    body('categories.*').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Each category must be 1-50 characters'),
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

      // Build the entry from an explicit allowlist rather than spreading the
      // raw body — otherwise unvalidated/nested fields (verified, rating,
      // arbitrary keys) leak through into the dynamically-mapped pending index.
      const sanitized: Partial<RegistryEntry> = {
        ...sanitizeSubmission(req.body as Record<string, unknown>),
        id: entryId,
        verified: false,
        installs: 0,
        createdAt: now,
        updatedAt: now,
      };

      // Apply submit-time policy (read-only defaults, token cap, auto-approve).
      const policyDoc = await getPolicy(true);
      const decision = applySubmissionPolicy(sanitized, policyDoc);
      const partialEntry = decision.entry;
      const { risk, flags: riskFlags } = assessRiskWithPolicy(partialEntry, policyDoc);
      const flags = [...new Set([...riskFlags, ...decision.flags])];

      // Reject-action rules fail closed at submission — don't waste moderator
      // time queuing an entry that can never be approved.
      if (decision.rejectRules.length > 0) {
        res.status(422).json({
          error: 'Policy Violation',
          message: 'Submission violates a reject-level policy rule and was not accepted.',
          blockedBy: decision.rejectRules,
          risk,
          correlationId: req.id,
        });
        return;
      }

      // Reject duplicate type+slug before creating anything.
      if (partialEntry.type && partialEntry.slug && (await slugTaken(partialEntry.type, partialEntry.slug))) {
        res.status(409).json({
          error: 'Conflict',
          message: `An entry with slug "${partialEntry.slug}" already exists for type "${partialEntry.type}".`,
          correlationId: req.id,
        });
        return;
      }

      if (decision.autoApprove) {
        // Policy allows immediate publication — skip the review queue.
        const dueAt = reviewDueAt(policyDoc, now);
        const entryType = partialEntry.type!;
        const entrySlug = partialEntry.slug!;

        if (!(await claimSlug(entryType, entrySlug, entryId))) {
          res.status(409).json({
            error: 'Conflict',
            message: `An entry with slug "${entrySlug}" already exists for type "${entryType}".`,
            correlationId: req.id,
          });
          return;
        }

        if (!(await claimOrOwnRegistrySlug(entryType, entrySlug, entryId))) {
          await releaseSlug(entryType, entrySlug, entryId);
          res.status(409).json({
            error: 'Conflict',
            message: `An entry with slug "${entrySlug}" already exists for type "${entryType}".`,
            correlationId: req.id,
          });
          return;
        }

        try {
          await esClient.index({
            index: INDEX_NAMES.REGISTRY,
            id: entryId,
            document: {
              ...partialEntry,
              verified: true,
              updatedAt: now,
              ...(dueAt ? { reviewDueAt: dueAt } : {}),
            },
            refresh: 'wait_for',
          });
        } catch (indexErr) {
          await releaseRegistrySlug(entryType, entrySlug, entryId);
          await releaseSlug(entryType, entrySlug, entryId);
          throw indexErr;
        }

        const autoApproved: PendingEntry = {
          id: uuidv4(),
          entry: partialEntry,
          submittedBy: req.user!.sub,
          submittedAt: now,
          status: 'approved',
          risk,
          flags,
          approvedBy: 'system:policy',
          approvedAt: now,
        };

        try {
          await esClient.index({
            index: INDEX_NAMES.PENDING,
            id: autoApproved.id,
            document: autoApproved,
            refresh: 'wait_for',
          });
        } catch (indexErr) {
          const rolledBack = await runCompensation(
            'auto-approve:rollback-registry',
            async () => {
              await esClient.delete({ index: INDEX_NAMES.REGISTRY, id: entryId, refresh: 'wait_for' });
              await releaseRegistrySlug(entryType, entrySlug, entryId);
            },
            { entryId, type: entryType, slug: entrySlug },
          );
          if (!rolledBack) {
            // The registry doc is still live with no pending record, and rollback
            // exhausted its retries. Keep the slug lock (a live entry still owns
            // it) and tell the caller the stores diverged rather than returning
            // an opaque 500 that hides the need for manual reconciliation.
            logger.error('Auto-approve rollback failed; registry may hold an orphaned entry', {
              correlationId: req.id,
              entryId,
              entryType,
            });
            res.status(500).json({
              error: 'Internal Server Error',
              message:
                'Entry was published but recording its approval failed, and automatic rollback did not complete. This entry requires manual reconciliation.',
              reconciliation: 'required',
              entryId,
              correlationId: req.id,
            });
            return;
          }
          await releaseSlug(entryType, entrySlug, entryId);
          throw indexErr;
        }

        await auditAction(req, 'AUTO_APPROVE_ENTRY', autoApproved.id, {
          entryId,
          entryType: partialEntry.type,
          name: partialEntry.name,
          risk,
        });

        logger.info('New entry auto-approved by policy', {
          correlationId: req.id,
          userId: req.user?.sub,
          pendingId: autoApproved.id,
          entryId,
          entryType: partialEntry.type,
          risk,
        });

        await releaseSlug(entryType, entrySlug, entryId);

        res.status(201).json({
          id: autoApproved.id,
          entryId,
          status: 'approved',
          risk,
          flags,
          message: 'Entry auto-approved and published per policy',
        });
        return;
      }

      const pending: PendingEntry = {
        id: uuidv4(),
        entry: partialEntry,
        submittedBy: req.user!.sub,
        submittedAt: now,
        status: 'pending',
        risk,
        flags,
      };

      // Claim the slug atomically so two concurrent same-slug submissions can't
      // both enter the review queue. Released on approve/auto-approve once the
      // registry doc is live; released on reject if submission never publishes.
      const pendType = partialEntry.type!;
      const pendSlug = partialEntry.slug!;
      if (!(await claimSlug(pendType, pendSlug, entryId))) {
        res.status(409).json({
          error: 'Conflict',
          message: `An entry with slug "${pendSlug}" already exists for type "${pendType}".`,
          correlationId: req.id,
        });
        return;
      }

      try {
        await esClient.index({
          index: INDEX_NAMES.PENDING,
          id: pending.id,
          document: pending,
          refresh: 'wait_for',
        });
      } catch (indexErr) {
        await releaseSlug(pendType, pendSlug, entryId);
        throw indexErr;
      }

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
