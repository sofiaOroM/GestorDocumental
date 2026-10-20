import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../core/auth';
import { Bytes } from '../core/bytes.pipe';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Bytes],
  template: `
    <header class="topbar">
      <strong class="brand"><span class="material-icons">description</span> Gestión Documental</strong>
      <nav>
        <a routerLink="/explorador" routerLinkActive="activo">Mis archivos</a>
        <a routerLink="/compartidos" routerLinkActive="activo">Compartidos</a>
        <a routerLink="/papelera" routerLinkActive="activo">Papelera</a>
        <a routerLink="/actividad" routerLinkActive="activo">Actividad</a>
        <a routerLink="/reportes" routerLinkActive="activo">Reportes</a>
        @if (auth.isAdmin()) { <a routerLink="/usuarios" routerLinkActive="activo">Usuarios</a> }
      </nav>
      <div class="spacer"></div>
      <span class="muted small">Almacenamiento: {{ auth.user()?.almacenamientoUsado | bytes }}</span>
      <span class="usuario">{{ auth.user()?.nombre }} <span class="badge">{{ auth.isAdmin() ? 'Admin' : 'Usuario' }}</span></span>
      <button (click)="auth.logout()">Salir</button>
    </header>
    <main class="contenido"><router-outlet /></main>
  `
})
export class Shell {
  auth = inject(Auth);
}
