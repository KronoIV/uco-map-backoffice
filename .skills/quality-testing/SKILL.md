---
name: quality-testing
description: Cómo validar cambios en el panel admin de UCO MAP (build con chequeo de tipos, ESLint y su línea base de errores, verificación de archivos compartidos, pruebas manuales). Úsala antes de cerrar una tarea o al configurar pruebas nuevas.
---

# Admin UCO MAP: calidad y pruebas

## Estado actual (verificado, noviembre de 2026)

| Comando | Resultado |
|---|---|
| `npm run build` | Compila. `tsc -b` sin errores. Advertencia de Vite: chunk principal ~3,3 MB (> 500 kB). |
| `npm run lint` | **5 errores + 1 advertencia previos** (no bloquean el build). |
| `npm run check:routing` | OK: «campus-routing.ts, campus-osm.ts, poi-catalog.ts y navmesh-input.ts: iguales a los de la app». |
| `npm run check:brand` | **Falla**: la app no tiene `src/styles/uco-brand.css` ni `src/assets/img/uco-logo.svg`. |
| Pruebas automáticas | No existen (no hay Vitest/Jest ni archivos `*.test.ts`). |

Línea base de lint (para no confundirla con errores nuevos):

```
src/components/analytics/ChartCard.tsx            react-refresh/only-export-components
src/components/analytics/charts/WeekHourHeatmap.tsx react-refresh/only-export-components
src/context/AuthContext.tsx                       react-hooks/set-state-in-effect, react-refresh/only-export-components
src/pages/MapPage.tsx                             react-hooks/refs
src/pages/ResetPasswordPage.tsx (advertencia)     react-hooks/incompatible-library
```

## Antes de terminar un cambio

```bash
npm run build           # tipos + bundle
npm run lint            # no debe aumentar la línea base
npm run check:routing   # si tocaste utils compartidos
```

`tsconfig.app.json` activa `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` (sin `enum` ni
propiedades de parámetro) y `verbatimModuleSyntax` (importa tipos con `import type`).

## Pruebas manuales recomendadas (contra backend local)

1. Login, cierre de sesión y expiración (borra la cookie `ucomap_token` → debe volver a `/login`).
2. CRUD de la página tocada y su efecto en la app (`GET /api/campus` de la app refleja los cambios).
3. Mapa: crear nodo/arista, Vista usuario calcula ruta.
4. Interior AR (solo si hay credenciales MultiSet en el backend local): cargar mallas, ubicar punto, regenerar
   navmesh y publicar **en local**.
5. Consola del navegador sin errores nuevos.

## Si se agregan pruebas automáticas

Recomendación (no implementada): Vitest + Testing Library, empezando por funciones puras de `src/utils`
(`campus-routing.ts`, `navPatches.ts`, `mapEdits.ts`, `analyticsFormat.ts`) y los servicios con Axios simulado.
Ten en cuenta que `campus-routing.ts` y `poi-catalog.ts` deben seguir idénticos a los de la app (la app usa
`node --test` en `uco-map-app/test/`, que hoy no cubre esos dos archivos).
