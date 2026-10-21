import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { Toast } from '../core/toast';
import { Confirm } from '../core/confirm';
import { Share } from '../core/models';
import { PERMISOS } from '../core/util';
import { FileViewer } from '../dialogs/file-viewer';

@Component({
  selector: 'app-shared',
  imports: [DatePipe, FileViewer],
  template: `
    <div class="tabs">
      <button [class.activo]="tab() === 'recibidos'" (click)="tab.set('recibidos')">
        <span class="material-icons">move_to_inbox</span>Compartidos conmigo ({{ recibidos().length }})
      </button>
      <button [class.activo]="tab() === 'enviados'" (click)="tab.set('enviados')">
        <span class="material-icons">outbox</span>Compartidos por mí ({{ enviados().length }})
      </button>
    </div>

    @if (tab() === 'recibidos') {
      <table class="tabla">
        <thead><tr><th>Recurso</th><th>Tipo</th><th>De</th><th>Permiso</th><th>Fecha</th></tr></thead>
        <tbody>
          @for (s of recibidos(); track s._id) {
            <tr>
              <td>
                <a class="nombre" (click)="abrir(s)">
                  <span class="material-icons" [class.carpeta]="s.resourceType === 'folder'" [class.archivo]="s.resourceType !== 'folder'">{{ s.resourceType === 'folder' ? 'folder' : 'description' }}</span>{{ s.recurso.nombre }}
                </a>
              </td>
              <td>{{ s.resourceType === 'folder' ? 'Carpeta' : 'Archivo' }}</td>
              <td>{{ s.owner.nombre }}</td>
              <td><span class="badge perm-{{ s.permission }}">{{ permisos[s.permission] }}</span></td>
              <td>{{ s.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
            </tr>
          } @empty { <tr><td colspan="5" class="vacio"><span class="material-icons">inbox</span>Nadie ha compartido recursos contigo</td></tr> }
        </tbody>
      </table>
    } @else {
      <table class="tabla">
        <thead><tr><th>Recurso</th><th>Tipo</th><th>Compartido con</th><th>Permiso</th><th>Fecha</th><th></th></tr></thead>
        <tbody>
          @for (s of enviados(); track s._id) {
            <tr>
              <td>
                <span class="nombre">
                  <span class="material-icons" [class.carpeta]="s.resourceType === 'folder'" [class.archivo]="s.resourceType !== 'folder'">{{ s.resourceType === 'folder' ? 'folder' : 'description' }}</span>{{ s.recurso.nombre }}
                </span>
              </td>
              <td>{{ s.resourceType === 'folder' ? 'Carpeta' : 'Archivo' }}</td>
              <td>{{ s.sharedWith.nombre }}</td>
              <td>
                <select [value]="s.permission" (change)="cambiar(s, $any($event.target).value)">
                  <option value="read">Lectura</option><option value="comment">Comentar</option><option value="edit">Edición</option>
                </select>
              </td>
              <td>{{ s.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
              <td class="acciones">
                <button class="danger" (click)="retirar(s)"><span class="material-icons">person_remove</span>Retirar</button>
              </td>
            </tr>
          } @empty { <tr><td colspan="6" class="vacio"><span class="material-icons">outbox</span>No has compartido recursos</td></tr> }
        </tbody>
      </table>
    }

    @if (visor(); as v) { <app-file-viewer [archivo]="v" (cerrar)="visor.set(null)" /> }
  `
})
export class Shared implements OnInit {
  private api = inject(Api);
  private toast = inject(Toast);
  private confirm = inject(Confirm);
  private router = inject(Router);

  tab = signal<'recibidos' | 'enviados'>('recibidos');
  recibidos = signal<Share[]>([]);
  enviados = signal<Share[]>([]);
  visor = signal<{ _id: string; nombre: string } | null>(null);
  permisos = PERMISOS;

  ngOnInit() { this.cargar(); }

  async cargar() {
    try {
      const [r, e] = await Promise.all([firstValueFrom(this.api.received()), firstValueFrom(this.api.sent())]);
      this.recibidos.set(r);
      this.enviados.set(e);
    } catch (err) { this.toast.error(err); }
  }

  abrir(s: Share) {
    if (s.resourceType === 'folder') this.router.navigate(['/explorador', s.resourceId]);
    else this.visor.set({ _id: s.resourceId, nombre: s.recurso.nombre });
  }

  async cambiar(s: Share, permiso: string) {
    try { await firstValueFrom(this.api.updateShare(s._id, permiso)); this.toast.ok('Permiso actualizado'); this.cargar(); }
    catch (e) { this.toast.error(e); }
  }

  async retirar(s: Share) {
    const ok = await this.confirm.ask({
      titulo: 'Retirar acceso',
      mensaje: `${s.sharedWith.nombre} dejará de tener acceso a «${s.recurso.nombre}».`,
      confirmar: 'Retirar acceso', peligro: true, icono: 'person_remove'
    });
    if (!ok) return;
    try { await firstValueFrom(this.api.removeShare(s._id)); this.toast.ok('Acceso retirado'); this.cargar(); }
    catch (e) { this.toast.error(e); }
  }
}