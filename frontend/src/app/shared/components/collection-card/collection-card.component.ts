import { Component, Input, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Collection, RegistryEntry } from '../../types';
import { IconComponent } from '../icon/icon.component';
import { SensitivityBadgeComponent } from '../sensitivity-badge/sensitivity-badge.component';

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  agent: { icon: 'agent', color: '#8b46d6' },
  server: { icon: 'server', color: '#5a63d8' },
  skill: { icon: 'skill', color: '#c2820b' },
  api: { icon: 'api', color: '#0d9aa6' },
};

@Component({
  selector: 'app-collection-card',
  standalone: true,
  imports: [CommonModule, IconComponent, SensitivityBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="card card-link col-card fade-up"
      role="button"
      tabindex="0"
      (click)="navigate()"
      (keydown.enter)="navigate()"
    >
      <div class="col-card-top">
        <div
          class="col-card-ic"
          [style.color]="collection.accent"
          [style.background]="'color-mix(in oklch, ' + collection.accent + ' 11%, var(--cm))'"
          [style.border-color]="'color-mix(in oklch, ' + collection.accent + ' 24%, var(--cm))'"
        >
          <app-icon [name]="collection.icon" [size]="20"></app-icon>
        </div>
        <app-sensitivity-badge [level]="collection.sensitivity"></app-sensitivity-badge>
      </div>
      <div class="col-card-title">{{ collection.title }}</div>
      <div class="col-card-desc">{{ collection.desc }}</div>
      <div class="col-card-foot">
        <div class="col-stack">
          @for (entry of collection.entries.slice(0, 5); track entry.id; let i = $index) {
            <span
              class="col-stack-chip"
              [title]="entry.name"
              [style.color]="typeMeta(entry).color"
            >
              <app-icon [name]="typeMeta(entry).icon" [size]="13"></app-icon>
            </span>
          }
        </div>
        <div style="flex: 1"></div>
        <span class="col-card-n mono">{{ collection.count }} items</span>
      </div>
    </div>
  `,
})
export class CollectionCardComponent {
  @Input({ required: true }) collection!: Collection;

  private readonly router = inject(Router);

  typeMeta(entry: RegistryEntry) {
    return TYPE_ICONS[entry.type] ?? { icon: 'box', color: 'var(--muted)' };
  }

  navigate(): void {
    void this.router.navigate(['/collections', this.collection.id]);
  }
}
