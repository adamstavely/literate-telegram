import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { APP_BASE_HREF } from '@angular/common';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideOAuthClient } from 'angular-oauth2-oidc';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { auditInterceptor } from './core/interceptors/audit.interceptor';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions(),
    ),
    provideHttpClient(withXhr(), 
      withInterceptors([authInterceptor, auditInterceptor]),
    ),
    provideAnimations(),
    provideOAuthClient(),
    {
      provide: APP_INITIALIZER,
      useFactory: (auth: AuthService) => () => auth.initAuth(),
      deps: [AuthService],
      multi: true,
    },
    {
      provide: APP_BASE_HREF,
      useValue: '/',
    },
  ],
};
