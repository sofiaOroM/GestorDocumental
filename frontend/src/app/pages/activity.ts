import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { Toast } from '../core/toast';
import { Actividad } from '../core/models';
import { accionLabel, tipoLabel } from '../core/util';
import { rangoInvalido } from '../core/validators';

const ACCIONES = ['login', 'upload', 'download', 'view', 'edit', 'rename', 'move', 'trash', 'restore',
  'permanent_delete', 'create_folder', 'share', 'share_update', 'unshare', 'comment', 'create_user', 'update_user'];

@Component({
  selector: 'app-activity',
  imports: [DatePipe, FormsModule],
  template: `
    <h2>Historial de actividad</h2>
    <div class="filtros">
      <select [(ngModel)]="accion">
        <option value="">Todas las acciones</option>
        @for (a of acciones; track a) { <option [value]="a">{{ label(a) }}</option> }
      </select>
      <input type="date" [(ngModel)]="desde" title="Desde" [attr.max]="hasta() || null" [class.invalido]="fechasInvalidas()" />
      <input type="date" [(ngModel)]="hasta" title="Hasta" [attr.min]="desde() || null" [class.invalido]="fechasInvalidas()" />
      <button class="primary" [disabled]="fechasInvalidas()" (click)="buscar()">Filtrar</button>
    </div>
    @if (fechasInvalidas()) {
      <p class="err filtros-msg"><span class="material-icons">error_outline</span>La fecha «Desde» no puede ser posterior a «Hasta». Corrígela para habilitar el botón Filtrar.</p>
    }
    <table class="tabla">
      <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Tipo</th><th>Recurso</th></tr></thead>
      <tbody>
        @for (a of items(); track a._id) {
          <tr>
            <td>{{ a.timestamp | date:'dd/MM/yyyy HH:mm:ss' }}</td><td>{{ a.userName }}</td>
            <td>{{ label(a.action) }}</td><td>{{ tipo(a.resourceType) }}</td><td>{{ a.resourceName }}</td>
          </tr>
        } @empty { <tr><td colspan="5" class="muted">Sin actividad para los filtros indicados.</td></tr> }
      </tbody>
    </table>
    <div class="paginacion">
      <button [disabled]="page() <= 1" (click)="ir(page() - 1)">← Anterior</button>
      <span>Página {{ page() }} de {{ paginas() }} ({{ total() }} registros)</span>
      <button [disabled]="page() >= paginas()" (click)="ir(page() + 1)">Siguiente →</button>
    </div>
  `
})
export class ActivityPage implements OnInit {
  private api = inject(Api);
  private toast = inject(Toast);
  acciones = ACCIONES;
  label = accionLabel;
  tipo = tipoLabel;

  accion = signal(''); desde = signal(''); hasta = signal('');
  fechasInvalidas = computed(() => rangoInvalido(this.desde(), this.hasta()));
  items = signal<Actividad[]>([]);
  page = signal(1);
  total = signal(0);
  paginas = () => Math.max(1, Math.ceil(this.total() / 20));

  ngOnInit() { this.ir(1); }
  buscar() { if (!this.fechasInvalidas()) this.ir(1); }

  async ir(page: number) {
    try {
      const r = await firstValueFrom(this.api.activity({
        action: this.accion(), desde: this.desde(), hasta: this.hasta(), page, limit: 20
      }));
      this.items.set(r.items); this.total.set(r.total); this.page.set(r.page);
    } catch (e) { this.toast.error(e); }
  }
}