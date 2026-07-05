import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { AuthService } from '../../core/services/auth.service';

const RETURN_URL_KEY = 'auth-return-url';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <div class="container page" role="status" aria-live="polite" style="padding-top: 48px">
      <h1 class="h2">Signing in…</h1>
      <p class="lede">Completing authentication with your identity provider.</p>
    </div>
  `,
})
export class CallbackComponent implements OnInit {
  private readonly oauth = inject(OAuthService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.oauth.loadDiscoveryDocumentAndTryLogin().then(() => {
      this.auth.syncFromOAuth();
      const returnUrl = sessionStorage.getItem(RETURN_URL_KEY) ?? '/';
      sessionStorage.removeItem(RETURN_URL_KEY);
      void this.router.navigateByUrl(returnUrl);
    }).catch(() => {
      void this.router.navigate(['/']);
    });
  }
}
