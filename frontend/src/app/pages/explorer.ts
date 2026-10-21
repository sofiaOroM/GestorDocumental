import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Location, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { Toast } from '../core/toast';
import { Confirm } from '../core/confirm';
import { Archivo, Contenido, TipoRecurso } from '../core/models';
import { NIVELES } from '../core/util';
import { Bytes } from '../core/bytes.pipe';
import { PromptDialog } from '../dialogs/prompt-dialog';
import { MoveDialog } from '../dialogs/move-dialog';
import { ShareDialog } from '../dialogs/share-dialog';
import { FileViewer } from '../dialogs/file-viewer';
import { HistoryDialog } from '../dialogs/history-dialog';

interface Dlg { t: 'nuevaCarpeta' | 'renombrar' | 'mover' | 'compartir' | 'ver' | 'historial'; tipo?: TipoRecurso; item?: any; }

@Component({
  selector: 'app-explorer',
  imports: [FormsModule, RouterLink, DatePipe, Bytes, PromptDialog, MoveDialog, ShareDialog, FileViewer, HistoryDialog],
  template: `
    <div class="toolbar">
      <div class="crumbs">
        @if (data(); as d) {
          @if (d.carpeta) {
            <button class="ib gris" title="Volver" (click)="atras()"><span class="material-icons">arrow_back</span></button>
          }
          <a routerLink="/explorador" class="crumb-inicio"><span class="material-icons">home</span>Inicio</a>
          @for (r of d.ruta; track r._id) {
            <span class="material-icons sep">chevron_right</span><a [routerLink]="['/explorador', r._id]">{{ r.nombre }}</a>
          }
          @if (d.carpeta) {
            <span class="material-icons sep">chevron_right</span><strong>{{ d.carpeta.nombre }}</strong>
            @if (d.nivel !== 'owner') { <span class="badge">{{ nivelLabel() }}</span> }
          }
        }
      </div>
      <div class="spacer"></div>
      @if (puedeEscribir()) {
        <button (click)="dlg.set({ t: 'nuevaCarpeta' })">
          <span class="material-icons ic-ambar">create_new_folder</span>Nueva carpeta
        </button>
        <label class="btn primary">
          <span class="material-icons">upload_file</span>Subir archivos
          <input type="file" hidden multiple accept=".txt,.md" (change)="subir($event)" />
        </label>
      }
    </div>

    <div class="filtros">
      <input type="text" placeholder="Buscar por nombre…" [(ngModel)]="q" (keyup.enter)="buscar()" />
      <select [(ngModel)]="ext">
        <option value="">Todos los tipos</option><option value="txt">.txt</option><option value="md">.md</option>
      </select>
      <input type="date" [(ngModel)]="desde" title="Desde" />
      <input type="date" [(ngModel)]="hasta" title="Hasta" />
      <select [(ngModel)]="orden">
        <option value="createdAt">Más recientes</option><option value="nombre">Nombre</option><option value="size">Tamaño</option>
      </select>
      <button class="primary" (click)="buscar()"><span class="material-icons">search</span>Buscar</button>
      @if (resultados()) { <button (click)="limpiar()"><span class="material-icons">close</span>Limpiar</button> }
    </div>

    @if (resultados(); as rs) {
      <h3>Resultados ({{ rs.length }}) <small class="muted">en todos tus archivos</small></h3>
      <table class="tabla">
        <thead><tr><th>Nombre</th><th>Tipo</th><th>Tamaño</th><th>Creado</th><th></th></tr></thead>
        <tbody>
          @for (a of rs; track a._id) {
            <tr>
              <td><a class="nombre" (click)="abrir(a)"><span class="material-icons archivo">description</span>{{ a.nombre }}</a></td>
              <td>.{{ a.extension }}</td><td>{{ a.size | bytes }}</td>
              <td>{{ a.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
              <td class="acciones">
                <button class="ib azul" title="Descargar" (click)="api.download(a._id, a.nombre)"><span class="material-icons">download</span></button>
                <button class="ib ambar" title="Ir a su carpeta" (click)="irACarpeta(a)"><span class="material-icons">folder_open</span></button>
              </td>
            </tr>
          } @empty { <tr><td colspan="5" class="muted">Sin resultados.</td></tr> }
        </tbody>
      </table>
    } @else if (data(); as d) {
      <table class="tabla">
        <thead><tr><th>Nombre</th><th>Tipo</th><th>Tamaño</th><th>Modificado</th><th></th></tr></thead>
        <tbody>
          @for (c of d.carpetas; track c._id) {
            <tr>
              <td><a class="nombre" [routerLink]="['/explorador', c._id]"><span class="material-icons carpeta">folder</span>{{ c.nombre }}</a></td>
              <td>Carpeta</td><td>—</td>
              <td>{{ c.updatedAt | date:'dd/MM/yyyy HH:mm' }}</td>
              <td class="acciones">
                @if (puedeEscribir()) {
                  <button class="ib ambar" title="Renombrar" (click)="dlg.set({ t: 'renombrar', tipo: 'folder', item: c })"><span class="material-icons">edit</span></button>
                }
                @if (esDueno()) {
                  <button class="ib violeta" title="Mover" (click)="dlg.set({ t: 'mover', tipo: 'folder', item: c })"><span class="material-icons">drive_file_move</span></button>
                  <button class="ib verde" title="Compartir" (click)="dlg.set({ t: 'compartir', tipo: 'folder', item: c })"><span class="material-icons">group_add</span></button>
                }
                <button class="ib gris" title="Historial" (click)="dlg.set({ t: 'historial', tipo: 'folder', item: c })"><span class="material-icons">history</span></button>
                @if (esDueno()) {
                  <button class="ib rojo" title="Enviar a papelera" (click)="eliminar('folder', c)"><span class="material-icons">delete</span></button>
                }
              </td>
            </tr>
          }
          @for (a of d.archivos; track a._id) {
            <tr>
              <td><a class="nombre" (click)="abrir(a)"><span class="material-icons archivo">description</span>{{ a.nombre }}</a></td>
              <td>.{{ a.extension }}</td><td>{{ a.size | bytes }}</td>
              <td>{{ a.updatedAt | date:'dd/MM/yyyy HH:mm' }}</td>
              <td class="acciones">
                <button class="ib azul" title="Descargar" (click)="api.download(a._id, a.nombre)"><span class="material-icons">download</span></button>
                @if (puedeEscribir()) {
                  <button class="ib ambar" title="Renombrar" (click)="dlg.set({ t: 'renombrar', tipo: 'file', item: a })"><span class="material-icons">edit</span></button>
                }
                @if (esDueno()) {
                  <button class="ib violeta" title="Mover" (click)="dlg.set({ t: 'mover', tipo: 'file', item: a })"><span class="material-icons">drive_file_move</span></button>
                  <button class="ib verde" title="Compartir" (click)="dlg.set({ t: 'compartir', tipo: 'file', item: a })"><span class="material-icons">group_add</span></button>
                }
                <button class="ib gris" title="Historial" (click)="dlg.set({ t: 'historial', tipo: 'file', item: a })"><span class="material-icons">history</span></button>
                @if (esDueno()) {
                  <button class="ib rojo" title="Enviar a papelera" (click)="eliminar('file', a)"><span class="material-icons">delete</span></button>
                }
              </td>
            </tr>
          }
          @if (!d.carpetas.length && !d.archivos.length) {
            <tr><td colspan="5" class="vacio"><span class="material-icons">folder_off</span>Esta carpeta está vacía</td></tr>
          }
        </tbody>
      </table>
    } @else if (cargando()) { <p class="muted">Cargando…</p> }

    @if (dlg(); as d) {
      @switch (d.t) {
        @case ('nuevaCarpeta') {
          <app-prompt-dialog titulo="Nueva carpeta" (confirmar)="crearCarpeta($event)" (cancelar)="dlg.set(null)" />
        }
        @case ('renombrar') {
          <app-prompt-dialog titulo="Renombrar" [valor]="d.item.nombre" (confirmar)="renombrar($event)" (cancelar)="dlg.set(null)" />
        }
        @case ('mover') {
          <app-move-dialog [tipo]="d.tipo!" [item]="d.item" (movido)="dlg.set(null); recargar()" (cancelar)="dlg.set(null)" />
        }
        @case ('compartir') {
          <app-share-dialog [tipo]="d.tipo!" [recurso]="d.item" (cerrar)="dlg.set(null)" />
        }
        @case ('ver') {
          <app-file-viewer [archivo]="d.item" (cerrar)="dlg.set(null); recargar()" />
        }
        @case ('historial') {
          <app-history-dialog [tipo]="d.tipo!" [recurso]="d.item" (cerrar)="dlg.set(null)" />
        }
      }
    }
  `
})
export class Explorer {
  api = inject(Api);
  private auth = inject(Auth);
  private toast = inject(Toast);
  private confirm = inject(Confirm);
  private router = inject(Router);
  private location = inject(Location);

  id = input<string>(); // parámetro :id de la ruta
  data = signal<Contenido | null>(null);
  cargando = signal(false);
  dlg = signal<Dlg | null>(null);

  nivel = computed(() => this.data()?.nivel ?? 'owner');
  nivelLabel = computed(() => NIVELES[this.nivel()]);
  puedeEscribir = computed(() => this.nivel() === 'owner' || this.nivel() === 'edit');
  esDueno = computed(() => this.nivel() === 'owner');

  q = signal(''); ext = signal(''); desde = signal(''); hasta = signal(''); orden = signal('createdAt');
  resultados = signal<Archivo[] | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => { this.resultados.set(null); this.data.set(null); this.cargar(id); });
    });
  }

  async cargar(id: string | undefined = this.id()) {
    this.cargando.set(true);
    try { this.data.set(await firstValueFrom(this.api.contents(id))); }
    catch (e) { this.toast.error(e); if (id) this.router.navigate(['/explorador']); }
    finally { this.cargando.set(false); }
  }
  recargar() { return this.cargar(); }
  atras() { this.location.back(); }

  abrir(a: Archivo) { this.dlg.set({ t: 'ver', item: a }); }
  irACarpeta(a: Archivo) { this.router.navigate(a.folderId ? ['/explorador', a.folderId] : ['/explorador']); }

  async buscar() {
    try {
      const r = await firstValueFrom(this.api.searchFiles({
        q: this.q(), extension: this.ext(), desde: this.desde(), hasta: this.hasta(),
        sort: this.orden(), order: this.orden() === 'nombre' ? 'asc' : 'desc', limit: 100
      }));
      this.resultados.set(r.items);
    } catch (e) { this.toast.error(e); }
  }
  limpiar() {
    this.q.set(''); this.ext.set(''); this.desde.set(''); this.hasta.set(''); this.orden.set('createdAt');
    this.resultados.set(null);
  }

  async crearCarpeta(nombre: string) {
    this.dlg.set(null);
    try { await firstValueFrom(this.api.createFolder(nombre, this.id())); this.toast.ok('Carpeta creada'); this.recargar(); }
    catch (e) { this.toast.error(e); }
  }

  async renombrar(nombre: string) {
    const d = this.dlg();
    this.dlg.set(null);
    if (!d) return;
    try {
      if (d.tipo === 'file') await firstValueFrom(this.api.renameFile(d.item._id, nombre));
      else await firstValueFrom(this.api.renameFolder(d.item._id, nombre));
      this.toast.ok('Renombrado');
      this.recargar();
    } catch (e) { this.toast.error(e); }
  }

  async eliminar(tipo: TipoRecurso, item: { _id: string; nombre: string }) {
    const ok = await this.confirm.ask({
      titulo: tipo === 'folder' ? 'Enviar carpeta a la papelera' : 'Enviar archivo a la papelera',
      mensaje: tipo === 'folder'
          ? `«${item.nombre}» y todo su contenido se moverán a la papelera. Podrás restaurarla cuando quieras.`
          : `«${item.nombre}» se moverá a la papelera. Podrás restaurarlo cuando quieras.`,
      confirmar: 'Enviar a la papelera', peligro: true, icono: 'delete'
    });
    if (!ok) return;
    try {
      if (tipo === 'file') await firstValueFrom(this.api.deleteFile(item._id));
      else await firstValueFrom(this.api.deleteFolder(item._id));
      this.toast.ok('Enviado a la papelera');
      this.recargar();
    } catch (e) { this.toast.error(e); }
  }

  async subir(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    input.value = '';
    let ok = 0;
    for (const f of archivos) {
      try { await firstValueFrom(this.api.upload(f, this.id())); ok++; }
      catch (e) { this.toast.error(`${f.name}: ${(e as any)?.error?.error ?? 'no se pudo subir'}`); }
    }
    if (ok) { this.toast.ok(`${ok} archivo(s) subido(s)`); this.auth.refresh(); this.recargar(); }
  }
}