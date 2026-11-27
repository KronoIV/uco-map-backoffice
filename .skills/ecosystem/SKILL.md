---
name: ecosystem
description: Contexto general de UCO MAP (backend Spring Boot + panel admin React + app web AR + VPS propio en Python). Úsala antes de cualquier cambio que cruce repositorios, toque contratos /api o /v1, autenticación, tokens del VPS, variables de entorno, el navmesh o el código copiado entre admin y app.
---

# UCO MAP: contexto del ecosistema (para agentes de IA)

> Skill compartida: idéntica en `.skills/ecosystem/SKILL.md` de los cuatro repos. Detalle humano en `docs/ECOSISTEMA.md`.

## Qué es

Navegación de campus para la Universidad Católica de Oriente. Tiene tres partes:

- Mapa exterior con GPS.
- Guía interior con cámara (AR). La cámara se ubica con el VPS propio (`vps-server`).
- Un panel para administrar los datos.

## Los cuatro repositorios (carpetas hermanas)

| Carpeta | Repo | Stack | Rol |
|---|---|---|---|
| `backend/` | `KronoIV/ms-ucoMap-backend` | Java 21, Spring Boot 3.5.14, MongoDB, JWT (jjwt 0.12.6) | API REST `/api/**`, persistencia, seguridad, tokens del VPS propio, correo |
| `uco-map-admin/` | `KronoIV/uco-map-backoffice` | React 19, Vite 8, TS 6, MUI 7, React Query 5, Axios, Leaflet, MapLibre, three 0.170, recast-navigation 0.43.0 | Panel de administración; **genera y publica el navmesh** |
| `uco-map-app/` | `KronoIV/uco-map-app` | Vite 8, TS 5.6 sin framework, three 0.150.1, WebXR, recast-navigation 0.43.0 | App del estudiante: ruta exterior GPS + guía AR interior; envía telemetría |
| `vps-server/` | git local (sin remoto aún) | Python 3.12 (uv), FastAPI, torch, PoseLib, MongoDB `ucomap_vps` | VPS propio: mapas, builds, publicación y `POST /v1/localize` en el espacio del map set |

## Reglas que no se deben romper

1. **Sobre de respuesta del backend:** `{data, succeeded, message?}`; errores `{error, succeeded:false, details?}`.
   Excepciones: `GET /api/navigation/navmesh` (binario), `GET /api/trips/export` (CSV), `GET /api/sessions/stream`
   (SSE). El admin desenvuelve en `src/services/api.ts`;
   la app con `unwrapApi()` en `src/services/campus-api.ts`.
2. **Autenticación:** solo el admin hace login (`POST /api/auth/login`), guarda el JWT en la cookie `ucomap_token` y
   lo manda como `Authorization: Bearer`. La app no tiene usuarios y solo usa endpoints públicos. Las reglas están en
   `backend/src/main/java/co/edu/uco/ucomap/security/config/SecurityConfig.java`; todo POST/PUT/PATCH/DELETE en
   `/api/**` es ADMIN salvo los públicos listados allí.
3. **Contratos compartidos:** al cambiar un endpoint o DTO revisa `uco-map-admin/src/services` + `src/types` y
   `uco-map-app/src/services`. Prefiere cambios aditivos; MongoDB no tiene migraciones.
4. **Archivos copiados idénticos** (verificar con `npm run check:routing` en el admin):
   admin `src/utils/{campus-routing,campus-osm,poi-catalog,navmesh-input}.ts` ⇄ app
   `src/navigation/{campus-routing,campus-osm,poi-catalog}.ts` y `test/eval/experiment/navmesh-input.ts`.
5. **recast-navigation 0.43.0 exacta en admin y app** (el admin produce el binario que la app consume).
6. **Secretos solo en variables de entorno del servidor que los usa.** Backend: `MONGODB_URI`, `JWT_SECRET`,
   `MAIL_USERNAME`, `MAIL_PASSWORD` y `VPS_TOKEN_SECRET`. VPS:
   `VPS_TOKEN_SECRETS` (mismo par que el backend) y `VPS_URL_SIGNING_SECRET`. Las variables `VITE_*` son públicas.
7. **Nunca** apuntes un entorno local a la base de producción ni hagas pruebas automáticas contra el VPS de
   producción (usa uno local). La app en `npm run dev` usa producción si no se define `BACKEND_URL` en `.env.local`.
8. **El espacio del map set (S) no cambia.** `Room.arPosition`, navmesh, `NavPatch`, `NavConnection`, ascensores,
   `NavBlock`, `ScanEdit` y `scenePins.json` están en S. Las conversiones de pose del VPS propio
   viven solo en `vps-server/src/ucovps/frames.py`.
9. **Tokens del VPS propio:** el backend los firma (`POST /api/vps/token` público → alcance `localize`;
   `POST /api/vps/admin-token` ADMIN → `admin`). Son HS256 con `kid`, `iss=ucomap-backend` y `aud=ucomap-vps`. Los
   clientes llaman directo al VPS (`baseUrl` de la respuesta); el backend nunca le reenvía fotos.

## Mapa rápido de endpoints

- Públicos (app): `GET /api/campus`, `GET /api/settings`, `GET /api/graph/nodes|edges`, `GET /api/events/active`,
  `GET /api/trips/popular`, `GET /api/navigation/navmesh`, `GET /api/navigation/elevators`,
  `POST /api/vps/token`, `POST /api/sessions/ping`, `POST /api/trips`, `POST /api/auth/*`.
- ADMIN (panel): CRUD de `/api/buildings`, `/api/rooms`, `/api/poi-clips`, `/api/graph/*`, `/api/events`,
  `/api/settings`, `/api/users`; `/api/navigation/{connections,patches,elevators,scan-edits,blocks,navmesh}`;
  `POST /api/vps/admin-token`; lectura de `/api/sessions`, `/api/trips`,
  `/api/analytics`.
- VPS propio: `POST /v1/localize` y `GET /v1/map-sets/{id}/status` (token `localize`); `/v1/admin/**` (token
  `admin`). Detalle en `vps-server/.skills/api/SKILL.md`.

## Flujos clave

- **Estudiante:** app carga `/api/campus` + `/api/settings` → elige destino → `POST /api/trips` → ruta exterior
  (Dijkstra en `campus-routing.ts` + GPS) → llegada a la puerta (`transition-engine.ts`) → si el teléfono es
  compatible: navmesh + token VPS (`/api/vps/token`) + localización →
  ruta interior (`RouteFinder`) → llegada → `POST /api/trips` final.
- **Administrador:** login → CRUD → MongoDB. Navmesh: modelos 3D del build publicado del VPS propio
  (`loadEditorMeshes` en `uco-map-admin/src/services/vpsService.ts`)
  → worker recast → `PUT /api/navigation/navmesh` (≤ 5 MB) → la app lo descarga.
- **Mapas del VPS propio:** admin (página VPS) sube escaneos → alinea → revisión → build (worker) → evaluación →
  publica; la app empieza a usar el build publicado sin redeploy.

## Arranque local (orden)

MongoDB (`docker run -d --name ucomap-mongo -p 27017:27017 mongo:7`) → backend (`cp .env.example .env`,
`./mvnw spring-boot:run`, :8080) → admin (`cp .env.example .env.local`, `npm ci`, `npm run dev`, :5173) →
app (`cp .env.example .env.local`, `npm ci`, `npm run dev`, https :5174) → opcional, VPS propio (`vps-server/`:
`uv sync`, `uv run ucovps models download`, `uv run ucovps serve` :8090 + `uv run ucovps worker`, con secretos de
desarrollo que coincidan con `VPS_TOKEN_KID`/`VPS_TOKEN_SECRET` del backend).

## Antes de terminar una tarea

- Backend: `./mvnw test`. Admin: `npm run build` y `npm run check:routing`. App: `npm test`, `npm run typecheck`,
  `npm run build`. VPS: `uv run pytest` y `uv run ruff check src tests`.
- No incluyas valores reales de `.env`, `.env.local` ni `.env.railway` en código, commits o respuestas.
