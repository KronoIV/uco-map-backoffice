---
name: ecosystem
description: Contexto general de UCO MAP (backend Spring Boot + panel admin React + app web AR). Úsala antes de cualquier cambio que cruce repositorios, toque contratos /api, autenticación, variables de entorno, el navmesh o el código copiado entre admin y app.
---

# UCO MAP: contexto del ecosistema (para agentes de IA)

> Skill compartida: idéntica en `.skills/ecosystem/SKILL.md` de los tres repos. Detalle humano en `docs/ECOSISTEMA.md`.

## Qué es

Navegación de campus para la Universidad Católica de Oriente: mapa exterior con GPS + guía interior con cámara (AR)
usando el VPS de MultiSet, y un panel para administrar los datos.

## Los tres repositorios (carpetas hermanas)

| Carpeta | Repo | Stack | Rol |
|---|---|---|---|
| `backend/` | `KronoIV/ms-ucoMap-backend` | Java 21, Spring Boot 3.5.14, MongoDB, JWT (jjwt 0.12.6) | API REST `/api/**`, persistencia, seguridad, intermediario de MultiSet, correo |
| `uco-map-admin/` | `KronoIV/uco-map-backoffice` | React 19, Vite 8, TS 6, MUI 7, React Query 5, Axios, Leaflet, MapLibre, three 0.170, recast-navigation 0.43.0 | Panel de administración; **genera y publica el navmesh** |
| `uco-map-app/` | `KronoIV/uco-map-app` | Vite 8, TS 5.6 sin framework, three 0.150.1, WebXR, recast-navigation 0.43.0 | App del estudiante: ruta exterior GPS + guía AR interior; envía telemetría |

## Reglas que no se deben romper

1. **Sobre de respuesta del backend:** `{data, succeeded, message?}`; errores `{error, succeeded:false, details?}`.
   Excepciones: `GET /api/navigation/navmesh` (binario), `POST /api/multiset/token` (`{token, expiresAt, mapSetCode}`),
   `GET /api/trips/export` (CSV), `GET /api/sessions/stream` (SSE). El admin desenvuelve en `src/services/api.ts`;
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
6. **Secretos solo en el backend** como variables de entorno (`MONGODB_URI`, `JWT_SECRET`, `MAIL_USERNAME`,
   `MAIL_PASSWORD`, `MULTISET_CLIENT_ID`, `MULTISET_CLIENT_SECRET`). Las variables `VITE_*` son públicas.
7. **Nunca** apuntar un entorno local a la base de producción ni hacer pruebas automáticas contra MultiSet (cobra por
   llamada). La app en `npm run dev` usa producción si no se define `BACKEND_URL` en `.env.local`.

## Mapa rápido de endpoints

- Públicos (app): `GET /api/campus`, `GET /api/settings`, `GET /api/graph/nodes|edges`, `GET /api/events/active`,
  `GET /api/trips/popular`, `GET /api/navigation/navmesh`, `GET /api/navigation/elevators`,
  `POST /api/multiset/token`, `POST /api/sessions/ping`, `POST /api/trips`, `POST /api/auth/*`.
- ADMIN (panel): CRUD de `/api/buildings`, `/api/rooms`, `/api/poi-clips`, `/api/graph/*`, `/api/events`,
  `/api/settings`, `/api/users`; `/api/navigation/{connections,patches,elevators,scan-edits,blocks,navmesh}`;
  `/api/multiset/{usage,map-meshes}`; lectura de `/api/sessions`, `/api/trips`, `/api/analytics`.

## Flujos clave

- **Estudiante:** app carga `/api/campus` + `/api/settings` → elige destino → `POST /api/trips` → ruta exterior
  (Dijkstra en `campus-routing.ts` + GPS) → llegada a la puerta (`transition-engine.ts`) → si el teléfono es
  compatible: navmesh + token VPS + MultiSet → ruta interior (`RouteFinder`) → llegada → `POST /api/trips` final.
- **Administrador:** login → CRUD → MongoDB. Navmesh: `GET /api/multiset/map-meshes` → GLB de MultiSet → worker
  recast → `PUT /api/navigation/navmesh` (≤ 5 MB) → la app lo descarga.

## Arranque local (orden)

MongoDB (`docker run -d --name ucomap-mongo -p 27017:27017 mongo:7`) → backend (`cp .env.example .env`,
`./mvnw spring-boot:run`, :8080) → admin (`cp .env.example .env.local`, `npm ci`, `npm run dev`, :5173) →
app (`cp .env.example .env.local`, `npm ci`, `npm run dev`, https :5174).

## Antes de terminar una tarea

- Backend: `./mvnw test`. Admin: `npm run build` y `npm run check:routing`. App: `npm test`, `npm run typecheck`,
  `npm run build`.
- No incluyas valores reales de `.env`, `.env.local` ni `.env.railway` en código, commits o respuestas.
