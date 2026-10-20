import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { Toast } from '../core/toast';
import { Usuario } from '../core/models';
import { Bytes } from '../core/bytes.pipe';

@Component({
  selector: 'app-users',
  imports: [FormsModule, DatePipe, Bytes],
  template: `
    <h2>Administración de usuarios</h2>
    <div class="card">
      <h4>Nuevo usuario</h4>
      <div class="row">
        <input type="text" placeholder="Nombre" [(ngModel)]="nombre" />
        <input type="email" placeholder="Correo" [(ngModel)]="email" />
        <input type="password" placeholder="Contraseña (mín. 8)" [(ngModel)]="password" />
        <select [(ngModel)]="rol"><option value="user">Usuario</option><option value="admin">Administrador</option></select>
        <button class="primary" [disabled]="!nombre() || !email() || password().length < 8" (click)="crear()">Crear</button>
      </div>
    </div>

    <table class="tabla">
      <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Almacenamiento</th><th>Alta</th><th>Estado</th></tr></thead>
      <tbody>
        @for (u of usuarios(); track u._id) {
          <tr [class.inactivo]="!u.activo">
            <td>{{ u.nombre }}</td><td>{{ u.email }}</td>
            <td>
              <select [value]="u.rol" [disabled]="esYo(u)" (change)="cambiarRol(u, $any($event.target).value)">
                <option value="user">Usuario</option><option value="admin">Administrador</option>
              </select>
            </td>
            <td>{{ u.almacenamientoUsado | bytes }}</td>
            <td>{{ u.createdAt | date:'dd/MM/yyyy' }}</td>
            <td>
              <button [class.danger]="u.activo" [disabled]="esYo(u)" (click)="alternar(u)">
                {{ u.activo ? 'Desactivar' : 'Activar' }}
              </button>
            </td>
          </tr>
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
  nombre = signal(''); email = signal(''); password = signal(''); rol = signal('user');

  ngOnInit() { this.cargar(); }
  esYo(u: Usuario) { return u._id === this.auth.user()?._id; }

  async cargar() {
    try { this.usuarios.set(await firstValueFrom(this.api.users())); } catch (e) { this.toast.error(e); }
  }

  async crear() {
    try {
      await firstValueFrom(this.api.createUser({
        nombre: this.nombre(), email: this.email(), password: this.password(), rol: this.rol()
      }));
      this.nombre.set(''); this.email.set(''); this.password.set(''); this.rol.set('user');
      this.toast.ok('Usuario creado');
      this.cargar();
    } catch (e) { this.toast.error(e); }
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
