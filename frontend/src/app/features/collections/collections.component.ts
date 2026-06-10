import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RegistryService } from '../../core/services/registry.service';
import { Collection } from '../../shared/types';
import { CollectionCardComponent } from '../../shared/components/collection-card/collection-card.component';

@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [CommonModule, CollectionCardComponent],
  template: `
    <div class="container page">
      <div class="page-head">
        <div class="eyebrow">Curated stacks</div>
        <h1 class="h1" style="margin-top: 8px">Collections</h1>
        <p class="lede">
          Hand-picked sets of agents, servers, and skills that work together — installed and governed as one.
          Start from a stack instead of wiring the pieces yourself.
        </p>
      </div>
      @if (loading()) {
        <div class="skeleton" style="height: 200px"></div>
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
  private readonly destroyRef = inject(DestroyRef);

  readonly collections = signal<Collection[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.registry
      .getCollections()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cols) => {
          this.collections.set(cols);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
