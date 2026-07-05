import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  DestroyRef,
  ElementRef,
  ViewChild,
  effect,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FocusTrapFactory } from '@angular/cdk/a11y';
import { RegistryService } from '../../core/services/registry.service';
import { activateFocusTrap } from '../../shared/utils/focus-trap.util';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { TypeBadgeComponent } from '../../shared/components/type-badge/type-badge.component';
import { TYPE_META } from '../../shared/constants/type-meta.constants';
import { timeAgo } from '../../shared/utils/time-ago';
import {
  AppStats,
  PendingEntry,
  PendingStats,
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
  imports: [RouterLink, FormsModule, IconComponent, TypeBadgeComponent],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
  private readonly registry = inject(RegistryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly focusTrapFactory = inject(FocusTrapFactory);
  private releaseFocusTrap: (() => void) | null = null;
  private releaseApproveTrap: (() => void) | null = null;

  @ViewChild('rejectModal') rejectModalRef?: ElementRef<HTMLDivElement>;
  @ViewChild('approveModal') approveModalRef?: ElementRef<HTMLDivElement>;

  readonly items = signal<PendingEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionInProgress = signal<string | null>(null);
  readonly filter = signal<QueueFilter>('all');
  readonly toast = signal<Toast | null>(null);
  readonly registryStats = signal<AppStats | null>(null);
  readonly pendingStats = signal<PendingStats | null>(null);
  readonly statsError = signal<string | null>(null);

  /** Accessible reject / request-changes dialog state (replaces window.prompt). */
  readonly rejectDialog = signal<{ entry: PendingEntry; mode: 'reject' | 'changes' } | null>(null);
  readonly approveDialog = signal<PendingEntry | null>(null);
  readonly rejectReason = signal('');
  readonly rejectError = signal<string | null>(null);

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
    const stats = this.registryStats();
    const pending = this.pendingStats();
    const statsFailed = this.statsError() !== null;
    const highRisk = statsFailed
      ? '—'
      : (pending?.highRiskPending ?? list.filter(i => i.risk === 'high' || i.risk === 'critical').length);
    const published = statsFailed ? '—' : (stats?.totalEntries ?? 0);
    const approvedThisWeek = pending?.approvedThisWeek ?? 0;
    const avgReview = statsFailed ? '—' : pending?.avgReviewTimeMinutes;

    return [
      { value: statsFailed ? '—' : (pending?.pendingCount ?? list.length), label: 'Awaiting review' },
      {
        value: published,
        label: 'Published',
        trend: approvedThisWeek > 0 ? `+${approvedThisWeek} this week` : undefined,
        up: approvedThisWeek > 0,
      },
      { value: highRisk, label: 'High risk flagged', danger: true },
      {
        value: avgReview ?? '—',
        label: 'Avg time to review',
        suffix: avgReview != null ? 'min' : undefined,
      },
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

  constructor() {
    effect(() => {
      const open = this.rejectDialog();
      if (open && this.rejectModalRef?.nativeElement) {
        queueMicrotask(() => {
          const el = this.rejectModalRef?.nativeElement;
          if (el) {
            this.releaseFocusTrap?.();
            this.releaseFocusTrap = activateFocusTrap(this.focusTrapFactory, el);
          }
        });
      } else if (!open) {
        this.releaseFocusTrap?.();
        this.releaseFocusTrap = null;
      }
    });

    effect(() => {
      const open = this.approveDialog();
      if (open && this.approveModalRef?.nativeElement) {
        queueMicrotask(() => {
          const el = this.approveModalRef?.nativeElement;
          if (el) {
            this.releaseApproveTrap?.();
            this.releaseApproveTrap = activateFocusTrap(this.focusTrapFactory, el);
          }
        });
      } else if (!open) {
        this.releaseApproveTrap?.();
        this.releaseApproveTrap = null;
      }
    });
  }

  ngOnInit(): void {
    this.loadStats();
    this.loadPending();
  }

  loadStats(): void {
    this.statsError.set(null);

    this.registry
      .getStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: s => this.registryStats.set(s),
        error: () => this.statsError.set('Could not load registry statistics.'),
      });

    this.registry
      .getPendingStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: s => this.pendingStats.set(s),
        error: () => this.statsError.set('Could not load moderation statistics.'),
      });
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

  /** Roving-tabindex arrow-key navigation for the queue filter tablist. */
  onFilterKeydown(event: KeyboardEvent, currentId: QueueFilter): void {
    const tabs = this.filterTabs;
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
      this.setFilter(nextTab.id);
      document.getElementById(`filter-tab-${nextTab.id}`)?.focus();
    }
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
    this.approveDialog.set(entry);
  }

  cancelApproveDialog(): void {
    this.approveDialog.set(null);
  }

  confirmApproveDialog(): void {
    const entry = this.approveDialog();
    if (!entry) return;
    this.approveDialog.set(null);
    this.executeApprove(entry);
  }

  private executeApprove(entry: PendingEntry): void {
    this.actionInProgress.set(entry.id);

    this.registry
      .approvePending(entry.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removeItem(entry);
          this.actionInProgress.set(null);
          this.showToast(entry.entry.name ?? 'Entry', 'approved');
          this.loadStats();
        },
        error: () => {
          this.actionInProgress.set(null);
          this.showToast(entry.entry.name ?? 'Entry', 'approval failed');
        },
      });
  }

  requestChanges(entry: PendingEntry): void {
    this.openRejectDialog(entry, 'changes');
  }

  reject(entry: PendingEntry): void {
    this.openRejectDialog(entry, 'reject');
  }

  private openRejectDialog(entry: PendingEntry, mode: 'reject' | 'changes'): void {
    this.rejectReason.set('');
    this.rejectError.set(null);
    this.rejectDialog.set({ entry, mode });
  }

  cancelRejectDialog(): void {
    this.rejectDialog.set(null);
  }

  confirmRejectDialog(): void {
    const ctx = this.rejectDialog();
    if (!ctx) return;
    const text = this.rejectReason().trim();
    if (text.length < 10) {
      this.rejectError.set('Please enter at least 10 characters.');
      return;
    }
    const reason = ctx.mode === 'changes' ? `Changes requested: ${text}` : text;
    const verdict = ctx.mode === 'changes' ? 'changes requested' : 'rejected';
    this.rejectDialog.set(null);
    this.rejectEntry(ctx.entry, reason, verdict);
  }

  private rejectEntry(entry: PendingEntry, reason: string, verdict: string): void {
    this.actionInProgress.set(entry.id);

    this.registry
      .rejectPending(entry.id, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removeItem(entry);
          this.actionInProgress.set(null);
          this.showToast(entry.entry.name ?? 'Entry', verdict);
          this.loadStats();
        },
        error: () => {
          this.actionInProgress.set(null);
          this.showToast(entry.entry.name ?? 'Entry', `${verdict} failed`);
        },
      });
  }

  private removeItem(entry: PendingEntry): void {
    this.items.update(list => list.filter(e => e.id !== entry.id));
  }

  private showToast(name: string, verdict: string): void {
    this.toast.set({ name, verdict });
    setTimeout(() => this.toast.set(null), 2600);
  }
}
