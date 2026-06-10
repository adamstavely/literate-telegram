import {
  Component,
  Input,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RegistryEntry, Server, Agent, Api, Skill, Tool } from '../../types';
import { IconComponent } from '../icon/icon.component';
import { VerifiedMarkComponent } from '../verified-mark/verified-mark.component';
import { SensitivityBadgeComponent } from '../sensitivity-badge/sensitivity-badge.component';
import { SparklineComponent } from '../sparkline/sparkline.component';

function formatInstalls(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

@Component({
  selector: 'app-entry-card',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    VerifiedMarkComponent,
    SensitivityBadgeComponent,
    SparklineComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entry-card.component.html',
  styleUrls: ['./entry-card.component.scss'],
})
export class EntryCardComponent {
  @Input() entry!: RegistryEntry;
  @Input() viewMode: 'grid' | 'list' = 'grid';

  private readonly router = inject(Router);

  get formattedInstalls(): string {
    return formatInstalls(this.entry.installs);
  }

  get typeIcon(): string {
    const icons: Record<string, string> = {
      server: 'server',
      tool: 'tool',
      skill: 'skill',
      agent: 'agent',
      api: 'api',
    };
    return icons[this.entry.type] ?? 'box';
  }

  get serverTransports(): string[] {
    if (this.entry.type === 'server') {
      return (this.entry as Server).transports;
    }
    return [];
  }

  get agentModel(): string | null {
    if (this.entry.type === 'agent') {
      return (this.entry as Agent).model;
    }
    return null;
  }

  get apiStyle(): string | null {
    if (this.entry.type === 'api') {
      return (this.entry as Api).style;
    }
    return null;
  }

  get skillTokens(): number | null {
    if (this.entry.type === 'skill') {
      return (this.entry as Skill).tokens;
    }
    return null;
  }

  get toolReadOnly(): boolean | null {
    if (this.entry.type === 'tool') {
      return (this.entry as Tool).readOnly;
    }
    return null;
  }

  navigate(): void {
    void this.router.navigate(['/entry', this.entry.type, this.entry.slug]);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.navigate();
    }
  }
}
