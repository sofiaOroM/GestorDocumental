# Cliente – Sistema de Gestión Documental (Angular 21)

SPA con componentes standalone, signals y control flow (`@if`, `@for`). Consume la API REST del servidor.

## Puesta en marcha
```bash
npm install
npm start          # http://localhost:4200
```
El servidor debe estar corriendo en `http://localhost:3000` (cambia la URL en `src/app/core/config.ts`).
Usuarios demo (contraseña `Password123!`): `admin@docs.com`, `ana@docs.com`, `luis@docs.com`.

## Estructura
- `core/` – `Api` (todas las llamadas HTTP), `Auth` (sesión con signals), interceptor JWT, guards, modelos, utilidades.
- `dialogs/` – diálogos reutilizables: nombre, mover, compartir, visor/editor con comentarios, historial.
- `pages/` – login, shell (menú), explorador, compartidos, papelera, actividad, reportes, usuarios (admin).
