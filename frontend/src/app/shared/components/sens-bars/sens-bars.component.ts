import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensitivityLevel } from '../../types';
import { SENSITIVITY } from '../../constants/sensitivity.constants';

@Component({
  selector: 'app-sens-bars',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sens-bars" [ngClass]="'sens-' + level" aria-hidden="true">
      @for (i of bars; track i) {
        <i [class.on]="i <= rank"></i>
      }
    </span>
  `,
})
export class SensBarsComponent {
  @Input() level: SensitivityLevel = 'internal';

  readonly bars = [0, 1, 2, 3];

  get rank(): number {
    return (SENSITIVITY[this.level] ?? SENSITIVITY.internal).rank;
  }
}
