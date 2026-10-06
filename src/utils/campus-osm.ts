// Edificios y senderos de OpenStreetMap en vivo: los dos mapas (app y admin) muestran la misma geometría.
// Copia idéntica en uco-map-app/src/navigation/campus-osm.ts y uco-map-admin/src/utils/campus-osm.ts:
// cualquier cambio va en las dos (`npm run check:routing` en el admin lo verifica).

export interface LatLng { lat: number; lng: number; }
export interface Bounds { minLat: number; maxLat: number; minLng: number; maxLng: number; }

/** [lng, lat] */
type Position = [number, number];

export interface OsmFeature {
    type: 'Feature';
    id: number;
    properties: Record<string, string | number>;
    geometry: { type: 'Polygon'; coordinates: Position[][] } | { type: 'LineString'; coordinates: Position[] };
}
export interface OsmCollection { type: 'FeatureCollection'; features: OsmFeature[]; }

/** Planta de un edificio: anillo cerrado en [lng, lat]. */
export interface Footprint { id: number; name: string; ring: Position[]; }

export interface CampusOsm { paths: OsmCollection; buildings: OsmCollection; footprints: Footprint[]; }

interface OsmWay {
    type: string;
    id: number;
    tags?: Record<string, string>;
    geometry?: Array<{ lat: number; lon: number }>;
}

interface OsmCache { bbox: string; at: number; elements: OsmWay[]; }

const OSM_API_MAP   = 'https://api.openstreetmap.org/api/0.6/map.json';
const OVERPASS_URLS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
];
const CACHE_KEY  = 'ucomap.osmLive.v1';
const REFRESH_MS = 5 * 60 * 1000;
const MARGIN_M   = 150;
// La caja se redondea a esta malla para que mover un nodo no cambie la consulta
const BBOX_GRID  = 0.001;
const SKIP_HIGHWAYS = new Set(['proposed', 'construction', 'corridor', 'elevator', 'platform', 'abandoned', 'razed']);

export const FOOT_WAYS = ['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'track', 'bridleway'];

export function osmBBox(b: Bounds): string {
    const pLat = MARGIN_M / 111320;
    const pLng = pLat / Math.cos(b.minLat * Math.PI / 180);
    const down = (v: number) => (Math.floor(v / BBOX_GRID) * BBOX_GRID).toFixed(3);
    const up   = (v: number) => (Math.ceil(v / BBOX_GRID) * BBOX_GRID).toFixed(3);
    return [down(b.minLat - pLat), down(b.minLng - pLng), up(b.maxLat + pLat), up(b.maxLng + pLng)].join(',');
}

function readCache(bbox: string): OsmCache | null {
    try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as OsmCache | null;
        return c && c.bbox === bbox && Array.isArray(c.elements) ? c : null;
    } catch {
        return null;
    }
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
        const res = await fetch(url, { ...init, signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
        return res;
    } finally {
        clearTimeout(timer);
    }
}

/** API de edición de OSM: devuelve nodos y vías por separado; se arma la geometría de cada vía. */
async function fetchOsmApi(bbox: string): Promise<OsmWay[]> {
    const [s, w, n, e] = bbox.split(',');
    const res  = await fetchWithTimeout(`${OSM_API_MAP}?bbox=${w},${s},${e},${n}`, {}, 15000);
    const json = await res.json() as {
        elements?: Array<{ type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string> }>;
    };
    const nodes = new Map<number, { lat: number; lon: number }>();
    for (const el of json.elements ?? []) {
        if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) nodes.set(el.id, { lat: el.lat, lon: el.lon });
    }
    const ways: OsmWay[] = [];
    for (const el of json.elements ?? []) {
        if (el.type !== 'way' || !el.tags || !el.nodes || !(el.tags.highway || el.tags.building)) continue;
        const geometry = el.nodes.map(id => nodes.get(id)).filter((p): p is { lat: number; lon: number } => !!p);
        ways.push({ type: 'way', id: el.id, tags: el.tags, geometry });
    }
    return ways;
}

async function fetchOverpass(bbox: string): Promise<OsmWay[]> {
    const query = `[out:json][timeout:25];(way["highway"](${bbox});way["building"](${bbox}););out geom;`;
    let lastErr: unknown = null;
    for (const url of OVERPASS_URLS) {
        try {
            const res  = await fetchWithTimeout(url, { method: 'POST', body: new URLSearchParams({ data: query }) }, 20000);
            const json = await res.json() as { elements?: OsmWay[] };
            return json.elements ?? [];
        } catch (err) {
            lastErr = err;
        }
    }
    throw lastErr;
}

async function fetchLiveOsm(bbox: string): Promise<OsmWay[]> {
    try {
        return await fetchOsmApi(bbox);
    } catch (err) {
        console.warn('[OSM] API de OSM no disponible, probando Overpass:', err);
        return fetchOverpass(bbox);
    }
}

function toCampusOsm(elements: OsmWay[]): CampusOsm {
    const paths: OsmFeature[] = [];
    const buildings: OsmFeature[] = [];
    const footprints: Footprint[] = [];
    const num = (v: string | undefined) => { const n = parseFloat(v ?? ''); return Number.isFinite(n) ? n : 0; };
    for (const el of elements) {
        if (el.type !== 'way' || !el.tags || !el.geometry || el.geometry.length < 2) continue;
        const coords = el.geometry.map(p => [p.lon, p.lat] as Position);
        if (el.tags.building) {
            if (coords.length < 4) continue;
            const first = coords[0], last = coords[coords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
            // building=roof es una cubierta sin muros (p. ej. la cancha cubierta): se dibuja solo el techo
            const roof   = el.tags.building === 'roof';
            const height = num(el.tags.height) || (num(el.tags['building:levels']) * 3.2) || 6;
            const base   = num(el.tags.min_height) || num(el.tags['building:min_level']) * 3.2 || (roof ? height - 0.6 : 0);
            buildings.push({
                type: 'Feature', id: el.id,
                properties: { height: Math.max(height, base + 0.5), base },
                geometry: { type: 'Polygon', coordinates: [coords] },
            });
            if (!roof) footprints.push({ id: el.id, name: el.tags.name || '', ring: coords });
        } else if (el.tags.highway && !SKIP_HIGHWAYS.has(el.tags.highway)) {
            paths.push({
                type: 'Feature', id: el.id,
                properties: { highway: el.tags.highway },
                geometry: { type: 'LineString', coordinates: coords },
            });
        }
    }
    return {
        paths:     { type: 'FeatureCollection', features: paths },
        buildings: { type: 'FeatureCollection', features: buildings },
        footprints,
    };
}

const _inflight = new Map<string, Promise<OsmWay[]>>();

/** Entrega al instante la última copia guardada y, si tiene más de 5 minutos, otra vez con la de OSM. */
export function loadCampusOsm(bounds: Bounds, onData: (osm: CampusOsm) => void): void {
    loadCampusOsmBBox(osmBBox(bounds), onData);
}

/** Igual que loadCampusOsm, con la caja ya calculada por osmBBox(). */
export function loadCampusOsmBBox(bbox: string, onData: (osm: CampusOsm) => void): void {
    const cached = readCache(bbox);
    if (cached) onData(toCampusOsm(cached.elements));
    if (cached && Date.now() - cached.at < REFRESH_MS) return;

    let pending = _inflight.get(bbox);
    if (!pending) {
        pending = fetchLiveOsm(bbox).then(elements => {
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ bbox, at: Date.now(), elements } satisfies OsmCache));
            } catch { /* sin espacio o modo privado */ }
            return elements;
        }).finally(() => _inflight.delete(bbox));
        _inflight.set(bbox, pending);
    }
    pending.then(
        elements => onData(toCampusOsm(elements)),
        err => console.warn('[OSM] Sin datos en vivo; se usan los tiles:', err),
    );
}

// ── Geometría en metros alrededor de un origen ─────────────────────────────

type Xy = [number, number];

function projector(origin: LatLng): (p: Position) => Xy {
    const kx = 111320 * Math.cos(origin.lat * Math.PI / 180);
    return ([lng, lat]) => [(lng - origin.lng) * kx, (lat - origin.lat) * 111320];
}

function insideRing(p: Xy, ring: Xy[]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

/** Parámetro t en el tramo (0,0)→b donde corta al lado p→q, o null. */
function crossT(b: Xy, p: Xy, q: Xy): number | null {
    const sx = q[0] - p[0], sy = q[1] - p[1];
    const den = b[0] * sy - b[1] * sx;
    if (Math.abs(den) < 1e-12) return null;
    const t = (p[0] * sy - p[1] * sx) / den;
    const u = (p[0] * b[1] - p[1] * b[0]) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/** Metros del tramo a→b que quedan dentro de cada edificio (solo los que llegan a minMeters). */
export function buildingsCrossed(
    a: LatLng, b: LatLng, footprints: Footprint[], minMeters = 1,
): Array<{ footprint: Footprint; meters: number }> {
    const proj = projector(a);
    const end  = proj([b.lng, b.lat]);
    const len  = Math.hypot(end[0], end[1]);
    const out: Array<{ footprint: Footprint; meters: number }> = [];
    if (len < 0.01) return out;
    for (const fp of footprints) {
        const ring = fp.ring.map(proj);
        const ts = [0, 1];
        for (let i = 0; i < ring.length - 1; i++) {
            const t = crossT(end, ring[i], ring[i + 1]);
            if (t !== null) ts.push(t);
        }
        ts.sort((x, y) => x - y);
        let meters = 0;
        for (let i = 0; i < ts.length - 1; i++) {
            const m = (ts[i] + ts[i + 1]) / 2;
            if (ts[i + 1] > ts[i] && insideRing([end[0] * m, end[1] * m], ring)) meters += (ts[i + 1] - ts[i]) * len;
        }
        if (meters >= minMeters) out.push({ footprint: fp, meters });
    }
    return out;
}

/** Edificio que contiene el punto y los metros hasta su fachada más cercana. */
export function footprintAt(p: LatLng, footprints: Footprint[]): { footprint: Footprint; depth: number } | null {
    const proj = projector(p);
    for (const fp of footprints) {
        const ring = fp.ring.map(proj);
        if (!insideRing([0, 0], ring)) continue;
        let depth = Infinity;
        for (let i = 0; i < ring.length - 1; i++) {
            const [ax, ay] = ring[i], [bx, by] = ring[i + 1];
            const dx = bx - ax, dy = by - ay;
            const l2 = dx * dx + dy * dy;
            const t  = l2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
            depth = Math.min(depth, Math.hypot(ax + dx * t, ay + dy * t));
        }
        return { footprint: fp, depth };
    }
    return null;
}
