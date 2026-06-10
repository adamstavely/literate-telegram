import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  Input,
  HostListener,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DOC_SECTIONS, DOC_ARTICLES, DocArticle } from './docs-content';
import { IconComponent } from '../../shared/components/icon/icon.component';

export interface DocTocHeading {
  id: string;
  label: string;
}

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './docs.component.html',
})
export class DocsComponent implements OnInit {
  private readonly sanitizer = inject(DomSanitizer);

  /** Bound via withComponentInputBinding() from route params. */
  @Input() articleId?: string;

  readonly sections = signal(DOC_SECTIONS);
  readonly articles = signal<DocArticle[]>(DOC_ARTICLES);
  readonly activeArticle = signal<DocArticle | null>(null);
  readonly activeTocId = signal<string | null>(null);

  readonly articlesByCategory = computed(() => {
    const map = new Map<string, DocArticle[]>();
    for (const section of this.sections()) {
      const sectionArticles = this.articles().filter(a => a.section === section.id);
      if (sectionArticles.length > 0) {
        map.set(section.label, sectionArticles);
      }
    }
    return map;
  });

  readonly tocHeadings = computed((): DocTocHeading[] => {
    const article = this.activeArticle();
    if (!article) return [];
    const matches = [...article.body.matchAll(/<h2[^>]*\sid="([^"]+)"[^>]*>([^<]+)<\/h2>/g)];
    return matches.map(m => ({ id: m[1], label: m[2].trim() }));
  });

  readonly prevArticle = computed(() => {
    const active = this.activeArticle();
    if (!active) return null;
    const all = this.articles();
    const idx = all.findIndex(a => a.id === active.id);
    return idx > 0 ? all[idx - 1] : null;
  });

  readonly nextArticle = computed(() => {
    const active = this.activeArticle();
    if (!active) return null;
    const all = this.articles();
    const idx = all.findIndex(a => a.id === active.id);
    return idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  });

  ngOnInit(): void {
    const id = this.articleId ?? 'introduction';
    const found = this.articles().find(a => a.id === id);
    this.activeArticle.set(found ?? this.articles()[0] ?? null);
    this.resetToc();
  }

  selectArticle(article: DocArticle): void {
    this.activeArticle.set(article);
    this.resetToc();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderContent(body: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(body);
  }

  formatDate(iso: string): string {
    try {
      return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  scrollToHeading(id: string, event: Event): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const headings = this.tocHeadings();
    if (headings.length < 2) return;

    let current = headings[0]?.id ?? null;
    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el && el.getBoundingClientRect().top <= 120) {
        current = heading.id;
      }
    }
    this.activeTocId.set(current);
  }

  private resetToc(): void {
    const first = this.tocHeadings()[0]?.id ?? null;
    this.activeTocId.set(first);
    queueMicrotask(() => this.onWindowScroll());
  }
}
