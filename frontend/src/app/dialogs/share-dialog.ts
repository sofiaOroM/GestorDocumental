import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { Toast } from '../core/toast';
import { Permiso, Share, TipoRecurso, UsuarioDir } from '../core/models';

@Component({
  selector: 'app-share-dialog',
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="cerrar.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3>Compartir «{{ recurso().nombre }}»</h3>
        <div class="row">
          <select [(ngModel)]="userId">
            <option value="">Selecciona un usuario…</option>
            @for (u of usuarios(); track u._id) { <option [value]="u._id">{{ u.nombre }} ({{ u.email }})</option> }
          </select>
          <select [(ngModel)]="permiso">
            <option value="read">Lectura</option>
            <option value="comment">Comentar</option>
            <option value="edit">Edición</option>
          </select>
          <button class="primary" [disabled]="!userId()" (click)="agregar()">Compartir</button>
        </div>

        <h4>Acceso actual</h4>
        @if (!existentes().length) { <p class="muted">Aún no está compartido con nadie.</p> }
        @for (s of existentes(); track s._id) {
          <div class="row share-row">
            <span class="grow">{{ s.sharedWith.nombre }} <small class="muted">{{ s.sharedWith.email }}</small></span>
            <select [value]="s.permission" (change)="cambiar(s, $any($event.target).value)">
              <option value="read">Lectura</option>
              <option value="comment">Comentar</option>
              <option value="edit">Edición</option>
            </select>
            <button class="danger" (click)="retirar(s)">Retirar</button>
          </div>
        }
        <div class="modal-actions"><button (click)="cerrar.emit()">Cerrar</button></div>
      </div>
    </div>
  `
})
export class ShareDialog implements OnInit {
  private api = inject(Api);
  private toast = inject(Toast);

  tipo = input.required<TipoRecurso>();
  recurso = input.required<{ _id: string; nombre: string }>();
  cerrar = output<void>();

  usuarios = signal<UsuarioDir[]>([]);
  existentes = signal<Share[]>([]);
  userId = signal('');
  permiso = signal<Permiso>('read');

  async ngOnInit() {
    try {
      this.usuarios.set(await firstValueFrom(this.api.directory()));
      await this.recargar();
    } catch (e) { this.toast.error(e); }
  }

  private async recargar() {
    this.existentes.set(await firstValueFrom(this.api.sharesOf(this.tipo(), this.recurso()._id)));
  }

  async agregar() {
    try {
      await firstValueFrom(this.api.share({
        resourceType: this.tipo(), resourceId: this.recurso()._id,
        userId: this.userId(), permission: this.permiso()
      }));
      this.userId.set('');
      this.toast.ok('Recurso compartido');
      await this.recargar();
    } catch (e) { this.toast.error(e); }
  }

  async cambiar(s: Share, permiso: string) {
    try {
      await firstValueFrom(this.api.updateShare(s._id, permiso));
      this.toast.ok('Permiso actualizado');
      await this.recargar();
    } catch (e) { this.toast.error(e); }
  }

  async retirar(s: Share) {
    try {
      await firstValueFrom(this.api.removeShare(s._id));
      this.toast.ok('Acceso retirado');
      await this.recargar();
    } catch (e) { this.toast.error(e); }
  }
}
