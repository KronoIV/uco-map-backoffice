import { ShapeUtils, Vector2 } from 'three';
import type { ArPoint } from '../types';

type P3 = [number, number, number];

const ON_LINE = 1e-9;
// Recast también rasteriza triángulos sin área: las astillas del recorte harían de techo sobre el parche
const MIN_PIECE_AREA = 1e-6;

/** Área 3D del polígono (las paredes tienen área aunque en planta sean una línea). */
function area3(poly: P3[]) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0, z0] = poly[i];
    const [x1, y1, z1] = poly[(i + 1) % poly.length];
    nx += (y0 - y1) * (z0 + z1);
    ny += (z0 - z1) * (x0 + x1);
    nz += (x0 - x1) * (y0 + y1);
  }
  return Math.hypot(nx, ny, nz) / 2;
}

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

interface ClipTri {
  a: ArPoint; b: ArPoint; c: ArPoint;
  /** Para que "dentro" sea el mismo lado en las tres aristas, sea cual sea el sentido del triángulo. */
  sign: number;
  minX: number; maxX: number; minZ: number; maxZ: number;
}

function clipTris(p: PreparedPatch): ClipTri[] {
  const out: ClipTri[] = [];
  for (let i = 0; i < p.tris.length; i += 3) {
    const a = p.points[p.tris[i]], b = p.points[p.tris[i + 1]], c = p.points[p.tris[i + 2]];
    const cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    if (Math.abs(cross) < 1e-12) continue;
    out.push({
      a, b, c, sign: Math.sign(cross),
      minX: Math.min(a.x, b.x, c.x), maxX: Math.max(a.x, b.x, c.x),
      minZ: Math.min(a.z, b.z, c.z), maxZ: Math.max(a.z, b.z, c.z),
    });
  }
  return out;
}

/** Parte un polígono convexo por la recta a→b (en planta): [lado de dentro, lado de fuera]. */
function split(poly: P3[], a: ArPoint, b: ArPoint, sign: number): [P3[], P3[]] {
  const f = (p: P3) => sign * ((b.x - a.x) * (p[2] - a.z) - (b.z - a.z) * (p[0] - a.x));
  const inside: P3[] = [], outside: P3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i], nxt = poly[(i + 1) % poly.length];
    const fc = f(cur), fn = f(nxt);
    if (fc >= -ON_LINE) inside.push(cur);
    if (fc <= ON_LINE) outside.push(cur);
    if ((fc > ON_LINE && fn < -ON_LINE) || (fc < -ON_LINE && fn > ON_LINE)) {
      const t = fc / (fc - fn);
      const q: P3 = [cur[0] + (nxt[0] - cur[0]) * t, cur[1] + (nxt[1] - cur[1]) * t, cur[2] + (nxt[2] - cur[2]) * t];
      inside.push(q);
      outside.push(q);
    }
  }
  return [inside, outside];
}

function planeY(t: ClipTri, x: number, z: number) {
  const { a, b, c } = t;
  const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
  const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
  const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
  return u * a.y + v * b.y + (1 - u - v) * c.y;
}

function overlaps(poly: P3[], t: ClipTri) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
  }
  return maxX > t.minX && minX < t.maxX && maxZ > t.minZ && minZ < t.maxZ;
}

/**
 * Suma los parches a la geometría del escaneo que entra a recast. Los triángulos del escaneo se recortan por el
 * contorno del parche y, dentro de él, se quita lo que queda entre `clearance.from` y `clearance.to` sobre su
 * superficie (peldaños, ruido, objetos): el parche manda. Fuera del contorno el escaneo queda intacto.
 */
export function applyPatches(
  positions: Float32Array,
  indices: Uint32Array,
  patches: { points: ArPoint[] }[],
  clearance: { from: number; to: number },
): { positions: Float32Array; indices: Uint32Array; removed: number } {
  const prepared = patches.map(p => preparePatch(p.points)).filter(p => p.tris.length);
  if (!prepared.length) return { positions, indices, removed: 0 };
  const cutters = prepared.flatMap(clipTris);

  const kept: number[] = [];
  const extraPos: number[] = [];
  const extraIdx: number[] = [];
  const baseVerts = positions.length / 3;
  let removed = 0;
  const vertex = (i: number): P3 => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];

  for (let t = 0; t < indices.length; t += 3) {
    const tri = [vertex(indices[t]), vertex(indices[t + 1]), vertex(indices[t + 2])];
    if (!cutters.some(c => overlaps(tri, c))) { kept.push(indices[t], indices[t + 1], indices[t + 2]); continue; }

    let pieces: P3[][] = [tri];
    let changed = false;
    for (const c of cutters) {
      const next: P3[][] = [];
      for (const piece of pieces) {
        if (!overlaps(piece, c)) { next.push(piece); continue; }
        let rest = piece;
        for (const [a, b] of [[c.a, c.b], [c.b, c.c], [c.c, c.a]] as const) {
          const [inside, outside] = split(rest, a, b, c.sign);
          if (outside.length >= 3) {
            changed = true;
            if (area3(outside) > MIN_PIECE_AREA) next.push(outside);
          }
          rest = inside;
          if (rest.length < 3 || area3(rest) <= MIN_PIECE_AREA) break;
        }
        if (rest.length < 3 || area3(rest) <= MIN_PIECE_AREA) continue;
        const dys = rest.map(p => p[1] - planeY(c, p[0], p[2]));
        if (Math.max(...dys) > clearance.from && Math.min(...dys) < clearance.to) { removed++; changed = true; }
        else next.push(rest);
      }
      pieces = next;
    }

    if (!changed) { kept.push(indices[t], indices[t + 1], indices[t + 2]); continue; }
    for (const piece of pieces) {
      const first = baseVerts + extraPos.length / 3;
      for (const p of piece) extraPos.push(p[0], p[1], p[2]);
      for (let k = 1; k < piece.length - 1; k++) extraIdx.push(first, first + k, first + k + 1);
    }
  }

  let vo = baseVerts + extraPos.length / 3;
  for (const p of prepared) {
    for (const q of p.points) extraPos.push(q.x, q.y, q.z);
    for (const t of p.tris) extraIdx.push(vo + t);
    vo += p.points.length;
  }
  const pos = new Float32Array(positions.length + extraPos.length);
  pos.set(positions);
  pos.set(extraPos, positions.length);
  const idx = new Uint32Array(kept.length + extraIdx.length);
  idx.set(kept);
  idx.set(extraIdx, kept.length);
  return { positions: pos, indices: idx, removed };
}
