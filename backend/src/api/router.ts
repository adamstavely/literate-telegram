import { Router, Request, Response, NextFunction } from 'express';
import { pingElasticsearch } from '../elasticsearch/client.js';
import entriesRouter from './routes/entries.js';
import pendingRouter from './routes/pending.js';
import notificationsRouter from './routes/notifications.js';
import auditRouter from './routes/audit.js';

const router = Router();

// Health check
router.get('/health', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const esAlive = await pingElasticsearch();

    const status = esAlive ? 'ok' : 'degraded';
    const httpStatus = esAlive ? 200 : 503;

    res.status(httpStatus).json({
      status,
      timestamp: new Date().toISOString(),
      services: {
        elasticsearch: esAlive ? 'ok' : 'unavailable',
      },
      version: process.env['npm_package_version'] ?? '1.0.0',
    });
  } catch (err) {
    next(err);
  }
});

// Mount sub-routers
router.use('/entries', entriesRouter);
router.use('/pending', pendingRouter);
router.use('/notifications', notificationsRouter);
router.use('/audit', auditRouter);

export default router;
