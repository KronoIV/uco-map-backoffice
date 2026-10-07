// Cálculo de rutas exteriores del campus (Dijkstra sobre el grafo de senderos).
// Copia idéntica en uco-map-app/src/navigation/campus-routing.ts y uco-map-admin/src/utils/campus-routing.ts:
// cualquier cambio va en las dos (`npm run check:routing` en el admin lo verifica).

export interface LatLng { lat: number; lng: number; }

export interface RoutingNode {
    id: string;
    gps: LatLng;
    nodeType?: string;
    label?: string;
}

interface Adjacency { node: string; dist: number; }

type Xy = [number, number];

/** Polígono del campus en metros alrededor de su primer vértice, con el perímetro acumulado por vértice. */
interface CampusArea { origin: LatLng; kx: number; ring: Xy[]; cum: number[]; perimeter: number; }

export interface RoutingGraph {
    nodes: Map<string, RoutingNode>;
    /** Aristas válidas, sin repetir ni bucles. */
    edges: Array<[string, string]>;
    adj: Map<string, Adjacency[]>;
    /** Caja de los nodos con margen (encuadre y descarga de OSM; límite del campus solo si no hay polígono). */
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
    /** Límite real del campus: fuera de él el usuario debe entrar por una ENTRANCE. */
    campus: CampusArea | null;
}

export interface PlannedRoute {
    /** Del primer nodo del grafo al destino (sin la posición del usuario). */
    nodeIds: string[];
    /** Metros reales a pie, desde el usuario. */
    totalDist: number;
    /** Costo de Dijkstra (incluye penalizaciones fuera de sendero). */
    cost: number;
    /** Punto donde el usuario se incorpora al sendero (null si va directo a un nodo). */
    startVia: LatLng | null;
    /** Sin camino en el grafo: línea recta de emergencia al destino. */
    direct: boolean;
}

const USER_NODE_ID = '__USER__';
// Caminar fuera de sendero (césped, parqueadero) cuesta más que por el camino
export const OFF_PATH_PENALTY = 1.25;
// Distancia máxima para "enganchar" al usuario a un sendero
export const EDGE_SNAP_MAX_METERS = 45;
// Estando sobre un sendero, solo se consideran otros hasta estos metros más lejos (error GPS)
export const PATH_SWITCH_TOLERANCE = 8;
// Más lejos que esto de cualquier sendero se permite ir en línea recta a los nodos cercanos
export const FREE_WALK_MIN_METERS = 15;
// Cruzar en línea recta (terreno desconocido) debe costar más que volver al sendero, o la ruta alterna entre ambas
export const FREE_WALK_PENALTY = 1.6;
export const CAMPUS_PADDING_METERS = 10;
// Ritmo peatonal en campus con pendientes y escaleras
export const WALKING_SPEED_MPS = 1.2;

/** Límite del campus en OpenStreetMap (way 577325228, «Universidad Catolica de Oriente»), en [lng, lat]. */
export const UCO_CAMPUS_BOUNDARY: Array<[number, number]> = [
    [-75.3686583, 6.1511608], [-75.3677017, 6.1516786], [-75.3671222, 6.1519672], [-75.3671164, 6.1518244],
    [-75.3659738, 6.1516591], [-75.3653622, 6.1515524], [-75.3647239, 6.1512271], [-75.3649438, 6.1501444],
    [-75.3651852, 6.1499844], [-75.3652988, 6.1498654], [-75.3653575, 6.1497207], [-75.3654575, 6.1495486],
    [-75.3655348, 6.1494017], [-75.3656169, 6.1494332], [-75.3656543, 6.1493452], [-75.3658021, 6.1491523],
    [-75.3661898, 6.1489], [-75.3663316, 6.1488077], [-75.3665797, 6.1490819], [-75.3668482, 6.1492643],
    [-75.3669715, 6.1492987], [-75.3670489, 6.149349], [-75.367272, 6.149435], [-75.3675085, 6.1496299],
    [-75.3676386, 6.149754], [-75.3680612, 6.1503457], [-75.3686583, 6.1511608],
];

export function walkingMinutes(meters: number): number {
    return Math.ceil(meters / WALKING_SPEED_MPS / 60);
}

/** Texto para el usuario: «mts», nunca «m» (se confunde con minutos). */
export function formatDistance(meters: number): string {
    return meters < 1000 ? `${Math.round(meters)} mts` : `${(meters / 1000).toFixed(1)} km`;
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Proyección de un punto sobre un segmento GPS (aproximación plana, precisa a escala de campus). */
export function projectToSegment(
    plat: number, plng: number, a: LatLng, b: LatLng,
): { lat: number; lng: number; dist: number; t: number } {
    const rd = Math.PI / 180;
    const ky = 6371000 * rd;
    const kx = Math.cos(((a.lat + b.lat) / 2) * rd) * ky;
    const px = (plng - a.lng) * kx;
    const py = (plat - a.lat) * ky;
    const bx = (b.lng - a.lng) * kx;
    const by = (b.lat - a.lat) * ky;
    const len2 = bx * bx + by * by;
    const t  = len2 < 1e-6 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
    const qx = t * bx;
    const qy = t * by;
    return { lat: a.lat + qy / ky, lng: a.lng + qx / kx, dist: Math.hypot(px - qx, py - qy), t };
}

export function buildRoutingGraph(
    nodeList: RoutingNode[],
    edgeList: Array<[string, string]>,
    boundary: Array<[number, number]> | null = UCO_CAMPUS_BOUNDARY,
): RoutingGraph {
    const nodes = new Map<string, RoutingNode>();
    for (const n of nodeList) nodes.set(n.id, { ...n, nodeType: (n.nodeType || 'WAYPOINT').toUpperCase() });

    const adj   = new Map<string, Adjacency[]>();
    const edges: Array<[string, string]> = [];
    const seen  = new Set<string>();
    for (const id of nodes.keys()) adj.set(id, []);
    for (const [a, b] of edgeList) {
        const na = nodes.get(a);
        const nb = nodes.get(b);
        if (!na || !nb || a === b) continue;
        const key = a < b ? a + '|' + b : b + '|' + a;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push([a, b]);
        const d = haversineDistance(na.gps.lat, na.gps.lng, nb.gps.lat, nb.gps.lng);
        adj.get(a)!.push({ node: b, dist: d });
        adj.get(b)!.push({ node: a, dist: d });
    }

    let bounds: RoutingGraph['bounds'] = null;
    if (nodes.size > 0) {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const n of nodes.values()) {
            minLat = Math.min(minLat, n.gps.lat); maxLat = Math.max(maxLat, n.gps.lat);
            minLng = Math.min(minLng, n.gps.lng); maxLng = Math.max(maxLng, n.gps.lng);
        }
        const pLat = CAMPUS_PADDING_METERS / 111320;
        const pLng = pLat / Math.cos(minLat * Math.PI / 180);
        bounds = { minLat: minLat - pLat, maxLat: maxLat + pLat, minLng: minLng - pLng, maxLng: maxLng + pLng };
    }
    return { nodes, edges, adj, bounds, campus: campusArea(boundary) };
}

export function nodeTypeOf(graph: RoutingGraph, id: string): string {
    return graph.nodes.get(id)?.nodeType || 'WAYPOINT';
}

function campusArea(boundary: Array<[number, number]> | null): CampusArea | null {
    if (!boundary || boundary.length < 3) return null;
    const origin = { lat: boundary[0][1], lng: boundary[0][0] };
    const kx     = 111320 * Math.cos(origin.lat * Math.PI / 180);
    const ring: Xy[] = boundary.map(([lng, lat]) => [(lng - origin.lng) * kx, (lat - origin.lat) * 111320]);
    const first = ring[0], last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    const cum = [0];
    for (let i = 1; i < ring.length; i++) cum.push(cum[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]));
    return { origin, kx, ring, cum, perimeter: cum[cum.length - 1] };
}

function toXy(area: CampusArea, lat: number, lng: number): Xy {
    return [(lng - area.origin.lng) * area.kx, (lat - area.origin.lat) * 111320];
}

function insideArea(area: CampusArea, [x, y]: Xy): boolean {
    const r = area.ring;
    let inside = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

/** Punto del perímetro más cercano: dónde queda a lo largo del perímetro (s), a qué distancia (d) y cuál es (q). */
function nearestOnPerimeter(area: CampusArea, [x, y]: Xy): { s: number; d: number; q: Xy } {
    let best = { s: 0, d: Infinity, q: area.ring[0] };
    for (let i = 0; i < area.ring.length - 1; i++) {
        const [ax, ay] = area.ring[i], [bx, by] = area.ring[i + 1];
        const vx = bx - ax, vy = by - ay;
        const l2 = vx * vx + vy * vy;
        const t  = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2)) : 0;
        const q: Xy = [ax + vx * t, ay + vy * t];
        const d = Math.hypot(x - q[0], y - q[1]);
        if (d < best.d) best = { s: area.cum[i] + Math.sqrt(l2) * t, d, q };
    }
    return best;
}

/** La recta a→b pasa por dentro del campus (muestreo cada ~5 m, sin los extremos). */
function crossesArea(area: CampusArea, a: Xy, b: Xy): boolean {
    const steps = Math.min(400, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5));
    for (let k = 1; k < steps; k++) {
        const t = k / steps;
        if (insideArea(area, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return true;
    }
    return false;
}

/**
 * Metros a pie desde afuera hasta una entrada: hasta el punto del límite más cercano a ella (rodeando el campus
 * por su perímetro si la recta lo atraviesa) y de ahí a la entrada. Sin polígono, en línea recta.
 */
export function metersFromOutside(graph: RoutingGraph, lat: number, lng: number, entrance: LatLng): number {
    const area = graph.campus;
    if (!area) return haversineDistance(lat, lng, entrance.lat, entrance.lng);
    const from = toXy(area, lat, lng);
    const gate = nearestOnPerimeter(area, toXy(area, entrance.lat, entrance.lng));
    if (!crossesArea(area, from, gate.q)) return Math.hypot(from[0] - gate.q[0], from[1] - gate.q[1]) + gate.d;
    const user = nearestOnPerimeter(area, from);
    const arc  = Math.abs(user.s - gate.s);
    return user.d + Math.min(arc, area.perimeter - arc) + gate.d;
}

export function isInsideCampus(graph: RoutingGraph, lat: number, lng: number): boolean {
    if (graph.campus) return insideArea(graph.campus, toXy(graph.campus, lat, lng));
    const b = graph.bounds;
    return !!b && lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

class MinHeap {
    private items: Array<{ id: string; d: number }> = [];

    get size(): number { return this.items.length; }

    push(id: string, d: number) {
        const a = this.items;
        a.push({ id, d });
        let i = a.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (a[p].d <= a[i].d) break;
            [a[p], a[i]] = [a[i], a[p]];
            i = p;
        }
    }

    pop(): { id: string; d: number } | undefined {
        const a = this.items;
        if (a.length === 0) return undefined;
        const top  = a[0];
        const last = a.pop()!;
        if (a.length > 0) {
            a[0] = last;
            let i = 0;
            for (;;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let m = i;
                if (l < a.length && a[l].d < a[m].d) m = l;
                if (r < a.length && a[r].d < a[m].d) m = r;
                if (m === i) break;
                [a[m], a[i]] = [a[i], a[m]];
                i = m;
            }
        }
        return top;
    }
}

/** Dijkstra con heap: O((V+E) log V). `startLinks` son las aristas del nodo virtual del usuario. */
function dijkstra(graph: RoutingGraph, toId: string, startLinks: Adjacency[]): { path: string[]; cost: number } {
    if (!graph.adj.has(toId)) return { path: [], cost: Infinity };

    const dist = new Map<string, number>();
    const prev = new Map<string, string>();
    const done = new Set<string>();
    const heap = new MinHeap();
    dist.set(USER_NODE_ID, 0);
    heap.push(USER_NODE_ID, 0);

    while (heap.size > 0) {
        const top = heap.pop()!;
        const u   = top.id;
        if (done.has(u)) continue;
        done.add(u);
        if (u === toId) break;

        const neighbors = u === USER_NODE_ID ? startLinks : (graph.adj.get(u) || []);
        for (const { node: v, dist: w } of neighbors) {
            if (done.has(v)) continue;
            const alt = top.d + w;
            if (alt < (dist.get(v) ?? Infinity)) {
                dist.set(v, alt);
                prev.set(v, u);
                heap.push(v, alt);
            }
        }
    }

    if (!dist.has(toId)) return { path: [], cost: Infinity };
    const path: string[] = [];
    let cur: string | undefined = toId;
    while (cur !== undefined) {
        path.unshift(cur);
        cur = prev.get(cur);
    }
    return path[0] === USER_NODE_ID ? { path, cost: dist.get(toId)! } : { path: [], cost: Infinity };
}

interface StartLink { node: string; cost: number; via: LatLng | null; meters?: number; }

/**
 * Conexiones del usuario hacia el grafo:
 * - Fuera del campus: hacia cada entrada, por fuera del límite (debe ingresar por una de ellas).
 * - Dentro: proyección sobre cada sendero cercano + nodos cercanos en línea recta.
 */
function buildStartLinks(graph: RoutingGraph, lat: number, lng: number): Map<string, StartLink> {
    const links = new Map<string, StartLink>();
    const add = (node: string, cost: number, via: LatLng | null, meters?: number) => {
        const cur = links.get(node);
        if (!cur || cost < cur.cost) links.set(node, { node, cost, via, meters });
    };

    if (!isInsideCampus(graph, lat, lng)) {
        for (const n of graph.nodes.values()) {
            if (n.nodeType !== 'ENTRANCE') continue;
            const meters = metersFromOutside(graph, lat, lng, n.gps);
            add(n.id, meters, null, meters);
        }
        if (links.size > 0) return links;
    }

    const projections: Array<{ a: RoutingNode; b: RoutingNode; pr: ReturnType<typeof projectToSegment> }> = [];
    let nearestEdge = Infinity;
    for (const [ia, ib] of graph.edges) {
        const a = graph.nodes.get(ia)!;
        const b = graph.nodes.get(ib)!;
        const pr = projectToSegment(lat, lng, a.gps, b.gps);
        if (pr.dist > EDGE_SNAP_MAX_METERS) continue;
        projections.push({ a, b, pr });
        nearestEdge = Math.min(nearestEdge, pr.dist);
    }

    // Sin esto la ruta "atajaba" hacia otro sendero cruzando edificios o zonas verdes
    for (const { a, b, pr } of projections) {
        if (pr.dist > nearestEdge + PATH_SWITCH_TOLERANCE) continue;
        const lateral = pr.dist * OFF_PATH_PENALTY;
        const via     = { lat: pr.lat, lng: pr.lng };
        add(a.id, lateral + haversineDistance(pr.lat, pr.lng, a.gps.lat, a.gps.lng), via);
        add(b.id, lateral + haversineDistance(pr.lat, pr.lng, b.gps.lat, b.gps.lng), via);
    }

    if (nearestEdge > FREE_WALK_MIN_METERS) {
        const nearest = [...graph.nodes.values()]
            .map(n => ({ id: n.id, d: haversineDistance(lat, lng, n.gps.lat, n.gps.lng) }))
            .sort((x, y) => x.d - y.d)
            .slice(0, 3);
        for (const { id, d } of nearest) add(id, d * FREE_WALK_PENALTY, null);
    }

    return links;
}

/** Ruta más corta desde la posición del usuario hasta un nodo. null si el nodo no existe. */
export function routeToNode(graph: RoutingGraph, lat: number, lng: number, destinationId: string): PlannedRoute | null {
    const dest = graph.nodes.get(destinationId);
    if (!dest) return null;
    const links  = buildStartLinks(graph, lat, lng);
    const result = dijkstra(graph, destinationId, [...links.values()].map(l => ({ node: l.node, dist: l.cost })));

    if (result.path.length < 2) {
        const direct = haversineDistance(lat, lng, dest.gps.lat, dest.gps.lng);
        return { nodeIds: [destinationId], totalDist: direct, cost: direct * OFF_PATH_PENALTY, startVia: null, direct: true };
    }

    const nodeIds = result.path.slice(1);
    const first   = links.get(nodeIds[0])!;
    const n0      = graph.nodes.get(nodeIds[0])!.gps;
    let totalDist = first.meters ?? (first.via
        ? haversineDistance(lat, lng, first.via.lat, first.via.lng) + haversineDistance(first.via.lat, first.via.lng, n0.lat, n0.lng)
        : haversineDistance(lat, lng, n0.lat, n0.lng));
    for (let i = 0; i < nodeIds.length - 1; i++) {
        const a = graph.nodes.get(nodeIds[i])!.gps;
        const b = graph.nodes.get(nodeIds[i + 1])!.gps;
        totalDist += haversineDistance(a.lat, a.lng, b.lat, b.lng);
    }
    return { nodeIds, totalDist, cost: result.cost, startVia: first.via, direct: false };
}

/** Nodos DOOR conectados al edificio; si aún no tiene puertas marcadas, el propio nodo del edificio. */
export function doorIdsOf(graph: RoutingGraph, buildingId: string): string[] {
    const doors = (graph.adj.get(buildingId) || []).map(a => a.node).filter(id => nodeTypeOf(graph, id) === 'DOOR');
    return doors.length > 0 ? doors : [buildingId];
}

/** La ruta a un edificio termina en su puerta más conveniente, no en el centro del edificio. */
export function routeToBuilding(graph: RoutingGraph, lat: number, lng: number, buildingId: string): PlannedRoute | null {
    let best: PlannedRoute | null = null;
    for (const id of doorIdsOf(graph, buildingId)) {
        const r = routeToNode(graph, lat, lng, id);
        if (r && (!best || r.cost < best.cost)) best = r;
    }
    return best;
}

/** Nombre corto de la ruta: por qué entrada del campus pasa. */
export function routeLabel(graph: RoutingGraph, route: PlannedRoute): string {
    if (route.direct) return 'Ruta directa';
    const entrance = route.nodeIds.find(id => nodeTypeOf(graph, id) === 'ENTRANCE');
    return entrance ? `Vía ${graph.nodes.get(entrance)!.label || entrance}` : 'Ruta más corta';
}
