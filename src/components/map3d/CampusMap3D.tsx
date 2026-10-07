import { useEffect, useLayoutEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { ExpressionSpecification, GeoJSONSource, LayerSpecification, Map as MlMap, StyleSpecification } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GraphEdge, GraphNode } from '../../types';
import { FOOT_WAYS, hideTileRoadsInside, type CampusOsm } from '../../utils/campus-osm';
import { nodeBadgeHtml } from './doorIcon';

// Misma vista que el mapa exterior de la app (uco-map-app/src/navigation/outdoor-map.ts)
const STREET_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const MAP_PITCH = 45;

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    },
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
};

type LatLng = { lat: number; lng: number };

export interface NodeLook { color: string; border: string; size: number; ring?: boolean; badge?: string | null; }
export interface EdgeLook { color: string; width: number; opacity?: number; }

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  satellite: boolean;
  /** Edificios y senderos de OSM en vivo (los mismos de la app); sin ellos quedan los de los tiles. */
  osm?: CampusOsm | null;
  nodeLook: (n: GraphNode) => NodeLook;
  nodeTitle?: (n: GraphNode) => string;
  edgeLook: (e: GraphEdge) => EdgeLook;
  /** Polilínea de la ruta (empieza en el usuario). */
  route?: LatLng[] | null;
  routeColor?: string;
  userPos?: LatLng | null;
  /** Marca un punto sobre un camino (dónde quedaría el punto nuevo). */
  pin?: LatLng | null;
  /** Dibujando: línea desde este punto hasta el cursor. */
  rubberFrom?: LatLng | null;
  draggable?: boolean;
  focus?: { lat: number; lng: number; n: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edge: GraphEdge, lat: number, lng: number) => void;
  onNodeDragEnd?: (nodeId: string, lat: number, lng: number) => void;
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const line = (coords: LatLng[], properties: Record<string, unknown> = {}): Feature => ({
  type: 'Feature', properties, geometry: { type: 'LineString', coordinates: coords.map(p => [p.lng, p.lat]) },
});
const collection = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features });

function addBuildings(map: MlMap, satellite: boolean) {
  const sources = map.getStyle().sources ?? {};
  const src = Object.keys(sources).find(k => k === 'openmaptiles' || k === 'vectorTiles' || k === 'maptiler_planet');
  if (!src || map.getLayer('ucm-3d-buildings')) return;
  map.addLayer({
    id: 'ucm-3d-buildings',
    source: src,
    'source-layer': 'building',
    type: 'fill-extrusion',
    minzoom: 14,
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6], 0, '#D0DCE8', 15, '#B8C8DA', 40, '#9FB2C4'],
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': satellite ? 0.55 : 0.82,
    },
  });
}

function addOverlays(map: MlMap) {
  for (const id of ['ucm-edges', 'ucm-route', 'ucm-rubber']) {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY });
  }
  const add = (layer: LayerSpecification) => { if (!map.getLayer(layer.id)) map.addLayer(layer); };
  const round = { 'line-cap': 'round', 'line-join': 'round' } as const;
  add({
    id: 'ucm-edges-line', type: 'line', source: 'ucm-edges', layout: round,
    paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': ['get', 'opacity'] },
  });
  // Zona de toque más ancha que la línea visible
  add({
    id: 'ucm-edges-hit', type: 'line', source: 'ucm-edges', layout: round,
    paint: { 'line-color': '#000', 'line-width': 16, 'line-opacity': 0 },
  });
  // Ruta con el mismo trazo que la app: sombra, borde blanco y color
  add({
    id: 'ucm-route-shadow', type: 'line', source: 'ucm-route', layout: round,
    paint: {
      'line-color': '#000', 'line-opacity': 0.18, 'line-blur': 3,
      'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 15, 8, 18, 16, 21, 26],
    },
  });
  add({
    id: 'ucm-route-casing', type: 'line', source: 'ucm-route', layout: round,
    paint: { 'line-color': '#fff', 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 15, 6, 18, 12, 21, 20] },
  });
  add({
    id: 'ucm-route-line', type: 'line', source: 'ucm-route', layout: round,
    paint: {
      'line-color': ['get', 'color'], 'line-opacity': 0.95,
      'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 15, 4, 18, 8, 21, 14],
    },
  });
  add({
    id: 'ucm-rubber-line', type: 'line', source: 'ucm-rubber',
    paint: { 'line-color': '#F59E0B', 'line-width': 3, 'line-dasharray': [2, 1.6] },
  });
}

const OSM_BUILDINGS = 'ucm-osm-buildings';

/** Senderos y edificios de OSM en vivo, igual que en la app; los edificios de los tiles se ocultan. */
function addLiveOsm(map: MlMap, osm: CampusOsm | null | undefined, satellite: boolean, edgesOnTop: boolean) {
  if (!osm) return;
  const paths = map.getSource('ucm-osm-paths') as GeoJSONSource | undefined;
  if (paths) {
    paths.setData(osm.paths);
    (map.getSource(OSM_BUILDINGS) as GeoJSONSource).setData(osm.buildings);
  } else {
    map.addSource('ucm-osm-paths', { type: 'geojson', data: osm.paths });
    map.addSource(OSM_BUILDINGS, { type: 'geojson', data: osm.buildings });
    // Sobre el satélite los senderos ya se ven en la foto
    if (!satellite) {
      const foot: ExpressionSpecification = ['match', ['get', 'highway'], FOOT_WAYS, true, false];
      const round = { 'line-cap': 'round', 'line-join': 'round' } as const;
      map.addLayer({
        id: 'ucm-osm-paths-casing', type: 'line', source: 'ucm-osm-paths', layout: round,
        paint: {
          'line-color': '#cfc6b8',
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'],
            15, ['case', foot, 2.5, 5], 18, ['case', foot, 7, 14], 21, ['case', foot, 14, 28]],
        },
      });
      map.addLayer({
        id: 'ucm-osm-paths', type: 'line', source: 'ucm-osm-paths', layout: round,
        paint: {
          'line-color': ['case', foot, '#fbf8f3', '#ffffff'],
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'],
            15, ['case', foot, 1.5, 3.5], 18, ['case', foot, 5, 11], 21, ['case', foot, 11, 24]],
        },
      });
    }
    map.addLayer({
      id: OSM_BUILDINGS, type: 'fill-extrusion', source: OSM_BUILDINGS, minzoom: 14,
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'height'], 0, '#D0DCE8', 15, '#B8C8DA', 40, '#9FB2C4'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-opacity': satellite ? 0.55 : 0.82,
      },
    });
  }
  if (osm.buildings.features.length > 0) {
    for (const layer of map.getStyle().layers ?? []) {
      if (layer.type === 'fill-extrusion' && layer.id !== OSM_BUILDINGS) map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }
  if (!satellite && osm.paths.features.length > 0) hideTileRoadsInside(map, osm.bbox);
  stackLayers(map, edgesOnTop);
}

/**
 * Suelo → (caminos del grafo) → ruta → edificios 3D → etiquetas → (caminos del grafo al editar) → línea de dibujo.
 * Los edificios tapan la ruta donde queda detrás o dentro de ellos, como en la app.
 */
function stackLayers(map: MlMap, edgesOnTop: boolean) {
  const layers = map.getStyle().layers ?? [];
  const labels = layers.find(l => l.type === 'symbol')?.id;
  const edges = ['ucm-edges-line', 'ucm-edges-hit'];
  const under = ['ucm-osm-paths-casing', 'ucm-osm-paths', ...(edgesOnTop ? [] : edges), 'ucm-route-shadow', 'ucm-route-casing', 'ucm-route-line'];
  const over = [...(edgesOnTop ? edges : []), 'ucm-rubber-line'];
  for (const id of under) if (map.getLayer(id)) map.moveLayer(id, labels);
  for (const l of layers) if (l.type === 'fill-extrusion') map.moveLayer(l.id, labels);
  for (const id of over) if (map.getLayer(id)) map.moveLayer(id);
}

function dotElement(look: NodeLook, title: string): HTMLDivElement {
  // MapLibre posiciona el elemento del marcador con transform: el estilo va en un hijo
  const el = document.createElement('div');
  el.title = title;
  el.appendChild(document.createElement('div'));
  styleDot(el, look);
  return el;
}

function styleDot(el: HTMLElement, look: NodeLook) {
  const inner = el.firstChild as HTMLElement;
  if (look.badge) {
    inner.style.cssText = '';
    inner.innerHTML = look.badge;
    return;
  }
  inner.innerHTML = '';
  const ring = look.ring ? `box-shadow:0 0 0 3px ${look.color}55, 0 0 0 5px ${look.color}22;` : '';
  inner.style.cssText = `background:${look.color};border:2px solid ${look.border};border-radius:50%;` +
    `width:${look.size}px;height:${look.size}px;box-sizing:border-box;cursor:pointer;${ring}`;
}

/** Mapa exterior en 3D (MapLibre inclinado y edificios levantados), igual que el de la app. */
export default function CampusMap3D(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const styleSatRef = useRef<boolean | null>(null);
  const markersRef = useRef(new Map<string, { marker: maplibregl.Marker; key: string }>());
  const extraRef = useRef<{ user?: maplibregl.Marker; pin?: maplibregl.Marker }>({});
  const cursorRef = useRef<LatLng | null>(null);
  const markerClickAt = useRef(0);
  // Los manejadores del mapa se registran una vez: leen siempre las props más recientes
  const propsRef = useRef(props);
  useLayoutEffect(() => { propsRef.current = props; });

  const { nodes, edges, satellite, osm, route, routeColor, userPos, pin, rubberFrom, draggable, focus } = props;

  const drawEdges = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const { nodes: ns, edges: es, edgeLook } = propsRef.current;
    const byId = new Map(ns.map(n => [n.nodeId, n]));
    const features = es.flatMap(e => {
      const a = byId.get(e.nodeA)?.gps;
      const b = byId.get(e.nodeB)?.gps;
      if (!a || !b) return [];
      const look = edgeLook(e);
      return [line([a, b], { id: e.id, color: look.color, width: look.width, opacity: look.opacity ?? 0.9 })];
    });
    (map.getSource('ucm-edges') as GeoJSONSource | undefined)?.setData(collection(features));
  };

  const drawRoute = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const { route: r, routeColor: color } = propsRef.current;
    const data = r && r.length >= 2 ? collection([line(r, { color: color ?? '#00d084' })]) : EMPTY;
    (map.getSource('ucm-route') as GeoJSONSource | undefined)?.setData(data);
  };

  const drawRubber = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const from = propsRef.current.rubberFrom;
    const to = cursorRef.current;
    (map.getSource('ucm-rubber') as GeoJSONSource | undefined)?.setData(from && to ? collection([line([from, to])]) : EMPTY);
  };

  // Crear el mapa una sola vez
  useEffect(() => {
    if (!containerRef.current) return;
    const { nodes: ns } = propsRef.current;
    const withGps = ns.filter(n => n.gps);
    const center: [number, number] = withGps.length > 0
      ? [withGps.reduce((s, n) => s + n.gps.lng, 0) / withGps.length, withGps.reduce((s, n) => s + n.gps.lat, 0) / withGps.length]
      : [-75.366407, 6.149703];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: propsRef.current.satellite ? SATELLITE_STYLE : STREET_STYLE,
      center,
      zoom: 17.5,
      maxZoom: 21,
      pitch: MAP_PITCH,
      bearing: 0,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    // Abajo a la izquierda: abajo a la derecha están los botones 2D/3D y satélite
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    mapRef.current = map;
    styleSatRef.current = propsRef.current.satellite;

    const markers = markersRef.current;
    const extra = extraRef.current;
    map.on('style.load', () => {
      addBuildings(map, propsRef.current.satellite);
      addOverlays(map);
      const { osm: data, satellite: sat, onEdgeClick } = propsRef.current;
      stackLayers(map, !!onEdgeClick);
      addLiveOsm(map, data, sat, !!onEdgeClick);
      readyRef.current = true;
      drawEdges();
      drawRoute();
      drawRubber();
    });

    map.on('click', e => {
      if (performance.now() - markerClickAt.current < 300) return;
      const { lat, lng } = e.lngLat;
      const hit = readyRef.current ? map.queryRenderedFeatures(e.point, { layers: ['ucm-edges-hit'] })[0] : undefined;
      const edge = hit && propsRef.current.edges.find(x => x.id === hit.properties?.id);
      if (edge && propsRef.current.onEdgeClick) propsRef.current.onEdgeClick(edge, lat, lng);
      else propsRef.current.onMapClick?.(lat, lng);
    });
    map.on('mousemove', e => {
      const edgeHover = readyRef.current && !!propsRef.current.onEdgeClick
        && map.queryRenderedFeatures(e.point, { layers: ['ucm-edges-hit'] }).length > 0;
      map.getCanvas().style.cursor = edgeHover ? 'pointer' : '';
      if (!propsRef.current.rubberFrom) return;
      cursorRef.current = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      drawRubber();
    });

    return () => {
      readyRef.current = false;
      markers.forEach(m => m.marker.remove());
      markers.clear();
      extra.user?.remove();
      extra.pin?.remove();
      extraRef.current = {};
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Cambiar entre mapa y satélite (el estilo nuevo borra las capas propias; se vuelven a poner en style.load)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleSatRef.current === satellite) return;
    styleSatRef.current = satellite;
    readyRef.current = false;
    map.setStyle(satellite ? SATELLITE_STYLE : STREET_STYLE);
  }, [satellite]);

  useEffect(drawEdges, [nodes, edges, props.edgeLook]);
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) addLiveOsm(map, osm, propsRef.current.satellite, !!propsRef.current.onEdgeClick);
  }, [osm]);
  useEffect(drawRoute, [route, routeColor]);
  useEffect(() => {
    if (!rubberFrom) cursorRef.current = null;
    drawRubber();
  }, [rubberFrom]);

  // Puntos del grafo como marcadores (se pueden tocar y arrastrar)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const { nodeLook, nodeTitle } = propsRef.current;
    const markers = markersRef.current;
    const seen = new Set<string>();
    for (const n of nodes) {
      if (!n.gps) continue;
      seen.add(n.nodeId);
      const base = nodeLook(n);
      const look = { ...base, badge: nodeBadgeHtml(n, base.color, base.border, base.size, base.ring) };
      const title = nodeTitle?.(n) ?? n.label ?? n.nodeId;
      const key = JSON.stringify([look, title]);
      const cur = markers.get(n.nodeId);
      if (cur) {
        cur.marker.setLngLat([n.gps.lng, n.gps.lat]).setDraggable(!!draggable);
        if (cur.key !== key) {
          const el = cur.marker.getElement();
          styleDot(el, look);
          el.title = title;
          cur.key = key;
        }
        continue;
      }
      const el = dotElement(look, title);
      const id = n.nodeId;
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        markerClickAt.current = performance.now();
        propsRef.current.onNodeClick?.(id);
      });
      const marker = new maplibregl.Marker({ element: el, draggable: !!draggable })
        .setLngLat([n.gps.lng, n.gps.lat])
        .addTo(map);
      marker.on('dragend', () => {
        markerClickAt.current = performance.now();
        const p = marker.getLngLat();
        propsRef.current.onNodeDragEnd?.(id, p.lat, p.lng);
      });
      markers.set(id, { marker, key });
    }
    for (const [id, m] of markers) {
      if (!seen.has(id)) { m.marker.remove(); markers.delete(id); }
    }
  }, [nodes, draggable, props.nodeLook, props.nodeTitle]);

  // Usuario simulado y punto elegido sobre un camino
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const extra = extraRef.current;
    const place = (slot: 'user' | 'pin', p: LatLng | null | undefined, look: NodeLook) => {
      if (!p) { extra[slot]?.remove(); extra[slot] = undefined; return; }
      if (!extra[slot]) {
        const el = dotElement(look, '');
        el.style.pointerEvents = 'none';
        extra[slot] = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
      } else {
        extra[slot]!.setLngLat([p.lng, p.lat]);
      }
    };
    place('user', userPos, { color: '#4285F4', border: '#fff', size: 18, ring: true });
    place('pin', pin, { color: '#F59E0B', border: '#fff', size: 12, ring: true });
  }, [userPos, pin]);

  useEffect(() => {
    if (focus) mapRef.current?.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(mapRef.current.getZoom(), 19), duration: 600 });
  }, [focus]);

  // Encuadrar la ruta cada vez que cambia
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route || route.length < 2) return;
    const bounds = new maplibregl.LngLatBounds();
    route.forEach(p => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 19, pitch: MAP_PITCH, duration: 700 });
  }, [route]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
