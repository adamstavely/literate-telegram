import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router, UrlTree, provideRouter } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { adminGuard } from './admin.guard';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

function configure(auth: Partial<AuthService>): void {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  });
}

function runGuard(guard: CanActivateFn): boolean | UrlTree {
  return TestBed.runInInjectionContext(
    () =>
      guard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ) as boolean | UrlTree,
  );
}

describe('adminGuard', () => {
  it('allows admins through', () => {
    configure({ isAdmin: () => true });
    expect(runGuard(adminGuard)).toBe(true);
  });

  it('redirects non-admins to home instead of blocking silently', () => {
    configure({ isAdmin: () => false });
    const result = runGuard(adminGuard);
    expect(result instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });
});

describe('authGuard', () => {
  it('allows authenticated users through', () => {
    configure({ isAuthenticated: () => true, login: () => undefined });
    expect(runGuard(authGuard)).toBe(true);
  });

  it('starts login and redirects home when unauthenticated (no dead end)', () => {
    let loginCalled = false;
    configure({
      isAuthenticated: () => false,
      login: () => {
        loginCalled = true;
      },
    });
    const result = runGuard(authGuard);
    expect(result instanceof UrlTree).toBe(true);
    expect(loginCalled).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });
});
