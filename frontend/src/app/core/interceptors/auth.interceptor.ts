import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const AUTH_FLASH_KEY = 'interop-auth-flash';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Only attach the token for requests to our API (relative /api/* paths).
  const isApiRequest = req.url.startsWith('/api/');
  if (!isApiRequest) {
    return next(req);
  }

  const token = auth.getAccessToken();
  const outgoing = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      // Only clear the session when a bearer token was sent and rejected —
      // anonymous 401s (e.g. optional-auth endpoints) must not log the user out.
      if (error instanceof HttpErrorResponse && error.status === 401 && token) {
        auth.logout();
        sessionStorage.setItem(AUTH_FLASH_KEY, 'Your session expired. Please sign in again.');
        void router.navigate(['/']);
      }
      return throwError(() => error);
    }),
  );
};
