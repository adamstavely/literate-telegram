import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs/operators';
import { AuditService } from '../services/audit.service';

const AUDITED_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);
const AUDITED_PATH_PATTERNS = [/\/api\/entries/, /\/api\/pending/];

export const auditInterceptor: HttpInterceptorFn = (req, next) => {
  const audit = inject(AuditService);

  // Attach request-id to every outgoing request for traceability.
  const cloned = req.clone({
    setHeaders: {
      'X-Client': 'interop-web/1.0',
      'X-Request-Id': crypto.randomUUID(),
    },
  });

  // Record audit event for state-changing calls to audited API paths.
  const shouldAudit =
    AUDITED_METHODS.has(cloned.method) &&
    AUDITED_PATH_PATTERNS.some(pattern => pattern.test(cloned.url));

  if (!shouldAudit) {
    return next(cloned);
  }

  // Derive action and resource from method + URL.
  const action = cloned.method.toLowerCase();
  const urlParts = cloned.url.split('/').filter(Boolean);
  const resource = urlParts.find(p => p === 'entries' || p === 'pending') ?? 'unknown';
  // The segment after the resource name is typically the ID.
  const resourceIdx = urlParts.indexOf(resource);
  const resourceId =
    resourceIdx !== -1 ? urlParts[resourceIdx + 1] : undefined;

  return next(cloned).pipe(
    tap({
      next: () => {
        audit.recordAction(action, resource, resourceId, {
          method: cloned.method,
          url: cloned.url,
        });
      },
    }),
  );
};
