import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { esClient } from '../elasticsearch/client.js';
import { INDEX_NAMES } from '../elasticsearch/indices.js';
import { AuditEvent } from '../types/index.js';
import { logger } from '../logger/logger.js';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
  }
  return req.ip ?? 'unknown';
}

function deriveResource(_method: string, path: string): { resource: string; resourceId?: string } {
  const segments = path.replace(/^\/api\//, '').split('/').filter(Boolean);
  const resource = segments[0] ?? 'unknown';
  const resourceId = segments[1];
  return { resource, resourceId: resourceId ?? undefined };
}

async function writeAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await esClient.index({
      index: INDEX_NAMES.AUDIT,
      id: event.id,
      document: event,
    });
  } catch (err) {
    // Audit write failures must not crash the app but should be logged
    logger.error('Failed to write audit event', {
      correlationId: event.id,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    // Only audit mutating operations and sensitive reads
    const shouldAudit =
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ||
      req.path.includes('/audit') ||
      req.path.includes('/pending');

    if (!shouldAudit) return;

    const responseTime = Date.now() - startTime;
    const { resource, resourceId } = deriveResource(req.method, req.path);
    const userId = req.user?.sub ?? 'anonymous';
    const result: 'success' | 'failure' = res.statusCode < 400 ? 'success' : 'failure';

    const event: AuditEvent = {
      id: uuidv4(),
      userId,
      action: `${req.method} ${req.path}`,
      resource,
      resourceId,
      timestamp: new Date().toISOString(),
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] ?? 'unknown',
      result,
      responseTime,
    };

    void writeAuditEvent(event);
  });

  next();
}

export async function auditAction(
  req: Request,
  action: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { resource } = deriveResource(req.method, req.path);

  const event: AuditEvent = {
    id: uuidv4(),
    userId: req.user?.sub ?? 'anonymous',
    action,
    resource,
    resourceId,
    timestamp: new Date().toISOString(),
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? 'unknown',
    result: 'success',
    metadata,
  };

  await writeAuditEvent(event);
}
