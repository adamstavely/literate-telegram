import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  DestroyRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, Subject, switchMap, catchError, of } from 'rxjs';
import { RegistryService, RegistryStats } from '../../core/services/registry.service';
import { RegistryEntry, SearchParams, EntryType, Collection } from '../../shared/types';
import { EntryCardComponent } from '../../shared/components/entry-card/entry-card.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { CollectionCardComponent } from '../../shared/components/collection-card/collection-card.component';

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

@Component({
    selector: 'app-browse',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, EntryCardComponent, IconComponent, CollectionCardComponent],
    changeDetection: ChangeDetectionStrategy.Default,
    templateUrl: './browse.component.html'
})
export class BrowseComponent implements OnInit {
  private readonly registry = inject(RegistryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly entries = signal<RegistryEntry[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly stats = signal<RegistryStats | null>(null);
  readonly statsError = signal(false);
  readonly featuredCollections = signal<Collection[]>([]);
  readonly collectionsError = signal<string | null>(null);
  readonly collectionsLoading = signal(false);

  readonly searchQuery = signal('');
  readonly activeType = signal<EntryType | ''>('');
  readonly activeCategory = signal('');
  readonly activeClient = signal('');
  readonly sortBy = signal<SearchParams['sort']>('installs');
  readonly currentPage = signal(0);
  readonly viewMode = signal<'grid' | 'list'>('grid');

  readonly pageSize = 12;
  readonly totalPages = computed(() => Math.ceil(this.total() / this.pageSize));
  readonly skeletonItems = Array.from({ length: 12 }, (_, i) => i);

  readonly showFeaturedStrip = computed(
    () =>
      !this.activeType() &&
      !this.activeCategory() &&
      !this.activeClient() &&
      !this.searchQuery().trim(),
  );

  readonly activeFilters = computed<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];
    if (this.activeType()) filters.push({ key: 'type', label: 'Type', value: this.activeType() });
    if (this.activeCategory()) filters.push({ key: 'category', label: 'Category', value: this.activeCategory() });
    if (this.activeClient()) filters.push({ key: 'client', label: 'Client', value: this.activeClient() });
    return filters;
  });

  private readonly search$ = new Subject<SearchParams>();

  readonly typeOptions: Array<{ label: string; value: EntryType | ''; icon: string }> = [
    { label: 'Everything', value: '', icon: 'grid' },
    { label: 'Agents', value: 'agent', icon: 'agent' },
    { label: 'Servers', value: 'server', icon: 'server' },
    { label: 'APIs', value: 'api', icon: 'api' },
    { label: 'Tools', value: 'tool', icon: 'tool' },
    { label: 'Skills', value: 'skill', icon: 'skill' },
  ];

  readonly categoryOptions = [
    'Developer Tools', 'Productivity', 'Data & Analytics', 'Communication',
    'Security', 'Infrastructure', 'AI & ML', 'Finance', 'Healthcare',
    'Education', 'Entertainment', 'E-commerce',
  ];

  readonly clientOptions = [
    'Claude', 'GPT-4', 'Gemini', 'Cursor', 'Windsurf', 'Continue', 'Cline',
  ];

  ngOnInit(): void {
    this.loadStats();
    this.loadCollections();

    // Read initial params from URL
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.searchQuery.set(params['q'] ?? '');
      this.activeType.set(params['type'] ?? '');
      this.activeCategory.set(params['category'] ?? '');
      this.activeClient.set(params['client'] ?? '');
      this.sortBy.set(params['sort'] ?? 'installs');
      this.currentPage.set(Number(params['page'] ?? 0));
      this._triggerSearch();
    });

    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap(params => {
          this.loading.set(true);
          this.error.set(null);
          return this.registry.searchEntries(params).pipe(
            catchError(() => {
              this.error.set('Failed to load entries. Please try again.');
              this.loading.set(false);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(result => {
        if (result) {
          this.entries.set(result.hits);
          this.total.set(result.total);
        }
        this.loading.set(false);
      });
  }

  onQueryChange(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(0);
    this._updateUrl();
  }

  setType(type: EntryType | ''): void {
    this.activeType.set(type);
    this.currentPage.set(0);
    this._updateUrl();
  }

  setCategory(category: string): void {
    this.activeCategory.set(this.activeCategory() === category ? '' : category);
    this.currentPage.set(0);
    this._updateUrl();
  }

  setClient(client: string): void {
    this.activeClient.set(this.activeClient() === client ? '' : client);
    this.currentPage.set(0);
    this._updateUrl();
  }

  setSort(sort: SearchParams['sort']): void {
    this.sortBy.set(sort);
    this._updateUrl();
  }

  removeFilter(filter: ActiveFilter): void {
    if (filter.key === 'type') this.activeType.set('');
    if (filter.key === 'category') this.activeCategory.set('');
    if (filter.key === 'client') this.activeClient.set('');
    this._updateUrl();
  }

  clearAllFilters(): void {
    this.activeType.set('');
    this.activeCategory.set('');
    this.activeClient.set('');
    this.searchQuery.set('');
    this.currentPage.set(0);
    this._updateUrl();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this._updateUrl();
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode.set(mode);
  }

  private _updateUrl(): void {
    const qp: Record<string, string | number | null> = {};
    if (this.searchQuery()) qp['q'] = this.searchQuery();
    if (this.activeType()) qp['type'] = this.activeType();
    if (this.activeCategory()) qp['category'] = this.activeCategory();
    if (this.activeClient()) qp['client'] = this.activeClient();
    if (this.sortBy() !== 'installs') qp['sort'] = this.sortBy() ?? 'installs';
    if (this.currentPage() > 0) qp['page'] = this.currentPage();

    // Navigating updates the URL, which the queryParams subscription reacts to
    // by running the search. Don't also trigger it here — that double-fetches.
    void this.router.navigate([], { queryParams: qp });
  }

  private _triggerSearch(): void {
    const params: SearchParams = {
      q: this.searchQuery() || undefined,
      type: (this.activeType() as EntryType) || undefined,
      category: this.activeCategory() || undefined,
      client: this.activeClient() || undefined,
      sort: this.sortBy(),
      page: this.currentPage(),
      size: this.pageSize,
    };
    this.search$.next(params);
  }

  /** Re-run the current search without changing filters (used by "Retry"). */
  retrySearch(): void {
    this.error.set(null);
    this._triggerSearch();
  }

  loadStats(): void {
    this.registry.getStats().subscribe({
      next: s => {
        this.stats.set(s);
        this.statsError.set(false);
      },
      error: () => this.statsError.set(true),
    });
  }

  loadCollections(): void {
    this.collectionsLoading.set(true);
    this.collectionsError.set(null);
    this.registry.getCollections().subscribe({
      next: cols => {
        this.featuredCollections.set(cols.slice(0, 4));
        this.collectionsLoading.set(false);
      },
      error: () => {
        this.collectionsError.set('Could not load featured collections.');
        this.collectionsLoading.set(false);
      },
    });
  }

  trackEntry(_index: number, entry: RegistryEntry): string {
    return entry.id;
  }

  statCount(type: EntryType | ''): number {
    const byType = this.stats()?.totalByType;
    if (!byType) return 0;
    if (type === '') {
      return (Object.values(byType) as number[]).reduce((sum, n) => sum + n, 0);
    }
    return byType[type] ?? 0;
  }
}
