import { Component, computed, inject } from '@angular/core';
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
      @if (auth.user(); as u) {
        <div class="cuota" [title]="'Asignado: ' + (u.almacenamientoAsignado | bytes) + ' · Disponible: ' + (disponible() | bytes)">
          <div class="cuota-texto">
            <span class="material-icons">cloud_queue</span>
            {{ u.almacenamientoUsado | bytes }} de {{ u.almacenamientoAsignado | bytes }}
            <small>({{ disponible() | bytes }} disponibles)</small>
          </div>
          <div class="cuota-barra"><div [style.width.%]="porcentaje()" [class.alta]="porcentaje() >= 90"></div></div>
        </div>
      }
      <span class="usuario">{{ auth.user()?.nombre }} <span class="badge">{{ auth.isAdmin() ? 'Admin' : 'Usuario' }}</span></span>
      <button (click)="auth.logout()">Salir</button>
    </header>
    <main class="contenido"><router-outlet /></main>
  `
})
export class Shell {
  auth = inject(Auth);
  disponible = computed(() =>
      Math.max(0, (this.auth.user()?.almacenamientoAsignado ?? 0) - (this.auth.user()?.almacenamientoUsado ?? 0)));
  porcentaje = computed(() => {
    const u = this.auth.user();
    return u && u.almacenamientoAsignado > 0 ? Math.min(100, (u.almacenamientoUsado / u.almacenamientoAsignado) * 100) : 0;
  });
}
