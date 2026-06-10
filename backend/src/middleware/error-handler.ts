import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger/logger.js';
import { config } from '../config/index.js';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

function mapErrorToStatus(err: AppError): number {
  if (err.statusCode) return err.statusCode;

  const name = err.name ?? '';
  const code = err.code ?? '';
  const message = (err.message ?? '').toLowerCase();

  if (name === 'ValidationError' || code === 'VALIDATION_ERROR') return 422;
  if (name === 'UnauthorizedError' || message.includes('unauthorized')) return 401;
  if (name === 'ForbiddenError' || message.includes('forbidden')) return 403;
  if (name === 'NotFoundError' || message.includes('not found')) return 404;
  if (name === 'ConflictError' || message.includes('conflict') || message.includes('already exists')) return 409;
  if (name === 'BadRequestError' || message.includes('bad request') || message.includes('invalid')) return 400;

  return 500;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = mapErrorToStatus(err);
  const correlationId = req.id ?? 'unknown';

  if (statusCode >= 500) {
    logger.error('Unhandled server error', {
      correlationId,
      error: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      userId: req.user?.sub,
    });
  } else {
    logger.warn('Client error', {
      correlationId,
      error: err.message,
      statusCode,
      method: req.method,
      path: req.path,
    });
  }

  const isProd = config.nodeEnv === 'production';

  const body: Record<string, unknown> = {
    error: statusCode >= 500 ? 'Internal Server Error' : err.name || 'Error',
    message: statusCode >= 500 && isProd ? 'An unexpected error occurred' : err.message,
    correlationId,
  };

  if (!isProd && statusCode >= 500 && err.stack) {
    body['stack'] = err.stack;
  }

  res.status(statusCode).json(body);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    correlationId: req.id ?? 'unknown',
  });
}

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}
