---
name: api-integration
description: Cómo el panel admin de UCO MAP se comunica con el backend (cliente Axios, sobre de respuesta, errores, 401, servicios por recurso y endpoints usados). Úsala al consumir un endpoint nuevo, depurar errores HTTP o cambiar tipos compartidos.
---

# Admin UCO MAP: integración con el backend

## Cliente común (`src/services/api.ts`)

```ts
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});
```

- **Petición:** lee la cookie `ucomap_token` y agrega `Authorization: Bearer <token>`.
- **Respuesta correcta:** si el cuerpo es `{ data, succeeded: true }`, reemplaza `response.data` por `data`
  (los servicios reciben la entidad directamente).
- **Error:** copia `error.response.data.error` en `error.apiErrorCode` y `details` en `error.apiErrorDetails`.
  `resolveApiError(err)` devuelve ese texto (ya en español, viene de `ErrorCode` del backend) o
  «Ocurrió un error. Intenta de nuevo.». Úsalo para mostrar mensajes en la UI.
- **401:** llama al manejador registrado por `AuthContext` (`registerOn401Handler`) que cierra la sesión.
- Sin `VITE_BACKEND_URL` las peticiones salen relativas al propio admin (`/api/...` en su mismo dominio) y fallan.

## Servicios por recurso (`src/services/`)

| Servicio | Endpoints del backend |
|---|---|
| `authService.ts` | `POST /api/auth/login`, `/forgot-password`, `/reset-password`; guarda/lee/borra la cookie `ucomap_token` y decodifica el JWT (sin verificar firma, solo para leer `sub`, `role`, `exp`) |
| `buildingService.ts` | `/api/buildings` (CRUD), `/api/poi-clips` |
| `roomService.ts` | `/api/rooms` (CRUD; `PATCH /api/rooms/{id}` para `arPosition`) |
| `graphService.ts` | `/api/graph/nodes`, `/api/graph/edges` (CRUD) |
| `eventService.ts` | `/api/events` (CRUD) |
| `settingsService.ts` | `/api/settings` (CRUD por `key`) |
| `userService.ts` | `/api/users` (CRUD) |
| `navigationService.ts` | `/api/navigation/{connections,patches,elevators}`, `GET/PUT /api/navigation/navmesh` (binario), `/navmesh/info` |
| `mapEditService.ts` | `/api/navigation/scan-edits`, `/api/navigation/blocks` |
| `vpsService.ts` | `POST /api/vps/admin-token` (token de alcance `admin`, 30 min, cacheado) y luego **directo al VPS propio** (`baseUrl` de la respuesta): `/v1/admin/**` (map sets, mapas, escaneos, subidas por partes, alineación, revisiones, builds, publicación, trabajos, registros) y `POST /v1/localize`. Errores como `VpsApiError` (503 del backend → `not_configured`). `loadEditorMeshes()` da las mallas del editor desde el build publicado |
| `deviceSessionService.ts` | `/api/sessions` (paginado), `/api/sessions/stats` |
| `tripService.ts` | `/api/trips` (paginado), `/api/trips/summary`, `/api/trips/export` (CSV) |
| `analyticsService.ts` | `/api/analytics`, `/api/analytics/trips` |

`hooks/useDeviceSessions.ts` abre además el stream SSE `GET /api/sessions/stream` con `fetch` (no `EventSource`)
para poder enviar la cabecera `Authorization`.

## Tipos

`src/types/index.ts` replica la forma JSON del backend (`Building`, `Room`, `GraphNode`, `GraphEdge`, `CampusEvent`,
`AppSetting`, `NavConnection`, `NavPatch`, `MapMesh`, `PageResponse<T>`...); `src/types/analytics.ts` la de
`/api/analytics` y `src/types/vps.ts` la del VPS propio (`/v1/**`). **Si el backend cambia un DTO, actualiza estos tipos** (TypeScript no lo detecta solo: el contrato
no se genera automáticamente).

## Cómo consumir un endpoint nuevo

1. Confirma la ruta, el método, el acceso y la forma del `data` en el controlador del backend (o en
   `backend/.skills/api-development/SKILL.md`).
2. Agrega el tipo en `src/types` y la función en el servicio del recurso (`.then(r => r.data)`).
3. Úsalo desde un hook o página con React Query; invalida las claves afectadas en `onSuccess`.
4. Muestra errores con `resolveApiError(error)`.
5. Para binarios usa `responseType: 'arraybuffer'` y cabecera `application/octet-stream` como en
   `navigationService.ts`; para operaciones lentas sube el `timeout` de esa llamada (lo hacen `saveNavMesh` y
   `getMapMeshes`).

## Errores comunes

- Olvidar `encodeURIComponent` en ids de la ruta (los ids de salones y nodos pueden tener espacios, p. ej. `CO 101`).
- Esperar `{data, succeeded}` en el servicio: ya llega desenvuelto.
- Probar contra producción con el admin local: guarda de verdad.
