import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../core/auth';
import { Toast } from '../core/toast';
import { validarEmail } from '../core/validators';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="login-wrap">
      <form class="login-card" (ngSubmit)="entrar()" novalidate>
        <h1>Gestión Documental</h1>
        <p class="muted">Inicia sesión con tus credenciales</p>

        <label>Correo</label>
        <input type="email" name="email" [(ngModel)]="email" (blur)="tEmail.set(true)"
               [class.invalido]="verErrEmail()" autocomplete="username" />
        @if (verErrEmail()) {
          <p class="err"><span class="material-icons">error_outline</span>{{ errEmail() }}</p>
        }

        <label>Contraseña</label>
        <input type="password" name="password" [(ngModel)]="password" (blur)="tPass.set(true)"
               [class.invalido]="verErrPass()" autocomplete="current-password" />
        @if (verErrPass()) {
          <p class="err"><span class="material-icons">error_outline</span>La contraseña es obligatoria.</p>
        }

        <button class="primary block" type="submit" [disabled]="cargando() || !formOk()">
          {{ cargando() ? 'Ingresando…' : 'Ingresar' }}
        </button>
        @if (!formOk() && !cargando()) {
          <p class="hint centrado"><span class="material-icons">info</span>Escribe un correo válido y tu contraseña para habilitar el botón.</p>
        }
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
  tEmail = signal(false);
  tPass = signal(false);

  errEmail = computed(() => validarEmail(this.email()));
  verErrEmail = computed(() => this.tEmail() && !!this.errEmail());
  verErrPass = computed(() => this.tPass() && !this.password());
  formOk = computed(() => !this.errEmail() && !!this.password());

  async entrar() {
    if (!this.formOk()) return;
    this.cargando.set(true);
    try {
      await this.auth.login(this.email().trim(), this.password());
      this.router.navigate(['/']);
    } catch (e) { this.toast.error(e); }
    finally { this.cargando.set(false); }
  }
}