import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'main',
    loadComponent: () => import('./nav/nav.component').then((c) => c.NavComponent),
  },
  { path: 'main/about', loadComponent: () => import('./about/about.page').then((c) => c.AboutPage) },
  {
    path: '',
    redirectTo: 'main',
    pathMatch: 'full',
  },
  {
    path: 'about',
    loadComponent: () => import('./about/about.page').then(m => m.AboutPage)
  },
];
