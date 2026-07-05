import { Component, signal, computed, inject, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { RegistryService } from '../../core/services/registry.service';
import { CollectionMemberKind } from '../../shared/types';
import { IconComponent } from '../../shared/components/icon/icon.component';

const COL_ICONS = ['box', 'bolt', 'shield', 'inbox', 'install', 'code', 'globe', 'lock', 'warning', 'star', 'book', 'grid'];
const COL_ACCENTS = ['#5a63d8', '#2A6FDB', '#0d9aa6', '#1f9d62', '#c2820b', '#d4602a', '#d44a3f', '#8b46d6', '#e0648f'];

@Component({
  selector: 'app-collection-create',
  standalone: true,
  imports: [FormsModule, IconComponent, RouterLink],
  templateUrl: './collection-create.component.html',
})
export class CollectionCreateComponent {
  private readonly registry = inject(RegistryService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly icons = COL_ICONS;
  readonly accents = COL_ACCENTS;

  readonly title = signal('');
  readonly summary = signal('');
  readonly blurb = signal('');
  readonly members = signal('');
  readonly icon = signal(COL_ICONS[0]);
  readonly accent = signal(COL_ACCENTS[0]);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly memberSlugs = computed(() =>
    this.members().split(',').map((s) => s.trim()).filter(Boolean),
  );

  readonly memberError = signal<string | null>(null);

  readonly canSubmit = computed(() =>
    this.title().trim().length >= 2 &&
    this.summary().trim().length >= 3 &&
    this.memberSlugs().length >= 1 &&
    !this.submitting(),
  );

  setIcon(ic: string): void {
    this.icon.set(ic);
  }

  setAccent(c: string): void {
    this.accent.set(c);
  }

  cancel(): void {
    void this.router.navigate(['/collections']);
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.memberError.set(null);

    this.registry
      .searchEntries({ size: 500 })
      .pipe(
        switchMap((catalog) => {
          const bySlug = new Map(catalog.hits.map((e) => [e.slug, e]));
          const slugs = this.memberSlugs();
          const unknown = slugs.filter((slug) => !bySlug.has(slug));
          if (unknown.length > 0) {
            this.memberError.set(`Unknown slugs: ${unknown.join(', ')}`);
            this.submitting.set(false);
            throw new Error('unknown-members');
          }
          const members = slugs.map((slug) => {
            const entry = bySlug.get(slug)!;
            return {
              kind: entry.type as CollectionMemberKind,
              id: slug,
            };
          });
          return this.registry.createCollection({
            title: this.title().trim(),
            desc: this.summary().trim(),
            blurb: this.blurb().trim() || undefined,
            icon: this.icon(),
            accent: this.accent(),
            members,
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (col) => {
          this.submitting.set(false);
          void this.router.navigate(['/collections', col.id]);
        },
        error: (err) => {
          this.submitting.set(false);
          if (err instanceof Error && err.message === 'unknown-members') return;
          this.error.set('Could not create the collection. Check the fields and try again.');
        },
      });
  }
}
