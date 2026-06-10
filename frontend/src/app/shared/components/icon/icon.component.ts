import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ElementRef,
  Renderer2,
  inject,
} from '@angular/core';

export const ICON_PATHS: Record<string, string> = {
  search: 'M11 5a6 6 0 1 0-1.17 3.64l3.7 3.71a.83.83 0 0 0 1.18-1.18l-3.7-3.7A6 6 0 0 0 11 5zm-6 0a4 4 0 1 1 8 0 4 4 0 0 1-8 0z',
  server: 'M3 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zm0 8a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4zm3-7.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1zm0 8a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z',
  tool: 'M14.7 3.3a1 1 0 0 0-1.4 0L10 6.6 8.4 5a1 1 0 0 0-1.5 1.3l1.6 1.6-4.2 4.2a2 2 0 0 0 2.8 2.8l4.2-4.2 1.6 1.6a1 1 0 0 0 1.3-1.5L12.6 9l3.4-3.3a1 1 0 0 0 0-1.4z',
  skill: 'M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 4v1h8V7H6zm0 3v1h8v-1H6zm0 3v1h5v-1H6z',
  agent: 'M12 2a5 5 0 0 1 3.54 8.54l-.07.07A6 6 0 0 1 18 16v1a1 1 0 0 1-2 0v-1a4 4 0 0 0-8 0v1a1 1 0 0 1-2 0v-1a6 6 0 0 1 2.53-4.39l-.07-.07A5 5 0 0 1 12 2zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  api: 'M5 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2h4V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1v6h1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2H9v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h1V7H6a1 1 0 0 1-1-1V4z',
  check: 'M4 8l4 4 8-8',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  install: 'M12 3v11m0 0-4-4m4 4 4-4M3 20h18',
  external: 'M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4m-6 0 7-7m0 0h-5m5 0v5',
  bell: 'M6 10a6 6 0 1 1 12 0c0 3.5 1 5 1 5H5s1-1.5 1-5zm3.7 7a2.4 2.4 0 0 0 4.6 0',
  close: 'M18 6 6 18M6 6l12 12',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  grid: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
  list: 'M3 6h18M3 10h18M3 14h18M3 18h18',
  filter: 'M4 6h16M7 10h10M10 14h4',
  plus: 'M12 4v16m-8-8h16',
  shield: 'M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z',
  globe: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 2c.55 0 1.67.74 2.66 2.86M12 4c-.55 0-1.67.74-2.66 2.86M3.34 9h17.32M3.34 15h17.32M12 4v16m-7.66-9c0-2.4.63-4.63 1.7-6.14M19.66 11c0-2.4-.63-4.63-1.7-6.14',
  lock: 'M17 11H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zm-5 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM7 11V7a5 5 0 0 1 10 0v4',
  sun: 'M12 3v2m0 14v2M5.64 5.64l1.42 1.42m9.9 9.9 1.42 1.42M3 12h2m14 0h2M5.64 18.36l1.42-1.42m9.9-9.9 1.42-1.42M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  copy: 'M8 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2M8 6V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V6z',
  book: 'M4 4h8a4 4 0 0 1 4 4v12H4V4zm8 0a4 4 0 0 1 4 4v12',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  warning: 'M12 2L2 19h20L12 2zm0 4v6m0 3v1',
  flag: 'M4 4h12l-2 6 2 6H4V4z',
  refresh: 'M4 12a8 8 0 0 1 14.93-4M20 12a8 8 0 0 1-14.93 4M1 12h6M17 12h6',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-8 16a8 8 0 0 1 16 0',
  dot: 'M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  clock: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 5v5l3 3',
  play: 'M5 3l14 9-14 9V3z',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  box: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8zM12 3l7 4-7 4-7-4 7-4zm-9 5 9 5 9-5m-9 5v9',
  info: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 5v4m0 4v1',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: [':host { display: inline-flex; align-items: center; justify-content: center; }'],
})
export class IconComponent implements OnChanges {
  @Input() name = '';
  @Input() size = 16;

  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnChanges(_changes: SimpleChanges): void {
    this.render();
  }

  private render(): void {
    const host = this.el.nativeElement as HTMLElement;
    host.innerHTML = '';

    const path = ICON_PATHS[this.name];
    if (!path) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = this.renderer.createElement('svg', svgNS) as SVGSVGElement;
    svg.setAttribute('xmlns', svgNS);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(this.size));
    svg.setAttribute('height', String(this.size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

    // Handle multiple paths separated by space that look like M commands
    const paths = path.split(/(?=M)/).filter(Boolean);
    for (const d of paths) {
      const pathEl = this.renderer.createElement('path', svgNS) as SVGPathElement;
      pathEl.setAttribute('d', d.trim());
      svg.appendChild(pathEl);
    }

    host.appendChild(svg);
  }
}
