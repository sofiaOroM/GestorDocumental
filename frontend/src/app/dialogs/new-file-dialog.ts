import { Component, computed, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CARACTERES_INVALIDOS, MAX_NOMBRE, validarNombreRecurso } from '../core/validators';

// Crea un archivo .txt o .md escribiendo su contenido en la aplicación.
// Internamente se envía con el mismo endpoint de subida (POST /api/files), por lo que se guarda en GridFS.
@Component({
    selector: 'app-new-file-dialog',
    imports: [FormsModule],
    template: `
    <div class="overlay" (click)="cancelar.emit()">
      <div class="modal wide" (click)="$event.stopPropagation()">
        <h3>Nuevo archivo</h3>

        <label>Nombre</label>
        <div class="row">
          <input class="grow" type="text" [ngModel]="base()" (ngModelChange)="cambio($event)" [attr.maxlength]="max"
                 placeholder="Ej.: acta_reunion" [class.invalido]="verError()" autofocus />
          <select [(ngModel)]="ext"><option value=".txt">.txt</option><option value=".md">.md</option></select>
        </div>
        @if (verError()) {
          <p class="err"><span class="material-icons">error_outline</span>{{ error() }}</p>
        } @else {
          <p class="hint">Se guardará como «{{ nombreFinal() || '…' }}». No uses {{ invalidos }}</p>
        }

        <label>Contenido</label>
        <textarea class="visor" [(ngModel)]="texto" placeholder="Escribe el contenido del archivo…"></textarea>

        <div class="modal-actions">
          <button (click)="cancelar.emit()">Cancelar</button>
          <button class="primary" [disabled]="!!error()" (click)="ok()">
            <span class="material-icons">note_add</span>Crear archivo
          </button>
        </div>
        @if (error()) {
          <p class="ayuda-boton"><span class="material-icons">info</span>Escribe un nombre válido para habilitar el botón.</p>
        }
      </div>
    </div>
  `
})
export class NewFileDialog {
    creado = output<{ nombre: string; texto: string }>();
    cancelar = output<void>();

    max = MAX_NOMBRE;
    invalidos = CARACTERES_INVALIDOS;
    base = signal('');
    ext = signal('.txt');
    texto = signal('');
    editado = signal(false);

    // Si el usuario ya escribió la extensión (.txt o .md) no se duplica
    nombreFinal = computed(() => {
        const b = this.base().trim();
        if (!b) return '';
        return /\.(txt|md)$/i.test(b) ? b : b + this.ext();
    });
    error = computed(() => validarNombreRecurso(this.nombreFinal(), 'archivo'));
    verError = computed(() => this.editado() && !!this.error());

    cambio(v: string) { this.base.set(v); this.editado.set(true); }
    ok() { if (!this.error()) this.creado.emit({ nombre: this.nombreFinal(), texto: this.texto() }); }
}