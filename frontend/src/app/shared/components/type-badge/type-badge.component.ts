import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { EntryType } from '../../types';
import { TYPE_META } from '../../constants/type-meta.constants';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-type-badge',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="type-badge" [class]="'type-' + type">
      <app-icon [name]="meta.icon" [size]="14" aria-hidden="true"></app-icon>
      {{ meta.label }}
    </span>
  `,
})
export class TypeBadgeComponent {
  @Input() type: EntryType = 'server';

  get meta() {
    return TYPE_META[this.type] ?? TYPE_META.server;
  }
}
