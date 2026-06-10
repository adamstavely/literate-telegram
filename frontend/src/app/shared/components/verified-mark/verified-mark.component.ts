import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  ElementRef,
  Renderer2,
  inject,
} from '@angular/core';

function buildSealPath(cx: number, cy: number, outerR: number, innerR: number, bumps: number): string {
  const points: Array<[number, number]> = [];
  const total = bumps * 2;
  for (let i = 0; i < total; i++) {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }

  let d = `M ${points[0][0].toFixed(3)} ${points[0][1].toFixed(3)}`;
  for (let i = 1; i <= points.length; i++) {
    const [x, y] = points[i % points.length];
    d += ` L ${x.toFixed(3)} ${y.toFixed(3)}`;
  }
  d += ' Z';
  return d;
}

@Component({
  selector: 'app-verified-mark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span aria-label="Verified" role="img" class="verified-wrap">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        aria-hidden="true"
      >
        <path
          [attr.d]="sealPath"
          fill="var(--accent, #3b5bff)"
        />
        <path
          d="M6 9l2 2 4-4"
          stroke="white"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
      </svg>
    </span>
  `,
  styles: [`
    .verified-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  `],
})
export class VerifiedMarkComponent {
  readonly sealPath = buildSealPath(9, 9, 8, 6.2, 12);
}
