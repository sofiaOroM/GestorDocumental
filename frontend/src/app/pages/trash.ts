import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { Toast } from '../core/toast';
import { Confirm } from '../core/confirm';
import { Papelera, TipoRecurso } from '../core/models';
import { Bytes } from '../core/bytes.pipe';

@Component({
  selector: 'app-trash',
  imports: [DatePipe, Bytes],
  template: `
    <div class="toolbar">
      <h2>Papelera</h2><div class="spacer"></div>
      <button class="danger" [disabled]="vacia()" (click)="vaciar()"><span class="material-icons">delete_sweep</span>Vaciar papelera</button>
    </div>
    <p class="muted">Los elementos eliminados se conservan aquí hasta que los restaures o los elimines definitivamente.</p>

    <table class="tabla">
      <thead><tr><th>Nombre</th><th>Tipo</th><th>Tamaño / contenido</th><th>Eliminado</th><th></th></tr></thead>
      <tbody>
        @for (c of datos().carpetas; track c._id) {
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
        @for (a of datos().archivos; track a._id) {
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
        @if (vacia()) { <tr><td colspan="5" class="vacio"><span class="material-icons">delete_outline</span>La papelera está vacía</td></tr> }
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