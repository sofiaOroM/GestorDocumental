import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from './core/toast';
import { Confirm } from './core/confirm';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  host: { '(document:keydown.escape)': 'confirm.responder(false)' },
  template: `
    <router-outlet />

    @if (confirm.actual(); as c) {
      <div class="overlay confirm-overlay" (click)="confirm.responder(false)">
        <div class="confirm" [class.peligro]="c.peligro" (click)="$event.stopPropagation()">
          <div class="confirm-icono">
            <span class="material-icons">{{ c.icono ?? (c.peligro ? 'warning' : 'help_outline') }}</span>
          </div>
          <h3>{{ c.titulo }}</h3>
          <p>{{ c.mensaje }}</p>
          <div class="confirm-acciones">
            <button (click)="confirm.responder(false)">{{ c.cancelar ?? 'Cancelar' }}</button>
            <button class="primary" [class.solid-danger]="c.peligro" (click)="confirm.responder(true)">
              {{ c.confirmar ?? 'Aceptar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <div class="toasts">
      @for (t of toast.items(); track t.id) {
        <div class="toast" [class.error]="t.tipo === 'error'">
          <span class="material-icons">{{ t.tipo === 'error' ? 'error' : 'check_circle' }}</span>
          {{ t.texto }}
        </div>
      }
    </div>
  `
})
export class App {
  toast = inject(Toast);
  confirm = inject(Confirm);
}