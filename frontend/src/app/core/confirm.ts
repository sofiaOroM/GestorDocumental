import { Injectable, signal } from '@angular/core';

export interface ConfirmOpts {
    titulo: string;
    mensaje: string;
    confirmar?: string;
    cancelar?: string;
    peligro?: boolean; // botón y icono en rojo
    icono?: string;    // nombre de Material Icon
}

// Reemplaza window.confirm(): const ok = await confirm.ask({...});
@Injectable({ providedIn: 'root' })
export class Confirm {
    readonly actual = signal<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);

    ask(opts: ConfirmOpts): Promise<boolean> {
        return new Promise((resolve) => this.actual.set({ ...opts, resolve }));
    }

    responder(valor: boolean) {
        const a = this.actual();
        this.actual.set(null);
        a?.resolve(valor);
    }
}