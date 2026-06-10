import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../shared/components/icon/icon.component';

type RuleAction = 'flag' | 'require-review' | 'block' | 'auto-reject';
type PosturePreset = 'strict' | 'balanced' | 'open';

interface PolicyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'info' | 'warn' | 'critical';
  action: RuleAction;
}

interface TransportToggle {
  id: string;
  label: string;
  enabled: boolean;
}

interface AuthToggle {
  id: string;
  label: string;
  enabled: boolean;
}

@Component({
  selector: 'app-policy',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, IconComponent],
  templateUrl: './policy.component.html',
})
export class PolicyComponent {
  readonly activeSection = signal<string>('posture');
  readonly dirty = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);

  readonly sections = [
    { id: 'posture', label: 'Posture', icon: 'shield' },
    { id: 'review', label: 'Review & Approval', icon: 'check' },
    { id: 'risk-rules', label: 'Risk Rules', icon: 'warning' },
    { id: 'publisher-trust', label: 'Publisher Trust', icon: 'user' },
    { id: 'capabilities', label: 'Capabilities', icon: 'bolt' },
    { id: 'skills', label: 'Skills', icon: 'skill' },
  ];

  readonly activePreset = signal<PosturePreset>('balanced');

  // Access toggles
  readonly readOnlyDefault = signal(false);
  readonly perToolApproval = signal(false);
  readonly blockWrites = signal(false);
  readonly quarantineHighRisk = signal(true);

  // Review settings
  readonly autoApproveVerified = signal(true);
  readonly requireTwoApprovers = signal(false);
  readonly reviewWindowDays = signal(7);

  readonly rules = signal<PolicyRule[]>([
    {
      id: 'no-shell-exec',
      name: 'Prohibit shell execution',
      description: 'Block entries that expose unrestricted shell execution.',
      enabled: true,
      severity: 'critical',
      action: 'block',
    },
    {
      id: 'require-auth',
      name: 'Require authentication',
      description: 'Flag entries without a declared auth method.',
      enabled: true,
      severity: 'warn',
      action: 'flag',
    },
    {
      id: 'license-required',
      name: 'Require license declaration',
      description: 'Servers must declare an open source license.',
      enabled: false,
      severity: 'warn',
      action: 'require-review',
    },
    {
      id: 'sensitivity-review',
      name: 'Review restricted entries',
      description: 'Entries marked "restricted" require manual admin approval.',
      enabled: true,
      severity: 'critical',
      action: 'require-review',
    },
    {
      id: 'source-required',
      name: 'Require source URL',
      description: 'MCP servers must link to a source repository.',
      enabled: false,
      severity: 'info',
      action: 'flag',
    },
    {
      id: 'high-autonomy-review',
      name: 'Review high-autonomy agents',
      description: 'Agents with "high" or "full" autonomy require additional review.',
      enabled: true,
      severity: 'critical',
      action: 'require-review',
    },
    {
      id: 'no-pii-tool',
      name: 'Detect PII-accessing tools',
      description: 'Flag tools with patterns suggesting PII access.',
      enabled: true,
      severity: 'warn',
      action: 'flag',
    },
    {
      id: 'verified-publisher',
      name: 'Unverified publisher warning',
      description: 'Warn when publisher is not on the allowlist.',
      enabled: false,
      severity: 'info',
      action: 'flag',
    },
  ]);

  readonly transports = signal<TransportToggle[]>([
    { id: 'http', label: 'HTTP', enabled: true },
    { id: 'sse', label: 'SSE', enabled: true },
    { id: 'stdio', label: 'stdio', enabled: true },
  ]);

  readonly authMethods = signal<AuthToggle[]>([
    { id: 'none', label: 'None (anonymous)', enabled: true },
    { id: 'api-key', label: 'API Key', enabled: true },
    { id: 'oauth2', label: 'OAuth 2.0', enabled: true },
    { id: 'jwt', label: 'JWT', enabled: true },
    { id: 'basic', label: 'Basic Auth', enabled: false },
  ]);

  readonly allowlistDomains = signal<string[]>([
    'anthropic.com',
    'openai.com',
    'github.com',
    'microsoft.com',
    'google.com',
  ]);

  readonly newDomain = signal('');

  readonly enabledSkillTriggers = signal(true);
  readonly maxTokenBudget = signal(8000);
  readonly requireSkillMd = signal(true);

  setSection(id: string): void {
    this.activeSection.set(id);
  }

  applyPreset(preset: PosturePreset): void {
    this.activePreset.set(preset);
    this.dirty.set(true);
    if (preset === 'strict') {
      this.readOnlyDefault.set(true);
      this.perToolApproval.set(true);
      this.blockWrites.set(true);
      this.quarantineHighRisk.set(true);
      this.rules.update(list => list.map(r => ({ ...r, enabled: true })));
    } else if (preset === 'balanced') {
      this.readOnlyDefault.set(false);
      this.perToolApproval.set(false);
      this.blockWrites.set(false);
      this.quarantineHighRisk.set(true);
    } else {
      this.readOnlyDefault.set(false);
      this.perToolApproval.set(false);
      this.blockWrites.set(false);
      this.quarantineHighRisk.set(false);
      this.rules.update(list => list.map(r => ({ ...r, enabled: false })));
    }
  }

  toggleRule(id: string): void {
    this.rules.update(list =>
      list.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    );
    this.dirty.set(true);
  }

  setRuleAction(id: string, action: RuleAction): void {
    this.rules.update(list =>
      list.map(r => r.id === id ? { ...r, action } : r)
    );
    this.dirty.set(true);
  }

  toggleTransport(id: string): void {
    this.transports.update(list =>
      list.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t)
    );
    this.dirty.set(true);
  }

  toggleAuth(id: string): void {
    this.authMethods.update(list =>
      list.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a)
    );
    this.dirty.set(true);
  }

  addDomain(): void {
    const domain = this.newDomain().trim().toLowerCase();
    if (domain && !this.allowlistDomains().includes(domain)) {
      this.allowlistDomains.update(d => [...d, domain]);
      this.newDomain.set('');
      this.dirty.set(true);
    }
  }

  removeDomain(domain: string): void {
    this.allowlistDomains.update(d => d.filter(x => x !== domain));
    this.dirty.set(true);
  }

  toggleReadOnlyDefault(): void { this.readOnlyDefault.update(v => !v); this.dirty.set(true); }
  togglePerToolApproval(): void { this.perToolApproval.update(v => !v); this.dirty.set(true); }
  toggleBlockWrites(): void { this.blockWrites.update(v => !v); this.dirty.set(true); }
  toggleQuarantineHighRisk(): void { this.quarantineHighRisk.update(v => !v); this.dirty.set(true); }
  toggleAutoApproveVerified(): void { this.autoApproveVerified.update(v => !v); this.dirty.set(true); }
  toggleRequireTwoApprovers(): void { this.requireTwoApprovers.update(v => !v); this.dirty.set(true); }
  toggleEnabledSkillTriggers(): void { this.enabledSkillTriggers.update(v => !v); this.dirty.set(true); }
  toggleRequireSkillMd(): void { this.requireSkillMd.update(v => !v); this.dirty.set(true); }
  setReviewWindowDays(val: number): void { this.reviewWindowDays.set(val); this.dirty.set(true); }
  setMaxTokenBudget(val: number): void { this.maxTokenBudget.set(val); this.dirty.set(true); }

  markDirty(): void {
    this.dirty.set(true);
  }

  discard(): void {
    this.dirty.set(false);
    // In a real app: reload from API
  }

  save(): void {
    this.saving.set(true);
    setTimeout(() => {
      this.saving.set(false);
      this.saved.set(true);
      this.dirty.set(false);
      setTimeout(() => this.saved.set(false), 3000);
    }, 800);
  }

  severityColor(sev: PolicyRule['severity']): string {
    return { info: 'var(--accent)', warn: 'var(--warn)', critical: 'var(--danger)' }[sev];
  }
}
