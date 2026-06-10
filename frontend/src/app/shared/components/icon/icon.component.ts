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

/** Inner SVG markup — mirrors project/components.jsx and Style Guide.html */
export const ICON_CONTENT: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-3.6-3.6"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  tool: '<path d="M4 7h7M4 12h12M4 17h7"/><path d="M16 6l3 3-3 3"/>',
  skill: '<path d="M5 4h11l3 3v13H5z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  agent: '<path d="M12 3.2c.55 5.7 2.6 7.75 8.3 8.3-5.7.55-7.75 2.6-8.3 8.3-.55-5.7-2.6-7.75-8.3-8.3 5.7-.55 7.75-2.6 8.3-8.3Z"/><path d="M18.6 4.2c.2 1.9.85 2.55 2.75 2.75-1.9.2-2.55.85-2.75 2.75-.2-1.9-.85-2.55-2.75-2.75 1.9-.2 2.55-.85 2.75-2.75Z"/>',
  api: '<path d="M7 8l-4 4 4 4"/><path d="M17 8l4 4-4 4"/><path d="M14 5l-4 14"/>',
  check: '<path d="M5 12l4.5 4.5L19 7"/>',
  star: '<path d="M12 4l2.3 4.9 5.2.7-3.8 3.6 1 5.2-4.7-2.6-4.7 2.6 1-5.2-3.8-3.6 5.2-.7z"/>',
  install: '<path d="M12 3v11M8 11l4 4 4-4"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/>',
  external: '<path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M19 13v6H5V5h6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  filter: '<path d="M3 5h18l-7 8v5l-4 2v-7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3 7.5-8 9-5-1.5-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  verified: '<path d="M12 3l2.2 1.6 2.7-.2 1 2.5 2.3 1.4-.6 2.7.6 2.7-2.3 1.4-1 2.5-2.7-.2L12 21l-2.2-1.6-2.7.2-1-2.5L3.8 16l.6-2.7L3.8 10.6l2.3-1.4 1-2.5 2.7.2z"/><path d="M9 12l2 2 4-4"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 2.5 14.5 0 17M12 3.5c-2.5 2.5-2.5 14.5 0 17"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.2 6.2 0 0 0 10.5 10.5z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  book: '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M18 18H7a2 2 0 0 0-2 2"/>',
  code: '<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>',
  warning: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  flag: '<path d="M5 21V4h12l-2.5 4L17 12H5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/>',
  dot: '<circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>',
  bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  play: '<path d="M7 5l11 7-11 7z"/>',
  link: '<path d="M9 14a4 4 0 0 0 6 .5l2.5-2.5a4 4 0 1 0-5.7-5.7L10.5 8"/><path d="M15 10a4 4 0 0 0-6-.5L6.5 12a4 4 0 1 0 5.7 5.7L13.5 16"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  inbox: '<path d="M4 6h16v12H4z"/><path d="M4 8l8 5 8-5"/>',
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

    const content = ICON_CONTENT[this.name];
    if (!content) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = this.renderer.createElement('svg', svgNS) as SVGSVGElement;
    svg.setAttribute('xmlns', svgNS);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(this.size));
    svg.setAttribute('height', String(this.size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = content;

    host.appendChild(svg);
  }
}
