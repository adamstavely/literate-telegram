import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { SensitivityLevel } from '../../types';
import { SENSITIVITY } from '../../constants/sensitivity.constants';

@Component({
    selector: 'app-sensitivity-badge',
    standalone: true,
    imports: [IconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      class="sens-badge"
      [class.sens-public]="level === 'public'"
      [class.sens-internal]="level === 'internal'"
      [class.sens-confidential]="level === 'confidential'"
      [class.sens-restricted]="level === 'restricted'"
      [attr.title]="meta.tip"
      [attr.aria-label]="'Sensitivity: ' + meta.label"
      role="img"
    >
      <app-icon [name]="meta.icon" [size]="12"></app-icon>
      @if (!compact) {
        <span>{{ meta.label }}</span>
      }
    </span>
  `
})
export class SensitivityBadgeComponent {
  @Input() level: SensitivityLevel = 'public';
  @Input() compact = false;

  get meta() {
    return SENSITIVITY[this.level] ?? SENSITIVITY.internal;
  }
}
