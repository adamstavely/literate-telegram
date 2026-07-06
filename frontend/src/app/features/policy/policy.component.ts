import { Component, OnInit, signal, computed, inject, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { RegistryService } from '../../core/services/registry.service';
import {
  PendingEntry,
  PolicyRule,
  PolicyState,
  RuleAction,
  RuleSeverity,
  TrustDomain,
} from '../../shared/types';

interface PolicyPreset {
  id: string;
  name: string;
  icon: string;
  desc: string;
  values: Partial<PolicyState>;
}

const DEFAULT_POLICY: PolicyState = {
  readOnlyDefault: true,
  perToolApproval: true,
  blockWriteUntilReview: true,
  quarantineHighRisk: true,
  requireReview: true,
  autoApproveVerified: false,
  autoApproveSkills: false,
  twoApproversHighRisk: true,
  republishAfterDays: 90,
  defaultVisibility: 'org',
  transports: { http: true, sse: true, stdio: false },
  auth: {
    'OAuth 2.1': true,
    'API key': true,
    'Bot token': true,
    'Connection string': true,
    None: false,
  },
  scanInjection: true,
  requireTriggers: true,
  tokenCap: true,
};

const DEFAULT_RULES: PolicyRule[] = [
  { id: 'arbitrary-exec', name: 'Arbitrary code execution', cond: 'tool runs shell / eval', desc: 'A tool can execute unbounded commands on the host. The single highest-blast-radius capability.', severity: 'high', action: 'block', enabled: true, flag: 'Arbitrary code execution' },
  { id: 'no-sandbox', name: 'No sandbox declared', cond: 'sandbox: none', desc: 'Server performs writes or exec without declaring an isolation boundary.', severity: 'high', action: 'block', enabled: true, flag: 'No sandbox declared' },
  { id: 'write-default', name: 'Write tools on by default', cond: 'write && !readOnly', desc: 'Mutating tools are exposed before an admin opts in. Least privilege wants these off until reviewed.', severity: 'medium', action: 'review', enabled: true, flag: 'Write tools enabled by default' },
  { id: 'broad-scope', name: 'Broad scope request', cond: 'scope ⊇ {file:read, admin:*}', desc: 'Requests a wide credential scope rather than the minimum the tools need.', severity: 'medium', action: 'review', enabled: true, flag: 'Requests file:read scope' },
  { id: 'unverified-domain', name: 'Unverified publisher domain', cond: '!domain ∈ allowlist', desc: "Publisher's domain isn't on the trusted allowlist and hasn't completed verification.", severity: 'medium', action: 'flag', enabled: true, flag: 'New publisher — unverified domain' },
  { id: 'destructive-verbs', name: 'Destructive verbs, no confirm', cond: 'name ~ /^(delete|drop|purge)_/', desc: 'Tool names imply irreversible actions but declare no confirmation step.', severity: 'high', action: 'review', enabled: true, flag: 'Destructive verbs, no confirm' },
  { id: 'internal-visibility', name: 'Internal-only not restricted', cond: 'internal && visibility = public', desc: 'An entry tagged internal is still publicly visible. Tighten before publish.', severity: 'low', action: 'flag', enabled: true, flag: 'Internal only — restrict visibility' },
  { id: 'injection', name: 'Prompt-injection patterns in SKILL.md', cond: 'skill body ~ injection heuristics', desc: 'Skill text contains instructions that could hijack the agent ("ignore previous", tool-call coercion).', severity: 'medium', action: 'flag', enabled: true, flag: null },
];

const SEED_DOMAINS: TrustDomain[] = [
  { d: 'anthropic.com', verified: true },
  { d: 'stripe.com', verified: true },
  { d: 'linear.app', verified: true },
  { d: 'sentry.io', verified: true },
  { d: 'acme.internal', verified: false },
];

const PRESETS: PolicyPreset[] = [
  {
    id: 'strict',
    name: 'Strict',
    icon: 'shield',
    desc: 'Lock everything down. Every entry is human-reviewed; nothing auto-approves.',
    values: {
      readOnlyDefault: true,
      perToolApproval: true,
      blockWriteUntilReview: true,
      quarantineHighRisk: true,
      requireReview: true,
      autoApproveVerified: false,
      autoApproveSkills: false,
      twoApproversHighRisk: true,
    },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    icon: 'check',
    desc: 'Least privilege by default, but trusted publishers and credential-free skills flow through.',
    values: {
      readOnlyDefault: true,
      perToolApproval: true,
      blockWriteUntilReview: true,
      quarantineHighRisk: true,
      requireReview: true,
      autoApproveVerified: true,
      autoApproveSkills: true,
      twoApproversHighRisk: false,
    },
  },
  {
    id: 'open',
    name: 'Open',
    icon: 'bolt',
    desc: 'Optimize for velocity. Reviews are advisory; only high-risk submissions are held.',
    values: {
      readOnlyDefault: false,
      perToolApproval: false,
      blockWriteUntilReview: false,
      quarantineHighRisk: true,
      requireReview: false,
      autoApproveVerified: true,
      autoApproveSkills: true,
      twoApproversHighRisk: false,
    },
  },
];

const ACTION_OPTS: Array<{ v: RuleAction; label: string }> = [
  { v: 'flag', label: 'Flag only' },
  { v: 'review', label: 'Require review' },
  { v: 'block', label: 'Block publish' },
  { v: 'reject', label: 'Auto-reject' },
];

const SEV_TONE: Record<RuleSeverity, string> = {
  high: 'danger',
  medium: 'warn',
  low: 'default',
};

const PANE: Record<string, { title: string; desc: string }> = {
  posture: {
    title: 'Default posture',
    desc: 'The baseline governance applied to every newly registered server before any human looks at it. Pick a preset or tune each control.',
  },
  review: {
    title: 'Review & approval',
    desc: 'Who has to look at a submission, and when it can skip the queue.',
  },
  rules: {
    title: 'Risk rules',
    desc: 'Conditions evaluated against every submission. Each produces a flag and an action — these are exactly what shows up in the moderation queue.',
  },
  publishers: {
    title: 'Publisher trust',
    desc: 'Domains you trust. Entries from an allowlisted, verified domain can take the fast path; everything else is treated as unverified.',
  },
  capabilities: {
    title: 'Capabilities',
    desc: 'Which transports and authentication methods are permitted on the registry at all.',
  },
  skills: {
    title: 'Skill policy',
    desc: 'Skills carry no credentials, so the risk is bad advice, not a bad action — these checks guard against prompt-injection and context bloat.',
  },
};

@Component({
    selector: 'app-policy',
    imports: [RouterLink, IconComponent],
    changeDetection: ChangeDetectionStrategy.Default,
    templateUrl: './policy.component.html'
})
export class PolicyComponent implements OnInit {
  private readonly registry = inject(RegistryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly presets = PRESETS;
  readonly actionOpts = ACTION_OPTS;
  readonly pane = PANE;

  readonly activeSection = signal('posture');
  readonly policy = signal<PolicyState>({ ...DEFAULT_POLICY });
  readonly rules = signal<PolicyRule[]>(DEFAULT_RULES.map(r => ({ ...r })));
  readonly domains = signal<TrustDomain[]>(SEED_DOMAINS.map(d => ({ ...d })));
  readonly newDomain = signal('');
  readonly toast = signal<string | null>(null);
  readonly toastError = signal(false);
  readonly pending = signal<PendingEntry[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly pendingError = signal<string | null>(null);

  private policySeqNo: number | undefined;
  private policyPrimaryTerm: number | undefined;
  private snap = '';

  readonly sections = computed(() => {
    const enabledRules = this.rules().filter(r => r.enabled).length;
    return [
      { id: 'posture', label: 'Default posture', icon: 'shield' },
      { id: 'review', label: 'Review & approval', icon: 'flag' },
      { id: 'rules', label: 'Risk rules', icon: 'warning', count: enabledRules },
      { id: 'publishers', label: 'Publisher trust', icon: 'verified', count: this.domains().length },
      { id: 'capabilities', label: 'Capabilities', icon: 'server' },
      { id: 'skills', label: 'Skill policy', icon: 'skill' },
    ];
  });

  readonly activePreset = computed(() => {
    const p = this.policy();
    return PRESETS.find(pr =>
      Object.entries(pr.values).every(([k, v]) => p[k as keyof PolicyState] === v),
    ) ?? null;
  });

  readonly dirty = computed(() => this.snap !== this.serialize());

  readonly enabledRules = computed(() => this.rules().filter(r => r.enabled).length);

  readonly totalFlags = computed(() =>
    this.rules()
      .filter(r => r.enabled)
      .reduce((n, r) => n + this.flagCount(r.flag), 0),
  );

  readonly transportRows = [
    { id: 'http', label: 'Streamable HTTP', d: 'Remote endpoint over HTTP.' },
    { id: 'sse', label: 'Server-sent events', d: 'Long-lived remote stream.' },
    { id: 'stdio', label: 'stdio (local subprocess)', d: 'Runs a process on the host. Highest blast radius.' },
  ];

  readonly republishOptions = [30, 60, 90, 180, 365];

  ngOnInit(): void {
    this.registry
      .getPolicy()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: doc => {
          this.policy.set({ ...doc.policy });
          this.rules.set(doc.rules.map(r => ({ ...r })));
          this.domains.set(doc.domains.map(d => ({ ...d })));
          this.policySeqNo = doc._seqNo;
          this.policyPrimaryTerm = doc._primaryTerm;
          this.snap = this.serialize();
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('Could not load policy from server.');
          this.loading.set(false);
        },
      });

    this.registry
      .getPending({ status: 'pending' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.pending.set(result.hits);
          this.pendingError.set(null);
        },
        error: () => this.pendingError.set('Could not load pending submissions for flag counts.'),
      });
  }

  setSection(id: string): void {
    this.activeSection.set(id);
  }

  applyPreset(preset: PolicyPreset): void {
    this.policy.update(p => ({ ...p, ...preset.values }));
  }

  setPolicy<K extends keyof PolicyState>(key: K, value: PolicyState[K]): void {
    this.policy.update(p => ({ ...p, [key]: value }));
  }

  setTransport(id: string, enabled: boolean): void {
    this.policy.update(p => ({
      ...p,
      transports: { ...p.transports, [id]: enabled },
    }));
  }

  setAuth(method: string, enabled: boolean): void {
    this.policy.update(p => ({
      ...p,
      auth: { ...p.auth, [method]: enabled },
    }));
  }

  setRule(id: string, patch: Partial<PolicyRule>): void {
    this.rules.update(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }

  addCustomRule(): void {
    this.rules.update(rs => [
      ...rs,
      {
        id: `custom-${Date.now()}`,
        name: 'Custom rule',
        cond: 'edit condition',
        desc: 'Describe what this rule matches.',
        severity: 'medium',
        action: 'flag',
        enabled: true,
        flag: null,
      },
    ]);
  }

  addDomain(): void {
    const d = this.newDomain()
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    if (!d || this.domains().some(x => x.d === d)) return;
    this.domains.update(list => [...list, { d, verified: false }]);
    this.newDomain.set('');
  }

  removeDomain(domain: string): void {
    this.domains.update(list => list.filter(x => x.d !== domain));
  }

  discard(): void {
    const s = JSON.parse(this.snap) as {
      policy: PolicyState;
      rules: PolicyRule[];
      domains: TrustDomain[];
    };
    this.policy.set(s.policy);
    this.rules.set(s.rules);
    this.domains.set(s.domains);
  }

  save(): void {
    this.saving.set(true);
    this.registry
      .savePolicy({
        policy: this.policy(),
        rules: this.rules(),
        domains: this.domains(),
        ...(this.policySeqNo !== undefined && this.policyPrimaryTerm !== undefined
          ? { ifSeqNo: this.policySeqNo, ifPrimaryTerm: this.policyPrimaryTerm }
          : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: doc => {
          this.policy.set({ ...doc.policy });
          this.rules.set(doc.rules.map(r => ({ ...r })));
          this.domains.set(doc.domains.map(d => ({ ...d })));
          this.policySeqNo = doc._seqNo;
          this.policyPrimaryTerm = doc._primaryTerm;
          this.snap = this.serialize();
          this.saving.set(false);
          this.toastError.set(false);
          this.toast.set('Policy saved · applies to new submissions immediately');
          setTimeout(() => this.toast.set(null), 2800);
        },
        error: () => {
          this.saving.set(false);
          this.toastError.set(true);
          this.toast.set('Failed to save policy — please try again');
          setTimeout(() => this.toast.set(null), 2800);
        },
      });
  }

  severityTone(sev: RuleSeverity): string {
    return SEV_TONE[sev];
  }

  flagCount(flag: string | null): number {
    if (!flag) return 0;
    return this.pending().filter(p => p.flags.includes(flag)).length;
  }

  authMethods(): string[] {
    return Object.keys(this.policy().auth);
  }

  private serialize(): string {
    return JSON.stringify({
      policy: this.policy(),
      rules: this.rules(),
      domains: this.domains(),
    });
  }
}
