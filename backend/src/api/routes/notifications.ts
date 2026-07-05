import { Router, Request, Response, NextFunction } from 'express';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { requireAuth } from '../../middleware/auth.js';
import { Notification, NotificationRead } from '../../types/index.js';
import { logger } from '../../logger/logger.js';
import { searchAll } from '../../elasticsearch/search-all.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

function receiptId(userId: string, notificationId: string): string {
  return `${userId}::${notificationId}`;
}

/**
 * Load this user's read/dismissal receipts. Receipts only exist for global
 * notifications (shared docs with no userId); a user's own notifications carry
 * their read state on the document itself.
 */
async function loadReceipts(userId: string): Promise<Map<string, NotificationRead>> {
  const receipts = await searchAll<NotificationRead>(
    INDEX_NAMES.NOTIFICATION_READS,
    { term: { userId } },
    { sort: [{ updatedAt: 'desc' }, { _id: 'asc' }] },
  );

  const map = new Map<string, NotificationRead>();
  for (const src of receipts) {
    map.set(src.notificationId, src);
  }
  return map;
}

async function upsertReceipt(
  userId: string,
  notificationId: string,
  patch: Partial<Pick<NotificationRead, 'read' | 'dismissed'>>,
): Promise<void> {
  const now = new Date().toISOString();
  await esClient.update({
    index: INDEX_NAMES.NOTIFICATION_READS,
    id: receiptId(userId, notificationId),
    doc: {
      userId,
      notificationId,
      read: patch.read ?? false,
      dismissed: patch.dismissed ?? false,
      updatedAt: now,
    },
    doc_as_upsert: true,
    refresh: 'wait_for',
  });
}

// GET /api/notifications - get user's notifications
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const page = Math.max(0, parseInt(req.query['page'] as string ?? '0', 10) || 0);
    // Clamp page size so a caller can't request an unbounded window.
    const rawSize = parseInt(req.query['size'] as string ?? '50', 10) || 50;
    const size = Math.min(100, Math.max(1, rawSize));
    const from = page * size;

    const receipts = await loadReceipts(userId);
    const dismissedIds = [...receipts.values()]
      .filter((r) => r.dismissed)
      .map((r) => r.notificationId);

    const mustNot: Record<string, unknown>[] = [];
    if (dismissedIds.length > 0) {
      // Hide globals this user has dismissed (own notifications are deleted, not
      // receipt-dismissed, so this only affects shared globals).
      mustNot.push({ terms: { id: dismissedIds } });
    }

    const response = await esClient.search<Notification>({
      index: INDEX_NAMES.NOTIFICATIONS,
      from,
      size,
      sort: [
        { createdAt: { order: 'desc' } },
      ],
      query: {
        bool: {
          should: [
            { term: { userId } },
            // Also return global notifications (no userId)
            {
              bool: {
                must_not: [{ exists: { field: 'userId' } }],
              },
            },
          ],
          minimum_should_match: 1,
          ...(mustNot.length > 0 ? { must_not: mustNot } : {}),
        },
      },
    });

    const total = typeof response.hits.total === 'number'
      ? response.hits.total
      : (response.hits.total?.value ?? 0);

    const hits = response.hits.hits
      .map((h) => ({ source: h._source, esId: h._id }))
      .filter((h): h is { source: Notification; esId: string } =>
        h.source !== undefined && h.esId !== undefined)
      .map(({ source }) => {
        // For global notifications the shared doc's `read` is meaningless; the
        // per-user receipt is the source of truth. Own notifications use the doc.
        // The internal ES document id (_esId) is deliberately not exposed.
        const isGlobal = source.userId === undefined || source.userId === null;
        const read = isGlobal
          ? (receipts.get(source.id)?.read ?? false)
          : source.read;
        return { ...source, read };
      });

    // Re-sort in memory: unread first, then newest first, since read state for
    // globals is overlaid after the ES query.
    hits.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });

    res.json({ hits, total, page, size });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/read-all - mark all as read (must be before /:id)
router.put('/read-all', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.sub;

    // Mark this user's own notifications read by mutating their documents.
    await esClient.updateByQuery({
      index: INDEX_NAMES.NOTIFICATIONS,
      refresh: true,
      query: {
        bool: {
          filter: [
            { term: { read: false } },
            { term: { userId } },
          ],
        },
      },
      script: {
        source: 'ctx._source.read = true',
        lang: 'painless',
      },
    });

    // Mark global notifications read via per-user receipts, never by mutating
    // the shared documents (which would clobber every other user's state).
    const globals = await searchAll<Pick<Notification, 'id'>>(
      INDEX_NAMES.NOTIFICATIONS,
      {
        bool: {
          must_not: [{ exists: { field: 'userId' } }],
        },
      },
      { source: ['id'], sort: [{ createdAt: 'desc' }, { id: 'asc' }] },
    );

    // Don't resurrect globals the user already dismissed — marking all read must
    // not clear an existing dismissal receipt.
    const receipts = await loadReceipts(userId);
    const globalIds = globals
      .map((g) => g.id)
      .filter((id) => !receipts.get(id)?.dismissed);

    if (globalIds.length > 0) {
      const now = new Date().toISOString();
      const BULK_BATCH = 500;
      for (let i = 0; i < globalIds.length; i += BULK_BATCH) {
        const batch = globalIds.slice(i, i + BULK_BATCH);
        const body = batch.flatMap((notificationId) => [
          { update: { _index: INDEX_NAMES.NOTIFICATION_READS, _id: receiptId(userId, notificationId) } },
          {
            doc: { userId, notificationId, read: true, dismissed: false, updatedAt: now },
            doc_as_upsert: true,
          },
        ]);
        await esClient.bulk({ refresh: i + BULK_BATCH >= globalIds.length, body });
      }
    }

    logger.info('All notifications marked as read', {
      correlationId: req.id,
      userId,
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/:id/read - mark single notification as read
router.put('/:id/read', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params as { id: string };

  try {
    const userId = req.user!.sub;

    // Find the notification (own or global)
    const searchResponse = await esClient.search<Notification>({
      index: INDEX_NAMES.NOTIFICATIONS,
      size: 1,
      query: {
        bool: {
          filter: [{ term: { id } }],
          should: [
            { term: { userId } },
            { bool: { must_not: [{ exists: { field: 'userId' } }] } },
          ],
          minimum_should_match: 1,
        },
      },
    });

    const hit = searchResponse.hits.hits[0];
    if (!hit?._source || !hit._id) {
      res.status(404).json({
        error: 'Not Found',
        message: `Notification not found: ${id}`,
        correlationId: req.id,
      });
      return;
    }

    const isGlobal = hit._source.userId === undefined || hit._source.userId === null;
    if (isGlobal) {
      // Per-user receipt; never mutate the shared global document.
      await upsertReceipt(userId, id, { read: true });
    } else {
      await esClient.update({
        index: INDEX_NAMES.NOTIFICATIONS,
        id: hit._id,
        doc: { read: true },
        refresh: 'wait_for',
      });
    }

    res.json({ id, read: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/notifications/:id - dismiss notification
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { id } = req.params as { id: string };

  try {
    const userId = req.user!.sub;

    const searchResponse = await esClient.search<Notification>({
      index: INDEX_NAMES.NOTIFICATIONS,
      size: 1,
      query: {
        bool: {
          filter: [{ term: { id } }],
          should: [
            { term: { userId } },
            { bool: { must_not: [{ exists: { field: 'userId' } }] } },
          ],
          minimum_should_match: 1,
        },
      },
    });

    const hit = searchResponse.hits.hits[0];
    if (!hit?._source || !hit._id) {
      res.status(404).json({
        error: 'Not Found',
        message: `Notification not found: ${id}`,
        correlationId: req.id,
      });
      return;
    }

    const isGlobal = hit._source.userId === undefined || hit._source.userId === null;
    if (isGlobal) {
      // Dismiss for this user only via a receipt; keep the shared doc for others.
      await upsertReceipt(userId, id, { dismissed: true, read: true });
    } else {
      await esClient.delete({
        index: INDEX_NAMES.NOTIFICATIONS,
        id: hit._id,
        refresh: 'wait_for',
      });
    }

    logger.info('Notification dismissed', {
      correlationId: req.id,
      userId,
      notificationId: id,
      global: isGlobal,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
