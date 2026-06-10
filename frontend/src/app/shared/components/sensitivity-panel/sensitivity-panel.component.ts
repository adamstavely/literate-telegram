import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensitivityLevel } from '../../types';
import { SENSITIVITY, SENS_ORDER } from '../../constants/sensitivity.constants';
import { IconComponent } from '../icon/icon.component';
import { SensBarsComponent } from '../sens-bars/sens-bars.component';
import { TooltipComponent } from '../tooltip/tooltip.component';

@Component({
  selector: 'app-sensitivity-panel',
  standalone: true,
  imports: [CommonModule, IconComponent, SensBarsComponent, TooltipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="aside-card sens-panel" [class]="'sens-' + level">
      <div class="section-title" style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px">
        Data sensitivity
        <app-tooltip label="The highest data-classification tier an admin has approved this for. Set by your org's governance policy.">
          <app-icon name="info" [size]="13" style="color: var(--faint); vertical-align: -2px"></app-icon>
        </app-tooltip>
      </div>
      <div class="sens-panel-head">
        <span class="sens-badge" [class]="'sens-' + level" style="height: 24px; font-size: 12px">
          <app-icon [name]="meta.icon" [size]="13"></app-icon>
          {{ meta.label }}
        </span>
        <app-sens-bars [level]="level"></app-sens-bars>
      </div>
      <div class="sens-panel-cap">
        Cleared to process <b>{{ meta.label.toLowerCase() }}</b> data and below.
      </div>
      <div class="sens-tiers">
        @for (tier of tiers; track tier.key) {
          <div
            class="sens-tier"
            [class.ok]="tier.allowed"
            [class.no]="!tier.allowed"
            [class.max]="tier.isMax"
            [class]="'sens-' + tier.key"
          >
            <span class="sens-tier-mark">
              <app-icon [name]="tier.allowed ? 'check' : 'close'" [size]="11"></app-icon>
            </span>
            <span class="sens-tier-label">
              {{ tier.label }}
              @if (tier.isMax) {
                <span class="sens-tier-tag">max</span>
              }
            </span>
            <span class="sens-tier-ex">{{ tier.example }}</span>
          </div>
        }
      </div>
      <div class="sens-panel-foot">
        <app-icon name="shield" [size]="13"></app-icon>
        <span>
          <ng-content select="[sens-footnote]"></ng-content>
          @if (!hasCustomFootnote) {
            @if (inherited) {
              Inherited from the <b>{{ inherited }}</b> server. The gateway blocks calls carrying higher-tier data.
            } @else {
              The gateway blocks any call that carries data above this tier.
            }
          }
        </span>
      </div>
    </div>
  `,
})
export class SensitivityPanelComponent {
  @Input() level: SensitivityLevel = 'internal';
  @Input() inherited?: string;
  @Input() hasCustomFootnote = false;

  get meta() {
    return SENSITIVITY[this.level] ?? SENSITIVITY.internal;
  }

  get tiers() {
    const maxRank = this.meta.rank;
    return SENS_ORDER.map((key) => ({
      key,
      label: SENSITIVITY[key].label,
      example: SENSITIVITY[key].example,
      allowed: SENSITIVITY[key].rank <= maxRank,
      isMax: key === this.level,
    }));
  }
}
