import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { Toast } from '../core/toast';
import { Comentario } from '../core/models';
import { NIVELES } from '../core/util';

// Vista previa, edición de contenido (permiso edit) y comentarios (permiso comment).
// El nivel real lo calcula el servidor (GET /files/:id) para no depender de la pantalla de origen.
@Component({
  selector: 'app-file-viewer',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="overlay" (click)="cerrar.emit()">
      <div class="modal wide" (click)="$event.stopPropagation()">
        <div class="row">
          <h3 class="grow">{{ archivo().nombre }}</h3>
          <span class="badge">{{ nivelLabel() }}</span>
        </div>

        @if (cargando()) { <p class="muted">Cargando…</p> }
        @else {
          <textarea class="visor" [ngModel]="texto()" (ngModelChange)="texto.set($event)" [readOnly]="!puedeEditar()"></textarea>

          <div class="modal-actions">
            <button (click)="api.download(archivo()._id, archivo().nombre)">⬇ Descargar</button>
            @if (puedeEditar()) {
              <button class="primary" [disabled]="texto() === original()" (click)="guardar()">Guardar cambios</button>
            }
          </div>

          <h4>Comentarios</h4>
          @if (!comentarios().length) { <p class="muted">Sin comentarios.</p> }
          @for (c of comentarios(); track c._id) {
            <div class="comentario"><strong>{{ c.userName }}</strong>
              <small class="muted">{{ c.createdAt | date:'dd/MM/yyyy HH:mm' }}</small>
              <div>{{ c.texto }}</div></div>
          }
          @if (puedeComentar()) {
            <div class="row">
              <input class="grow" type="text" placeholder="Escribe un comentario…" [(ngModel)]="nuevo" (keyup.enter)="comentar()" />
              <button class="primary" [disabled]="!nuevo().trim()" (click)="comentar()">Comentar</button>
            </div>
          }
        }
        <div class="modal-actions"><button (click)="cerrar.emit()">Cerrar</button></div>
      </div>
    </div>
  `
})
export class FileViewer implements OnInit {
  api = inject(Api);
  private toast = inject(Toast);

  archivo = input.required<{ _id: string; nombre: string }>();
  cerrar = output<void>();

  cargando = signal(true);
  nivel = signal('read');
  texto = signal('');
  original = signal('');
  comentarios = signal<Comentario[]>([]);
  nuevo = signal('');

  puedeEditar = computed(() => ['owner', 'edit'].includes(this.nivel()));
  puedeComentar = computed(() => ['owner', 'edit', 'comment'].includes(this.nivel()));
  nivelLabel = computed(() => NIVELES[this.nivel()] ?? '');

  async ngOnInit() {
    const id = this.archivo()._id;
    try {
      const info = await firstValueFrom(this.api.fileInfo(id));
      this.nivel.set(info.nivel);
      const t = await this.api.text(id);
      this.texto.set(t);
      this.original.set(t);
      this.comentarios.set(await firstValueFrom(this.api.comments(id)));
    } catch (e) {
      this.toast.error(e);
      this.cerrar.emit();
    } finally { this.cargando.set(false); }
  }

  async guardar() {
    try {
      const file = new File([this.texto()], this.archivo().nombre, { type: 'text/plain' });
      await firstValueFrom(this.api.saveContent(this.archivo()._id, file));
      this.original.set(this.texto());
      this.toast.ok('Contenido guardado');
    } catch (e) { this.toast.error(e); }
  }

  async comentar() {
    const t = this.nuevo().trim();
    if (!t) return;
    try {
      const c = await firstValueFrom(this.api.addComment(this.archivo()._id, t));
      this.comentarios.update((l) => [...l, c]);
      this.nuevo.set('');
    } catch (e) { this.toast.error(e); }
  }
}
