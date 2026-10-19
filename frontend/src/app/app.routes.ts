import { Routes } from '@angular/router';
import { authGuard, adminGuard, guestGuard } from './core/guards';
import { Login } from './pages/login';
import { Shell } from './pages/shell';
import { Explorer } from './pages/explorer';
import { Shared } from './pages/shared';
import { Trash } from './pages/trash';
import { ActivityPage } from './pages/activity';
import { Reports } from './pages/reports';
import { UsersPage } from './pages/users';

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [guestGuard] },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'explorador' },
      { path: 'explorador', component: Explorer },
      { path: 'explorador/:id', component: Explorer },
      { path: 'compartidos', component: Shared },
      { path: 'papelera', component: Trash },
      { path: 'actividad', component: ActivityPage },
      { path: 'reportes', component: Reports },
      { path: 'usuarios', component: UsersPage, canActivate: [adminGuard] }
    ]
  },
  { path: '**', redirectTo: '' }
];
