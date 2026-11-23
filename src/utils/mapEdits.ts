import type { ArPoint, NavBlock } from '../types';

/** Índices ordenados y sin repetir → pares [inicio, cantidad]. */
export function toRanges(sorted: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const last = out.length - 2;
    if (last >= 0 && out[last] + out[last + 1] === t) out[last + 1]++;
    else out.push(t, 1);
  }
  return out;
}

export function forEachInRanges(ranges: number[], fn: (t: number) => void) {
  for (let i = 0; i + 1 < ranges.length; i += 2) {
    for (let t = ranges[i], end = ranges[i] + ranges[i + 1]; t < end; t++) fn(t);
  }
}

export function rangesCount(ranges: number[]) {
  let n = 0;
  for (let i = 1; i < ranges.length; i += 2) n += ranges[i];
  return n;
}

export const meshKey = (map: string, mesh: number) => `${map}#${mesh}`;

/** Celdas del heightfield (convexas en planta) que recast marca como no caminables, entre hmin y hmax de altura. */
export interface BlockedArea {
  points: ArPoint[];
  hmin: number;
  hmax: number;
}

// Polígonos del navmesh: sus vértices van unos cm sobre el piso; el piso de arriba está a ~3 m
export const AREA_BELOW_M = 0.5;
export const AREA_ABOVE_M = 0.4;
// Ancho del corte en planta: 3 celdas de 10 cm, suficiente para que recast no una los dos lados
export const BARRIER_WIDTH_M = 0.3;
// El corte alcanza el piso aunque el clic cayera algo arriba o abajo (escalones, rampas)
export const BARRIER_HEIGHT_M = 1;

/** Cuadriláteros de un corte, uno por tramo, alargados medio ancho en cada punta para cerrar las esquinas. */
export function barrierPolygons(line: ArPoint[], width = BARRIER_WIDTH_M): ArPoint[][] {
  const out: ArPoint[][] = [];
  const h = width / 2;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len;
    const nx = -uz * h, nz = ux * h;
    const a0 = { x: a.x - ux * h, z: a.z - uz * h }, b0 = { x: b.x + ux * h, z: b.z + uz * h };
    out.push([
      { x: a0.x + nx, y: a.y, z: a0.z + nz },
      { x: b0.x + nx, y: b.y, z: b0.z + nz },
      { x: b0.x - nx, y: b.y, z: b0.z - nz },
      { x: a0.x - nx, y: a.y, z: a0.z - nz },
    ]);
  }
  return out;
}

/** Lo que recast debe marcar como no caminable para estos bloqueos (las conexiones se quitan aparte). */
export function blockedAreas(blocks: NavBlock[]): BlockedArea[] {
  const out: BlockedArea[] = [];
  for (const b of blocks) {
    if (b.kind === 'AREA') {
      for (const poly of b.polygons ?? []) {
        if (poly.length < 3) continue;
        const ys = poly.map(p => p.y);
        out.push({ points: poly, hmin: Math.min(...ys) - AREA_BELOW_M, hmax: Math.max(...ys) + AREA_ABOVE_M });
      }
    } else if (b.kind === 'BARRIER') {
      for (const quad of barrierPolygons(b.line ?? [])) {
        const ys = quad.map(p => p.y);
        out.push({ points: quad, hmin: Math.min(...ys) - BARRIER_HEIGHT_M, hmax: Math.max(...ys) + BARRIER_HEIGHT_M });
      }
    }
  }
  return out;
}

export function blockedConnectionIds(blocks: NavBlock[]): Set<string> {
  return new Set(blocks.filter(b => b.kind === 'CONNECTION' && b.connectionId).map(b => b.connectionId!));
}

/** Área en planta (m²) de un polígono. */
export function planArea(points: ArPoint[]) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

export function lineLength(line: ArPoint[]) {
  let d = 0;
  for (let i = 1; i < line.length; i++) d += Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z);
  return d;
}

export function blockCenter(b: NavBlock): ArPoint | null {
  const pts = b.kind === 'AREA' ? (b.polygons ?? []).flat() : b.kind === 'BARRIER' ? (b.line ?? []) : [];
  if (!pts.length) return null;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    z: pts.reduce((s, p) => s + p.z, 0) / pts.length,
  };
}
