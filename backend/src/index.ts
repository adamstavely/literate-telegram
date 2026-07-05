import 'dotenv/config';
import { config } from './config/index.js';
import { logger } from './logger/logger.js';
import { setupIndices } from './elasticsearch/indices.js';
import app from './app.js';

async function start(): Promise<void> {
  const port = config.port;

  try {
    await setupIndices();
    logger.info('Elasticsearch indices ready');
  } catch (err) {
    logger.warn('Could not set up Elasticsearch indices on startup', {
      error: err instanceof Error ? err.message : 'unknown',
    });
  }

  const server = app.listen(port, () => {
    logger.info('Interop backend started', {
      port,
      nodeEnv: config.nodeEnv,
      logLevel: config.logging.level,
    });
  });

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);

    server.close((err) => {
      if (err) {
        logger.error('Error during server close', { error: err.message });
        process.exit(1);
      }
      logger.info('Server closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

export default app;
