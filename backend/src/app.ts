import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { config } from './config/index.js';
import { requestLoggingMiddleware } from './middleware/logging.js';
import { optionalAuth } from './middleware/auth.js';
import { auditMiddleware } from './middleware/audit.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import apiRouter from './api/router.js';

const app = express();

app.set('trust proxy', config.trustProxy);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (config.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  exposedHeaders: ['X-Correlation-ID'],
}));

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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

app.use(requestLoggingMiddleware);
app.use(optionalAuth);
app.use(auditMiddleware);
app.use('/api', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
