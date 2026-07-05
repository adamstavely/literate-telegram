import { Component, OnChanges, SimpleChanges, signal, inject, DestroyRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RegistryService } from '../../core/services/registry.service';
import { AuthService } from '../../core/services/auth.service';
import { Collection, RegistryEntry } from '../../shared/types';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { SensitivityBadgeComponent } from '../../shared/components/sensitivity-badge/sensitivity-badge.component';
import { SensitivityPanelComponent } from '../../shared/components/sensitivity-panel/sensitivity-panel.component';
import { VerifiedMarkComponent } from '../../shared/components/verified-mark/verified-mark.component';

const KIND_META: Record<string, { icon: string; label: string; color: string; note: string }> = {
  agent: {
    icon: 'agent',
    label: 'Agents',
    color: '#8b46d6',
    note: 'The assembled assistant — it composes the servers and skills below.',
  },
  server: {
    icon: 'server',
    label: 'Servers',
    color: '#5a63d8',
    note: 'Governed capabilities. Each carries its own credential at the boundary.',
  },
  skill: {
    icon: 'skill',
    label: 'Skills',
    color: '#c2820b',
    note: 'Procedural knowledge that shapes how the agent uses the tools.',
  },
  api: {
    icon: 'api',
    label: 'APIs',
    color: '#0d9aa6',
    note: 'The raw service one layer below MCP.',
  },
};

@Component({
  selector: 'app-collection-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IconComponent,
    SensitivityBadgeComponent,
    SensitivityPanelComponent,
    VerifiedMarkComponent,
  ],
  templateUrl: './collection-detail.component.html',
})
export class CollectionDetailComponent implements OnChanges {
  @Input() id!: string;

  private readonly registry = inject(RegistryService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Only admins may jump to the governance/policy surface. */
  isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  readonly collection = signal<Collection | null>(null);
  readonly loading = signal(true);
  readonly added = signal(false);
  readonly error = signal<string | null>(null);

  readonly kindOrder = ['agent', 'server', 'skill', 'api'] as const;
  readonly kindMeta = KIND_META;

  // React to the route-bound id changing on the reused component instance.
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['id']) {
      this.loadCollection();
    }
  }

  private loadCollection(): void {
    this.loading.set(true);
    this.error.set(null);
    this.collection.set(null);
    this.added.set(false);
    this.registry
      .getCollection(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (col) => {
          this.collection.set(col);
          this.loading.set(false);
          document.title = `${col.title} — Interop`;
        },
        error: () => {
          this.error.set('Collection not found.');
          this.loading.set(false);
        },
      });
  }

  entriesByKind(kind: string): RegistryEntry[] {
    const col = this.collection();
    if (!col) return [];
    return col.entries.filter((e) => e.type === kind);
  }

  formatInstalls(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
  }

  openEntry(entry: RegistryEntry): void {
    void this.router.navigate(['/entry', entry.type, entry.slug]);
  }

  installStack(): void {
    this.added.set(true);
  }

  reviewGovernance(): void {
    void this.router.navigate(['/admin/policy']);
  }
}
