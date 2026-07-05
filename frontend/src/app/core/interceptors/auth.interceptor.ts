import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Only attach the token for requests to our API.
  const isApiRequest = req.url.includes('/api');
  if (!isApiRequest) {
    return next(req);
  }

  const token = auth.getAccessToken();
  const outgoing = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Token is expired or invalid — clear the session and route back to a
        // page with a sign-in path instead of leaving the user stranded.
        auth.logout();
        void router.navigate(['/']);
      }
      return throwError(() => error);
    }),
  );
};
