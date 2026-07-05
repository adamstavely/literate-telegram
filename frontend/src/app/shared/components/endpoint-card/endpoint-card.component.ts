import {
  Component,
  Input,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiEndpoint } from '../../types';
import { IconComponent } from '../icon/icon.component';
import {
  buildEndpointSpec,
  buildLiveRequest,
  liveResponseBody,
  exampleVal,
  EndpointSpec,
  EpParam,
} from '../../utils/endpoint-spec';

interface LiveResponse {
  code: string;
  tone: 'ok' | 'warn' | 'danger';
  label: string;
  ms: number;
  body: string;
}

/**
 * Swagger-style expandable endpoint card with a "Try it out" console.
 * Ported from the design prototype (detail2.jsx EndpointRow). Execution is a
 * client-side mock — no request leaves the browser.
 */
@Component({
  selector: 'app-endpoint-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  templateUrl: './endpoint-card.component.html',
})
export class EndpointCardComponent implements OnInit {
  @Input({ required: true }) api!: Api;
  @Input({ required: true }) ep!: ApiEndpoint;

  readonly open = signal(false);
  readonly tryOn = signal(false);
  readonly running = signal(false);
  readonly resp = signal<LiveResponse | null>(null);
  readonly vals = signal<Record<string, string>>({});

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

  get okResp() {
    return this.spec.responses.find((r) => r.tone === 'ok') ?? this.spec.responses[0];
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
    this.running.set(true);
    this.resp.set(null);
    const vals = this.vals();
    const missing = this.inputFields.find(
      (f) => f.required && (vals[f.name] === undefined || String(vals[f.name]).trim() === ''),
    );
    const t0 = performance.now();
    setTimeout(() => {
      this.running.set(false);
      if (missing) {
        this.resp.set({
          code: this.spec.isGql ? '200' : '400',
          tone: 'warn',
          label: this.spec.isGql ? 'errors[]' : 'Bad Request',
          ms: Math.round(performance.now() - t0),
          body: `{\n  "error": {\n    "type": "invalid_request_error",\n    "param": "${missing.name}",\n    "message": "Missing required ${missing.in === 'path' ? 'path parameter' : missing.in === 'query' ? 'query parameter' : 'field'}: ${missing.name}"\n  }\n}`,
        });
      } else {
        const ok = this.okResp;
        this.resp.set({
          code: ok.code,
          tone: 'ok',
          label: ok.label,
          ms: Math.round(performance.now() - t0) + 380,
          body: liveResponseBody(this.spec, this.vals()),
        });
      }
    }, 620);
  }

  reset(): void {
    this.vals.set(Object.fromEntries(this.inputFields.map((f) => [f.name, exampleVal(f)])));
    this.resp.set(null);
  }
}
