import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { Toast } from '../core/toast';
import { Carpeta, TipoRecurso } from '../core/models';

@Component({
  selector: 'app-move-dialog',
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="cancelar.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3>Mover «{{ item().nombre }}»</h3>
        <label>Carpeta destino</label>
        <select [(ngModel)]="destino">
          <option value=""><span class="material-icons">folder</span> Inicio (raíz)</option>
          @for (o of opciones(); track o.id) { <option [value]="o.id">{{ o.etiqueta }}</option> }
        </select>
        <div class="modal-actions">
          <button (click)="cancelar.emit()">Cancelar</button>
          <button class="primary" (click)="mover()">Mover</button>
        </div>
      </div>
    </div>
  `
})
export class MoveDialog implements OnInit {
  private api = inject(Api);
  private toast = inject(Toast);

  tipo = input.required<TipoRecurso>();
  item = input.required<{ _id: string; nombre: string }>();
  movido = output<void>();
  cancelar = output<void>();

  carpetas = signal<Carpeta[]>([]);
  destino = signal('');

  // Etiqueta con la ruta completa; si se mueve una carpeta se excluyen ella y sus descendientes
  opciones = computed(() => {
    const todas = this.carpetas();
    const nombres = new Map(todas.map((c) => [c._id, c.nombre]));
    const id = this.item()._id;
    return todas
      .filter((c) => this.tipo() === 'file' || (c._id !== id && !c.ancestors.includes(id)))
      .map((c) => ({ id: c._id, etiqueta: [...c.ancestors.map((a) => nombres.get(a) ?? '?'), c.nombre].join(' / ') }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
  });

  async ngOnInit() {
    try { this.carpetas.set(await firstValueFrom(this.api.allFolders())); } catch (e) { this.toast.error(e); }
  }

  async mover() {
    const destino = this.destino() || null;
    try {
      if (this.tipo() === 'file') await firstValueFrom(this.api.moveFile(this.item()._id, destino));
      else await firstValueFrom(this.api.moveFolder(this.item()._id, destino));
      this.toast.ok('Movido correctamente');
      this.movido.emit();
    } catch (e) { this.toast.error(e); }
  }
}
