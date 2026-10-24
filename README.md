# Sistema de Gestión Documental

Plataforma para almacenar, organizar, buscar y compartir archivos `.txt` y `.md` entre usuarios de una organización.

| Componente | Tecnología |
|---|---|
| Cliente (`frontend/`) | Angular 21 |
| Servidor (`backend/servidor/`) | Node.js + Express 5 |
| Base de datos | MongoDB (contenido de los archivos en GridFS) |

## Repositorio

https://github.com/sofiaOroM/GestorDocumental

## Obtener el proyecto

```bash
git clone https://github.com/sofiaOroM/GestorDocumental.git GestorDocumental
cd GestorDocumental

## Ejecución rápida con Docker (recomendada)

**Requisitos:** Docker Desktop en ejecución y los puertos **3000** y **4200** libres.

```bash
docker compose up --build
```

La primera vez tarda varios minutos. Cuando la terminal muestre `Servidor listo en http://localhost:3000/api`, abre **http://localhost:4200**.

La base de datos se inicializa sola con datos de prueba (3 usuarios, 50 archivos, comparticiones, papelera e historial) si está vacía.

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin@docs.com` | `Password123!` | Administrador |
| `ana@docs.com` | `Password123!` | Usuario |
| `luis@docs.com` | `Password123!` | Usuario |

| Acción | Comando |
|---|---|
| Detener (conserva los datos) | `docker compose down` |
| Reiniciar con datos limpios | `docker compose down -v` y luego `docker compose up --build` |
| Ver registros de la API | `docker compose logs -f api` |

## Ejecución sin Docker

**Requisitos:** Node.js 20.19+ (o 22.12+) y MongoDB en `localhost:27017`.

```bash
# Servidor
cd backend/servidor
npm install
cp .env.example .env
npm run seed          # BORRA la base y carga los datos de prueba
npm run dev           # http://localhost:3000/api

# Cliente (otra terminal)
cd frontend
npm install
npm start             # http://localhost:4200
```

## Documentación (`documentacion/`)

| Documento | Contenido |
|-----------|-----------|
| [Manual Técnico](documentacion/) | Instalación, Docker, arquitectura, API, reglas de negocio y solución de problemas |
| [Manual de Usuario](documentacion/) | Guía de uso de la aplicación |
| [Modelo Documental](documentacion/) | Colecciones, embebidos vs. referencias, índices y consultas |
| [Diagramas UML](https://drive.google.com/file/d/1VLQ2YMUoMvirM-gxzB6aIuVvjmrnPccT/view?usp=sharing) | Casos de uso, secuencia y despliegue |