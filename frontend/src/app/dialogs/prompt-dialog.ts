import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CARACTERES_INVALIDOS, MAX_NOMBRE, validarNombreRecurso } from '../core/validators';

// Pide un nombre (carpeta o archivo) y lo valida antes de habilitar «Aceptar».
@Component({
  selector: 'app-prompt-dialog',
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="cancelar.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3>{{ titulo() }}</h3>
        <label>{{ etiqueta() }}</label>
        <input type="text" [ngModel]="texto()" (ngModelChange)="cambio($event)" (keyup.enter)="ok()"
               [attr.maxlength]="max" [class.invalido]="verError()" autofocus />
        <div class="fila-ayuda">
          @if (verError()) {
            <p class="err"><span class="material-icons">error_outline</span>{{ error() }}</p>
          } @else {
            <p class="hint">{{ ayuda() }}</p>
          }
          <span class="contador" [class.limite]="texto().length >= max">{{ texto().length }}/{{ max }}</span>
        </div>
        <div class="modal-actions">
          <button (click)="cancelar.emit()">Cancelar</button>
          <button class="primary" [disabled]="!!error()" (click)="ok()">Aceptar</button>
        </div>
      </div>
    </div>
  `
})
export class PromptDialog implements OnInit {
  titulo = input.required<string>();
  etiqueta = input('Nombre');
  valor = input('');
  tipo = input<'carpeta' | 'archivo'>('carpeta'); // define las reglas de validación
  confirmar = output<string>();
  cancelar = output<void>();

  max = MAX_NOMBRE;
  texto = signal('');
  editado = signal(false);

  error = computed(() => validarNombreRecurso(this.texto(), this.tipo()));
  verError = computed(() => this.editado() && !!this.error());
  ayuda = computed(() =>
      this.tipo() === 'archivo'
          ? 'Incluye la extensión .txt o .md. No uses ' + CARACTERES_INVALIDOS
          : 'Escribe el nombre. No uses ' + CARACTERES_INVALIDOS);

  ngOnInit() { this.texto.set(this.valor()); }
  cambio(v: string) { this.texto.set(v); this.editado.set(true); }
  ok() { if (!this.error()) this.confirmar.emit(this.texto().trim()); }
}