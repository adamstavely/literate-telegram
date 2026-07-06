import { Component, Input, ChangeDetectionStrategy } from '@angular/core';


let tooltipSeq = 0;

@Component({
    selector: 'app-tooltip',
    imports: [],
    changeDetection: ChangeDetectionStrategy.OnPush,
    // The wrapper is focusable and describes itself via the tooltip, and the CSS
    // reveals the tooltip on :focus-within as well as :hover — so the content is
    // reachable by keyboard, not mouse-only (WCAG 1.4.13 / 2.1.1).
    template: `
    <span class="tt-wrap" tabindex="0" [attr.aria-describedby]="tooltipId">
      <ng-content></ng-content>
      <span class="tt" role="tooltip" [id]="tooltipId">{{ label }}</span>
    </span>
  `
})
export class TooltipComponent {
  @Input({ required: true }) label!: string;
  readonly tooltipId = `tt-${++tooltipSeq}`;
}
