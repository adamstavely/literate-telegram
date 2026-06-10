import {
  Component,
  OnInit,
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
import { RegistryService } from '../../core/services/registry.service';
import {
  RegistryEntry,
  EntryType,
  Server,
  Tool,
  Skill,
  Agent,
  Api,
} from '../../shared/types';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { VerifiedMarkComponent } from '../../shared/components/verified-mark/verified-mark.component';
import { SensitivityBadgeComponent } from '../../shared/components/sensitivity-badge/sensitivity-badge.component';

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
  ],
  templateUrl: './detail.component.html',
  styleUrl: './detail.component.scss',
})
export class DetailComponent implements OnInit {
  /** Bound via withComponentInputBinding() from route params. */
  @Input() type!: string;
  @Input() slug!: string;

  private readonly registry = inject(RegistryService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly entry = signal<RegistryEntry | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<TabId>('overview');
  readonly copied = signal(false);

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
    return [
      { id: 'overview' as TabId, label: 'Overview', show: true },
      { id: 'install' as TabId, label: 'Install / Connect', show: true },
      { id: 'tools' as TabId, label: `Tools${e?.type === 'server' ? ` (${(e as Server).tools?.length ?? 0})` : ''}`, show: e?.type === 'server' },
      { id: 'reviews' as TabId, label: 'Reviews', show: true },
    ].filter(t => t.show);
  });

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.altKey || event.metaKey) && event.key === 'ArrowLeft') {
      event.preventDefault();
      void this.router.navigate(['/']);
    }
  }

  ngOnInit(): void {
    this.registry
      .getEntry(this.type as EntryType, this.slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: entry => {
          this.entry.set(entry);
          this.loading.set(false);
          // Update the page title dynamically.
          document.title = `${entry.name} — Interop`;
        },
        error: (err: unknown) => {
          this.error.set('Entry not found or failed to load.');
          this.loading.set(false);
          console.error(err);
        },
      });
  }

  setTab(tab: TabId): void {
    this.activeTab.set(tab);
  }

  goBack(): void {
    void this.router.navigate(['/']);
  }

  copyConfig(): void {
    void navigator.clipboard.writeText(this.configJson()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  copyInstall(): void {
    void navigator.clipboard.writeText(this.installCommand()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  formatInstalls(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
  }
}
