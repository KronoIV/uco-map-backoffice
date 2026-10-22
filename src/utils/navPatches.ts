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

// Un parche que sube más que esto es una escalera o rampa: lo que importa es que se una abajo y arriba
const RAMP_MIN_RISE = 0.3;
// Lo que la rampa de una escalera se mete en cada piso para que recast la una a él sin depender del clic
export const STAIRS_APRON = 0.3;

export interface RampInfo {
  /** Lado (índice del vértice inicial) más bajo y más alto. */
  bottom: number;
  top: number;
  rise: number;
  /** Pendiente media entre ambos lados (grados). */
  slopeDeg: number;
}

/** Si el parche es una rampa (escalera), sus lados de abajo y de arriba; null si es suelo casi plano. */
export function rampInfo(points: ArPoint[]): RampInfo | null {
  if (points.length < 3) return null;
  const mid = (i: number) => {
    const a = points[i], b = points[(i + 1) % points.length];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  };
  let bottom = 0, top = 0;
  for (let i = 1; i < points.length; i++) {
    if (mid(i).y < mid(bottom).y) bottom = i;
    if (mid(i).y > mid(top).y) top = i;
  }
  const lo = mid(bottom), hi = mid(top);
  const rise = hi.y - lo.y;
  if (rise < RAMP_MIN_RISE) return null;
  return { bottom, top, rise, slopeDeg: (Math.atan2(rise, Math.hypot(hi.x - lo.x, hi.z - lo.z)) * 180) / Math.PI };
}

/**
 * Rampa sobre una escalera a partir de dos esquinas al pie y dos arriba (en cualquier orden de costados): cada lado
 * se alarga STAIRS_APRON hacia su piso y toma la altura de ese piso (`floorAt`, p. ej. un rayo contra el escaneo),
 * así queda unida aunque el clic cayera en un escalón. Devuelve el contorno en orden.
 */
export function stairsRamp(
  clicks: [ArPoint, ArPoint, ArPoint, ArPoint],
  floorAt: (x: number, z: number, nearY: number) => number | null = () => null,
): ArPoint[] {
  let [b0, b1, t0, t1] = clicks;
  if (b0.y + b1.y > t0.y + t1.y) [b0, b1, t0, t1] = [t0, t1, b0, b1];
  // Cada esquina de arriba con la de abajo de su mismo costado
  if (Math.hypot(b0.x - t1.x, b0.z - t1.z) + Math.hypot(b1.x - t0.x, b1.z - t0.z)
    < Math.hypot(b0.x - t0.x, b0.z - t0.z) + Math.hypot(b1.x - t1.x, b1.z - t1.z)) [t0, t1] = [t1, t0];
  const dx = (t0.x + t1.x - b0.x - b1.x) / 2, dz = (t0.z + t1.z - b0.z - b1.z) / 2;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  const out = (p: ArPoint, sign: number): ArPoint => {
    const x = p.x + sign * ux * STAIRS_APRON, z = p.z + sign * uz * STAIRS_APRON;
    const y = floorAt(x, z, p.y) ?? p.y;
    return { x: round3(x), y: round3(y), z: round3(z) };
  };
  return [out(b0, -1), out(b1, -1), out(t1, 1), out(t0, 1)];
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

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
