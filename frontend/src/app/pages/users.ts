import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { Toast } from '../core/toast';
import { Usuario } from '../core/models';
import { Bytes } from '../core/bytes.pipe';
import { faltanCaracteres, passwordValida, reglasPassword, validarEmail, validarNombrePersona } from '../core/validators';

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(); // ignora tildes y mayúsculas

@Component({
  selector: 'app-users',
  imports: [FormsModule, DatePipe, Bytes],
  template: `
    <h2>Administración de usuarios</h2>
    <div class="card">
      <h4>Nuevo usuario</h4>
      <div class="form-usuario">

        <div class="campo">
          <label>Nombre completo</label>
          <input type="text" [value]="nombre()" (input)="soloLetras($event)" (blur)="tNombre.set(true)"
                 maxlength="60" placeholder="Ej.: María Fernández" [class.invalido]="verErrNombre() || rechazoNombre()" />
          @if (rechazoNombre()) {
            <p class="err"><span class="material-icons">error_outline</span>No se permiten números ni símbolos en el nombre.</p>
          } @else if (verErrNombre()) {
            <p class="err"><span class="material-icons">error_outline</span>{{ errNombre() }}</p>
          } @else {
            <p class="hint">Solo letras y espacios.</p>
          }
        </div>

        <div class="campo">
          <label>Correo</label>
          <input type="email" [(ngModel)]="email" (blur)="tEmail.set(true)" placeholder="nombre@correo.com"
                 [class.invalido]="verErrEmail()" />
          @if (verErrEmail()) {
            <p class="err"><span class="material-icons">error_outline</span>{{ errEmail() }}</p>
          }
        </div>

        <div class="campo">
          <label>Contraseña</label>
          <input type="password" [(ngModel)]="password" (blur)="tPass.set(true)" placeholder="Mínimo 8 caracteres"
                 [class.invalido]="tPass() && !passOk()" autocomplete="new-password" />
          @if (password() || tPass()) {
            @if (faltan() > 0) {
              <p class="err"><span class="material-icons">error_outline</span>Faltan {{ faltan() }} {{ faltan() === 1 ? 'carácter' : 'caracteres' }}.</p>
            }
            <ul class="reglas">
              @for (r of reglas(); track r.texto) {
                <li [class.ok]="r.ok">
                  <span class="material-icons">{{ r.ok ? 'check_circle' : 'radio_button_unchecked' }}</span>{{ r.texto }}
                </li>
              }
            </ul>
          } @else {
            <p class="hint">Mínimo 8 caracteres, con letras y números.</p>
          }
        </div>

        <div class="campo">
          <label>Rol</label>
          <select [(ngModel)]="rol"><option value="user">Usuario</option><option value="admin">Administrador</option></select>
        </div>

        <div class="campo">
          <label>Almacenamiento asignado (MB)</label>
          <input type="number" min="1" step="1" [(ngModel)]="cuota" [class.invalido]="!cuotaOk()" />
          @if (!cuotaOk()) {
            <p class="err"><span class="material-icons">error_outline</span>Escribe un número mayor que 0.</p>
          } @else {
            <p class="hint">Espacio total que podrá usar este usuario.</p>
          }
        </div>
      </div>

      <div class="row">
        <button class="primary" [disabled]="!formOk() || creando()" (click)="crear()">
          <span class="material-icons">person_add</span>Crear usuario
        </button>
        @if (!formOk()) {
          <span class="ayuda-boton"><span class="material-icons">info</span>Completa correctamente todos los campos para habilitar el botón.</span>
        }
      </div>
    </div>

    <div class="filtros">
      <input type="text" placeholder="Buscar por nombre o correo…" maxlength="60" [(ngModel)]="q" />
      <select [(ngModel)]="fRol">
        <option value="">Todos los roles</option><option value="admin">Administradores</option><option value="user">Usuarios</option>
      </select>
      <select [(ngModel)]="fEstado">
        <option value="">Todos los estados</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option>
      </select>
      @if (hayFiltros()) { <button (click)="limpiarFiltros()"><span class="material-icons">close</span>Limpiar</button> }
      <span class="muted small">Mostrando {{ filtrados().length }} de {{ usuarios().length }} usuarios</span>
    </div>

    <table class="tabla">
      <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Almacenamiento</th><th>Cuota (MB)</th><th>Alta</th><th>Estado</th></tr></thead>
      <tbody>
        @for (u of filtrados(); track u._id) {
          <tr [class.inactivo]="!u.activo">
            <td>{{ u.nombre }}</td><td>{{ u.email }}</td>
            <td>
              <select [value]="u.rol" [disabled]="esYo(u)" (change)="cambiarRol(u, $any($event.target).value)">
                <option value="user">Usuario</option><option value="admin">Administrador</option>
              </select>
            </td>
            <td>
              {{ u.almacenamientoUsado | bytes }} de {{ u.almacenamientoAsignado | bytes }}
              <div class="cuota-barra mini"><div [style.width.%]="pct(u)" [class.alta]="pct(u) >= 90"></div></div>
              <small class="muted">{{ disponible(u) | bytes }} disponibles</small>
            </td>
            <td>
              <input class="cuota-input" type="number" min="1" step="1" [value]="mb(u)" title="Espacio asignado en MB"
                     (change)="cambiarCuota(u, $any($event.target))" />
            </td>
            <td>{{ u.createdAt | date:'dd/MM/yyyy' }}</td>
            <td>
              <button [class.danger]="u.activo" [disabled]="esYo(u)" (click)="alternar(u)">
                {{ u.activo ? 'Desactivar' : 'Activar' }}
              </button>
            </td>
          </tr>
        } @empty {
          <tr><td colspan="7" class="vacio"><span class="material-icons">search_off</span>Ningún usuario coincide con los filtros</td></tr>
        }
      </tbody>
    </table>
    <p class="muted small">Desactivar un usuario le impide iniciar sesión, pero conserva sus archivos y su historial.</p>
  `
})
export class UsersPage implements OnInit {
  private api = inject(Api);
  private auth = inject(Auth);
  private toast = inject(Toast);

  usuarios = signal<Usuario[]>([]);
  q = signal(''); fRol = signal(''); fEstado = signal('');
  hayFiltros = computed(() => !!this.q().trim() || !!this.fRol() || !!this.fEstado());
  filtrados = computed(() => {
    const q = norm(this.q().trim());
    return this.usuarios().filter((u) =>
        (!q || norm(u.nombre).includes(q) || norm(u.email).includes(q)) &&
        (!this.fRol() || u.rol === this.fRol()) &&
        (!this.fEstado() || (this.fEstado() === 'activo') === u.activo));
  });
  nombre = signal(''); email = signal(''); password = signal(''); rol = signal('user');
  cuota = signal<number>(100);
  tNombre = signal(false); tEmail = signal(false); tPass = signal(false);
  rechazoNombre = signal(false);
  creando = signal(false);

  errNombre = computed(() => validarNombrePersona(this.nombre()));
  errEmail = computed(() => validarEmail(this.email()));
  reglas = computed(() => reglasPassword(this.password()));
  faltan = computed(() => faltanCaracteres(this.password()));
  passOk = computed(() => passwordValida(this.password()));
  verErrNombre = computed(() => this.tNombre() && !!this.errNombre());
  verErrEmail = computed(() => this.tEmail() && !!this.errEmail());
  cuotaOk = computed(() => Number(this.cuota()) > 0);
  formOk = computed(() => !this.errNombre() && !this.errEmail() && this.passOk() && this.cuotaOk());

  ngOnInit() { this.cargar(); }
  limpiarFiltros() { this.q.set(''); this.fRol.set(''); this.fEstado.set(''); }
  esYo(u: Usuario) { return u._id === this.auth.user()?._id; }

  // Almacenamiento: asignado, utilizado y disponible
  mb(u: Usuario) { return Math.round((u.almacenamientoAsignado / 1048576) * 100) / 100; }
  disponible(u: Usuario) { return Math.max(0, u.almacenamientoAsignado - u.almacenamientoUsado); }
  pct(u: Usuario) {
    return u.almacenamientoAsignado > 0 ? Math.min(100, (u.almacenamientoUsado / u.almacenamientoAsignado) * 100) : 0;
  }

  async cambiarCuota(u: Usuario, el: HTMLInputElement) {
    const mb = Number(el.value);
    if (!Number.isFinite(mb) || mb <= 0) {
      this.toast.error('La cuota debe ser un número mayor que 0');
      el.value = String(this.mb(u));
      return;
    }
    try {
      await firstValueFrom(this.api.updateUser(u._id, { cuotaMB: mb }));
      this.toast.ok('Cuota actualizada');
      this.cargar();
      if (this.esYo(u)) this.auth.refresh();
    } catch (e) {
      this.toast.error(e);
      el.value = String(this.mb(u)); // el servidor rechaza una cuota menor al espacio ya usado
    }
  }

  // Restricción en vivo: el campo de nombre no admite números ni símbolos
  soloLetras(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const limpio = el.value.replace(/[^\p{L} '’-]/gu, '');
    this.rechazoNombre.set(limpio !== el.value);
    if (limpio !== el.value) el.value = limpio;
    this.nombre.set(limpio);
  }

  async cargar() {
    try { this.usuarios.set(await firstValueFrom(this.api.users())); } catch (e) { this.toast.error(e); }
  }

  async crear() {
    if (!this.formOk()) return;
    this.creando.set(true);
    try {
      await firstValueFrom(this.api.createUser({
        nombre: this.nombre().trim(), email: this.email().trim(), password: this.password(), rol: this.rol(),
        cuotaMB: Number(this.cuota())
      }));
      this.nombre.set(''); this.email.set(''); this.password.set(''); this.rol.set('user'); this.cuota.set(100);
      this.tNombre.set(false); this.tEmail.set(false); this.tPass.set(false); this.rechazoNombre.set(false);
      this.toast.ok('Usuario creado');
      this.cargar();
    } catch (e) { this.toast.error(e); }
    finally { this.creando.set(false); }
  }

  async alternar(u: Usuario) {
    try { await firstValueFrom(this.api.updateUser(u._id, { activo: !u.activo })); this.cargar(); }
    catch (e) { this.toast.error(e); }
  }

  async cambiarRol(u: Usuario, rol: string) {
    try { await firstValueFrom(this.api.updateUser(u._id, { rol })); this.toast.ok('Rol actualizado'); this.cargar(); }
    catch (e) { this.toast.error(e); this.cargar(); }
  }
}
