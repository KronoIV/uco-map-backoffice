# Guía de transferencia para el nuevo equipo de UCO MAP

> Documento compartido: existe **idéntico** en `docs/GUIA-ESTUDIANTES.md` de los cuatro repositorios.
> Léelo después de `docs/ECOSISTEMA.md`.

## 1. Por dónde empezar

| Paso | Qué hacer | Resultado esperado |
|---|---|---|
| 1 | Leer `docs/ECOSISTEMA.md` (arquitectura, flujos, contratos). | Saber qué hace cada repo y cómo se hablan. |
| 2 | Solicitar los accesos de la sección 8. | Poder clonar, desplegar y consultar servicios. |
| 3 | Clonar los repos como carpetas hermanas (`backend/`, `uco-map-admin/`, `uco-map-app/` y `vps-server/`). | Los scripts de verificación del admin encuentran la app. |
| 4 | Levantar el **backend** en local con MongoDB en Docker (README del backend). | `GET http://localhost:8080/api/campus` responde 200. |
| 5 | Levantar el **admin** contra ese backend e iniciar sesión con el usuario sembrado. | Ver el dashboard, el mapa y el campus de ejemplo. |
| 6 | Levantar la **app** con `BACKEND_URL=http://localhost:8080`. | Ver la lista de lugares y el mapa exterior. |
| 7 | Correr las pruebas de cada repo (`./mvnw test`, `npm test`, `npm run build`, `uv run pytest`). | Todo en verde antes de tocar código. |
| 8 | Leer las Skills (`.skills/`) del módulo en el que vayas a trabajar. | Conocer convenciones y trampas antes de editar. |

## 2. Qué módulo entender primero

1. **Backend.** Define el modelo de datos (`model/`), los contratos (`controller/`, `dto/`) y la seguridad. Todo lo
   demás depende de él. Empieza por `SecurityConfig.java`, `CampusController` → `CampusService` (lo que consume la
   app) y un CRUD pequeño como `CampusEventController`.
2. **Admin.** Es el que crea los datos que ve la app. Empieza por `src/routes/router.tsx`, `src/services/api.ts` y
   una página simple (`src/pages/EventsPage.tsx`). Deja para después `MapPage.tsx` y `components/poi-editor/`.
3. **App.** Es la más compleja (GPS, AR, sensores). Empieza por `src/main.ts` (flujo de pantallas),
   `src/services/campus-api.ts` y `src/navigation/outdoor-map.ts`. El motor AR (`src/ar-engine/`,
   `src/navigation/ar-navigation.ts`) es lo último: lee antes `docs/ar-navigation-report.md` y
   `docs/ar-device-capability.md` de la app.
4. **VPS propio** (`vps-server/`, Python). Solo si vas a trabajar en la localización o en los mapas: empieza por su
   `README.md`, `DESIGN.md` y `src/ucovps/frames.py` (conversiones de coordenadas).

## 3. Funcionalidades que deben revisar

| Funcionalidad | Backend | Admin | App |
|---|---|---|---|
| Datos del campus (edificios, salones, POI) | `BuildingService`, `RoomService`, `CampusService` | `CampusPage.tsx` | `services/campus-api.ts`, `main.ts` |
| Grafo exterior y rutas | `GraphService`, `BuildingNodeSync` | `MapPage.tsx` (pestañas Caminos / Vista usuario) | `navigation/outdoor-map.ts`, `campus-routing.ts` |
| Puntos AR de salones (`Room.arPosition`) | `RoomController` (PATCH) | `PoiEditorPage.tsx` (pestaña Lugares) | `navigation/ar-destinations.ts` |
| Navmesh interior | `NavigationService`, `MapEditService` | `PoiEditorPage.tsx` (Navegación / Corregir), `utils/navmesh-builder.ts`, `workers/navmeshWorker.ts` | `ar-engine/RouteFinder.ts`, `assets/navmesh/generated.navmesh` |
| VPS propio | `UcoVpsController`, `UcoVpsService` (tokens) | `pages/vps/`, `services/vpsService.ts`, `MapViewer.tsx` | `ar-engine/UcoVpsProvider.ts`, `vps-budget.ts` |
| Transición exterior → interior | `TransitionStats` (modelo) | | `navigation/transition-engine.ts`, `environment-detector.ts` |
| Compatibilidad AR del teléfono | `AppSetting` `arOnLimitedDevices` | Configuración | `services/ar-device-rules.ts`, `ar-capability.ts`, `ar-boot.ts` |
| Eventos del campus | `CampusEventService` | `EventsPage.tsx` | `services/campus-events.ts`, `ui/campus-events.ts` |
| Telemetría y analítica | `DeviceSessionService`, `NavigationTripService`, `AnalyticsService` | `DashboardPage`, `ActivityPage` | `services/session-tracker.ts`, `trip-tracker.ts` |
| Usuarios y contraseña | `UserService`, `PasswordResetService`, `EmailService` | `UsersPage`, `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage` | |

## 4. Puntos de entrada del código

| Módulo | Arranque | Primer archivo a leer |
|---|---|---|
| Backend | `src/main/java/co/edu/uco/ucomap/BackendApplication.java` (+ `AdminInitializer`, `DataInitializerService`, `AppSettingInitializer`, `BuildingNodeSync`, `MongoIndexInitializer` al iniciar) | `security/config/SecurityConfig.java` |
| Admin | `index.html` → `src/main.tsx` → `src/App.tsx` (providers) → `src/routes/router.tsx` | `src/services/api.ts` |
| App | `index.html` → `src/main.ts`; página de diagnóstico `ar-diagnostics.html` → `src/diagnostics/main.ts` | `src/config.ts` y `src/services/campus-api.ts` |

Para rastrear una funcionalidad: busca la ruta (`/api/...`) en los tres repos. En el backend lleva al controlador;
en el admin, al servicio de `src/services/`; en la app, a `src/services/` o `src/navigation/`.

## 5. Cómo hacer cambios sin romper otros módulos

1. **Contratos de API:** agrega campos o endpoints nuevos en vez de renombrar o quitar. Si cambias una forma de
   respuesta, actualiza a la vez `uco-map-admin/src/types` y los tipos de `uco-map-app/src/services`.
2. **Seguridad:** al crear un endpoint nuevo, decide si es público y agrégalo **antes** de las reglas generales de
   `SecurityConfig` (el orden importa). Por defecto todo `POST/PUT/PATCH/DELETE /api/**` es solo ADMIN.
3. **Base de datos:** no hay migraciones. Campos nuevos deben tolerar documentos viejos sin ese campo (`null`).
4. **Código copiado entre admin y app:** si editas `campus-routing.ts`, `campus-osm.ts`, `poi-catalog.ts` o
   `navmesh-input.ts`, copia el archivo al otro repo y corre `npm run check:routing` en el admin.
5. **recast-navigation:** no actualices la versión en un solo repo; el navmesh binario debe ser compatible.
6. **Variables `VITE_*`:** son públicas. Los secretos van solo en el backend.
7. **Ramas y PR:** trabaja en ramas y abre Pull Request contra `main`. El backend se construye con
   `./mvnw package`, que corre las pruebas: una prueba rota bloquea el build de Docker.

## 6. Cómo probar los cambios en local

| Módulo | Comandos | Notas |
|---|---|---|
| Backend | `./mvnw test` | 185 pruebas, no necesitan MongoDB (usan mocks y `src/test/resources/application.properties`). |
| Admin | `npm run build` (incluye `tsc -b`), `npm run lint`, `npm run check:routing` | No hay pruebas automáticas. `lint` ya tiene 5 errores previos (ver sección 9). |
| App | `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e` | `npm test` bloquea la red. `test:e2e` necesita Google Chrome instalado. |
| VPS propio | `uv run pytest`, `uv run ruff check src tests` | 105 pruebas rápidas sin GPU, modelos ni MongoDB real (mongomock). Las marcadas `slow` y `data` necesitan los modelos y los mapas del campus. |
| Integración | Backend local + admin + app apuntando a `http://localhost:8080` | Crea datos en el admin y verifica que aparecen en la app. |

La guía con cámara (AR) **solo se valida en un teléfono real** sobre HTTPS y dentro del edificio escaneado. Usa
`?arDevice=report` para ver el veredicto de compatibilidad y `ar-diagnostics.html` para el motor AR
(`ar-diagnostics.html` y cualquier navegación con cámara consultan el VPS propio).

## 7. Aspectos que exigen especial cuidado

- **Producción compartida:** no conectes nada local a la base de producción; no uses el backend de producción desde
  `npm run dev` de la app (envía telemetría real).
- **VPS de producción:** cada localización usa CPU o GPU del servidor. No hagas bucles ni pruebas automáticas contra
  él; para probar, levanta un VPS local (`local-dev.sh vps`).
- **Publicar el navmesh** (admin › Mapa › Interior AR) reemplaza el que usan todos los teléfonos de inmediato.
- **Publicar un build del VPS propio** (admin › VPS propio) cambia la localización de todos los teléfonos. Revisa la
  evaluación del build antes; si algo falla, usa «Rollback».
- **`app.data.init-on-startup=true`** está activo también en producción: al arrancar, si falta el usuario
  `admin@admin.com`, el backend lo vuelve a crear con la contraseña fija de `AdminInitializer.java`.
- **Coordenadas AR:** `arPosition` está en el espacio del map set del VPS propio. Si se re-escanea o cambia el map set,
  todos los puntos AR y el navmesh deben rehacerse.
- **Archivos grandes:** `src/main.ts` de la app (~3 300 líneas) y `MapPage.tsx` del admin (~1 700) concentran mucha
  lógica; haz cambios pequeños y prueba a mano el flujo completo.

## 8. Información y accesos que deben solicitar al responsable

- [ ] Acceso de escritura a los repos de GitHub `KronoIV/ms-ucoMap-backend`, `KronoIV/uco-map-backoffice` y `KronoIV/uco-map-app`.
- [ ] Acceso al proyecto de **Railway** (backend) y confirmación de cómo se despliega (Dockerfile, rama, auto-deploy).
- [ ] Acceso al hosting del **admin** (Netlify, por confirmar) y de la **app** (por confirmar), con sus variables de entorno.
- [ ] Usuario de **MongoDB Atlas** (idealmente de solo lectura) y un volcado de datos para desarrollo.
- [ ] **VPS propio:** repositorio de `vps-server` (hoy sin remoto), servidor donde corre (x86_64; GPU para procesar
      builds), secretos `VPS_TOKEN_SECRET`/`VPS_TOKEN_SECRETS` y `VPS_URL_SIGNING_SECRET`, y su base `ucomap_vps`.
- [ ] Cuenta **Gmail** del proyecto o una nueva contraseña de aplicación para `MAIL_USERNAME/MAIL_PASSWORD`.
- [ ] Usuario administrador del panel en producción (no el sembrado por defecto).
- [ ] Los escaneos 3D originales y cualquier material de campo (grabaciones `?arRecord=1`, trazas GPS).
- [ ] Teléfonos de prueba: al menos un Android con ARCore/WebXR y un iPhone con iOS 16 o superior.

## 9. Pendientes, limitaciones conocidas y recomendaciones

### 9.1 Seguridad (prioridad alta)

1. **Secretos expuestos en el historial público del backend.** Hasta noviembre de 2026 `application.properties`
   tenía la URI de MongoDB con usuario y contraseña, el secreto JWT, la contraseña de Gmail y las credenciales del
   servicio VPS externo que se usaba antes. Ya se reemplazaron por variables de entorno, pero **siguen en el historial de
   Git** de un repositorio público. Hay que **rotarlos** (usuario de Atlas, contraseña de aplicación de Gmail,
   `JWT_SECRET`), **revocar** las credenciales del VPS externo (ya no se usan) y, si se decide, limpiar el historial.
2. **Contraseña fija del administrador sembrado** en `AdminInitializer.java`. Recomendado: leerla de una variable de
   entorno o desactivar la siembra en producción, y verificar que en producción ese usuario no conserve esa contraseña.
3. **CORS abierto** (`app.cors.allowed-origins=*`). Recomendado: limitarlo a los dominios del admin y de la app.
4. **JWT en cookie legible por JavaScript** (`ucomap_token`, `SameSite=Strict`). Un XSS en el admin podría leerlo.
5. **Rate limit en memoria** (`RateLimitFilter`): vale por instancia; con varias réplicas no se comparte.

### 9.2 Configuración y despliegue

1. El despliegue de producción **debe tener definidas** `MONGODB_URI`, `JWT_SECRET`, `MAIL_USERNAME` y `MAIL_PASSWORD`;
   sin ellas el backend no arranca (ver README del backend). Para la guía con cámara hacen falta además
   `VPS_BASE_URL` y `VPS_TOKEN_SECRET`: sin ellas `/api/vps/*` responde 503.
2. `server.port` está fijo en `8080` y `app.data.init-on-startup` en `true`. El `Dockerfile` define `PORT`,
   `INIT_DATA` y `CORS_ORIGINS`, y `docker-compose.yml` lista otras (`JWT_EXPIRATION_MS`, `MAIL_HOST`,
   `FRONTEND_URL`, `PASSWORD_RESET_*`…) que **`application.properties` no lee**.
3. App: `src/config.ts` tiene como respaldo la URL antigua de Render; el README anterior citaba un `netlify.toml`
   inexistente. Confirmar dónde y cómo se publica la app.
4. App: el mapa exterior carga MapLibre GL desde `unpkg.com/maplibre-gl@5` en tiempo de ejecución (no está en
   `package.json`); si el CDN falla, no hay mapa.

### 9.3 Calidad y pruebas

1. **Admin sin pruebas automáticas**; `npm run lint` reporta 5 errores y 1 advertencia previos
   (`react-refresh/only-export-components` en `ChartCard.tsx`, `WeekHourHeatmap.tsx` y `AuthContext.tsx`;
   `react-hooks/set-state-in-effect` en `AuthContext.tsx`; `react-hooks/refs` en `MapPage.tsx`; advertencia en
   `ResetPasswordPage.tsx`). No impiden el build. El bundle principal pesa ~3,3 MB.
2. **`npm run check:brand` falla**: la app no tiene `src/styles/uco-brand.css` ni `src/assets/img/uco-logo.svg`.
3. **Sin documentación OpenAPI/Swagger** del backend: la referencia de endpoints está en el README del backend.
4. App: `src/main.ts` tiene un `TODO: Implementar carga dinámica de modelos 3D`.

### 9.4 Funcionalidad pendiente (según `uco-map-app/docs/ar-navigation-report.md`)

1. **Validación de campo de la guía AR** en Android e iPhone (precisión real, escaleras, ascensores, alias del VPS).
   Varias secciones del informe terminan en «Pendiente en campo».
2. Experimento real del ajuste de detalle del navmesh con la geometría exportada.
3. Salones sin punto AR (`arPosition`): se guían solo hasta el edificio.
4. VPS propio (`vps-server`): 90 % de aciertos a 0,5 m en la evaluación del build actual, pero falta validarlo en
   campo con teléfonos y desplegarlo en un servidor de producción. Hasta entonces la guía con cámara no funciona en
   producción.

### 9.5 Recomendaciones para continuar

- Agregar pruebas al admin (por ejemplo, Vitest + Testing Library) empezando por `services/` y `utils/`.
- Publicar la especificación OpenAPI del backend (springdoc) para no depender de este documento.
- Separar `main.ts` de la app y `MapPage.tsx` del admin en módulos más pequeños, con pruebas antes de moverlos.
- Configurar CI (GitHub Actions) que corra `./mvnw test`, `npm test`, `npm run typecheck`, `npm run build` y
  `npm run check:routing`.
