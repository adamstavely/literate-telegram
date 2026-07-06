import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
    selector: 'app-not-found',
    imports: [RouterLink, IconComponent],
    template: `
    <section class="notfound" aria-labelledby="nf-title">
      <div class="container" style="padding: 80px 0; text-align: center">
        <div class="nf-code mono" aria-hidden="true">404</div>
        <h1 id="nf-title">Page not found</h1>
        <p style="color: var(--muted); max-width: 40ch; margin: 8px auto 24px">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <a class="btn btn-primary btn-md" routerLink="/">
          <app-icon name="arrowLeft" [size]="16" aria-hidden="true"></app-icon>
          Back to Browse
        </a>
      </div>
    </section>
  `,
    changeDetection: ChangeDetectionStrategy.Default,
    styles: [
        `.nf-code { font-size: 64px; font-weight: 700; color: var(--accent); line-height: 1; }`,
    ]
})
export class NotFoundComponent {}
