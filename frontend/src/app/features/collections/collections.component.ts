import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { RegistryService } from '../../core/services/registry.service';
import { AuthService } from '../../core/services/auth.service';
import { Collection } from '../../shared/types';
import { CollectionCardComponent } from '../../shared/components/collection-card/collection-card.component';

@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [CommonModule, RouterLink, CollectionCardComponent],
  template: `
    <div class="container page">
      <div class="page-head">
        <div class="eyebrow">Curated stacks</div>
        <h1 class="h1" style="margin-top: 8px">Collections</h1>
        <p class="lede">
          Hand-picked sets of agents, servers, and skills that work together — installed and governed as one.
          Start from a stack instead of wiring the pieces yourself.
        </p>
        @if (isAdmin()) {
          <a class="btn btn-primary btn-sm" routerLink="/collections/new" style="margin-top: 14px">
            + New collection
          </a>
        }
      </div>
      @if (loading()) {
        <div class="skeleton" style="height: 200px"></div>
      } @else if (error()) {
        <div class="callout" role="alert">
          {{ error() }}
          <button type="button" class="inline-link" (click)="loadCollections()">Retry</button>
        </div>
      } @else {
        <div class="grid col-grid">
          @for (col of collections(); track col.id) {
            <app-collection-card [collection]="col"></app-collection-card>
          }
        </div>
      }
    </div>
  `,
})
export class CollectionsComponent implements OnInit {
  private readonly registry = inject(RegistryService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  /** Only admins can create collections (POST /api/collections requires admin). */
  readonly isAdmin = toSignal(this.auth.isAdmin$, { initialValue: this.auth.isAdmin() });

  readonly collections = signal<Collection[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadCollections();
  }

  loadCollections(): void {
    this.loading.set(true);
    this.error.set(null);
    this.registry
      .getCollections()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cols) => {
          this.collections.set(cols);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load collections.');
          this.loading.set(false);
        },
      });
  }
}
