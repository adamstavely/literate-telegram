import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="avatar"
      [style.width.px]="size"
      [style.height.px]="size"
      [style.fontSize.px]="size * 0.42"
      [style.borderRadius.px]="round ? size / 2 : 6"
      [attr.aria-label]="name"
      role="img"
    >{{ initials }}</span>
  `,
})
export class AvatarComponent {
  @Input() name = 'You';
  @Input() size = 30;
  @Input() round = false;

  get initials(): string {
    return this.name
      .split(/[\s/]/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }
}
