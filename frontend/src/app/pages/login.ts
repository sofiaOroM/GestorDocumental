import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../core/auth';
import { Toast } from '../core/toast';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="login-wrap">
      <form class="login-card" (ngSubmit)="entrar()">
        <h1>Gestión Documental</h1>
        <p class="muted">Inicia sesión con tus credenciales</p>
        <label>Correo</label>
        <input type="email" name="email" [(ngModel)]="email" required autocomplete="username" />
        <label>Contraseña</label>
        <input type="password" name="password" [(ngModel)]="password" required autocomplete="current-password" />
        <button class="primary block" type="submit" [disabled]="cargando() || !email() || !password()">
          {{ cargando() ? 'Ingresando…' : 'Ingresar' }}
        </button>
        <p class="muted small">Demo: ana@docs.com / Password123!</p>
      </form>
    </div>
  `
})
export class Login {
  private auth = inject(Auth);
  private router = inject(Router);
  private toast = inject(Toast);
  email = signal('');
  password = signal('');
  cargando = signal(false);

  async entrar() {
    this.cargando.set(true);
    try {
      await this.auth.login(this.email(), this.password());
      this.router.navigate(['/']);
    } catch (e) { this.toast.error(e); }
    finally { this.cargando.set(false); }
  }
}
