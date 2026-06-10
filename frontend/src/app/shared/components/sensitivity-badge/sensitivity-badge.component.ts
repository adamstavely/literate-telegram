import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { SensitivityLevel } from '../../types';

const SENSITIVITY_TIPS: Record<SensitivityLevel, string> = {
  public: 'Approved for public, non-sensitive data only.',
  internal: 'Approved for internal business data.',
  confidential: 'Approved for confidential data — restricted access.',
  restricted: 'Approved for restricted data: PII, secrets, financial.',
};

@Component({
  selector: 'app-sensitivity-badge',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="sens-badge"
      [class.sens-public]="level === 'public'"
      [class.sens-internal]="level === 'internal'"
      [class.sens-confidential]="level === 'confidential'"
      [class.sens-restricted]="level === 'restricted'"
      [attr.title]="tip"
      [attr.aria-label]="'Sensitivity: ' + label"
      role="img"
    >
      <app-icon [name]="icon" [size]="12"></app-icon>
      <span>{{ label }}</span>
    </span>
  `,
})
export class SensitivityBadgeComponent {
  @Input() level: SensitivityLevel = 'public';

  private readonly config: Record<SensitivityLevel, { icon: string; label: string }> = {
    public: { icon: 'globe', label: 'Public' },
    internal: { icon: 'shield', label: 'Internal' },
    confidential: { icon: 'lock', label: 'Confidential' },
    restricted: { icon: 'lock', label: 'Restricted' },
  };

  get icon(): string {
    return this.config[this.level]?.icon ?? 'shield';
  }

  get label(): string {
    return this.config[this.level]?.label ?? 'Internal';
  }

  get tip(): string {
    return SENSITIVITY_TIPS[this.level] ?? SENSITIVITY_TIPS.internal;
  }
}
