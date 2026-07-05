import { Injectable, OnDestroy, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { safePageLocation } from '../utils/page-location';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  url: string;
  userAgent: string;
}

@Injectable({ providedIn: 'root' })
export class LoggingService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly logsEndpoint = `${environment.apiBaseUrl}/logs`;

  private _batch: LogEntry[] = [];
  private _flushTimer: ReturnType<typeof setInterval> | null = null;

  // Native event listeners — stored so we can remove them on destroy.
  private readonly _errorHandler = (event: ErrorEvent): void => {
    this.error('Unhandled error', event.error as unknown, {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };

  private readonly _rejectionHandler = (event: PromiseRejectionEvent): void => {
    this.error('Unhandled promise rejection', event.reason as unknown, {
      type: 'unhandledrejection',
    });
  };

  constructor() {
    window.addEventListener('error', this._errorHandler);
    window.addEventListener('unhandledrejection', this._rejectionHandler);

    // Flush log batch every 5 seconds in production.
    if (environment.production) {
      this._flushTimer = setInterval(() => this._flush(), 5000);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('error', this._errorHandler);
    window.removeEventListener('unhandledrejection', this._rejectionHandler);

    if (this._flushTimer !== null) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }

    // Final flush on destroy.
    this._flush();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** General-purpose logging method. */
  log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      url: safePageLocation(),
      userAgent: navigator.userAgent,
    };

    if (!environment.production) {
      const consoleFn =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : console.log;
      consoleFn(`[${level.toUpperCase()}] ${message}`, context ?? '');
    }

    this._batch.push(entry);

    // In dev, flush immediately so logs reach the server without waiting.
    if (!environment.production) {
      this._flush();
    }
  }

  /** Convenience method for error logging with optional Error object. */
  error(
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ): void {
    const errorContext: Record<string, unknown> = { ...context };

    if (error instanceof Error) {
      errorContext['errorName'] = error.name;
      errorContext['errorMessage'] = error.message;
      if (!environment.production) {
        errorContext['stack'] = error.stack;
      }
    } else if (error !== undefined) {
      errorContext['raw'] = String(error);
    }

    this.log('error', message, errorContext);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private _flush(): void {
    if (this._batch.length === 0) return;

    const toSend = this._batch.splice(0);

    this.http
      .post(this.logsEndpoint, { entries: toSend })
      .subscribe({ error: () => void 0 }); // Swallow — logging must never throw.
  }
}
