import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { AuthService } from '../../core/services/auth.service';
import { AUTH_FLASH_KEY } from '../../core/interceptors/auth.interceptor';

const RETURN_URL_KEY = 'auth-return-url';

@Component({
    selector: 'app-auth-callback',
    standalone: true,
    imports: [RouterLink],
    changeDetection: ChangeDetectionStrategy.Default,
    template: `
    <div class="container page" role="status" aria-live="polite" style="padding-top: 48px">
      @if (error()) {
        <h1 class="h2">Sign-in failed</h1>
        <p class="lede">{{ error() }}</p>
        <p>
          <a routerLink="/" class="btn btn-primary">Return home</a>
        </p>
      } @else {
        <h1 class="h2">Signing in…</h1>
        <p class="lede">Completing authentication with your identity provider.</p>
      }
    </div>
  `
})
export class CallbackComponent implements OnInit {
  private readonly oauth = inject(OAuthService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.oauth.loadDiscoveryDocumentAndTryLogin().then(() => {
      this.auth.syncFromOAuth();
      const returnUrl = sessionStorage.getItem(RETURN_URL_KEY) ?? '/';
      sessionStorage.removeItem(RETURN_URL_KEY);
      void this.router.navigateByUrl(returnUrl);
    }).catch(() => {
      const message =
        'We could not complete sign-in with your identity provider. Please try again.';
      this.error.set(message);
      sessionStorage.setItem(AUTH_FLASH_KEY, message);
    });
  }
}
