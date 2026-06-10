import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tooltip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="tt-wrap">
      <ng-content></ng-content>
      <span class="tt" role="tooltip">{{ label }}</span>
    </span>
  `,
})
export class TooltipComponent {
  @Input({ required: true }) label!: string;
}
