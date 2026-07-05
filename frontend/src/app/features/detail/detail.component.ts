import {
  Component,
  OnChanges,
  SimpleChanges,
  signal,
  computed,
  inject,
  DestroyRef,
  Input,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import { RegistryService } from '../../core/services/registry.service';
import {
  RegistryEntry,
  EntryType,
  Server,
  Tool,
  Skill,
  Agent,
  Api,
  SensitivityLevel,
} from '../../shared/types';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { VerifiedMarkComponent } from '../../shared/components/verified-mark/verified-mark.component';
import { SensitivityBadgeComponent } from '../../shared/components/sensitivity-badge/sensitivity-badge.component';
import { SensitivityPanelComponent } from '../../shared/components/sensitivity-panel/sensitivity-panel.component';
import { computeSkillSensitivity } from '../../shared/utils/skill-sensitivity';
import { buildToolExample } from '../../shared/utils/tool-example';
import { EndpointCardComponent } from '../../shared/components/endpoint-card/endpoint-card.component';

type TabId = 'overview' | 'install' | 'tools' | 'reviews';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IconComponent,
    VerifiedMarkComponent,
    SensitivityBadgeComponent,
    SensitivityPanelComponent,
    EndpointCardComponent,
  ],
  templateUrl: './detail.component.html',
})
export class DetailComponent implements OnChanges {
  @Input() type!: string;
  @Input() slug!: string;

  private readonly registry = inject(RegistryService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly entry = signal<RegistryEntry | null>(null);
  readonly parentServer = signal<Server | null>(null);
  readonly allServers = signal<Server[]>([]);
  readonly relatedSkills = signal<Skill[]>([]);
  readonly relatedAgents = signal<Agent[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Non-blocking notice when related data (parent server, related items) fails. */
  readonly relatedError = signal<string | null>(null);
  readonly activeTab = signal<TabId>('overview');
  readonly copied = signal(false);
  readonly copyAnnouncement = signal('');
  readonly openToolId = signal<string | null>(null);

  readonly isServer = computed(() => this.entry()?.type === 'server');
  readonly isTool = computed(() => this.entry()?.type === 'tool');
  readonly isSkill = computed(() => this.entry()?.type === 'skill');
  readonly isAgent = computed(() => this.entry()?.type === 'agent');
  readonly isApi = computed(() => this.entry()?.type === 'api');

  readonly asServer = computed(() =>
    this.isServer() ? (this.entry() as Server) : null,
  );
  readonly asTool = computed(() =>
    this.isTool() ? (this.entry() as Tool) : null,
  );
  readonly asSkill = computed(() =>
    this.isSkill() ? (this.entry() as Skill) : null,
  );
  readonly asAgent = computed(() =>
    this.isAgent() ? (this.entry() as Agent) : null,
  );
  readonly asApi = computed(() =>
    this.isApi() ? (this.entry() as Api) : null,
  );

  readonly skillEffectiveSensitivity = computed((): SensitivityLevel => {
    const skill = this.asSkill();
    if (!skill) return 'public';
    const derived = computeSkillSensitivity(skill, this.allServers());
    return derived ?? 'public';
  });

  readonly skillHasReaches = computed(() => {
    const skill = this.asSkill();
    return (skill?.reaches?.length ?? 0) > 0;
  });

  readonly toolExample = computed(() => {
    const tool = this.asTool();
    return tool ? buildToolExample(tool) : null;
  });

  readonly toolSignature = computed(() => {
    const tool = this.asTool();
    if (!tool) return '';
    const params = tool.params.map((p) => p.name).join(', ');
    return `(${params}) → ${tool.returns}`;
  });

  readonly typeIcon = computed(() => {
    const icons: Record<string, string> = {
      server: 'server', tool: 'tool', skill: 'skill', agent: 'agent', api: 'api',
    };
    return icons[this.entry()?.type ?? ''] ?? 'box';
  });

  readonly installCommand = computed(() => {
    const e = this.entry();
    if (!e) return '';
    return `npx @interop/cli add ${e.type} ${e.slug}`;
  });

  readonly configJson = computed(() => {
    const e = this.entry();
    if (!e) return '';
    const config: Record<string, unknown> = {
      name: e.name,
      type: e.type,
      slug: e.slug,
      version: e.version ?? 'latest',
    };
    if (e.type === 'server') {
      const s = e as Server;
      config['transport'] = s.transports[0] ?? 'stdio';
      config['auth'] = s.auth;
    }
    return JSON.stringify(config, null, 2);
  });

  readonly visibleTabs = computed(() => {
    const e = this.entry();
    if (e?.type === 'tool') return [];
    return [
      { id: 'overview' as TabId, label: 'Overview', show: true },
      { id: 'install' as TabId, label: 'Install / Connect', show: true },
      {
        id: 'tools' as TabId,
        label: `Tools${e?.type === 'server' ? ` (${(e as Server).tools?.length ?? 0})` : ''}`,
        show: e?.type === 'server',
      },
      { id: 'reviews' as TabId, label: 'Reviews', show: true },
    ].filter((t) => t.show);
  });

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.altKey || event.metaKey) && event.key === 'ArrowLeft') {
      event.preventDefault();
      void this.router.navigate(['/']);
    }
  }

  /** Emits on every navigation so in-flight requests for the previous entry
   *  are cancelled (switchMap) — last click wins, not last response. */
  private readonly nav$ = new Subject<{ type: string; slug: string }>();

  constructor() {
    this.nav$
      .pipe(
        switchMap(({ type, slug }) => {
          this.loading.set(true);
          this.error.set(null);
          this.resetEntryState();
          return this.registry.getEntry(type as EntryType, slug).pipe(
            catchError((err: unknown) => {
              console.error(err);
              this.error.set('Entry not found or failed to load.');
              this.loading.set(false);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((entry) => {
        if (!entry) return;
        this.entry.set(entry);
        document.title = `${entry.name} — Interop`;
        this.loadRelated(entry);
      });
  }

  // withComponentInputBinding() re-binds type/slug when navigating between
  // entries on the reused component instance. React to that, not just to first
  // construction, or the page shows stale content after in-app navigation.
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['type'] || changes['slug']) {
      this.nav$.next({ type: this.type, slug: this.slug });
    }
  }

  private resetEntryState(): void {
    this.entry.set(null);
    this.parentServer.set(null);
    this.relatedSkills.set([]);
    this.relatedAgents.set([]);
    this.relatedError.set(null);
    this.activeTab.set('overview');
    this.openToolId.set(null);
  }

  private loadRelated(entry: RegistryEntry): void {
    if (entry.type === 'skill') {
      this.registry
        .searchEntries({ type: 'server', size: 100 })
        .pipe(takeUntil(this.nav$), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.allServers.set(res.hits.filter((e): e is Server => e.type === 'server'));
            this.loading.set(false);
          },
          error: (err: unknown) => {
            console.error('Failed to load related servers', err);
            this.relatedError.set('Some related data could not be loaded.');
            this.loading.set(false);
          },
        });
      return;
    }

    if (entry.type !== 'tool') {
      this.loading.set(false);
      return;
    }

    const tool = entry as Tool;
    forkJoin({
      parent: this.registry
        .getEntry('server', tool.parentServer)
        .pipe(catchError(() => of(null))),
      catalog: this.registry.searchEntries({ size: 200 }),
    })
      .pipe(takeUntil(this.nav$), takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: ({ parent, catalog }) => {
        const server = parent?.type === 'server' ? parent : null;
        if (tool.parentServer && !server) {
          this.relatedError.set('Could not load parent server.');
        }
        if (server) this.parentServer.set(server);
        if (server) {
          const reachKeys = [
            `${server.slug} / ${tool.name}`,
            `${server.slug} / ${tool.slug}`,
          ];
          this.relatedSkills.set(
            catalog.hits.filter(
              (e): e is Skill =>
                e.type === 'skill' &&
                (e as Skill).reaches?.some((r) =>
                  reachKeys.some((k) => r.toLowerCase().includes(k.toLowerCase())),
                ),
            ),
          );
          this.relatedAgents.set(
            catalog.hits.filter(
              (e): e is Agent =>
                e.type === 'agent' &&
                (e as Agent).servers?.includes(server.slug),
            ),
          );
        }
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load related entries', err);
        this.relatedError.set('Some related data could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  retryRelated(): void {
    const entry = this.entry();
    if (!entry) return;
    this.relatedError.set(null);
    this.loading.set(true);
    this.loadRelated(entry);
  }

  setTab(tab: TabId): void {
    this.activeTab.set(tab);
  }

  /** Roving-tabindex arrow-key navigation for the tablist (WAI-ARIA tabs). */
  onTabKeydown(event: KeyboardEvent, currentId: TabId): void {
    const tabs = this.visibleTabs();
    const idx = tabs.findIndex((t) => t.id === currentId);
    if (idx < 0) return;

    let next = idx;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (idx + 1) % tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (idx - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = tabs[next];
    if (nextTab) {
      this.setTab(nextTab.id);
      document.getElementById(`tab-${nextTab.id}`)?.focus();
    }
  }

  toggleToolExpand(toolId: string, event?: Event): void {
    event?.stopPropagation();
    this.openToolId.set(this.openToolId() === toolId ? null : toolId);
  }

  openToolPage(slug: string, event: Event): void {
    event.stopPropagation();
    void this.router.navigate(['/entry', 'tool', slug]);
  }

  goBack(): void {
    void this.router.navigate(['/']);
  }

  openServer(slug: string): void {
    void this.router.navigate(['/entry', 'server', slug]);
  }

  runToolStub(): void {
    // Sandbox invoke — future modal
  }

  copyConfig(): void {
    void navigator.clipboard.writeText(this.configJson()).then(() => {
      this.copied.set(true);
      this.copyAnnouncement.set('Config JSON copied to clipboard');
      setTimeout(() => {
        this.copied.set(false);
        this.copyAnnouncement.set('');
      }, 2000);
    }).catch(() => {
      this.copyAnnouncement.set('Could not copy to clipboard');
      setTimeout(() => this.copyAnnouncement.set(''), 3000);
    });
  }

  copyInstall(): void {
    void navigator.clipboard.writeText(this.installCommand()).then(() => {
      this.copied.set(true);
      this.copyAnnouncement.set('Install command copied to clipboard');
      setTimeout(() => {
        this.copied.set(false);
        this.copyAnnouncement.set('');
      }, 2000);
    }).catch(() => {
      this.copyAnnouncement.set('Could not copy to clipboard');
      setTimeout(() => this.copyAnnouncement.set(''), 3000);
    });
  }

  formatInstalls(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
  }
}
