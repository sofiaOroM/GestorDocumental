import { Component, input, output, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-prompt-dialog',
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="cancelar.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3>{{ titulo() }}</h3>
        <label>{{ etiqueta() }}</label>
        <input type="text" [(ngModel)]="texto" (keyup.enter)="ok()" autofocus />
        <div class="modal-actions">
          <button (click)="cancelar.emit()">Cancelar</button>
          <button class="primary" [disabled]="!texto().trim()" (click)="ok()">Aceptar</button>
        </div>
      </div>
    </div>
  `
})
export class PromptDialog implements OnInit {
  titulo = input.required<string>();
  etiqueta = input('Nombre');
  valor = input('');
  confirmar = output<string>();
  cancelar = output<void>();
  texto = signal('');

  ngOnInit() { this.texto.set(this.valor()); }
  ok() { if (this.texto().trim()) this.confirmar.emit(this.texto().trim()); }
}
