import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { Toast } from '../core/toast';
import { Actividad, TipoRecurso } from '../core/models';
import { accionLabel } from '../core/util';

@Component({
  selector: 'app-history-dialog',
  imports: [DatePipe],
  template: `
    <div class="overlay" (click)="cerrar.emit()">
      <div class="modal wide" (click)="$event.stopPropagation()">
        <h3>Historial de «{{ recurso().nombre }}»</h3>
        @if (!items().length) { <p class="muted">Sin actividad registrada.</p> }
        <table class="tabla">
          <tbody>
            @for (a of items(); track a._id) {
              <tr>
                <td>{{ a.timestamp | date:'dd/MM/yyyy HH:mm' }}</td>
                <td>{{ a.userName }}</td>
                <td>{{ label(a.action) }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (items().length < total()) {
          <button (click)="cargar()">Cargar más</button>
        }
        <div class="modal-actions"><button (click)="cerrar.emit()">Cerrar</button></div>
      </div>
    </div>
  `
})
export class HistoryDialog implements OnInit {
  private api = inject(Api);
  private toast = inject(Toast);

  tipo = input.required<TipoRecurso>();
  recurso = input.required<{ _id: string; nombre: string }>();
  cerrar = output<void>();

  items = signal<Actividad[]>([]);
  total = signal(0);
  private page = 0;
  label = accionLabel;

  ngOnInit() { this.cargar(); }

  async cargar() {
    try {
      const r = await firstValueFrom(this.api.activityOf(this.tipo(), this.recurso()._id, ++this.page));
      this.items.update((l) => [...l, ...r.items]);
      this.total.set(r.total);
    } catch (e) { this.toast.error(e); }
  }
}
