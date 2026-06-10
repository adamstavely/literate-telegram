import { Injectable, OnDestroy, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

interface ClientAuditEvent {
  userId: string | null;
  action: string;
  resource: string;
  resourceId?: string;
  timestamp: string;
  pageUrl: string;
  metadata?: Record<string, unknown>;
}

const MAX_BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 3000;

@Injectable({ providedIn: 'root' })
export class AuditService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly endpoint = `${environment.apiBaseUrl}/audit/client`;

  private _batch: ClientAuditEvent[] = [];
  private _flushTimer: ReturnType<typeof setInterval>;

  constructor() {
    this._flushTimer = setInterval(() => this._flush(), FLUSH_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this._flushTimer);
    this._flush();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Records a user action as an audit event.
   * Events are batched and sent every 3 seconds or when the batch exceeds 10.
   *
   * @param action     Verb describing the action (e.g. 'approve', 'register').
   * @param resource   Resource type affected (e.g. 'entry', 'notification').
   * @param resourceId Optional ID of the affected resource.
   * @param metadata   Additional structured data about the action.
   */
  recordAction(
    action: string,
    resource: string,
    resourceId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    const user = this.auth.isAuthenticated()
      ? (this.auth.currentUser$ as unknown as { value: { sub: string } | null })
      : null;

    // Resolve userId synchronously from the BehaviorSubject's current value.
    const userId = this._resolveUserId();

    const event: ClientAuditEvent = {
      userId,
      action,
      resource,
      resourceId,
      timestamp: new Date().toISOString(),
      pageUrl: window.location.href,
      metadata,
    };

    this._batch.push(event);

    if (this._batch.length >= MAX_BATCH_SIZE) {
      this._flush();
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private _resolveUserId(): string | null {
    // AuthService exposes a BehaviorSubject; grab its current value via the
    // observable's getValue equivalent by subscribing synchronously.
    let userId: string | null = null;
    this.auth.currentUser$
      .subscribe(u => { userId = u?.sub ?? null; })
      .unsubscribe();
    return userId;
  }

  private _flush(): void {
    if (this._batch.length === 0) return;

    const toSend = this._batch.splice(0);

    this.http
      .post(this.endpoint, { events: toSend })
      .subscribe({ error: () => void 0 }); // Audit must never throw.
  }
}
