import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, fromEvent } from 'rxjs';
import { map } from 'rxjs/operators';
import { OAuthService } from 'angular-oauth2-oidc';
import { environment } from '../../../environments/environment';
import { AuthenticatedUser } from '../../shared/types';
import { buildAuthConfig, isOidcConfigured } from '../auth/auth.config';
import { userFromAccessToken } from '../auth/jwt-claims';

interface MockAuthPayload extends AuthenticatedUser {
  accessToken?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly STORAGE_KEY = 'mock-auth';
  private readonly oauth = inject(OAuthService, { optional: true });

  private _user$ = new BehaviorSubject<AuthenticatedUser | null>(
    this._readInitialUser(),
  );

  private _oauthEventsSub: Subscription | null = null;
  private _storageListener: Subscription;

  readonly currentUser$: Observable<AuthenticatedUser | null> =
    this._user$.asObservable();

  readonly isAuthenticated$: Observable<boolean> = this._user$.pipe(
    map(u => u !== null),
  );

  readonly isAdmin$: Observable<boolean> = this._user$.pipe(
    map(u => u?.roles?.some(r => r.toLowerCase() === 'admin') ?? false),
  );

  constructor() {
    this._storageListener = fromEvent<StorageEvent>(window, 'storage').subscribe(
      event => {
        if (!isOidcConfigured() && event.key === this.STORAGE_KEY) {
          this._user$.next(this._readStoredMockUser());
        }
      },
    );
  }

  ngOnDestroy(): void {
    this._storageListener.unsubscribe();
    this._oauthEventsSub?.unsubscribe();
  }

  /** Configure OIDC and attempt silent login when an IdP is configured. */
  async initAuth(): Promise<void> {
    if (!isOidcConfigured() || !this.oauth) {
      this._user$.next(this._readStoredMockUser());
      return;
    }

    this.oauth.configure(buildAuthConfig());
    this._oauthEventsSub = this.oauth.events.subscribe(() => {
      this.syncFromOAuth();
    });

    await this.oauth.loadDiscoveryDocumentAndTryLogin();
    this.syncFromOAuth();
  }

  isAuthenticated(): boolean {
    return this._user$.value !== null;
  }

  isAdmin(): boolean {
    return this._user$.value?.roles?.some(r => r.toLowerCase() === 'admin') ?? false;
  }

  getAccessToken(): string | null {
    if (isOidcConfigured() && this.oauth?.hasValidAccessToken()) {
      return this.oauth.getAccessToken();
    }
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as MockAuthPayload).accessToken ?? null;
    } catch {
      return null;
    }
  }

  login(returnUrl?: string): void {
    if (returnUrl) {
      sessionStorage.setItem('auth-return-url', returnUrl);
    }

    if (isOidcConfigured() && this.oauth) {
      this.oauth.initLoginFlow();
      return;
    }

    if (environment.production) {
      return;
    }

    this._setMockUser({
      sub: 'dev-user-1',
      email: 'dev@example.com',
      name: 'Dev User',
      roles: ['admin'],
      accessToken: 'mock-token',
    });
  }

  logout(): void {
    if (isOidcConfigured() && this.oauth) {
      this.oauth.logOut();
    }
    localStorage.removeItem(this.STORAGE_KEY);
    this._user$.next(null);
  }

  /** Refresh currentUser$ from the OAuthService access token. */
  syncFromOAuth(): void {
    if (!isOidcConfigured() || !this.oauth?.hasValidAccessToken()) {
      if (isOidcConfigured()) {
        this._user$.next(null);
      }
      return;
    }

    const user = userFromAccessToken(this.oauth.getAccessToken());
    this._user$.next(
      user
        ? {
            sub: user.sub,
            email: user.email,
            name: user.name,
            roles: user.roles,
          }
        : null,
    );
  }

  private _readInitialUser(): AuthenticatedUser | null {
    if (isOidcConfigured()) return null;
    return this._readStoredMockUser();
  }

  private _readStoredMockUser(): AuthenticatedUser | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;
    try {
      return this._toUser(JSON.parse(raw) as MockAuthPayload);
    } catch {
      return null;
    }
  }

  private _setMockUser(payload: MockAuthPayload): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    this._user$.next(this._toUser(payload));
  }

  private _toUser(payload: MockAuthPayload): AuthenticatedUser {
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      roles: payload.roles?.map(r => r.toLowerCase()) ?? [],
    };
  }
}
