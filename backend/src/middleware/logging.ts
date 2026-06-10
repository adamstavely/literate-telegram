import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger/logger.js';
import { AuthenticatedUser } from '../types/index.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      user?: AuthenticatedUser;
      startTime?: number;
    }
  }
}

export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  req.id = uuidv4();
  req.startTime = Date.now();

  res.setHeader('X-Correlation-ID', req.id);

  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : -1;
    const userId = req.user?.sub;

    logger.info('HTTP request completed', {
      correlationId: req.id,
      userId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}
