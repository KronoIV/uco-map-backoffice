---
name: architecture
description: Organización del código del panel admin de UCO MAP (rutas, layouts, providers, estado con React Query, carpetas y convenciones). Úsala para ubicar dónde va un cambio o para agregar una página.
---

# Admin UCO MAP: arquitectura

## Arranque

`index.html` → `src/main.tsx` (importa `theme/uco-brand.css` e `index.css`) → `src/App.tsx`:

```
QueryClientProvider (staleTime 30 s, sin refetch al enfocar)
└─ ThemeProvider (theme/theme.ts) + CssBaseline
   └─ AuthProvider (context/AuthContext.tsx)
      └─ RouterProvider (routes/router.tsx)
```

## Rutas (`src/routes/router.tsx`)

| Ruta | Página | Acceso |
|---|---|---|
| `/login`, `/forgot-password`, `/reset-password` | `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage` | Público |
| `/` | `DashboardPage` (→ `pages/dashboard/AnalyticsDashboard.tsx`) | Protegido |
| `/map` | `MapPage` (pestañas Caminos, Vista usuario, Interior AR → `PoiEditorPage`) | Protegido |
| `/campus` | `CampusPage` (edificios y salones) | Protegido |
| `/events` | `EventsPage` | Protegido |
| `/sessions` | `ActivityPage` (pestañas Dispositivos → `device-sessions/DeviceSessionsPage`, Recorridos → `TripsPage`) | Protegido |
| `/users` | `users/UsersPage` | Protegido |
| `/settings` | `SettingsPage` | Protegido |
| `/help` | `help/HelpPage` (manual del panel; textos en `pages/help/helpContent.ts`, imágenes en `assets/help/`) | Protegido |
| `/nodes`, `/ar-points`, `/trips` | Redirecciones a `/map`, `/map?tab=ar`, `/sessions?tab=trips` | — |
| `*` | `NotFoundPage` | — |

Las protegidas cuelgan de `components/ProtectedRoute.tsx` y se pintan dentro de `layouts/AppLayout.tsx`
(`Sidebar.tsx` + `Navbar.tsx` + `<Outlet/>`). El menú lateral está en el arreglo de `Sidebar.tsx`; las migas de pan en
el `routeMap` de `Navbar.tsx`.

## Carpetas de `src/`

```
pages/         Una página por ruta (algunas en subcarpetas: dashboard/, device-sessions/, users/, help/)
components/    Reutilizables: AuthShell/AuthField (pantallas de acceso), PageHeader, SectionTabs, StatCard,
               ProtectedRoute, MultiSetUsageCard; analytics/ (gráficas propias), device-sessions/, map3d/
               (CampusMap3D con MapLibre), poi-editor/ (visor three.js y editores del interior)
services/      Un módulo por recurso del backend (axios). api.ts = cliente común
hooks/         Hooks de React Query y utilidades (useSettings, useUsers, useDeviceSessions, useMultiSetUsage,
               usePeriod, useCampusOsm)
context/       AuthContext (sesión)
layouts/       AppLayout, Sidebar, Navbar
routes/        router.tsx
types/         Tipos del dominio (index.ts) y de analítica (analytics.ts)
utils/         Lógica sin React: rutas exteriores, OSM, catálogo de POI, navmesh, parches, ediciones, formato
workers/       navmeshWorker.ts (genera el navmesh fuera del hilo principal)
theme/         brand.ts (tokens de marca + paleta de gráficas), theme.ts (tema MUI), uco-brand.css
data/          scenePins.json (pines de la escena AR anterior, usados como «Puntos sugeridos»)
assets/        Logos, fuentes TeX Gyre Heros (licencia GUST), mascota
```

## Patrones

- **Datos del servidor con React Query.** Las páginas llaman `useQuery({ queryKey: ['rooms'], queryFn: roomService.getAll })`
  y `useMutation` con `qc.invalidateQueries({ queryKey: [...] })` o `qc.setQueryData` al terminar. Las claves
  usadas son nombres simples (`['rooms']`, `['nodes']`, `['buildings']`, `['events']`, `['settings']`,
  `['multiset-usage']`...). Reutiliza la misma clave para que la caché se comparta entre páginas.
- **Servicios** = objetos con funciones que devuelven `api.get<T>(...).then(r => r.data)` (el sobre ya viene quitado).
- **Formularios** con React Hook Form (`register`, `Controller` para componentes MUI).
- **UI** con componentes MUI y `sx`; colores de `theme/brand.ts` (verde UCO `#008b50`, `greenStrong` `#007d48` para
  texto/botones pequeños, amarillo `#ffca00` solo como acento).
- Textos de la interfaz y comentarios en **español**; identificadores en inglés.
- Páginas grandes: `MapPage.tsx` (~1 700 líneas), `components/poi-editor/MapViewer.tsx` (~1 100). Haz cambios
  acotados.

## Agregar una página nueva (receta basada en Eventos)

1. Tipos en `src/types/index.ts` (p. ej. `CampusEvent`).
2. Servicio en `src/services/<recurso>Service.ts` siguiendo `eventService.ts`:
   ```ts
   export const eventService = {
     getAll: () => api.get<CampusEvent[]>('/api/events').then(r => r.data),
     create: (data: CampusEventInput) => api.post<CampusEvent>('/api/events', data).then(r => r.data),
     update: (id: string, data: CampusEventInput) =>
       api.put<CampusEvent>(`/api/events/${encodeURIComponent(id)}`, data).then(r => r.data),
     delete: (id: string) => api.delete(`/api/events/${encodeURIComponent(id)}`),
   };
   ```
3. Página en `src/pages/<Nombre>Page.tsx` con `useQuery`/`useMutation` (ver `EventsPage.tsx`) y `PageHeader`.
4. Ruta en `routes/router.tsx` (dentro de los hijos de `AppLayout`), entrada en el menú de `layouts/Sidebar.tsx` y
   miga en `layouts/Navbar.tsx`.
5. Si el backend necesita un endpoint nuevo, créalo primero (ver `.skills/ecosystem`).
6. `npm run build` y `npm run lint` antes de terminar.
