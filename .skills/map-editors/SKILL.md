---
name: map-editors
description: Editores de mapa del admin UCO MAP — grafo exterior (MapPage con Leaflet/MapLibre, OSM, vista usuario) e interior AR (PoiEditorPage con three.js, puntos AR, generación y publicación del navmesh con recast, parches, conexiones, ascensores, correcciones del escaneo). Úsala antes de tocar MapPage, components/poi-editor, utils de navmesh/rutas o workers.
---

# Admin UCO MAP: editores de mapa y navmesh

Es la parte más delicada del panel: lo que se guarda aquí cambia directamente cómo la app guía a los estudiantes.

## Mapa exterior — `src/pages/MapPage.tsx` (ruta `/map`)

- Pestañas (`MAP_TABS`): **Caminos** (`editor`), **Vista usuario** (`preview`) e **Interior AR** (`ar`, renderiza
  `PoiEditorPage`). `/map?tab=ar` abre directo la última.
- Mapa 2D con Leaflet (`react-leaflet`) y capa satelital de ArcGIS; vista 3D opcional con MapLibre en
  `components/map3d/CampusMap3D.tsx` (estilo OpenFreeMap). La preferencia 2D/3D se guarda en `localStorage`.
- Edita nodos del grafo (`BUILDING`, `ENTRANCE`, `DOOR`, `WAYPOINT`, `POI`), aristas, piso de puertas/POI y tipo de
  POI (`utils/poi-catalog.ts`). Guarda con `graphService` (`/api/graph/*`).
- **Vista usuario** calcula rutas con `utils/campus-routing.ts` (Dijkstra con penalización fuera de sendero, mismas
  constantes que la app: `OFF_PATH_PENALTY = 1.25`, `EDGE_SNAP_MAX_METERS = 45`, `WALKING_SPEED_MPS = 1.2`...).
- `hooks/useCampusOsm.ts` + `utils/campus-osm.ts` traen huellas de edificios y senderos de OpenStreetMap (Overpass)
  para detectar aristas que cruzan edificios y puertas mal ubicadas.
- Edificios y nodos `BUILDING` están enlazados 1:1 en el backend (`BuildingNodeSync`): crear/mover el nodo afecta al
  edificio.

## Interior AR — `src/pages/PoiEditorPage.tsx`

Pestañas internas:

| Pestaña | Para qué | Archivos |
|---|---|---|
| **Lugares** | Ubicar el punto AR (`Room.arPosition {x,y,z}`) de cada salón sobre las mallas 3D. «Puntos sugeridos» precarga pines de `src/data/scenePins.json`. Guarda con `PATCH /api/rooms/{id}`. | `PoiEditorPage.tsx`, `components/poi-editor/MapViewer.tsx` |
| **Navegación** | Conexiones (escaleras sin suelo continuo), parches de piso («Escalera», «Nuevo»), ascensores (no requieren regenerar); botones **Regenerar**, **Publicar**, «Descartar» y «Exportar geometría» (experimentos de la app). | `components/poi-editor/NavigationPanel.tsx`, `useNavigationEditor.ts` |
| **Corregir** | Quitar triángulos del escaneo y bloquear zonas, barreras o conexiones; borrador con deshacer/rehacer y guardado por diferencias. | `components/poi-editor/MapEditPanel.tsx`, `useMapEditor.ts`, `sceneEditing.ts`, `utils/mapEdits.ts` |

### Visor 3D (`components/poi-editor/MapViewer.tsx`)

- three.js 0.170 + `GLTFLoader` con `DRACOLoader` (decodificadores en `public/draco/`).
- Las mallas vienen de `GET /api/multiset/map-meshes` (el backend devuelve URLs firmadas; timeout 60 s). La pose de
  cada mapa se aplica convirtiendo de la convención de MultiSet: rotación `quaternion.set(qx, -qy, -qz, qw)`.
- Navegación con teclado (`WASD`, `Q`/`E`, flechas; Shift acelera). Los clics toman el punto de la malla.

### Generación del navmesh

```
mallas visibles ─► geometría (sin triángulos quitados) ─► Web Worker (workers/navmeshWorker.ts)
   ─► utils/navmesh.ts → buildNavMesh() + utils/navmesh-builder.ts (reparaciones del escaneo)
   ─► parches (utils/navPatches.ts) + zonas bloqueadas + conexiones off-mesh
   ─► binario recast ─► PUT /api/navigation/navmesh (máx. 5 MB, timeout 60 s)
```

- `useNavigationEditor.ts` crea el worker con `new Worker(new URL('../../workers/navmeshWorker.ts', import.meta.url), { type: 'module' })`.
- Los parámetros de recast están documentados en `utils/navmesh.ts`. Si los cambias, compáralos con
  `npm run eval:experiment` en `uco-map-app` usando «Exportar geometría» (`utils/navmesh-input.ts`, copia idéntica
  en `uco-map-app/test/eval/experiment/navmesh-input.ts`).
- **Publicar reemplaza el navmesh de producción** que descargan todos los teléfonos. Pruébalo primero contra un
  backend local.

## Archivos compartidos con la app (copias idénticas)

`utils/campus-routing.ts`, `utils/campus-osm.ts`, `utils/poi-catalog.ts`, `utils/navmesh-input.ts`. Después de editar
uno: cópialo a la ruta equivalente de `uco-map-app` y ejecuta `npm run check:routing` (debe imprimir «iguales a los de
la app»). Agregar un tipo de POI = nueva entrada en `POI_TYPES` de `poi-catalog.ts` (en ambos repos).

## Reglas

- `recast-navigation` debe quedar en `0.43.0` aquí y en la app.
- Las coordenadas AR (`arPosition`, parches, conexiones, bloqueos) están en el espacio del map set de MultiSet; si el
  map set cambia, todo esto debe rehacerse.
- No hagas recálculos pesados en el hilo principal: usa el worker.
- Verifica a mano: generar, revisar huecos/islas en el visor, publicar en local y abrir la app contra ese backend.
