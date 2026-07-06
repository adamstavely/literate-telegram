import {
  Component,
  Input,
  OnInit,
  signal,
  computed,
  inject,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Api, ApiEndpoint } from '../../types';
import { IconComponent } from '../icon/icon.component';
import {
  buildEndpointSpec,
  buildLiveRequest,
  buildStructuredRequest,
  exampleVal,
  EndpointSpec,
  EpParam,
} from '../../utils/endpoint-spec';
import { RegistryService } from '../../../core/services/registry.service';

interface LiveResponse {
  code: string;
  tone: 'ok' | 'warn' | 'danger';
  label: string;
  ms: number;
  body: string;
}

/**
 * Swagger-style expandable endpoint card with a "Try it out" console. Execution
 * issues a real request to the API's own host through the Interop proxy
 * (POST /api/proxy); credentials entered in the Authorize field are sent with
 * that one request and never stored. Only available when the API has a baseUrl.
 */
@Component({
    selector: 'app-endpoint-card',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, IconComponent],
    templateUrl: './endpoint-card.component.html'
})
export class EndpointCardComponent implements OnInit {
  @Input({ required: true }) api!: Api;
  @Input({ required: true }) ep!: ApiEndpoint;

  private readonly registry = inject(RegistryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = signal(false);
  readonly tryOn = signal(false);
  readonly running = signal(false);
  readonly resp = signal<LiveResponse | null>(null);
  readonly vals = signal<Record<string, string>>({});
  /** Upstream credential entered in the Authorize field (per-request only). */
  readonly authToken = signal('');

  /** Live requests require a base URL to call. */
  get liveEnabled(): boolean {
    return !!this.api?.baseUrl;
  }

  spec!: EndpointSpec;
  inputFields: EpParam[] = [];
  allParams: EpParam[] = [];

  readonly liveReq = computed(() => buildLiveRequest(this.api, this.ep, this.spec, this.vals()));

  readonly panelId = computed(() =>
    `ep-panel-${this.ep.method}-${this.ep.path.replace(/[^a-zA-Z0-9]+/g, '-')}`,
  );

  readonly liveResponseText = computed(() => {
    if (this.running()) return 'Sending request…';
    const r = this.resp();
    if (!r) return '';
    return `Response received: ${r.code} in ${r.ms} ms`;
  });

  ngOnInit(): void {
    this.spec = buildEndpointSpec(this.api, this.ep);
    this.allParams = [...this.spec.pathParams, ...this.spec.query];
    this.inputFields = [
      ...this.spec.pathParams,
      ...this.spec.query,
      ...this.spec.body.map((f) => ({ ...f, in: this.spec.bodyIn })),
    ];
    this.vals.set(Object.fromEntries(this.inputFields.map((f) => [f.name, exampleVal(f)])));
  }

  verbClass(): string {
    return `ev-${this.ep.method.toLowerCase()}`;
  }

  toggleOpen(): void {
    this.open.update((o) => !o);
  }

  toggleTry(): void {
    this.tryOn.update((o) => !o);
  }

  setVal(name: string, v: string): void {
    this.vals.update((s) => ({ ...s, [name]: v }));
  }

  execute(): void {
    const vals = this.vals();
    const missing = this.inputFields.find(
      (f) => f.required && (vals[f.name] === undefined || String(vals[f.name]).trim() === ''),
    );
    if (missing) {
      const kind = missing.in === 'path' ? 'path parameter' : missing.in === 'query' ? 'query parameter' : 'field';
      this.resp.set({ code: '—', tone: 'warn', label: 'Missing field', ms: 0, body: `Please provide the required ${kind}: ${missing.name}` });
      return;
    }

    this.running.set(true);
    this.resp.set(null);
    const req = buildStructuredRequest(this.api, this.ep, this.spec, vals);
    const headers: Record<string, string> = {};
    const token = this.authToken().trim();
    if (token) headers['Authorization'] = /^(Bearer|Basic) /i.test(token) ? token : `Bearer ${token}`;
    const started = performance.now();

    this.registry
      .proxyTry({ entryId: this.api.id, method: req.method, path: req.path, query: req.query, body: req.body, headers })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.running.set(false);
          this.resp.set({
            code: String(r.status),
            tone: r.status < 400 ? 'ok' : r.status < 500 ? 'warn' : 'danger',
            label: r.statusText || `HTTP ${r.status}`,
            ms: r.ms,
            body: r.truncated ? `${r.body}\n… (response truncated)` : r.body,
          });
        },
        error: (err: unknown) => {
          this.running.set(false);
          this.resp.set(this.errorResponse(err, Math.round(performance.now() - started)));
        },
      });
  }

  private errorResponse(err: unknown, ms: number): LiveResponse {
    if (err instanceof HttpErrorResponse) {
      const errorBody = err.error as { message?: unknown } | null;
      const message =
        errorBody && typeof errorBody.message === 'string' ? errorBody.message : err.message || 'Request failed';
      return { code: err.status ? String(err.status) : 'ERR', tone: 'danger', label: 'Error', ms, body: message };
    }
    return { code: 'ERR', tone: 'danger', label: 'Error', ms, body: 'Request failed' };
  }

  reset(): void {
    this.vals.set(Object.fromEntries(this.inputFields.map((f) => [f.name, exampleVal(f)])));
    this.resp.set(null);
  }
}
