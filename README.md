# UCO MAP — Panel de administración (admin)

Panel web del equipo de **UCO MAP**, el sistema de navegación del campus de la Universidad Católica de Oriente. Desde
aquí se mantienen los datos que usa la app de los estudiantes: edificios, salones, caminos, puntos AR, navmesh
interior, eventos, usuarios y parámetros, y se consulta la analítica de uso.

> ¿Primera vez en el proyecto? Lee [docs/ECOSISTEMA.md](docs/ECOSISTEMA.md) y
> [docs/GUIA-ESTUDIANTES.md](docs/GUIA-ESTUDIANTES.md). Si usas un asistente de IA, apúntalo a [AGENTS.md](AGENTS.md).

## 1. Objetivo y responsabilidad

| Sección (menú) | Ruta | Qué permite |
|---|---|---|
| Dashboard | `/` | Indicadores de uso por periodo y plataforma (`/api/analytics`) |
| Mapa | `/map` | Editar el grafo exterior (nodos, puertas, POI, caminos), previsualizar rutas y, en «Interior AR», ubicar puntos AR y generar/publicar el navmesh |
| Campus | `/campus` | Edificios y salones |
| Eventos | `/events` | Eventos que la app anuncia en su inicio |
| Actividad | `/sessions` | Dispositivos (en vivo por SSE) y recorridos (con exportación CSV) |
| Usuarios | `/users` | Administradores del panel |
| Configuración | `/settings` | Parámetros de la app (p. ej. activar la guía AR) y cuota de MultiSet |
| Ayuda | `/help` | Manual de uso del panel (contenido en `src/pages/help/helpContent.ts`, capturas en `src/assets/help/`) |

También incluye login, «olvidé mi contraseña» y restablecer contraseña. No lo usan los estudiantes.

## 2. Tecnologías

| Herramienta | Versión (`package.json`) |
|---|---|
| React / React DOM | 19.2 |
| React Router | 7 |
| MUI (Material UI) + X Data Grid | 7 / 8 |
| TanStack React Query | 5 |
| Axios | 1 |
| React Hook Form | 7 |
| Leaflet + react-leaflet | 1.9 / 5 (mapa 2D) |
| MapLibre GL | 5 (mapa 3D) |
| three.js | 0.170 (visor 3D de los escaneos) |
| recast-navigation | **0.43.0 exacta** (generación del navmesh; debe coincidir con la app) |
| TypeScript | ~6.0 |
| Vite | 8 |
| ESLint | 10 (typescript-eslint, react-hooks, react-refresh) |

## 3. Requisitos previos

- **Node.js 22** (verificado con 22.22.2) y **npm 10**. Vite 8 exige Node 20.19+ o 22.12+.
- **Backend** de UCO MAP corriendo (local recomendado: ver README del backend).
- Git. Navegador moderno (Chrome/Edge/Firefox) con WebGL para el visor 3D.

## 4. Clonar y configurar

```bash
git clone https://github.com/KronoIV/uco-map-backoffice.git uco-map-admin
cd uco-map-admin
cp .env.example .env.local
```

Clona también `uco-map-app` como carpeta hermana (`../uco-map-app`) si vas a usar `check:routing` / `check:brand`.

## 5. Instalar dependencias

```bash
npm ci        # usa exactamente package-lock.json
```

## 6. Variables de entorno

| Variable | Obligatoria | Para qué | Valor |
|---|---|---|---|
| `VITE_BACKEND_URL` | **Sí** | URL base del backend, sin `/` final | Local: `http://localhost:8080`. Producción: URL pública del backend (la configura el responsable en el hosting). |

- Va en `.env.local` (o `.env`); ambos están en `.gitignore`. Plantilla: `.env.example`.
- Es **pública**: Vite la copia dentro del JavaScript. No pongas secretos en variables `VITE_*`.
- Vite lee el archivo al arrancar: si lo cambias, reinicia `npm run dev`. Para el build se toma en el momento de
  compilar (en el hosting debe estar definida como variable de entorno del build).

## 7. Ejecutar en desarrollo

```bash
npm run dev      # http://localhost:5173
```

Entra con un usuario administrador del backend al que apuntas. Con el backend local recién creado:
`admin@admin.com` y la contraseña definida en `backend/src/main/java/co/edu/uco/ucomap/service/AdminInitializer.java`.

> No apuntes el admin local a producción para probar: cada guardado escribe en la base real y «Publicar» el navmesh
> lo cambia para todos los teléfonos.

## 8. Build

```bash
npm run build    # tsc -b (tipos) + vite build → dist/
npm run preview  # sirve dist/ en http://localhost:4173
```

`dist/` es estático. El hosting debe redirigir todas las rutas a `index.html` (ya incluido para Netlify en
`public/_redirects`). Producción actual: Netlify **(por confirmar con el responsable)**.

## 9. Pruebas y verificación

No hay pruebas automáticas. Antes de entregar un cambio:

```bash
npm run build           # debe compilar sin errores de tipos
npm run lint            # hoy hay 5 errores y 1 advertencia previos; no agregues nuevos
npm run check:routing   # archivos copiados con ../uco-map-app deben ser idénticos
```

`npm run check:brand` falla hoy porque la app no tiene `uco-brand.css` ni `uco-logo.svg` (limitación conocida).
Detalle en [.skills/quality-testing/SKILL.md](.skills/quality-testing/SKILL.md).

## 10. Estructura de carpetas

```
uco-map-admin/
├── index.html               Entrada HTML (monta src/main.tsx)
├── public/                  _redirects (SPA en Netlify), decodificadores Draco, favicons
├── src/
│   ├── main.tsx, App.tsx    Arranque y providers (React Query, tema MUI, Auth, Router)
│   ├── routes/router.tsx    Rutas públicas y protegidas
│   ├── layouts/             AppLayout, Sidebar (menú), Navbar (migas)
│   ├── pages/               Una página por sección
│   ├── components/          Componentes reutilizables; poi-editor/ (interior AR) y map3d/ (MapLibre)
│   ├── services/            Cliente Axios (api.ts) y un servicio por recurso del backend
│   ├── hooks/               Hooks de React Query y utilidades
│   ├── context/             AuthContext (sesión)
│   ├── types/               Tipos del dominio (espejo del JSON del backend)
│   ├── utils/               Rutas, OSM, catálogo POI, navmesh, parches (algunos copiados de la app)
│   ├── workers/             navmeshWorker.ts (recast en segundo plano)
│   ├── theme/               Marca UCO (brand.ts, theme.ts, uco-brand.css)
│   ├── data/                scenePins.json (puntos AR sugeridos)
│   └── assets/              Logos y fuentes
├── docs/                    ECOSISTEMA.md y GUIA-ESTUDIANTES.md (compartidos con backend y app)
├── .skills/                 Contexto para asistentes de IA
└── .env.example             Plantilla de variables
```

## 11. Conexión con Backend y App

- **Backend:** todas las llamadas pasan por `src/services/api.ts` (Axios con `VITE_BACKEND_URL`), que agrega el JWT
  de la cookie `ucomap_token` y quita el sobre `{data, succeeded}` de las respuestas. Endpoints por servicio en
  [.skills/api-integration/SKILL.md](.skills/api-integration/SKILL.md).
- **App:** no hay llamadas directas. El admin escribe los datos que la app lee del backend (`/api/campus`,
  `/api/settings`, `/api/events/active`, `/api/navigation/navmesh`...). Comparte con la app copias idénticas de
  `utils/campus-routing.ts`, `campus-osm.ts`, `poi-catalog.ts` y `navmesh-input.ts`, y la versión de
  `recast-navigation`.
- **Servicios externos desde el navegador:** OpenStreetMap (Overpass / API 0.6), OpenFreeMap, ArcGIS World Imagery,
  unpkg (iconos de Leaflet) y las URLs de mallas 3D de MultiSet que entrega el backend.

## 12. Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| Las peticiones van a `http://localhost:5173/api/...` (el propio admin) y fallan o devuelven HTML | Falta `VITE_BACKEND_URL`. Crea `.env.local` y reinicia `npm run dev`. |
| `Network Error` / CORS en consola | El backend no está corriendo o la URL está mal (sin `/` final, puerto correcto). |
| Vuelve a `/login` constantemente | Token vencido (24 h), 401 del backend o cookie bloqueada. Revisa la pestaña Red. |
| «Credenciales inválidas» en local | Base nueva: usa el usuario sembrado del backend; base copiada: usa un usuario de esa base. |
| Interior AR no carga mallas | El backend local no tiene credenciales MultiSet (`/api/multiset/map-meshes` falla). Normal sin ellas. |
| `npm run check:routing` dice «differ» | Un archivo compartido cambió en un solo repo: copia la versión correcta al otro. |
| `npm ci` falla por versión de Node | Usa Node 22 (`node -v`). |
| Advertencia «Some chunks are larger than 500 kB» | Esperada (bundle ~3,3 MB); no impide el build. |

