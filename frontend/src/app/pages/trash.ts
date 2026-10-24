import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { Toast } from '../core/toast';
import { Confirm } from '../core/confirm';
import { Papelera, TipoRecurso } from '../core/models';
import { Bytes } from '../core/bytes.pipe';
import { rangoInvalido } from '../core/validators';

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(); // ignora tildes y mayúsculas

@Component({
  selector: 'app-trash',
  imports: [DatePipe, FormsModule, Bytes],
  template: `
    <div class="toolbar">
      <h2>Papelera</h2><div class="spacer"></div>
      <button class="danger" [disabled]="vacia()" (click)="vaciar()"><span class="material-icons">delete_sweep</span>Vaciar papelera</button>
    </div>
    <p class="muted">Los elementos eliminados se conservan aquí hasta que los restaures o los elimines definitivamente.</p>

    @if (!vacia()) {
      <div class="filtros">
        <input type="text" placeholder="Buscar por nombre…" maxlength="120" [(ngModel)]="q" />
        <select [(ngModel)]="tipo">
          <option value="">Carpetas y archivos</option><option value="folder">Solo carpetas</option><option value="file">Solo archivos</option>
        </select>
        <input type="date" [(ngModel)]="desde" title="Eliminado desde" [attr.max]="hasta() || null" [class.invalido]="fechasInvalidas()" />
        <input type="date" [(ngModel)]="hasta" title="Eliminado hasta" [attr.min]="desde() || null" [class.invalido]="fechasInvalidas()" />
        @if (hayFiltros()) { <button (click)="limpiar()"><span class="material-icons">close</span>Limpiar</button> }
        <span class="muted small">Mostrando {{ visibles() }} de {{ totalElementos() }} elementos</span>
      </div>
      @if (fechasInvalidas()) {
        <p class="err filtros-msg"><span class="material-icons">error_outline</span>La fecha «Desde» no puede ser posterior a «Hasta».</p>
      }
    }

    <table class="tabla">
      <thead><tr><th>Nombre</th><th>Tipo</th><th>Tamaño / contenido</th><th>Eliminado</th><th></th></tr></thead>
      <tbody>
        @for (c of carpetasVis(); track c._id) {
          <tr>
            <td><span class="nombre"><span class="material-icons carpeta">folder</span>{{ c.nombre }}</span></td>
            <td>Carpeta</td>
            <td>{{ c.contiene?.carpetas }} subcarpeta(s), {{ c.contiene?.archivos }} archivo(s)</td>
            <td>{{ c.deletedAt | date:'dd/MM/yyyy HH:mm' }}</td>
            <td class="acciones">
              <button class="ok" (click)="restaurar('folder', c._id)"><span class="material-icons">restore_from_trash</span>Restaurar</button>
              <button class="danger" (click)="eliminar('folder', c._id, c.nombre)"><span class="material-icons">delete_forever</span>Eliminar</button>
            </td>
          </tr>
        }
        @for (a of archivosVis(); track a._id) {
          <tr>
            <td><span class="nombre"><span class="material-icons archivo">description</span>{{ a.nombre }}</span></td>
            <td>.{{ a.extension }}</td><td>{{ a.size | bytes }}</td>
            <td>{{ a.deletedAt | date:'dd/MM/yyyy HH:mm' }}</td>
            <td class="acciones">
              <button class="ok" (click)="restaurar('file', a._id)"><span class="material-icons">restore_from_trash</span>Restaurar</button>
              <button class="danger" (click)="eliminar('file', a._id, a.nombre)"><span class="material-icons">delete_forever</span>Eliminar</button>
            </td>
          </tr>
        }
        @if (vacia()) {
          <tr><td colspan="5" class="vacio"><span class="material-icons">delete_outline</span>La papelera está vacía</td></tr>
        } @else if (!visibles()) {
          <tr><td colspan="5" class="vacio"><span class="material-icons">search_off</span>Ningún elemento coincide con los filtros</td></tr>
        }
      </tbody>
    </table>
  `
})
export class Trash implements OnInit {
  private api = inject(Api);
  private auth = inject(Auth);
  private toast = inject(Toast);
  private confirm = inject(Confirm);
  datos = signal<Papelera>({ carpetas: [], archivos: [] });

  vacia = () => !this.datos().carpetas.length && !this.datos().archivos.length;

  q = signal(''); tipo = signal(''); desde = signal(''); hasta = signal('');
  fechasInvalidas = computed(() => rangoInvalido(this.desde(), this.hasta()));
  hayFiltros = computed(() => !!this.q().trim() || !!this.tipo() || !!this.desde() || !!this.hasta());

  // Coincide con el texto (sin tildes ni mayúsculas) y con el rango de fecha de eliminación
  private coincide(nombre: string, eliminado?: string | null) {
    const q = norm(this.q().trim());
    if (q && !norm(nombre).includes(q)) return false;
    if (!eliminado) return true;
    const t = new Date(eliminado).getTime();
    const ini = this.desde() ? new Date(this.desde() + 'T00:00:00-06:00').getTime() : -Infinity;
    const fin = this.hasta() ? new Date(this.hasta() + 'T23:59:59.999-06:00').getTime() : Infinity;
    return t >= ini && t <= fin;
  }
  carpetasVis = computed(() => this.tipo() === 'file' ? [] : this.datos().carpetas.filter((c) => this.coincide(c.nombre, c.deletedAt)));
  archivosVis = computed(() => this.tipo() === 'folder' ? [] : this.datos().archivos.filter((a) => this.coincide(a.nombre, a.deletedAt)));
  visibles = computed(() => this.carpetasVis().length + this.archivosVis().length);
  totalElementos = computed(() => this.datos().carpetas.length + this.datos().archivos.length);
  limpiar() { this.q.set(''); this.tipo.set(''); this.desde.set(''); this.hasta.set(''); }
  ngOnInit() { this.cargar(); }

  async cargar() {
    try { this.datos.set(await firstValueFrom(this.api.trash())); } catch (e) { this.toast.error(e); }
  }

  async restaurar(tipo: TipoRecurso, id: string) {
    try { await firstValueFrom(this.api.restore(tipo, id)); this.toast.ok('Restaurado'); this.cargar(); }
    catch (e) { this.toast.error(e); }
  }

  async eliminar(tipo: TipoRecurso, id: string, nombre: string) {
    const ok = await this.confirm.ask({
      titulo: 'Eliminar definitivamente',
      mensaje: `«${nombre}» se eliminará de forma permanente y no podrás recuperarlo.`,
      confirmar: 'Eliminar', peligro: true, icono: 'delete_forever'
    });
    if (!ok) return;
    try {
      await firstValueFrom(this.api.purge(tipo, id));
      this.toast.ok('Eliminado definitivamente');
      this.auth.refresh(); // se libera espacio
      this.cargar();
    } catch (e) { this.toast.error(e); }
  }

  async vaciar() {
    const ok = await this.confirm.ask({
      titulo: 'Vaciar papelera',
      mensaje: 'Todos los elementos de la papelera se eliminarán de forma permanente.',
      confirmar: 'Vaciar papelera', peligro: true, icono: 'delete_sweep'
    });
    if (!ok) return;
    try { await firstValueFrom(this.api.emptyTrash()); this.toast.ok('Papelera vaciada'); this.auth.refresh(); this.cargar(); }
    catch (e) { this.toast.error(e); }
  }
}