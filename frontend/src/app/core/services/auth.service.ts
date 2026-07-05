/**
 * AuthService — OIDC placeholder scaffold.
 *
 * HOW TO WIRE A REAL OIDC LIBRARY:
 * 1. Install `angular-oauth2-oidc` or `auth0-angular`.
 * 2. Replace the `_authenticated$` BehaviorSubject with the library's
 *    authentication signal/observable.
 * 3. Call `oauthService.configure(environment.oidc)` and
 *    `oauthService.loadDiscoveryDocumentAndTryLogin()` from `initAuth()`.
 * 4. Replace `getAccessToken()` with `oauthService.getAccessToken()`.
 * 5. Replace `login()` / `logout()` with the library equivalents.
 *
 * In placeholder mode, the service reads `mock-auth` from localStorage so
 * that developers can simulate an authenticated session without a real IdP.
 * Set it via the browser console:
 *   localStorage.setItem('mock-auth', JSON.stringify({
 *     sub: 'dev-user-1',
 *     email: 'dev@example.com',
 *     name: 'Dev User',
 *     roles: ['admin'],
 *     accessToken: 'mock-token',
 *   }));
 */

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthenticatedUser } from '../../shared/types';

interface MockAuthPayload extends AuthenticatedUser {
  accessToken?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly STORAGE_KEY = 'mock-auth';

  private _user$ = new BehaviorSubject<AuthenticatedUser | null>(
    this._readStoredUser(),
  );

  /** Emits the currently authenticated user, or null when logged out. */
  readonly currentUser$: Observable<AuthenticatedUser | null> =
    this._user$.asObservable();

  /** Emits true whenever a user is authenticated. */
  readonly isAuthenticated$: Observable<boolean> = this._user$.pipe(
    map(u => u !== null),
  );

  /** Emits true whenever the current user has the 'admin' role. */
  readonly isAdmin$: Observable<boolean> = this._user$.pipe(
    map(u => u?.roles?.includes('admin') ?? false),
  );

  private _storageListener: Subscription;

  constructor() {
    // React to mock-auth changes in other tabs / from DevTools console.
    this._storageListener = fromEvent<StorageEvent>(window, 'storage').subscribe(
      event => {
        if (event.key === this.STORAGE_KEY) {
          this._user$.next(this._readStoredUser());
        }
      },
    );
  }

  ngOnDestroy(): void {
    this._storageListener.unsubscribe();
  }

  // ── Synchronous helpers ────────────────────────────────────────────────────

  /** Returns true if there is a currently authenticated user. */
  isAuthenticated(): boolean {
    return this._user$.value !== null;
  }

  /**
   * Returns true if the current user has the 'admin' role.
   * Wire to real JWT claim checks when using an actual OIDC library.
   */
  isAdmin(): boolean {
    return this._user$.value?.roles?.includes('admin') ?? false;
  }

  /**
   * Returns the raw access token, or null when unauthenticated.
   * Replace with `oauthService.getAccessToken()` for real OIDC.
   */
  getAccessToken(): string | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;
    try {
      const payload = JSON.parse(raw) as MockAuthPayload;
      return payload.accessToken ?? null;
    } catch {
      return null;
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Initiates OIDC login.
   * Replace with `oauthService.initLoginFlow()` for real OIDC.
   */
  login(): void {
    if (environment.production) {
      // PLACEHOLDER: In a real app this would redirect to the OIDC provider.
      // e.g. this.oauthService.initLoginFlow();
      console.warn(
        '[AuthService] login() called — wire a real OIDC library to enable authentication.',
      );
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

  /**
   * Clears the session and emits null on currentUser$.
   * Replace with `oauthService.logOut()` for real OIDC.
   */
  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this._user$.next(null);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private _readStoredUser(): AuthenticatedUser | null {
    let raw = localStorage.getItem(this.STORAGE_KEY);
    // In non-production (local dev / demo) seed a mock session so the app
    // behaves like the design prototype — a signed-in "You" with the header,
    // Publish, and collection-authoring flows available without a login screen.
    // Production never auto-seeds; it goes through real OIDC.
    if (!raw && !environment.production) {
      this._setMockUser({
        sub: 'dev-user-1',
        email: 'dev@example.com',
        name: 'Dev User',
        roles: ['admin'],
        accessToken: 'mock-token',
      });
      raw = localStorage.getItem(this.STORAGE_KEY);
    }
    if (!raw) return null;
    try {
      const payload = JSON.parse(raw) as MockAuthPayload;
      return this._toUser(payload);
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
      roles: payload.roles,
    };
  }
}
