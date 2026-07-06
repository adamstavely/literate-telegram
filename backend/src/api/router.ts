import { Router, Request, Response, NextFunction } from 'express';
import { pingElasticsearch } from '../elasticsearch/client.js';
import entriesRouter from './routes/entries.js';
import pendingRouter from './routes/pending.js';
import notificationsRouter from './routes/notifications.js';
import auditRouter from './routes/audit.js';
import collectionsRouter from './routes/collections.js';
import logsRouter from './routes/logs.js';
import policyRouter from './routes/policy.js';
import docsFeedbackRouter from './routes/docs-feedback.js';
import apisRouter from './routes/apis.js';
import proxyRouter from './routes/proxy.js';

const router = Router();

// Liveness probe — is the process up? Never depends on downstreams, so a
// transient Elasticsearch outage cannot trigger a Kubernetes restart loop.
router.get('/health/live', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env['npm_package_version'] ?? '1.0.0',
  });
});

// Readiness probe — can we serve traffic? Returns 503 when Elasticsearch is
// down so the load balancer stops routing to this pod without killing it.
router.get('/health/ready', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const esAlive = await pingElasticsearch();
    res.status(esAlive ? 200 : 503).json({
      status: esAlive ? 'ready' : 'not-ready',
      timestamp: new Date().toISOString(),
      services: {
        elasticsearch: esAlive ? 'ok' : 'unavailable',
      },
    });
  } catch (err) {
    next(err);
  }
});

// Combined health check (kept for backwards compatibility). Reports degraded
// rather than failing hard.
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
router.use('/collections', collectionsRouter);
router.use('/pending', pendingRouter);
router.use('/notifications', notificationsRouter);
router.use('/audit', auditRouter);
router.use('/logs', logsRouter);
router.use('/policy', policyRouter);
router.use('/docs/feedback', docsFeedbackRouter);
router.use('/apis', apisRouter);
router.use('/proxy', proxyRouter);

export default router;
