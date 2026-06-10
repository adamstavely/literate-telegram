import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RegistryService } from '../../core/services/registry.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PendingEntry, RiskLevel, EntryType } from '../../shared/types';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, IconComponent],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
  private readonly registry = inject(RegistryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pending = signal<PendingEntry[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionInProgress = signal<string | null>(null);
  readonly toasts = signal<Toast[]>([]);

  // Modal state
  readonly rejectModalEntry = signal<PendingEntry | null>(null);
  readonly rejectReason = signal('');
  readonly changesModalEntry = signal<PendingEntry | null>(null);
  readonly changesText = signal('');

  readonly riskFilter = signal<RiskLevel | ''>('');
  readonly typeFilter = signal<EntryType | ''>('');
  readonly statusFilter = signal<'pending' | 'approved' | 'rejected' | ''>('pending');

  readonly kpi = computed(() => {
    const all = this.pending();
    return {
      awaiting: all.filter(e => e.status === 'pending').length,
      published: all.filter(e => e.status === 'approved').length,
      highRisk: all.filter(e => e.risk === 'high' || e.risk === 'critical').length,
    };
  });

  readonly statusTabs: Array<{ value: 'pending' | 'approved' | 'rejected' | ''; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: '', label: 'All' },
  ];

  readonly typeTabs: Array<{ value: EntryType | ''; label: string }> = [
    { value: '', label: 'All' },
    { value: 'server', label: 'Servers' },
    { value: 'tool', label: 'Tools' },
    { value: 'skill', label: 'Skills' },
    { value: 'agent', label: 'Agents' },
    { value: 'api', label: 'APIs' },
  ];

  readonly riskOptions: Array<{ value: RiskLevel | ''; label: string }> = [
    { value: '', label: 'All risks' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  ngOnInit(): void {
    this.loadPending();
  }

  loadPending(): void {
    this.loading.set(true);
    this.error.set(null);

    const filters = {
      status: this.statusFilter() || undefined,
      type: (this.typeFilter() as EntryType) || undefined,
      risk: this.riskFilter() || undefined,
    };

    this.registry
      .getPending(filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.pending.set(result.hits);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load pending entries.');
          this.loading.set(false);
        },
      });
  }

  setRiskFilter(risk: RiskLevel | ''): void {
    this.riskFilter.set(risk);
    this.loadPending();
  }

  setStatusFilter(status: 'pending' | 'approved' | 'rejected' | ''): void {
    this.statusFilter.set(status);
    this.loadPending();
  }

  setTypeFilter(type: EntryType | ''): void {
    this.typeFilter.set(type);
    this.loadPending();
  }

  approve(entry: PendingEntry): void {
    if (!confirm(`Approve "${entry.entry.name}"?`)) return;
    this.actionInProgress.set(entry.id);

    this.registry
      .approvePending(entry.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pending.update(list => list.filter(e => e.id !== entry.id));
          this.actionInProgress.set(null);
          this.showToast(`"${entry.entry.name}" approved`, 'success');
        },
        error: () => {
          this.actionInProgress.set(null);
          this.showToast('Approval failed', 'error');
        },
      });
  }

  openRejectModal(entry: PendingEntry): void {
    this.rejectModalEntry.set(entry);
    this.rejectReason.set('');
  }

  confirmReject(): void {
    const entry = this.rejectModalEntry();
    if (!entry || !this.rejectReason().trim()) return;
    this.actionInProgress.set(entry.id);

    this.registry
      .rejectPending(entry.id, this.rejectReason())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pending.update(list => list.filter(e => e.id !== entry.id));
          this.actionInProgress.set(null);
          this.rejectModalEntry.set(null);
          this.showToast(`"${entry.entry.name}" rejected`, 'success');
        },
        error: () => {
          this.actionInProgress.set(null);
          this.showToast('Rejection failed', 'error');
        },
      });
  }

  closeRejectModal(): void {
    this.rejectModalEntry.set(null);
  }

  showToast(message: string, type: 'success' | 'error'): void {
    const id = crypto.randomUUID();
    this.toasts.update(t => [...t, { id, message, type }]);
    setTimeout(() => {
      this.toasts.update(t => t.filter(x => x.id !== id));
    }, 4000);
  }

  dismissToast(id: string): void {
    this.toasts.update(t => t.filter(x => x.id !== id));
  }

  riskBarWidth(risk: RiskLevel): string {
    const map: Record<RiskLevel, string> = { low: '25%', medium: '50%', high: '75%', critical: '100%' };
    return map[risk];
  }
}
