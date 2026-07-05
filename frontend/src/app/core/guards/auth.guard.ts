import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Requires an authenticated user. Unlike a bare `() => isAuthenticated()` guard
 * (which returns false and leaves the user on a blank, dead-end route), this
 * kicks off login and redirects home so there is always a way forward.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  auth.login();
  return router.createUrlTree(['/']);
};
