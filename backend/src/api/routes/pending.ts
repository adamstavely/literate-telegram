import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { auditAction } from '../../middleware/audit.js';
import { PendingEntry, RegistryEntry, RiskLevel } from '../../types/index.js';
import { logger } from '../../logger/logger.js';

const router = Router();

// All routes require authentication + admin role
router.use(requireAuth, requireAdmin);

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
      // Fetch the pending entry
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

      const entry = pending.entry as RegistryEntry;
      const now = new Date().toISOString();

      // Index into the registry
      await esClient.index({
        index: INDEX_NAMES.REGISTRY,
        id: entry.id,
        document: {
          ...entry,
          verified: true,
          updatedAt: now,
        },
        refresh: 'wait_for',
      });

      // Update pending entry status
      await esClient.update({
        index: INDEX_NAMES.PENDING,
        id: pendingHit._id,
        doc: {
          status: 'approved',
          approvedBy: req.user!.sub,
          approvedAt: now,
        },
        refresh: 'wait_for',
      });

      await auditAction(req, 'APPROVE_ENTRY', id, {
        entryId: entry.id,
        entryType: entry.type,
        entryName: entry.name,
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
