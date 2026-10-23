# Servidor – Sistema de Gestión Documental

Node.js + Express 5 + MongoDB (driver nativo, GridFS para el contenido de los archivos).

## Puesta en marcha
```bash
npm install
cp .env.example .env      # ajusta MONGO_URI si es necesario
npm run seed              # BORRA la BD y carga datos de demostración
npm run dev               # http://localhost:3000/api
```
Usuarios de prueba (contraseña `Password123!`): `admin@docs.com`, `ana@docs.com`, `luis@docs.com`.

## Endpoints (todos bajo `/api`, salvo login requieren `Authorization: Bearer <token>`)
| Módulo | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` |
| Usuarios | `GET /users/directory`; admin: `GET/POST /users`, `PATCH /users/:id` |
| Carpetas | `GET /folders`, `GET /folders/contents?parentId=`, `POST /folders`, `GET/PATCH/DELETE /folders/:id`, `PATCH /folders/:id/move` |
| Archivos | `GET /files?q=&extension=&desde=&hasta=&sort=&order=&page=`, `POST /files` (multipart `archivo`, `folderId`), `GET /files/:id`, `GET /files/:id/download[?inline=1]`, `PUT /files/:id/content`, `PATCH /files/:id`, `PATCH /files/:id/move`, `DELETE /files/:id`, `GET/POST /files/:id/comments` |
| Compartir | `POST /shares`, `GET /shares/sent`, `GET /shares/received`, `GET /shares/resource/:tipo/:id`, `PATCH/DELETE /shares/:id` |
| Papelera | `GET /trash`, `POST /trash/:tipo/:id/restore`, `DELETE /trash/:tipo/:id`, `DELETE /trash` |
| Actividad | `GET /activity`, `GET /activity/resource/:tipo/:id` |
| Reportes | `/reports/archivos-por-tipo`, `archivos-por-fecha`, `archivos-mas-operaciones`, `usuarios-top-archivos`*, `usuarios-mas-compartidos`*, `archivos-mas-compartidos`, `compartidos-por`, `recibidos-por`, `actividad-usuario`, `operaciones-por-tipo`, `operaciones-por-periodo`, `principales-acciones` |

\* solo administrador. `:tipo` = `file` | `folder`.
