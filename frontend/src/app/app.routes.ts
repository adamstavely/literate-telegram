import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/browse/browse.component').then(m => m.BrowseComponent),
    title: 'Interop — AI Registry',
  },
  {
    path: 'entry/:type/:slug',
    loadComponent: () =>
      import('./features/detail/detail.component').then(m => m.DetailComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/register/register.component').then(m => m.RegisterComponent),
    title: 'Register — Interop',
    canActivate: [() => inject(AuthService).isAuthenticated()],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin.component').then(m => m.AdminComponent),
    title: 'Admin — Interop',
    canActivate: [adminGuard],
  },
  {
    path: 'admin/policy',
    loadComponent: () =>
      import('./features/policy/policy.component').then(m => m.PolicyComponent),
    title: 'Policy — Interop',
    canActivate: [adminGuard],
  },
  {
    path: 'collections',
    loadComponent: () =>
      import('./features/collections/collections.component').then(m => m.CollectionsComponent),
    title: 'Collections — Interop',
  },
  {
    path: 'collections/:id',
    loadComponent: () =>
      import('./features/collections/collection-detail.component').then(m => m.CollectionDetailComponent),
  },
  {
    path: 'docs',
    loadComponent: () =>
      import('./features/docs/docs.component').then(m => m.DocsComponent),
    title: 'Docs — Interop',
  },
  {
    path: 'docs/:articleId',
    loadComponent: () =>
      import('./features/docs/docs.component').then(m => m.DocsComponent),
  },
  { path: '**', redirectTo: '' },
];
