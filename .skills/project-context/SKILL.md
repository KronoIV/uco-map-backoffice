---
name: project-context
description: Contexto del panel de administración de UCO MAP (React 19 + Vite 8 + MUI 7). Úsala al empezar cualquier tarea en este repo para saber qué hace, cómo se ejecuta, cómo se configura y qué no tocar.
---

# Admin UCO MAP: contexto del proyecto

## Propósito

Panel web para el equipo que mantiene UCO MAP. Permite:

- Gestionar **edificios y salones** (Campus), **eventos** del campus, **usuarios** administradores y **parámetros**
  de la app (Configuración, incluida la cuota de MultiSet).
- Editar el **grafo exterior** (nodos, puertas, puntos de interés, caminos) sobre un mapa 2D/3D y previsualizar rutas
  como las ve el estudiante (pestañas Caminos / Vista usuario de `/map`).
- Ubicar **puntos AR** de salones y generar/publicar el **navmesh** interior sobre las mallas 3D de MultiSet
  (pestaña Interior AR de `/map`).
- Consultar **analítica** (Dashboard) y **actividad** (dispositivos y recorridos, con exportación CSV).

No lo usan los estudiantes. Depende por completo del backend (`backend/`).

## Stack verificado (`package.json`, versión 1.2.5)

React 19.2, React Router 7, MUI 7 (+ X Data Grid 8), Emotion, TanStack React Query 5, Axios 1, React Hook Form 7,
Leaflet 1.9 + react-leaflet 5 (mapa 2D), MapLibre GL 5 (mapa 3D), three 0.170 (visor 3D), recast-navigation **0.43.0
exacta** (navmesh), TypeScript ~6.0, Vite 8, ESLint 10 (typescript-eslint, react-hooks, react-refresh).

## Comandos

```bash
npm ci               # instala exactamente package-lock.json
npm run dev          # Vite en http://localhost:5173
npm run build        # tsc -b (chequeo de tipos) + vite build → dist/
npm run preview      # sirve dist/
npm run lint         # ESLint (hoy: 5 errores y 1 advertencia previos)
npm run check:routing  # cmp de archivos copiados con ../uco-map-app (debe decir "iguales")
npm run check:brand    # cmp de marca con ../uco-map-app (hoy falla: faltan en la app)
```

No hay script de pruebas automáticas.

## Configuración

- Única variable: `VITE_BACKEND_URL` (URL del backend, sin `/` final). Va en `.env.local` (copiar `.env.example`).
  `.env` y `*.local` están en `.gitignore`. Es pública: queda dentro del JavaScript compilado.
- `vite.config.ts` solo registra el plugin de React (puerto por defecto 5173, sin proxy).
- `public/_redirects` (`/* /index.html 200`) hace que el hosting (Netlify) sirva la SPA en cualquier ruta.
- `public/draco/` contiene los decodificadores Draco para las mallas GLB comprimidas de MultiSet.

## Usuario para entrar en local

Con el backend local recién sembrado: `admin@admin.com` y la contraseña definida en
`backend/src/main/java/co/edu/uco/ucomap/service/AdminInitializer.java`.

## No hacer

- No poner secretos en variables `VITE_*`.
- No apuntar el admin local a producción para «probar»: cualquier guardado escribe en la base real y publicar el
  navmesh afecta a todos los teléfonos.
- No actualizar `recast-navigation` sin hacerlo también en `uco-map-app`.
- No editar `src/utils/{campus-routing,campus-osm,poi-catalog,navmesh-input}.ts` sin copiar el cambio a la app y
  correr `npm run check:routing`.

## Más contexto

`.skills/architecture`, `api-integration`, `map-editors`, `auth-security`, `quality-testing`, `ecosystem`;
`README.md`; `docs/ECOSISTEMA.md`; `docs/GUIA-ESTUDIANTES.md`.
