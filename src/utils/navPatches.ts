import { ShapeUtils, Vector2 } from 'three';
import type { ArPoint } from '../types';

// Triángulos del escaneo más grandes que esto (paredes, techos) no se recortan si solo asoman sobre el parche
const MAX_CARVE_EDGE = 0.5;

/** Área en planta (m²) del polígono. */
export function patchArea(points: ArPoint[]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

/**
 * Triángulos del parche (índices sobre `points`), orientados para que recast los vea con la normal
 * hacia arriba: si no, los marca como no caminables.
 */
export function triangulatePatch(points: ArPoint[]): number[] {
  if (points.length < 3) return [];
  const faces = ShapeUtils.triangulateShape(points.map(p => new Vector2(p.x, p.z)), []);
  const out: number[] = [];
  for (const [i0, i1, i2] of faces) {
    const a = points[i0], b = points[i1], c = points[i2];
    // Componente Y de la normal tal como la calcula recast (calcTriNormal)
    const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    if (ny >= 0) out.push(i0, i1, i2); else out.push(i0, i2, i1);
  }
  return out;
}

export interface PreparedPatch {
  points: ArPoint[];
  tris: number[];
  minX: number; maxX: number; minZ: number; maxZ: number;
}

export function preparePatch(points: ArPoint[]): PreparedPatch {
  return {
    points,
    tris: triangulatePatch(points),
    minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
    minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)),
  };
}

/** Altura del parche en (x, z); null si el punto cae fuera de él. */
export function surfaceAt(p: PreparedPatch, x: number, z: number): number | null {
  if (x < p.minX || x > p.maxX || z < p.minZ || z > p.maxZ) return null;
  for (let i = 0; i < p.tris.length; i += 3) {
    const a = p.points[p.tris[i]], b = p.points[p.tris[i + 1]], c = p.points[p.tris[i + 2]];
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(d) < 1e-12) continue;
    const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
    const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
    const w = 1 - u - v;
    if (u >= -1e-9 && v >= -1e-9 && w >= -1e-9) return u * a.y + v * b.y + w * c.y;
  }
  return null;
}

/**
 * Suma los parches a la geometría del escaneo que entra a recast y quita los triángulos del escaneo que,
 * dentro de un parche, invaden el espacio libre sobre él (ruido, objetos): el parche manda.
 */
export function applyPatches(
  positions: Float32Array,
  indices: Uint32Array,
  patches: { points: ArPoint[] }[],
  clearance: { from: number; to: number },
): { positions: Float32Array; indices: Uint32Array; removed: number } {
  const prepared = patches.map(p => preparePatch(p.points)).filter(p => p.tris.length);
  if (!prepared.length) return { positions, indices, removed: 0 };

  const kept = new Uint32Array(indices.length);
  let kc = 0;
  for (let t = 0; t < indices.length; t += 3) {
    let drop = false;
    for (const p of prepared) {
      let lo = Infinity, hi = -Infinity, inside = 0, intrudes = false, maxEdge = 0;
      for (let k = 0; k < 3; k++) {
        const vi = indices[t + k] * 3;
        const wi = indices[t + (k + 1) % 3] * 3;
        maxEdge = Math.max(maxEdge, Math.hypot(positions[wi] - positions[vi], positions[wi + 1] - positions[vi + 1], positions[wi + 2] - positions[vi + 2]));
        const s = surfaceAt(p, positions[vi], positions[vi + 2]);
        if (s === null) continue;
        const dy = positions[vi + 1] - s;
        inside++;
        lo = Math.min(lo, dy);
        hi = Math.max(hi, dy);
        if (dy > clearance.from && dy < clearance.to) intrudes = true;
      }
      // Entero dentro del parche, o un tri\u00e1ngulo peque\u00f1o del escaneo que asoma sobre \u00e9l
      if ((inside === 3 && hi > clearance.from && lo < clearance.to) || (intrudes && maxEdge <= MAX_CARVE_EDGE)) {
        drop = true;
        break;
      }
    }
    if (!drop) { kept[kc++] = indices[t]; kept[kc++] = indices[t + 1]; kept[kc++] = indices[t + 2]; }
  }

  const extraVerts = prepared.reduce((n, p) => n + p.points.length, 0);
  const extraIdx = prepared.reduce((n, p) => n + p.tris.length, 0);
  const pos = new Float32Array(positions.length + extraVerts * 3);
  const idx = new Uint32Array(kc + extraIdx);
  pos.set(positions);
  idx.set(kept.subarray(0, kc));
  let vo = positions.length / 3;
  let io = kc;
  for (const p of prepared) {
    p.points.forEach((q, i) => pos.set([q.x, q.y, q.z], (vo + i) * 3));
    for (const t of p.tris) idx[io++] = vo + t;
    vo += p.points.length;
  }
  return { positions: pos, indices: idx, removed: (indices.length - kc) / 3 };
}
