import { ApplicationConfig } from '@angular/core';
import { APP_BASE_HREF } from '@angular/common';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { auditInterceptor } from './core/interceptors/audit.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions(),
    ),
    provideHttpClient(
      withInterceptors([authInterceptor, auditInterceptor]),
    ),
    provideAnimations(),
    {
      provide: APP_BASE_HREF,
      useValue: '/',
    },
  ],
};
