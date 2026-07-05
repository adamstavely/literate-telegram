import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { config } from './config/index.js';
import { logger } from './logger/logger.js';
import { setupIndices } from './elasticsearch/indices.js';
import { requestLoggingMiddleware } from './middleware/logging.js';
import { optionalAuth } from './middleware/auth.js';
import { auditMiddleware } from './middleware/audit.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import apiRouter from './api/router.js';

const app = express();

// Trust proxy governs how req.ip is derived from X-Forwarded-For. Keep it
// explicit so rate limiting and audit attribution use the same, non-spoofable
// client IP. Defaults to false (ignore XFF) unless deployed behind a proxy.
app.set('trust proxy', config.trustProxy);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) {
      callback(null, true);
      return;
    }
    if (config.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Return false (block) rather than error — express-cors will send 204 with no ACAO header
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  exposedHeaders: ['X-Correlation-ID'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    });
  },
});
app.use(limiter);

// Request logging + correlation ID
app.use(requestLoggingMiddleware);

// Optional auth (attaches req.user if token present)
app.use(optionalAuth);

// Audit middleware (records mutations to ES)
app.use(auditMiddleware);

// Mount API routes
app.use('/api', apiRouter);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Startup
async function start(): Promise<void> {
  const port = config.port;

  // Setup Elasticsearch indices (non-blocking on failure)
  try {
    await setupIndices();
    logger.info('Elasticsearch indices ready');
  } catch (err) {
    logger.warn('Could not set up Elasticsearch indices on startup', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    // Continue startup — ES may become available later
  }

  const server = app.listen(port, () => {
    logger.info('Interop backend started', {
      port,
      nodeEnv: config.nodeEnv,
      logLevel: config.logging.level,
    });
  });

  // Graceful shutdown
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

    // Force shutdown after 10 seconds
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
