import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api } from './api';
import { Usuario } from './models';

@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  private router = inject(Router);

  readonly token = signal<string | null>(localStorage.getItem('token'));
  readonly user = signal<Usuario | null>(JSON.parse(localStorage.getItem('user') ?? 'null'));
  readonly isLoggedIn = computed(() => !!this.token() && !!this.user());
  readonly isAdmin = computed(() => this.user()?.rol === 'admin');

  async login(email: string, password: string) {
    const r = await firstValueFrom(this.api.login(email, password));
    localStorage.setItem('token', r.token);
    localStorage.setItem('user', JSON.stringify(r.user));
    this.token.set(r.token);
    this.user.set(r.user);
  }

  // Actualiza los datos del usuario (p. ej. el almacenamiento usado)
  async refresh() {
    try {
      const u = await firstValueFrom(this.api.me());
      localStorage.setItem('user', JSON.stringify(u));
      this.user.set(u);
    } catch { /* el interceptor maneja el 401 */ }
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.token.set(null);
    this.user.set(null);
    this.router.navigate(['/login']);
  }
}
