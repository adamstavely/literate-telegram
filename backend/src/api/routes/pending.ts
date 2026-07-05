import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { auditAction } from '../../middleware/audit.js';
import { PendingEntry, PendingStats, RegistryEntry, RiskLevel } from '../../types/index.js';
import { logger } from '../../logger/logger.js';
import { getPolicy, evaluatePolicyEnforcement } from '../../services/policy.js';
import { sanitizeSubmission } from '../../services/entry-dto.js';

const router = Router();

/** True if an Elasticsearch error is an optimistic-locking version conflict. */
function isVersionConflict(err: unknown): boolean {
  const e = err as { statusCode?: number; meta?: { statusCode?: number } };
  return e?.statusCode === 409 || e?.meta?.statusCode === 409;
}

// All routes require authentication + admin role
router.use(requireAuth, requireAdmin);

// GET /api/pending/stats - moderation KPIs
router.get('/stats', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [pendingRes, approvedRes, weekRes, highRiskRes, reviewRes] = await Promise.all([
      esClient.count({
        index: INDEX_NAMES.PENDING,
        query: { term: { status: 'pending' } },
      }),
      esClient.count({
        index: INDEX_NAMES.PENDING,
        query: { term: { status: 'approved' } },
      }),
      esClient.count({
        index: INDEX_NAMES.PENDING,
        query: {
          bool: {
            filter: [
              { term: { status: 'approved' } },
              { range: { approvedAt: { gte: weekAgo } } },
            ],
          },
        },
      }),
      esClient.count({
        index: INDEX_NAMES.PENDING,
        query: {
          bool: {
            filter: [
              { term: { status: 'pending' } },
              { terms: { risk: ['high', 'critical'] } },
            ],
          },
        },
      }),
      esClient.search<PendingEntry>({
        index: INDEX_NAMES.PENDING,
        size: 200,
        _source: ['submittedAt', 'approvedAt'],
        query: { term: { status: 'approved' } },
        sort: [{ approvedAt: { order: 'desc' } }],
      }),
    ]);

    let avgReviewTimeMinutes: number | null = null;
    const durations: number[] = [];
    for (const hit of reviewRes.hits.hits) {
      const src = hit._source;
      if (src?.submittedAt && src.approvedAt) {
        const ms = new Date(src.approvedAt).getTime() - new Date(src.submittedAt).getTime();
        if (ms > 0) durations.push(ms);
      }
    }
    if (durations.length > 0) {
      const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
      avgReviewTimeMinutes = Math.round(avgMs / 60_000);
    }

    const stats: PendingStats = {
      pendingCount: pendingRes.count,
      approvedCount: approvedRes.count,
      approvedThisWeek: weekRes.count,
      avgReviewTimeMinutes,
      highRiskPending: highRiskRes.count,
    };

    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/pending - list pending submissions
router.get(
  '/',
  [
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
    query('type').optional().isIn(['server', 'tool', 'skill', 'agent', 'api']),
    query('risk').optional().isIn(['low', 'medium', 'high', 'critical']),
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
      const size = parseInt(req.query['size'] as string ?? '20', 10) || 20;
      const from = page * size;

      const filterClauses: Record<string, unknown>[] = [];

      const status = req.query['status'] as string | undefined;
      if (status) {
        filterClauses.push({ term: { status } });
      } else {
        // Default to pending only
        filterClauses.push({ term: { status: 'pending' } });
      }

      const type = req.query['type'] as string | undefined;
      if (type) {
        filterClauses.push({ term: { 'entry.type': type } });
      }

      const risk = req.query['risk'] as RiskLevel | undefined;
      if (risk) {
        filterClauses.push({ term: { risk } });
      }

      const response = await esClient.search<PendingEntry>({
        index: INDEX_NAMES.PENDING,
        from,
        size,
        sort: [
          { risk: { order: 'desc' } },
          { submittedAt: { order: 'asc' } },
        ],
        query: {
          bool: {
            filter: filterClauses,
          },
        },
      });

      const total = typeof response.hits.total === 'number'
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

      const hits = response.hits.hits
        .map((h) => h._source)
        .filter((s): s is PendingEntry => s !== undefined);

      res.json({ hits, total, page, size });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/pending/:id/approve - approve a pending submission
router.put(
  '/:id/approve',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params as { id: string };

    try {
      // Fetch the pending entry, requesting seq_no/primary_term so we can apply
      // optimistic locking on the write and prevent two concurrent approvers
      // from both publishing the same entry.
      const pendingResponse = await esClient.search<PendingEntry>({
        index: INDEX_NAMES.PENDING,
        size: 1,
        seq_no_primary_term: true,
        query: { bool: { filter: [{ term: { id } }] } },
      });

      const pendingHit = pendingResponse.hits.hits[0];
      if (!pendingHit?._source || !pendingHit._id) {
        res.status(404).json({
          error: 'Not Found',
          message: `Pending entry not found: ${id}`,
          correlationId: req.id,
        });
        return;
      }

      const pending = pendingHit._source;
      const seqNo = pendingHit._seq_no;
      const primaryTerm = pendingHit._primary_term;

      if (pending.status !== 'pending') {
        res.status(409).json({
          error: 'Conflict',
          message: `Entry is already ${pending.status}`,
          correlationId: req.id,
        });
        return;
      }

      const entry = pending.entry as RegistryEntry;
      const now = new Date().toISOString();
      const approver = req.user!.sub;
      const body = (req.body ?? {}) as { override?: unknown; overrideReason?: unknown };
      const override = body.override === true;
      const overrideReason =
        typeof body.overrideReason === 'string' ? body.overrideReason.trim() : '';

      // Enforce the active governance policy at approval time. Without this the
      // Policy page toggles and per-rule actions are purely cosmetic.
      const policyDoc = await getPolicy();
      const enforcement = evaluatePolicyEnforcement(pending.entry, policyDoc);

      // 'reject'-action rules are a hard stop — the entry must be rejected.
      if (enforcement.rejectRules.length > 0) {
        res.status(422).json({
          error: 'Policy Violation',
          message: 'Entry violates a reject-level policy rule and cannot be approved.',
          blockedBy: enforcement.rejectRules,
          risk: enforcement.risk,
          correlationId: req.id,
        });
        return;
      }

      // 'block'-action rules and quarantine require an explicit admin override.
      const blockedReasons = [
        ...enforcement.blockRules,
        ...(enforcement.quarantined ? ['Quarantine: high-risk entry'] : []),
      ];
      if (blockedReasons.length > 0) {
        if (!override) {
          res.status(409).json({
            error: 'Policy Block',
            message:
              'Approval is blocked by policy. Resubmit with { "override": true, "overrideReason": "..." } to force-approve.',
            blockedBy: blockedReasons,
            risk: enforcement.risk,
            correlationId: req.id,
          });
          return;
        }
        // A force-approve must be justified — no silent overrides.
        if (overrideReason.length < 10) {
          res.status(422).json({
            error: 'Validation Error',
            message: 'A policy override requires an overrideReason of at least 10 characters.',
            blockedBy: blockedReasons,
            correlationId: req.id,
          });
          return;
        }
      }

      // Two-approver requirement for high/critical risk: record this approver's
      // vote and hold the entry until a second, distinct approver signs off.
      if (enforcement.requiresTwoApprovers) {
        const approvals = new Set(pending.approvals ?? []);
        approvals.add(approver);
        if (approvals.size < 2) {
          try {
            await esClient.update({
              index: INDEX_NAMES.PENDING,
              id: pendingHit._id,
              doc: { approvals: [...approvals] },
              if_seq_no: seqNo,
              if_primary_term: primaryTerm,
              refresh: 'wait_for',
            });
          } catch (e) {
            if (isVersionConflict(e)) {
              res.status(409).json({
                error: 'Conflict',
                message: 'Entry was modified concurrently. Please retry.',
                correlationId: req.id,
              });
              return;
            }
            throw e;
          }

          await auditAction(req, 'APPROVE_ENTRY_VOTE', id, {
            entryId: entry.id,
            approvals: approvals.size,
            required: 2,
          });

          res.status(202).json({
            id,
            status: 'pending',
            approvals: approvals.size,
            required: 2,
            message: 'Approval recorded. A second distinct approver is required.',
          });
          return;
        }
      }

      const finalApprovals = enforcement.requiresTwoApprovers
        ? [...new Set([...(pending.approvals ?? []), approver])]
        : undefined;
      const wasOverridden = blockedReasons.length > 0;

      // Claim the approval first under an optimistic lock. If another approver
      // won the race the version conflicts and we stop before touching the
      // registry, so the entry is published exactly once.
      try {
        await esClient.update({
          index: INDEX_NAMES.PENDING,
          id: pendingHit._id,
          doc: {
            status: 'approved',
            approvedBy: approver,
            approvedAt: now,
            policyOverride: wasOverridden,
            ...(wasOverridden ? { overrideReason } : {}),
            ...(finalApprovals ? { approvals: finalApprovals } : {}),
          },
          if_seq_no: seqNo,
          if_primary_term: primaryTerm,
          refresh: 'wait_for',
        });
      } catch (e) {
        if (isVersionConflict(e)) {
          res.status(409).json({
            error: 'Conflict',
            message: 'Entry was approved or modified concurrently. Please retry.',
            correlationId: req.id,
          });
          return;
        }
        throw e;
      }

      // Re-sanitize the stored blob before publishing — never trust a pending
      // document (it may predate the allowlist or have been tampered with).
      const publishedEntry = {
        ...sanitizeSubmission(entry as unknown as Record<string, unknown>),
        id: entry.id,
        verified: true,
        installs: entry.installs ?? 0,
        createdAt: entry.createdAt ?? now,
        updatedAt: now,
      };

      // Publish to the registry.
      await esClient.index({
        index: INDEX_NAMES.REGISTRY,
        id: entry.id,
        document: publishedEntry,
        refresh: 'wait_for',
      });

      await auditAction(req, 'APPROVE_ENTRY', id, {
        entryId: entry.id,
        entryType: entry.type,
        entryName: entry.name,
        risk: enforcement.risk,
        policyOverride: wasOverridden,
        overrideReason: wasOverridden ? overrideReason : undefined,
        overriddenBlocks: wasOverridden ? blockedReasons : undefined,
      });

      logger.info('Pending entry approved', {
        correlationId: req.id,
        userId: req.user?.sub,
        pendingId: id,
        entryId: entry.id,
        entryType: entry.type,
      });

      res.json({
        id,
        status: 'approved',
        entryId: entry.id,
        message: 'Entry approved and published to registry',
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/pending/:id/reject - reject a pending submission
router.put(
  '/:id/reject',
  [
    body('reason').isString().trim().isLength({ min: 10, max: 1000 }).withMessage('Rejection reason must be 10-1000 characters'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: 'Validation Error', details: errors.array(), correlationId: req.id });
      return;
    }

    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason: string };

    try {
      const pendingResponse = await esClient.search<PendingEntry>({
        index: INDEX_NAMES.PENDING,
        size: 1,
        query: { bool: { filter: [{ term: { id } }] } },
      });

      const pendingHit = pendingResponse.hits.hits[0];
      if (!pendingHit?._source || !pendingHit._id) {
        res.status(404).json({
          error: 'Not Found',
          message: `Pending entry not found: ${id}`,
          correlationId: req.id,
        });
        return;
      }

      const pending = pendingHit._source;

      if (pending.status !== 'pending') {
        res.status(409).json({
          error: 'Conflict',
          message: `Entry is already ${pending.status}`,
          correlationId: req.id,
        });
        return;
      }

      const now = new Date().toISOString();

      await esClient.update({
        index: INDEX_NAMES.PENDING,
        id: pendingHit._id,
        doc: {
          status: 'rejected',
          rejectReason: reason,
          rejectedBy: req.user!.sub,
          rejectedAt: now,
        },
        refresh: 'wait_for',
      });

      await auditAction(req, 'REJECT_ENTRY', id, {
        reason,
        entryType: pending.entry.type,
        entryName: pending.entry.name,
      });

      logger.info('Pending entry rejected', {
        correlationId: req.id,
        userId: req.user?.sub,
        pendingId: id,
        reason,
      });

      res.json({
        id,
        status: 'rejected',
        reason,
        message: 'Entry rejected',
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
