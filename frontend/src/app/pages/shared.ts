import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { Toast } from '../core/toast';
import { Confirm } from '../core/confirm';
import { Share } from '../core/models';
import { PERMISOS } from '../core/util';
import { FileViewer } from '../dialogs/file-viewer';
import { rangoInvalido } from '../core/validators';

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(); // ignora tildes y mayúsculas

@Component({
  selector: 'app-shared',
  imports: [DatePipe, FormsModule, FileViewer],
  template: `
    <div class="tabs">
      <button [class.activo]="tab() === 'recibidos'" (click)="tab.set('recibidos')">
        <span class="material-icons">move_to_inbox</span>Compartidos conmigo ({{ recibidos().length }})
      </button>
      <button [class.activo]="tab() === 'enviados'" (click)="tab.set('enviados')">
        <span class="material-icons">outbox</span>Compartidos por mí ({{ enviados().length }})
      </button>
    </div>

    <div class="filtros">
      <input type="text" placeholder="Buscar por recurso o persona…" maxlength="120" [(ngModel)]="q" />
      <select [(ngModel)]="tipo">
        <option value="">Archivos y carpetas</option><option value="file">Solo archivos</option><option value="folder">Solo carpetas</option>
      </select>
      <select [(ngModel)]="permiso">
        <option value="">Todos los permisos</option><option value="read">Lectura</option>
        <option value="comment">Comentar</option><option value="edit">Edición</option>
      </select>
      <input type="date" [(ngModel)]="desde" title="Compartido desde" [attr.max]="hasta() || null" [class.invalido]="fechasInvalidas()" />
      <input type="date" [(ngModel)]="hasta" title="Compartido hasta" [attr.min]="desde() || null" [class.invalido]="fechasInvalidas()" />
      @if (hayFiltros()) { <button (click)="limpiar()"><span class="material-icons">close</span>Limpiar</button> }
      <span class="muted small">Mostrando {{ visibles() }} de {{ total() }}</span>
    </div>
    @if (fechasInvalidas()) {
      <p class="err filtros-msg"><span class="material-icons">error_outline</span>La fecha «Desde» no puede ser posterior a «Hasta». Corrígela para ver resultados.</p>
    }

    @if (tab() === 'recibidos') {
      <table class="tabla">
        <thead><tr><th>Recurso</th><th>Tipo</th><th>De</th><th>Permiso</th><th>Fecha</th></tr></thead>
        <tbody>
          @for (s of recibidosVis(); track s._id) {
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
          } @empty {
            <tr><td colspan="5" class="vacio">
              <span class="material-icons">{{ hayFiltros() ? 'search_off' : 'inbox' }}</span>{{ hayFiltros() ? 'Ningún recurso coincide con los filtros' : 'Nadie ha compartido recursos contigo' }}
            </td></tr>
          }
        </tbody>
      </table>
    } @else {
      <table class="tabla">
        <thead><tr><th>Recurso</th><th>Tipo</th><th>Compartido con</th><th>Permiso</th><th>Fecha</th><th></th></tr></thead>
        <tbody>
          @for (s of enviadosVis(); track s._id) {
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
          } @empty {
            <tr><td colspan="6" class="vacio">
              <span class="material-icons">{{ hayFiltros() ? 'search_off' : 'outbox' }}</span>{{ hayFiltros() ? 'Ningún recurso coincide con los filtros' : 'No has compartido recursos' }}
            </td></tr>
          }
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

  q = signal(''); tipo = signal(''); permiso = signal(''); desde = signal(''); hasta = signal('');
  fechasInvalidas = computed(() => rangoInvalido(this.desde(), this.hasta()));
  hayFiltros = computed(() => !!this.q().trim() || !!this.tipo() || !!this.permiso() || !!this.desde() || !!this.hasta());

  // Coincide con el texto (recurso o persona, sin tildes ni mayúsculas), tipo, permiso y fecha de compartición
  private coincide(s: Share, persona: { nombre: string; email: string } | undefined) {
    const q = norm(this.q().trim());
    if (q && !norm(s.recurso.nombre).includes(q) && !norm(persona?.nombre ?? '').includes(q) && !norm(persona?.email ?? '').includes(q))
      return false;
    if (this.tipo() && s.resourceType !== this.tipo()) return false;
    if (this.permiso() && s.permission !== this.permiso()) return false;
    const t = new Date(s.createdAt).getTime();
    const ini = this.desde() ? new Date(this.desde() + 'T00:00:00-06:00').getTime() : -Infinity;
    const fin = this.hasta() ? new Date(this.hasta() + 'T23:59:59.999-06:00').getTime() : Infinity;
    return t >= ini && t <= fin;
  }
  recibidosVis = computed(() => this.recibidos().filter((s) => this.coincide(s, s.owner)));
  enviadosVis = computed(() => this.enviados().filter((s) => this.coincide(s, s.sharedWith)));
  visibles = computed(() => (this.tab() === 'recibidos' ? this.recibidosVis().length : this.enviadosVis().length));
  total = computed(() => (this.tab() === 'recibidos' ? this.recibidos().length : this.enviados().length));
  limpiar() { this.q.set(''); this.tipo.set(''); this.permiso.set(''); this.desde.set(''); this.hasta.set(''); }

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