import { Injectable, signal } from '@angular/core';
import { errMsg } from './util';

@Injectable({ providedIn: 'root' })
export class Toast {
  items = signal<{ id: number; tipo: 'ok' | 'error'; texto: string }[]>([]);
  private n = 0;

  private add(tipo: 'ok' | 'error', texto: string) {
    const id = ++this.n;
    this.items.update((l) => [...l, { id, tipo, texto }]);
    setTimeout(() => this.items.update((l) => l.filter((i) => i.id !== id)), 4000);
  }
  ok(texto: string) { this.add('ok', texto); }
  error(e: unknown) { this.add('error', typeof e === 'string' ? e : errMsg(e)); }
}
