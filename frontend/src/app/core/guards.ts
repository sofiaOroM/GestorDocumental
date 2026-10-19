import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.isLoggedIn() || inject(Router).parseUrl('/login');
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  return !auth.isLoggedIn() || inject(Router).parseUrl('/');
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.isAdmin() || inject(Router).parseUrl('/');
};
