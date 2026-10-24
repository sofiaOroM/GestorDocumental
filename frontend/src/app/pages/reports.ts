import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { Toast } from '../core/toast';
import { Usuario } from '../core/models';
import { accionLabel, fmtBytes, fmtFecha, PERMISOS, tipoLabel } from '../core/util';
import { rangoInvalido } from '../core/validators';

type Filtro = 'fechas' | 'usuario' | 'granularidad';
interface Rep {
  id: string; grupo: string; titulo: string; path: string; admin?: boolean; filtros: Filtro[];
  cols: { h: string; f: (r: any) => string | number }[];
  barra?: (r: any) => number; // columna numérica que se dibuja como barra
}

const REPORTES: Rep[] = [
  { id: 'tipo', grupo: 'Archivos y almacenamiento', titulo: 'Archivos por tipo', path: 'archivos-por-tipo', filtros: [],
    cols: [{ h: 'Tipo', f: r => '.' + r.tipo }, { h: 'Cantidad', f: r => r.cantidad }, { h: 'Tamaño total', f: r => fmtBytes(r.tamanoTotal) }],
    barra: r => r.cantidad },
  { id: 'fecha', grupo: 'Archivos y almacenamiento', titulo: 'Archivos en un rango de fechas', path: 'archivos-por-fecha', filtros: ['fechas'],
    cols: [{ h: 'Nombre', f: r => r.nombre }, { h: 'Tipo', f: r => '.' + r.extension }, { h: 'Tamaño', f: r => fmtBytes(r.size) },
      { h: 'Propietario', f: r => r.propietario }, { h: 'Creado', f: r => fmtFecha(r.createdAt) }] },
  { id: 'ops', grupo: 'Archivos y almacenamiento', titulo: 'Archivos con más operaciones', path: 'archivos-mas-operaciones', filtros: [],
    cols: [{ h: 'Archivo', f: r => r.nombre }, { h: 'Operaciones', f: r => r.operaciones }, { h: 'Última', f: r => fmtFecha(r.ultima) },
      { h: 'Existe', f: r => (r.existe ? 'Sí' : 'Eliminado') }],
    barra: r => r.operaciones },
  { id: 'carp', grupo: 'Archivos y almacenamiento', titulo: 'Carpetas con más archivos', path: 'carpetas-mas-archivos', filtros: [],
    cols: [{ h: 'Carpeta', f: r => r.nombre }, { h: 'Propietario', f: r => r.propietario }, { h: 'Archivos', f: r => r.archivos },
      { h: 'Tamaño total', f: r => fmtBytes(r.tamanoTotal) }],
    barra: r => r.archivos },
  { id: 'top', grupo: 'Usuarios', titulo: 'Top 10 usuarios con más archivos', path: 'usuarios-top-archivos', admin: true, filtros: [],
    cols: [{ h: 'Usuario', f: r => r.nombre }, { h: 'Correo', f: r => r.email }, { h: 'Archivos', f: r => r.archivos },
      { h: 'Tamaño total', f: r => fmtBytes(r.tamanoTotal) }],
    barra: r => r.archivos },
  { id: 'comp', grupo: 'Usuarios', titulo: 'Usuarios con más recursos compartidos', path: 'usuarios-mas-compartidos', admin: true, filtros: [],
    cols: [{ h: 'Usuario', f: r => r.nombre }, { h: 'Total', f: r => r.totalCompartidos }, { h: 'Archivos', f: r => r.archivos },
      { h: 'Carpetas', f: r => r.carpetas }, { h: 'Recursos distintos', f: r => r.recursosDistintos }],
    barra: r => r.totalCompartidos },
  { id: 'masusu', grupo: 'Compartición', titulo: 'Archivos compartidos con más usuarios', path: 'archivos-mas-compartidos', filtros: [],
    cols: [{ h: 'Archivo', f: r => r.nombre }, { h: 'Usuarios', f: r => r.usuarios }], barra: r => r.usuarios },
  { id: 'nunca', grupo: 'Compartición', titulo: 'Archivos que nunca han sido compartidos', path: 'archivos-nunca-compartidos', filtros: [],
    cols: [{ h: 'Archivo', f: r => r.nombre }, { h: 'Tipo', f: r => '.' + r.extension }, { h: 'Tamaño', f: r => fmtBytes(r.size) },
      { h: 'Propietario', f: r => r.propietario }, { h: 'Creado', f: r => fmtFecha(r.createdAt) }] },
  { id: 'por', grupo: 'Compartición', titulo: 'Recursos compartidos por un usuario', path: 'compartidos-por', filtros: ['usuario'],
    cols: [{ h: 'Recurso', f: r => r.recurso.nombre }, { h: 'Tipo', f: r => tipoLabel(r.resourceType) },
      { h: 'Compartido con', f: r => r.sharedWith?.nombre }, { h: 'Permiso', f: r => PERMISOS[r.permission] }, { h: 'Fecha', f: r => fmtFecha(r.createdAt) }] },
  { id: 'rec', grupo: 'Compartición', titulo: 'Recursos recibidos por un usuario', path: 'recibidos-por', filtros: ['usuario'],
    cols: [{ h: 'Recurso', f: r => r.recurso.nombre }, { h: 'Tipo', f: r => tipoLabel(r.resourceType) },
      { h: 'De', f: r => r.owner?.nombre }, { h: 'Permiso', f: r => PERMISOS[r.permission] }, { h: 'Fecha', f: r => fmtFecha(r.createdAt) }] },
  { id: 'actusu', grupo: 'Actividad', titulo: 'Actividad de un usuario por fechas', path: 'actividad-usuario', filtros: ['usuario', 'fechas'],
    cols: [{ h: 'Fecha', f: r => fmtFecha(r.timestamp) }, { h: 'Acción', f: r => accionLabel(r.action) },
      { h: 'Tipo', f: r => tipoLabel(r.resourceType) }, { h: 'Recurso', f: r => r.resourceName }] },
  { id: 'optipo', grupo: 'Actividad', titulo: 'Operaciones por tipo', path: 'operaciones-por-tipo', filtros: ['fechas'],
    cols: [{ h: 'Acción', f: r => accionLabel(r.accion) }, { h: 'Cantidad', f: r => r.cantidad }], barra: r => r.cantidad },
  { id: 'opper', grupo: 'Actividad', titulo: 'Operaciones por período', path: 'operaciones-por-periodo', filtros: ['fechas', 'granularidad'],
    cols: [{ h: 'Período', f: r => r.periodo }, { h: 'Cantidad', f: r => r.cantidad }], barra: r => r.cantidad },
  { id: 'princ', grupo: 'Actividad', titulo: 'Principales acciones del sistema', path: 'principales-acciones', filtros: ['fechas'],
    cols: [{ h: 'Acción', f: r => accionLabel(r.accion) }, { h: 'Recurso', f: r => tipoLabel(r.recurso) },
      { h: 'Cantidad', f: r => r.cantidad }, { h: 'Usuarios distintos', f: r => r.usuariosDistintos }],
    barra: r => r.cantidad }
];

@Component({
  selector: 'app-reports',
  imports: [FormsModule],
  template: `
    <div class="reportes">
      <aside class="lista-reportes">
        @for (g of grupos(); track g.nombre) {
          <h4>{{ g.nombre }}</h4>
          @for (r of g.items; track r.id) {
            <button [class.activo]="sel().id === r.id" (click)="elegir(r)">{{ r.titulo }}</button>
          }
        }
      </aside>

      <section class="resultado">
        <h2>{{ sel().titulo }}</h2>
        <div class="filtros">
          @if (sel().filtros.includes('usuario') && auth.isAdmin()) {
            <select [(ngModel)]="userId">
              <option value="">Yo mismo</option>
              @for (u of usuarios(); track u._id) { <option [value]="u._id">{{ u.nombre }}</option> }
            </select>
          }
          @if (sel().filtros.includes('fechas')) {
            <input type="date" [(ngModel)]="desde" title="Desde" [attr.max]="hasta() || null" [class.invalido]="fechasInvalidas()" />
            <input type="date" [(ngModel)]="hasta" title="Hasta" [attr.min]="desde() || null" [class.invalido]="fechasInvalidas()" />
          }
          @if (sel().filtros.includes('granularidad')) {
            <select [(ngModel)]="gran"><option value="dia">Por día</option><option value="hora">Por hora</option><option value="mes">Por mes</option></select>
          }
          <button class="primary" [disabled]="fechasInvalidas()" (click)="ejecutar()">Generar</button>
        </div>
        @if (fechasInvalidas()) {
          <p class="err filtros-msg"><span class="material-icons">error_outline</span>La fecha «Desde» no puede ser posterior a «Hasta». Corrígela para habilitar el botón Generar.</p>
        }

        @if (filas() !== null) {
          <table class="tabla">
            <thead>
            <tr>@for (c of sel().cols; track c.h) { <th>{{ c.h }}</th> }@if (sel().barra) { <th class="ancho"></th> }</tr>
            </thead>
            <tbody>
              @for (f of filas(); track $index) {
                <tr>
                  @for (c of sel().cols; track c.h) { <td>{{ c.f(f) }}</td> }
                  @if (sel().barra; as b) { <td><div class="barra" [style.width.%]="(b(f) / max()) * 100"></div></td> }
                </tr>
              } @empty { <tr><td [attr.colspan]="sel().cols.length + 1" class="muted">Sin resultados.</td></tr> }
            </tbody>
          </table>
        } @else { <p class="muted">Elige los filtros y pulsa «Generar».</p> }
      </section>
    </div>
  `
})
export class Reports implements OnInit {
  private api = inject(Api);
  auth = inject(Auth);
  private toast = inject(Toast);

  visibles = computed(() => REPORTES.filter((r) => !r.admin || this.auth.isAdmin()));
  grupos = computed(() => {
    const m = new Map<string, Rep[]>();
    for (const r of this.visibles()) m.set(r.grupo, [...(m.get(r.grupo) ?? []), r]);
    return [...m].map(([nombre, items]) => ({ nombre, items }));
  });

  sel = signal<Rep>(REPORTES[0]);
  filas = signal<any[] | null>(null);
  usuarios = signal<Usuario[]>([]);
  userId = signal(''); desde = signal(''); hasta = signal(''); gran = signal('dia');
  fechasInvalidas = computed(() => this.sel().filtros.includes('fechas') && rangoInvalido(this.desde(), this.hasta()));
  max = computed(() => {
    const b = this.sel().barra;
    return b ? Math.max(1, ...(this.filas() ?? []).map(b)) : 1;
  });

  async ngOnInit() {
    if (this.auth.isAdmin()) {
      try { this.usuarios.set(await firstValueFrom(this.api.users())); } catch (e) { this.toast.error(e); }
    }
    this.ejecutar();
  }

  elegir(r: Rep) { this.sel.set(r); this.filas.set(null); this.ejecutar(); }

  async ejecutar() {
    if (this.fechasInvalidas()) return;
    const f = this.sel().filtros;
    const params: Record<string, unknown> = {};
    if (f.includes('usuario')) params['userId'] = this.userId();
    if (f.includes('fechas')) { params['desde'] = this.desde(); params['hasta'] = this.hasta(); }
    if (f.includes('granularidad')) params['granularidad'] = this.gran();
    try { this.filas.set(await firstValueFrom(this.api.report(this.sel().path, params))); }
    catch (e) { this.toast.error(e); }
  }
}
