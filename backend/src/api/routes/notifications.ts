import { Router, Request, Response, NextFunction } from 'express';
import { esClient } from '../../elasticsearch/client.js';
import { INDEX_NAMES } from '../../elasticsearch/indices.js';
import { requireAuth } from '../../middleware/auth.js';
import { Notification } from '../../types/index.js';
import { logger } from '../../logger/logger.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/notifications - get user's notifications
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.sub;
    const page = parseInt(req.query['page'] as string ?? '0', 10) || 0;
    const size = parseInt(req.query['size'] as string ?? '50', 10) || 50;
    const from = page * size;

    const response = await esClient.search<Notification>({
      index: INDEX_NAMES.NOTIFICATIONS,
      from,
      size,
      sort: [
        { read: { order: 'asc' } },   // unread first
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
        },
      },
    });

    const total = typeof response.hits.total === 'number'
      ? response.hits.total
      : (response.hits.total?.value ?? 0);

    const hits = response.hits.hits
      .map((h) => ({ ...h._source, _esId: h._id }))
      .filter((s): s is Notification & { _esId: string } => s._esId !== undefined);

    res.json({ hits, total, page, size });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/read-all - mark all as read (must be before /:id)
router.put('/read-all', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.sub;

    await esClient.updateByQuery({
      index: INDEX_NAMES.NOTIFICATIONS,
      refresh: true,
      query: {
        bool: {
          filter: [
            { term: { read: false } },
            {
              bool: {
                should: [
                  { term: { userId } },
                  { bool: { must_not: [{ exists: { field: 'userId' } }] } },
                ],
                minimum_should_match: 1,
              },
            },
          ],
        },
      },
      script: {
        source: 'ctx._source.read = true',
        lang: 'painless',
      },
    });

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

    // Find the notification
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
    if (!hit) {
      res.status(404).json({
        error: 'Not Found',
        message: `Notification not found: ${id}`,
        correlationId: req.id,
      });
      return;
    }

    if (!hit._id) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Missing document ID', correlationId: req.id });
      return;
    }

    await esClient.update({
      index: INDEX_NAMES.NOTIFICATIONS,
      id: hit._id,
      doc: { read: true },
      refresh: 'wait_for',
    });

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
    if (!hit) {
      res.status(404).json({
        error: 'Not Found',
        message: `Notification not found: ${id}`,
        correlationId: req.id,
      });
      return;
    }

    if (!hit._id) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Missing document ID', correlationId: req.id });
      return;
    }

    await esClient.delete({
      index: INDEX_NAMES.NOTIFICATIONS,
      id: hit._id,
      refresh: 'wait_for',
    });

    logger.info('Notification dismissed', {
      correlationId: req.id,
      userId,
      notificationId: id,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
