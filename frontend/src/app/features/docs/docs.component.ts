import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  Input,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { DOC_SECTIONS, DOC_ARTICLES, DocArticle } from './docs-content';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './docs.component.html',
  styleUrl: './docs.component.scss',
})
export class DocsComponent implements OnInit {
  private readonly sanitizer = inject(DomSanitizer);

  /** Bound via withComponentInputBinding() from route params. */
  @Input() articleId?: string;

  readonly sections = signal(DOC_SECTIONS);
  readonly articles = signal<DocArticle[]>(DOC_ARTICLES);
  readonly activeArticle = signal<DocArticle | null>(null);

  readonly categories = computed(() => this.sections().map(s => s.label));

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
  }

  selectArticle(article: DocArticle): void {
    this.activeArticle.set(article);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderContent(body: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(body);
  }
}
