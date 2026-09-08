import type { GraphNode, GraphEdge } from '../types';

export interface RouteResult {
  nodeIds: string[];
  totalDistMeters: number;
  /** Distance from user's actual GPS position to the first graph node (last-mile leg) */
  lastMileMeters: number;
}

// Haversine distance in meters
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildAdj(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Map<string, Array<{ node: string; dist: number }>> {
  const adj = new Map<string, Array<{ node: string; dist: number }>>();
  for (const n of nodes) adj.set(n.nodeId, []);

  for (const e of edges) {
    const a = nodes.find(n => n.nodeId === e.nodeA);
    const b = nodes.find(n => n.nodeId === e.nodeB);
    if (!a?.gps || !b?.gps) continue;
    const d = haversineDistance(a.gps.lat, a.gps.lng, b.gps.lat, b.gps.lng);
    adj.get(e.nodeA)!.push({ node: e.nodeB, dist: d });
    adj.get(e.nodeB)!.push({ node: e.nodeA, dist: d });
  }
  return adj;
}

export function dijkstra(
  nodes: GraphNode[],
  edges: GraphEdge[],
  fromId: string,
  toId: string,
): RouteResult {
  const adj = buildAdj(nodes, edges);
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();

  for (const n of nodes) { dist.set(n.nodeId, Infinity); prev.set(n.nodeId, null); }
  dist.set(fromId, 0);

  const queue = new Set<string>(nodes.map(n => n.nodeId));

  while (queue.size > 0) {
    let u: string | null = null;
    let best = Infinity;
    for (const id of queue) {
      const d = dist.get(id)!;
      if (d < best) { best = d; u = id; }
    }
    if (u === null || u === toId) break;
    queue.delete(u);

    for (const { node: v, dist: w } of (adj.get(u) ?? [])) {
      if (!queue.has(v)) continue;
      const alt = dist.get(u)! + w;
      if (alt < dist.get(v)!) { dist.set(v, alt); prev.set(v, u); }
    }
  }

  // Reconstruct path
  const path: string[] = [];
  let cur: string | null = toId;
  while (cur !== null) { path.unshift(cur); cur = prev.get(cur) ?? null; }

  if (path.length < 2 || path[0] !== fromId) {
    return { nodeIds: [], totalDistMeters: 0, lastMileMeters: 0 };
  }

  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = nodes.find(n => n.nodeId === path[i]);
    const b = nodes.find(n => n.nodeId === path[i + 1]);
    if (a?.gps && b?.gps) total += haversineDistance(a.gps.lat, a.gps.lng, b.gps.lat, b.gps.lng);
  }

  return { nodeIds: path, totalDistMeters: total, lastMileMeters: 0 };
}

/** Returns the nodeId of the node nearest to the given GPS coordinate */
export function nearestNode(nodes: GraphNode[], lat: number, lng: number): string {
  let best = '';
  let bestDist = Infinity;
  for (const n of nodes) {
    if (!n.gps) continue;
    const d = haversineDistance(lat, lng, n.gps.lat, n.gps.lng);
    if (d < bestDist) { bestDist = d; best = n.nodeId; }
  }
  return best;
}

/** Returns the nodeId of the nearest ENTRANCE-type node */
export function nearestEntrance(nodes: GraphNode[], lat: number, lng: number): string {
  const entrances = nodes.filter(n => n.nodeType === 'ENTRANCE');
  return nearestNode(entrances.length > 0 ? entrances : nodes, lat, lng);
}

/**
 * Determines the correct start node for routing:
 * - If the user is OUTSIDE the campus (nearest entrance is closer or equal to any node)
 *   → must enter through the nearest ENTRANCE.
 * - If the user is INSIDE the campus (some internal node is closer than any entrance)
 *   → start from the nearest node of any type.
 */
export function findStartNode(nodes: GraphNode[], lat: number, lng: number): string {
  const nearestAnyId = nearestNode(nodes, lat, lng);
  const nearestEntranceId = nearestEntrance(nodes, lat, lng);

  if (nearestAnyId === nearestEntranceId) return nearestEntranceId;

  const anyNode = nodes.find(n => n.nodeId === nearestAnyId);
  const entrNode = nodes.find(n => n.nodeId === nearestEntranceId);
  if (!anyNode?.gps || !entrNode?.gps) return nearestEntranceId;

  const dAny = haversineDistance(lat, lng, anyNode.gps.lat, anyNode.gps.lng);
  const dEntr = haversineDistance(lat, lng, entrNode.gps.lat, entrNode.gps.lng);

  // User is inside if a non-entrance node is strictly closer than the nearest entrance
  return dAny < dEntr ? nearestAnyId : nearestEntranceId;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function formatETA(m: number): string {
  const minutes = Math.ceil(m / 1.4 / 60);
  return minutes <= 1 ? '< 1 min' : `~${minutes} min`;
}
