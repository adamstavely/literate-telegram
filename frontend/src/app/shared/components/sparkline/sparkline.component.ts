import { Component, Input, ChangeDetectionStrategy, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function () {
    h ^= h << 13;
    h ^= h >> 7;
    h ^= h << 17;
    return (h >>> 0) / 4294967296;
  };
}

@Component({
  selector: 'app-sparkline',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="width"
      [attr.height]="height"
      [attr.viewBox]="'0 0 ' + width + ' ' + height"
      aria-hidden="true"
      role="presentation"
      style="display:block;overflow:visible"
    >
      <defs>
        <linearGradient [id]="gradId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent, #3b5bff)" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="var(--accent, #3b5bff)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path
        [attr.d]="fillPath"
        [attr.fill]="'url(#' + gradId + ')'"
      />
      <path
        [attr.d]="linePath"
        fill="none"
        stroke="var(--accent, #3b5bff)"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle
        [attr.cx]="lastX"
        [attr.cy]="lastY"
        r="2"
        fill="var(--accent, #3b5bff)"
      />
    </svg>
  `,
  styles: [':host { display: inline-flex; }'],
})
export class SparklineComponent implements OnChanges {
  @Input() seed = 'default';
  @Input() width = 52;
  @Input() height = 20;

  linePath = '';
  fillPath = '';
  lastX = 0;
  lastY = 0;
  gradId = '';

  ngOnChanges(): void {
    this.gradId = 'grad-' + this.seed.replace(/[^a-z0-9]/gi, '') + '-' + this.width;
    this.generate();
  }

  private generate(): void {
    const rand = seededRandom(this.seed);
    const points = 8;
    const pad = 2;
    const usableW = this.width - pad * 2;
    const usableH = this.height - pad * 2;

    const ys: number[] = [];
    let prev = 0.5;
    for (let i = 0; i < points; i++) {
      prev = Math.max(0.05, Math.min(0.95, prev + (rand() - 0.5) * 0.35));
      ys.push(prev);
    }

    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rangeY = maxY - minY || 1;

    const coords: Array<[number, number]> = ys.map((y, i) => [
      pad + (i / (points - 1)) * usableW,
      pad + (1 - (y - minY) / rangeY) * usableH,
    ]);

    // Build smooth cubic bezier line
    let d = `M ${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`;
    for (let i = 1; i < coords.length; i++) {
      const [x0, y0] = coords[i - 1];
      const [x1, y1] = coords[i];
      const cpx = (x0 + x1) / 2;
      d += ` C ${cpx.toFixed(2)} ${y0.toFixed(2)} ${cpx.toFixed(2)} ${y1.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    }

    this.linePath = d;
    this.lastX = coords[coords.length - 1][0];
    this.lastY = coords[coords.length - 1][1];

    // Fill path: continue line down to baseline and back
    const fillClose = ` L ${this.lastX.toFixed(2)} ${(this.height - pad).toFixed(2)} L ${pad.toFixed(2)} ${(this.height - pad).toFixed(2)} Z`;
    this.fillPath = d + fillClose;
  }
}
