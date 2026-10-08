import { ShapeUtils, Vector2 } from 'three';
import type { ArPoint } from '../types';

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

/** Suma los parches a la geometría del escaneo que entra a recast. */
export function appendPatches(
  positions: Float32Array,
  indices: Uint32Array,
  patches: { points: ArPoint[] }[],
): { positions: Float32Array; indices: Uint32Array } {
  const tris = patches.map(p => triangulatePatch(p.points));
  const extraVerts = patches.reduce((n, p) => n + p.points.length, 0);
  const extraIdx = tris.reduce((n, t) => n + t.length, 0);
  if (!extraIdx) return { positions, indices };

  const pos = new Float32Array(positions.length + extraVerts * 3);
  const idx = new Uint32Array(indices.length + extraIdx);
  pos.set(positions);
  idx.set(indices);
  let vo = positions.length / 3;
  let io = indices.length;
  patches.forEach((p, k) => {
    p.points.forEach((q, i) => pos.set([q.x, q.y, q.z], (vo + i) * 3));
    for (const t of tris[k]) idx[io++] = vo + t;
    vo += p.points.length;
  });
  return { positions: pos, indices: idx };
}
