import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { SensitivityLevel } from '../../types';

interface BadgeConfig {
  icon: string;
  label: string;
  colorClass: string;
}

const BADGE_CONFIG: Record<SensitivityLevel, BadgeConfig> = {
  public: { icon: 'globe', label: 'Public', colorClass: 'badge--public' },
  internal: { icon: 'shield', label: 'Internal', colorClass: 'badge--internal' },
  confidential: { icon: 'lock', label: 'Confidential', colorClass: 'badge--confidential' },
  restricted: { icon: 'lock', label: 'Restricted', colorClass: 'badge--restricted' },
};

@Component({
  selector: 'app-sensitivity-badge',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="sensitivity-badge"
      [ngClass]="config.colorClass"
      [attr.aria-label]="'Sensitivity: ' + config.label"
      role="img"
    >
      <app-icon [name]="config.icon" [size]="11"></app-icon>
      <span class="badge-label">{{ config.label }}</span>
    </span>
  `,
  styles: [`
    .sensitivity-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px 2px 5px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 500;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    .badge--public {
      background: rgba(39, 174, 96, 0.12);
      color: #27ae60;
      border-color: rgba(39, 174, 96, 0.25);
    }

    .badge--internal {
      background: rgba(59, 91, 255, 0.1);
      color: #3b5bff;
      border-color: rgba(59, 91, 255, 0.2);
    }

    .badge--confidential {
      background: rgba(230, 168, 23, 0.12);
      color: #b8860b;
      border-color: rgba(230, 168, 23, 0.25);
    }

    .badge--restricted {
      background: rgba(229, 62, 62, 0.1);
      color: #e53e3e;
      border-color: rgba(229, 62, 62, 0.2);
    }

    [data-theme="dark"] .badge--confidential {
      color: #e6a817;
    }
  `],
})
export class SensitivityBadgeComponent {
  @Input() level: SensitivityLevel = 'public';

  get config(): BadgeConfig {
    return BADGE_CONFIG[this.level] ?? BADGE_CONFIG['public'];
  }
}
