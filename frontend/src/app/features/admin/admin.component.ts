import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RegistryService } from '../../core/services/registry.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { TypeBadgeComponent } from '../../shared/components/type-badge/type-badge.component';
import { TYPE_META } from '../../shared/constants/type-meta.constants';
import { timeAgo } from '../../shared/utils/time-ago';
import {
  PendingEntry,
  RiskLevel,
  EntryType,
  RegistryEntry,
  Server,
  Tool,
} from '../../shared/types';

type QueueFilter = 'all' | 'server' | 'tool' | 'skill' | 'high';

interface Toast {
  name: string;
  verdict: string;
}

interface KpiCard {
  value: string | number;
  label: string;
  suffix?: string;
  trend?: string;
  up?: boolean;
  danger?: boolean;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, IconComponent, TypeBadgeComponent],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
  private readonly registry = inject(RegistryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<PendingEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionInProgress = signal<string | null>(null);
  readonly filter = signal<QueueFilter>('all');
  readonly toast = signal<Toast | null>(null);

  readonly filteredItems = computed(() => {
    const filter = this.filter();
    const list = this.items();
    if (filter === 'all') return list;
    if (filter === 'high') {
      return list.filter(i => i.risk === 'high');
    }
    return list.filter(i => i.entry.type === filter);
  });

  readonly kpis = computed((): KpiCard[] => {
    const list = this.items();
    const highRisk = list.filter(i => i.risk === 'high').length;
    return [
      { value: list.length, label: 'Awaiting review' },
      { value: 8, label: 'Published', trend: '+3 this week', up: true },
      { value: highRisk, label: 'High risk flagged', danger: true },
      { value: '2.1k', label: 'Avg time to review', suffix: 'min', trend: '−18%', up: true },
    ];
  });

  readonly filterTabs: Array<{ id: QueueFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'server', label: 'Servers' },
    { id: 'tool', label: 'Tools' },
    { id: 'skill', label: 'Skills' },
    { id: 'high', label: 'High risk' },
  ];

  readonly timeAgo = timeAgo;
  readonly typeMeta = TYPE_META;

  ngOnInit(): void {
    this.loadPending();
  }

  loadPending(): void {
    this.loading.set(true);
    this.error.set(null);

    this.registry
      .getPending({ status: 'pending' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.items.set(result.hits);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load pending entries.');
          this.loading.set(false);
        },
      });
  }

  setFilter(filter: QueueFilter): void {
    this.filter.set(filter);
  }

  tabLabel(tab: { id: QueueFilter; label: string }): string {
    if (tab.id === 'all') return `All · ${this.items().length}`;
    return tab.label;
  }

  typeIcon(entry: Partial<RegistryEntry>): string {
    const type = entry.type ?? 'server';
    return TYPE_META[type as EntryType]?.icon ?? 'server';
  }

  entryType(entry: Partial<RegistryEntry>): EntryType {
    return (entry.type ?? 'server') as EntryType;
  }

  entrySlug(entry: Partial<RegistryEntry>): string {
    return entry.slug ?? '';
  }

  entrySummary(entry: Partial<RegistryEntry>): string {
    return entry.summary ?? '';
  }

  entryPublisher(entry: Partial<RegistryEntry>): string {
    return entry.publisher ?? 'Unknown';
  }

  entryTransports(entry: Partial<RegistryEntry>): string[] {
    if (entry.type === 'server') {
      return (entry as Server).transports ?? [];
    }
    return [];
  }

  entryAuth(entry: Partial<RegistryEntry>): string | null {
    if (entry.type === 'server') {
      return (entry as Server).auth ?? null;
    }
    return (entry as { auth?: string }).auth ?? null;
  }

  entryToolCount(entry: Partial<RegistryEntry>): number {
    if (entry.type === 'server') {
      return (entry as Server).tools?.length ?? 0;
    }
    return 0;
  }

  entryParent(entry: Partial<RegistryEntry>): string | null {
    if (entry.type === 'tool') {
      return (entry as Tool).parentServer ?? null;
    }
    return null;
  }

  riskBarClass(risk: RiskLevel): string {
    if (risk === 'critical') return 'risk-high';
    return `risk-${risk}`;
  }

  flagHighClass(risk: RiskLevel): boolean {
    return risk === 'high';
  }

  riskBadgeTone(risk: RiskLevel): string {
    if (risk === 'critical' || risk === 'high') return 'danger';
    if (risk === 'medium') return 'warn';
    return 'ok';
  }

  riskLabel(risk: RiskLevel): string {
    return risk;
  }

  approve(entry: PendingEntry): void {
    this.actionInProgress.set(entry.id);

    this.registry
      .approvePending(entry.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removeItem(entry);
          this.actionInProgress.set(null);
          this.showToast(entry.entry.name ?? 'Entry', 'approved');
        },
        error: () => {
          this.actionInProgress.set(null);
          this.showToast(entry.entry.name ?? 'Entry', 'approval failed');
        },
      });
  }

  requestChanges(entry: PendingEntry): void {
    this.removeItem(entry);
    this.showToast(entry.entry.name ?? 'Entry', 'changes requested');
  }

  reject(entry: PendingEntry): void {
    this.removeItem(entry);
    this.showToast(entry.entry.name ?? 'Entry', 'rejected');
  }

  private removeItem(entry: PendingEntry): void {
    this.items.update(list => list.filter(e => e.id !== entry.id));
  }

  private showToast(name: string, verdict: string): void {
    this.toast.set({ name, verdict });
    setTimeout(() => this.toast.set(null), 2600);
  }
}
