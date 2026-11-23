/**
 * Generador de navmesh propio: el mismo flujo de recast que generateSoloNavMesh, más reparaciones del escaneo que
 * recast no hace. Se aplican sobre el heightfield (vóxeles) antes de que recast lo filtre, así que no dependen de
 * cómo esté triangulada la malla:
 *
 * 1. Triángulos inválidos (NaN, índices fuera de rango, sin área) se descartan.
 * 2. Ruido flotante: grupos pequeños de vóxeles sueltos en el aire (polvo del escaneo, lámparas, reflejos) se quitan;
 *    si no, le roban altura libre al piso de debajo y lo cortan.
 * 3. Orientación: el escaneo mezcla triángulos del piso con la normal hacia abajo (p. ej. la losa vista desde el piso
 *    inferior) y del techo hacia arriba. recast decide triángulo a triángulo y parte pasillos en islas; aquí vota cada
 *    superficie conectada: si es suelo, toda ella es caminable; si es la cara de arriba de un techo, ninguna parte de
 *    ella hace crecer el navmesh. Si toda la malla viene al revés (suelos hacia abajo), se invierte.
 * 4. Picos: vértices disparados y postes delgados que salen del suelo (hasta 1,2 m) se recortan a su altura; cada uno
 *    abría un hueco de medio metro tras la erosión.
 * 5. Huecos y rendijas: el suelo de cada superficie se cierra morfológicamente (rendijas entre trozos del escaneo,
 *    entrantes, huecos angostos, motas no caminables) y los huecos cerrados más anchos se rellenan si su borde es
 *    sobre todo suelo, con la altura interpolada del borde. No se rellena lo que da al vacío, lo ancho ni lo que deja
 *    ver debajo una superficie caminable cercana (escalera, rampa, desnivel): eso queda para un parche manual.
 */
import {
  NavMesh, NavMeshCreateParams, Raw, Recast, RecastBuildContext, TriangleAreasArray, TrianglesArray, VerticesArray,
  allocCompactHeightfield, allocContourSet, allocHeightfield, allocPolyMesh, allocPolyMeshDetail,
  buildCompactHeightfield, buildContours, buildDistanceField, buildPolyMesh, buildPolyMeshDetail, buildRegions,
  calcGridSize, createHeightfield, createNavMeshData, erodeWalkableArea, filterLedgeSpans,
  filterLowHangingWalkableObstacles, filterWalkableLowHeightSpans, freeCompactHeightfield, freeContourSet,
  freeHeightfield, freePolyMesh, freePolyMeshDetail, markConvexPolyArea, rasterizeTriangles, type RecastHeightfield,
} from 'recast-navigation';

export interface WalkerSettings {
  cellSize: number;
  cellHeight: number;
  walkableClimb: number;
  walkableHeight: number;
  walkableRadius: number;
  walkableSlopeAngle: number;
}

export interface DetailSettings {
  /** En celdas, como en recast-navigation: × cellSize. */
  detailSampleDist: number;
  /** En celdas: × cellHeight. */
  detailSampleMaxError: number;
}

export interface OffMeshConnection {
  startPosition: { x: number; y: number; z: number };
  endPosition: { x: number; y: number; z: number };
  radius: number;
  bidirectional: boolean;
  userId?: number;
}

/** Zona que el admin bloqueó: polígono convexo en planta, solo para el suelo entre hmin y hmax (m). */
export interface BlockedArea {
  points: Array<{ x: number; y: number; z: number }>;
  hmin: number;
  hmax: number;
}

export interface RepairSettings {
  /** Quitar grupos de vóxeles flotantes de hasta esta planta (m²). 0 = no. */
  floaterMaxArea: number;
  /** Decidir por superficie si los triángulos con la normal invertida son suelo (y si la malla entera viene al revés). */
  orientation: boolean;
  /** Recortar picos y postes delgados (hasta esta planta, m², y 1,2 m de alto) a la altura del suelo. 0 = no. */
  spikeMaxArea: number;
  /** Cerrar rendijas, entrantes y huecos de hasta este ancho (m), aunque den a zonas sin escanear. 0 = no. */
  gapMaxWidth: number;
  /** Rellenar huecos rodeados de suelo de hasta este ancho (m)... 0 = no. */
  holeMaxWidth: number;
  /** ...y hasta esta superficie (m²). */
  holeMaxArea: number;
  /** Si bajo el hueco hay suelo caminable a menos de esta profundidad (m), es un desnivel real: no se rellena. */
  holeDropProbe: number;
  /** Reconstruir escaleras y rampas escaneadas con picos, huecos y basura encima como una rampa limpia. */
  stairs: boolean;
}

export const DEFAULT_REPAIR: RepairSettings = {
  floaterMaxArea: 0.12,
  orientation: true,
  spikeMaxArea: 0.1,
  gapMaxWidth: 1.2,
  holeMaxWidth: 2.4,
  holeMaxArea: 6,
  holeDropProbe: 1.5,
  stairs: true,
};

export const NO_REPAIR: RepairSettings = {
  floaterMaxArea: 0, orientation: false, spikeMaxArea: 0, gapMaxWidth: 0, holeMaxWidth: 0, holeMaxArea: 0, holeDropProbe: 0,
  stairs: false,
};

export interface OpenHole {
  x: number; y: number; z: number;
  areaM2: number;
  widthM: number;
}

/** Escalera o rampa reconstruida: centro, desnivel y planta. */
export interface StairRegion {
  x: number; y: number; z: number;
  riseM: number;
  areaM2: number;
  slopeDeg: number;
}

export interface BuildReport {
  triangles: number;
  droppedTriangles: number;
  /** false si el formato interno del heightfield no es el esperado: se generó sin reparaciones. */
  repaired: boolean;
  floaters: { clusters: number; spans: number };
  /** La malla venía con los suelos hacia abajo y se invirtió entera. */
  flipped: boolean;
  invertedFloorM2: number;
  invertedRejectedM2: number;
  /** Columnas de picos recortadas al suelo. */
  spikes: number;
  /** Rendijas y entrantes cerrados (relleno nuevo y spans no caminables que pasaron a suelo). */
  gapsClosedM2: number;
  holesFilled: number;
  holesFilledM2: number;
  /** Huecos cerrados que no se rellenaron por anchos o grandes (candidatos a parche manual), de mayor a menor. */
  openHoles: OpenHole[];
  /** Escaleras y rampas reconstruidas. */
  stairs: StairRegion[];
  ms: Record<string, number>;
}

const AREA_WALKABLE = 63;
const AREA_INVERTED = 1;
// Un parche plano: vecinos a esta diferencia (celdas) como máximo; una losa vista desde abajo queda un escalón por debajo
const FLAT_JOIN = 2;
// Superficie mínima (m²) de un suelo para que las reparaciones crezcan desde él
const TRUSTED_FLOOR_M2 = 1.5;
// Un techo tiene otro suelo debajo a menos de esto (m): una planta y algo más
const CEILING_PROBE_M = 4.5;
// Lo que sobresale más que esto no es un pico de ruido
const SPIKE_MAX_RISE_M = 1.2;
// Escaleras: plano ajustado en una ventana de (2·R + 1)² celdas (1,1 m), con al menos esta fracción de muestras
const STAIR_FIT_R = 5;
const STAIR_MIN_SAMPLES = 0.35;
// Una escalera sube entre ~20° y ~42°; las rampas suaves no necesitan arreglo
const STAIR_MIN_SLOPE_DEG = 14;
const STAIR_MAX_SLOPE_DEG = 50;
// Las muestras a más de esto (celdas) del primer ajuste son picos o basura: se ajusta otra vez sin ellas
const STAIR_OUTLIER = 3;
const STAIR_MIN_RISE_M = 0.6;
const STAIR_MIN_AREA_M2 = 0.6;
// Cierre de la planta de la escalera (celdas): tapa huecos de picos y de peldaños sin escanear de hasta ~0,6 m
const STAIR_CLOSE = 3;
// Lo que sale del peldaño y sube al menos esto es una pared, un poste o una baranda: ese hueco no se tapa
const STAIR_WALL_M = 1;
// Suavizado de la rampa: iteraciones (cada una propaga una celda) y peso del plano ajustado frente a los vecinos
const STAIR_SMOOTH_ITERS = 40;
const STAIR_DATA_WEIGHT = 1;
// Un suelo plano conectado de esta planta (celdas) es un piso o un descanso real: nunca se quita
const PROTECTED_FLOOR_CELLS = 100;
const EPS = 1e-6;
// 4 vecinos y luego las diagonales (dx, dz)
const DIRS: ReadonlyArray<readonly [number, number]> = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

interface WasmModule {
  HEAP32: Int32Array;
  HEAPU32: Uint32Array;
  getPointer(o: unknown): number;
}

const wasm = () => Raw.Module as unknown as WasmModule;

/** Unidades de celda como las calcula RecastDemo, sin que el error de coma flotante reste una celda (0,3 / 0,05). */
export function walkerCells(s: WalkerSettings) {
  return {
    height: Math.ceil(s.walkableHeight / s.cellHeight - EPS),
    climb: Math.floor(s.walkableClimb / s.cellHeight + EPS),
    radius: Math.ceil(s.walkableRadius / s.cellSize - EPS),
  };
}

/**
 * Columnas de vóxeles del heightfield leídas de la memoria de WASM (rcHeightfield y rcSpan de Recast 1.6:
 * smin 13 bits, smax 13, area 6, puntero next). El formato se comprueba contra los getters de la librería.
 */
class SpanColumns {
  readonly w: number;
  readonly h: number;
  start = new Int32Array(0);
  smin = new Uint16Array(0);
  smax = new Uint16Array(0);
  area = new Uint8Array(0);
  addr = new Uint32Array(0);
  private readonly heads: number;

  constructor(hf: RecastHeightfield) {
    const m = wasm();
    const p = m.getPointer(hf.raw) >> 2;
    this.w = hf.raw.get_width();
    this.h = hf.raw.get_height();
    if (m.HEAP32[p] !== this.w || m.HEAP32[p + 1] !== this.h) throw new Error('heightfield: formato inesperado');
    this.heads = m.HEAPU32[p + 10] >> 2;
    this.read();
    for (let c = 0; c < this.w * this.h; c++) {
      if (this.start[c] === this.start[c + 1]) continue;
      const s = hf.raw.get_spans(c);
      const i = this.start[c];
      if (m.getPointer(s) !== this.addr[i] || s.get_smin() !== this.smin[i] || s.get_smax() !== this.smax[i] || s.get_area() !== this.area[i]) {
        throw new Error('heightfield: formato de span inesperado');
      }
      break;
    }
  }

  get n() { return this.addr.length; }

  read() {
    const u32 = wasm().HEAPU32;
    const cols = this.w * this.h;
    let n = 0;
    for (let c = 0; c < cols; c++) for (let s = u32[this.heads + c]; s; s = u32[(s >> 2) + 1]) n++;
    this.start = new Int32Array(cols + 1);
    this.smin = new Uint16Array(n);
    this.smax = new Uint16Array(n);
    this.area = new Uint8Array(n);
    this.addr = new Uint32Array(n);
    let i = 0;
    for (let c = 0; c < cols; c++) {
      this.start[c] = i;
      for (let s = u32[this.heads + c]; s; s = u32[(s >> 2) + 1]) {
        const bits = u32[s >> 2];
        this.smin[i] = bits & 0x1fff;
        this.smax[i] = (bits >>> 13) & 0x1fff;
        this.area[i] = bits >>> 26;
        this.addr[i] = s;
        i++;
      }
    }
    this.start[cols] = i;
  }

  /** Columna de cada span. */
  columns() {
    const out = new Int32Array(this.n);
    for (let c = 0; c < this.w * this.h; c++) for (let i = this.start[c]; i < this.start[c + 1]; i++) out[i] = c;
    return out;
  }

  /** Espacio libre (celdas) sobre el span i de la columna c. */
  clearance(c: number, i: number) {
    return i + 1 < this.start[c + 1] ? this.smin[i + 1] - this.smax[i] : 0xffff;
  }

  setArea(i: number, area: number) {
    const u32 = wasm().HEAPU32;
    const p = this.addr[i] >> 2;
    u32[p] = ((u32[p] & 0x03ffffff) | (area << 26)) >>> 0;
    this.area[i] = area;
  }

  setTop(i: number, smax: number) {
    const u32 = wasm().HEAPU32;
    const p = this.addr[i] >> 2;
    u32[p] = ((u32[p] & ~(0x1fff << 13)) | (smax << 13)) >>> 0;
    this.smax[i] = smax;
  }

  /** Saca el span de la lista de su columna (su memoria se libera con el heightfield). */
  unlink(c: number, i: number) {
    const u32 = wasm().HEAPU32;
    const target = this.addr[i];
    const next = u32[(target >> 2) + 1];
    if (u32[this.heads + c] === target) { u32[this.heads + c] = next; return; }
    for (let s = u32[this.heads + c]; s; s = u32[(s >> 2) + 1]) {
      if (u32[(s >> 2) + 1] === target) { u32[(s >> 2) + 1] = next; return; }
    }
  }
}

function sanitize(positions: Float32Array, indices: Uint32Array) {
  const nv = positions.length / 3;
  const keep = new Uint8Array(indices.length / 3);
  const bmin = [Infinity, Infinity, Infinity];
  const bmax = [-Infinity, -Infinity, -Infinity];
  let kept = 0;
  for (let t = 0; t < keep.length; t++) {
    const a = indices[t * 3], b = indices[t * 3 + 1], c = indices[t * 3 + 2];
    if (a >= nv || b >= nv || c >= nv || a === b || b === c || a === c) continue;
    const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
    const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
    const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
    if (!Number.isFinite(ax + ay + az + bx + by + bz + cx + cy + cz)) continue;
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-20) continue;
    keep[t] = 1;
    kept++;
    bmin[0] = Math.min(bmin[0], ax, bx, cx); bmax[0] = Math.max(bmax[0], ax, bx, cx);
    bmin[1] = Math.min(bmin[1], ay, by, cy); bmax[1] = Math.max(bmax[1], ay, by, cy);
    bmin[2] = Math.min(bmin[2], az, bz, cz); bmax[2] = Math.max(bmax[2], az, bz, cz);
  }
  let out = indices;
  if (kept < keep.length) {
    out = new Uint32Array(kept * 3);
    for (let t = 0, k = 0; t < keep.length; t++) {
      if (!keep[t]) continue;
      out[k++] = indices[t * 3]; out[k++] = indices[t * 3 + 1]; out[k++] = indices[t * 3 + 2];
    }
  }
  return { indices: out, dropped: keep.length - kept, bmin, bmax };
}

/** Caminable si la pendiente lo permite; con la normal hacia abajo, «suelo invertido» (se decide después). */
function triangleAreas(positions: Float32Array, indices: Uint32Array, slopeDeg: number, inverted: boolean) {
  const thr = Math.cos((slopeDeg * Math.PI) / 180);
  const out = new Uint8Array(indices.length / 3);
  for (let t = 0; t < out.length; t++) {
    const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const ky = ny / Math.hypot(nx, ny, nz);
    out[t] = ky > thr ? AREA_WALKABLE : inverted && -ky > thr ? AREA_INVERTED : 0;
  }
  return out;
}

function rasterize(ctx: RecastBuildContext, hf: RecastHeightfield, positions: Float32Array | number[], indices: Uint32Array | number[], areas: Uint8Array, climb: number) {
  const va = new VerticesArray();
  const ta = new TrianglesArray();
  const aa = new TriangleAreasArray();
  try {
    va.copy(positions as Float32Array<ArrayBuffer>);
    ta.copy(indices as unknown as Int32Array<ArrayBuffer>);
    aa.copy(areas as Uint8Array<ArrayBuffer>);
    if (!rasterizeTriangles(ctx, va, positions.length / 3, ta, aa, areas.length, hf, climb)) throw new Error('No se pudo rasterizar la geometría');
  } finally {
    va.destroy();
    ta.destroy();
    aa.destroy();
  }
}

/** Grupos de vóxeles que no tocan nada y ocupan poca planta: ruido en el aire. */
function removeFloaters(g: SpanColumns, maxCols: number, maxTall: number) {
  const { w, h, start, smin, smax } = g;
  const parent = new Int32Array(g.n);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = (i: number) => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const forward = [DIRS[0], DIRS[1], DIRS[4], DIRS[5]];
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const c = x + z * w;
    for (let i = start[c]; i < start[c + 1]; i++) {
      if (i + 1 < start[c + 1] && smin[i + 1] <= smax[i] + 1) union(i, i + 1);
      for (const [dx, dz] of forward) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nx >= w || nz >= h) continue;
        const nc = nx + nz * w;
        for (let j = start[nc]; j < start[nc + 1]; j++) {
          if (smin[j] <= smax[i] + 1 && smin[i] <= smax[j] + 1) union(i, j);
        }
      }
    }
  }
  const cols = new Int32Array(g.n);
  const lastCol = new Int32Array(g.n).fill(-1);
  const lo = new Uint16Array(g.n).fill(0xffff);
  const hi = new Uint16Array(g.n);
  for (let c = 0; c < w * h; c++) {
    for (let i = start[c]; i < start[c + 1]; i++) {
      const r = find(i);
      if (lastCol[r] !== c) { lastCol[r] = c; cols[r]++; }
      lo[r] = Math.min(lo[r], smin[i]);
      hi[r] = Math.max(hi[r], smax[i]);
    }
  }
  const isFloater = (r: number) => cols[r] <= maxCols && (hi[r] - lo[r] <= maxTall || cols[r] <= 4);
  let spans = 0;
  const clusters = new Set<number>();
  for (let c = 0; c < w * h; c++) {
    for (let i = start[c]; i < start[c + 1]; i++) {
      const r = find(i);
      if (!isFloater(r)) continue;
      g.unlink(c, i);
      clusters.add(r);
      spans++;
    }
  }
  return { clusters: clusters.size, spans };
}

/**
 * Malla entera al revés: en cada columna la superficie más baja es el piso de la planta baja; si casi siempre mira
 * hacia abajo, los suelos vienen invertidos (y los techos hacia arriba).
 */
function detectFlip(g: SpanColumns, H: number) {
  let up = 0, down = 0;
  for (let c = 0; c < g.w * g.h; c++) {
    const i = g.start[c];
    if (i === g.start[c + 1] || g.clearance(c, i) < H) continue;
    if (g.area[i] === AREA_WALKABLE) up++;
    else if (g.area[i] === AREA_INVERTED) down++;
  }
  return down > 1000 && down > 1.5 * up;
}

function flipOrientation(g: SpanColumns) {
  for (let i = 0; i < g.n; i++) {
    if (g.area[i] === AREA_WALKABLE) g.setArea(i, AREA_INVERTED);
    else if (g.area[i] === AREA_INVERTED) g.setArea(i, AREA_WALKABLE);
  }
}

/**
 * Orientación por superficie, en dos pasos. 1) Cada parche plano (spans con altura libre y la cara de arriba a
 * ±FLAT_JOIN de su vecino, uno por columna) vota con su planta: es suelo si al menos el 40 % mira hacia arriba y no
 * es la cara de arriba de un techo (sin nada encima y con otro suelo debajo a menos de `belowCells`). Su suelo
 * invertido pasa a caminable; el de los demás parches, no, y si el parche rechazado está sobre otro suelo (un techo o
 * la losa vistos desde abajo, con algunos triángulos al revés) tampoco su parte «hacia arriba». 2) Los parches-suelo
 * se unen por escalones de hasta climb (escaleras, rampas); las superficies de al menos `minCells` son el suelo de
 * confianza desde el que crecen las demás reparaciones.
 */
function classifySurfaces(g: SpanColumns, colOf: Int32Array, H: number, climb: number, minCells: number, belowCells: number) {
  const { w, h, start, smax, area } = g;
  const isSurface = (c: number, i: number) => (area[i] === AREA_WALKABLE || area[i] === AREA_INVERTED) && g.clearance(c, i) >= H;
  const floorBelow = (c: number, i: number) => {
    for (let j = start[c]; j < i; j++) {
      if (area[j] === AREA_WALKABLE && smax[j] <= smax[i] - H && smax[j] >= smax[i] - belowCells && g.clearance(c, j) >= H) return true;
    }
    return false;
  };
  const queue = new Int32Array(g.n);
  // Una capa: si la superficie ya pasa por esta columna (p. ej. sube por la escalera y vuelve sobre la planta de
  // abajo), el otro span de la columna es otra superficie
  const flood = (label: Int32Array, colMark: Int32Array, i0: number, id: number, joins: (i: number, j: number) => boolean) => {
    let qh = 0, qt = 0;
    queue[qt++] = i0;
    label[i0] = id;
    colMark[colOf[i0]] = id;
    while (qh < qt) {
      const i = queue[qh++], c = colOf[i], x = c % w, z = (c - x) / w;
      for (let d = 0; d < 4; d++) {
        const nx = x + DIRS[d][0], nz = z + DIRS[d][1];
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        const nc = nx + nz * w;
        if (colMark[nc] === id) continue;
        for (let j = start[nc]; j < start[nc + 1]; j++) {
          if (label[j] >= 0 || !joins(i, j)) continue;
          label[j] = id;
          colMark[nc] = id;
          queue[qt++] = j;
          break;
        }
      }
    }
    return qt;
  };

  const patch = new Int32Array(g.n).fill(-1);
  const isFloor: boolean[] = [];
  const isCeiling: boolean[] = [];
  let colMark = new Int32Array(w * h).fill(-1);
  for (let i0 = 0; i0 < g.n; i0++) {
    if (patch[i0] >= 0 || !isSurface(colOf[i0], i0)) continue;
    const id = isFloor.length;
    const n = flood(patch, colMark, i0, id, (i, j) => Math.abs(smax[j] - smax[i]) <= FLAT_JOIN && isSurface(colOf[j], j));
    let up = 0, below = 0, over = 0;
    for (let q = 0; q < n; q++) {
      const i = queue[q], c = colOf[i];
      if (area[i] === AREA_WALKABLE) up++;
      if (!floorBelow(c, i)) continue;
      over++;
      if (i === start[c + 1] - 1) below++;
    }
    // Sin nada encima y sobre otro suelo puede ser la cara de arriba de un techo con ruido... o un piso alto sin techo
    // escaneado: solo lo decide una orientación clara
    const top = below >= 0.6 * n;
    const floor = up >= (top ? 0.75 : 0.4) * n;
    isFloor.push(floor);
    isCeiling.push(up < 0.4 * n && over >= 0.5 * n);
  }
  let accepted = 0, rejected = 0;
  for (let i = 0; i < g.n; i++) {
    const k = patch[i];
    if (area[i] === AREA_WALKABLE) {
      if (k >= 0 && isCeiling[k]) g.setArea(i, 0);
      continue;
    }
    if (area[i] !== AREA_INVERTED) continue;
    if (k >= 0 && isFloor[k]) {
      g.setArea(i, AREA_WALKABLE);
      accepted++;
    } else {
      g.setArea(i, 0);
      rejected++;
    }
  }

  const comp = new Int32Array(g.n).fill(-1);
  colMark = new Int32Array(w * h).fill(-1);
  const onFloor = (i: number) => patch[i] >= 0 && isFloor[patch[i]];
  const trustedComps: Int32Array[] = [];
  let id = 0;
  for (let i0 = 0; i0 < g.n; i0++) {
    if (comp[i0] >= 0 || !onFloor(i0)) continue;
    const n = flood(comp, colMark, i0, id++, (i, j) => onFloor(j) && Math.abs(smax[j] - smax[i]) <= climb);
    if (n >= minCells) trustedComps.push(queue.slice(0, n));
  }
  return { trustedComps, accepted, rejected };
}

/**
 * Picos: grupos de hasta `maxCols` columnas sin suelo que, rodeadas de suelo a una misma altura, tienen algo que sale
 * de ese suelo y no pasa de `maxRise`. Son ruido (un vértice disparado) o postes y objetos pequeños; cada uno, tras la
 * erosión, abriría un hueco de medio metro en el navmesh. Se recortan a la altura del suelo de alrededor.
 */
function flattenSpikes(g: SpanColumns, H: number, climb: number, maxCols: number, maxRise: number) {
  const { w, h, start, smin, smax, area } = g;
  const floorTop = (c: number, lo: number, hi: number) => {
    for (let k = start[c]; k < start[c + 1]; k++) {
      if (area[k] === AREA_WALKABLE && g.clearance(c, k) >= H && smax[k] >= lo && smax[k] <= hi) return smax[k];
    }
    return -1;
  };
  const spike = new Int32Array(w * h).fill(-1);
  const base = new Int32Array(w * h);
  const levels: number[] = [];
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const c = x + z * w;
    for (let j = start[c]; j < start[c + 1] && spike[c] < 0; j++) {
      // Altura del suelo alrededor (5 × 5) a la altura de donde arranca el span: mediana, si es pareja
      levels.length = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, nz = z + dz;
        if ((!dx && !dz) || nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        const nc = nx + nz * w;
        for (let k = start[nc]; k < start[nc + 1]; k++) {
          if (area[k] === AREA_WALKABLE && g.clearance(nc, k) >= H && Math.abs(smax[k] - smin[j]) <= climb) { levels.push(smax[k]); break; }
        }
      }
      if (levels.length < 8) continue;
      levels.sort((a, b) => a - b);
      const L = levels[levels.length >> 1];
      if (levels[Math.floor(levels.length * 0.8)] - levels[Math.floor(levels.length * 0.2)] > climb) continue;
      if (smax[j] <= L + climb || smax[j] > L + maxRise || floorTop(c, L - climb, L + climb) >= 0) continue;
      spike[c] = j;
      base[c] = L;
    }
  }
  const seen = new Uint8Array(w * h);
  let flattened = 0;
  for (let c0 = 0; c0 < w * h; c0++) {
    if (spike[c0] < 0 || seen[c0]) continue;
    const group = [c0];
    seen[c0] = 1;
    let ok = true;
    for (let q = 0; q < group.length; q++) {
      const c = group[q], x = c % w, z = (c - x) / w;
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) { ok = false; continue; }
        const nc = nx + nz * w;
        if (spike[nc] >= 0) {
          if (!seen[nc]) { seen[nc] = 1; group.push(nc); }
          continue;
        }
        // Todo el contorno ha de ser suelo a la altura del pico
        if (floorTop(nc, base[c0] - climb, base[c0] + climb) < 0) ok = false;
      }
    }
    if (!ok || group.length > maxCols) continue;
    for (const c of group) {
      const j = spike[c];
      if (smin[j] >= base[c]) continue;
      if (smax[j] > base[c]) g.setTop(j, base[c]);
      g.setArea(j, AREA_WALKABLE);
      flattened++;
    }
  }
  return flattened;
}

interface GapOptions {
  H: number;
  climb: number;
  /** Radio del cierre (celdas): huecos, entrantes y rendijas de hasta 2·r de ancho. */
  r: number;
  maxHalfWidth: number;
  maxCells: number;
  probe: number;
  maxStep: number;
}

interface GapState {
  /** Niveles (celdas) ya rellenados por columna: dos superficies no rellenan dos veces el mismo hueco. */
  filled: Map<number, number[]>;
  quads: Array<{ c: number; top: number }>;
  relabeled: Set<number>;
  closedCells: number;
  holes: number;
  holeCells: number;
  open: Array<{ gx: number; gz: number; top: number; cells: number; halfWidth: number }>;
}

// Clases de celda frente al nivel de la superficie
const CELL_EMPTY = 0, CELL_FLOOR = 1, CELL_BLOCKED = 2, CELL_RELABEL = 3, CELL_VOID = 4;
// Huecos cerrados desde esta superficie (celdas) se informan para un parche manual
const MIN_REPORTED_HOLE = 50;

/**
 * Cierre morfológico del suelo de una superficie de confianza, consciente de alturas: se dilata el suelo r celdas
 * sobre columnas libres a su nivel (nada entre nivel − 1 y nivel + altura libre) y se erosiona r celdas desde el vacío
 * (lo que la dilatación no alcanzó, desniveles visibles y el borde del mapa). Los obstáculos no erosionan: un entrante
 * entre el suelo y una pared se cierra. Queda relleno lo angosto (rendijas entre trozos de escaneo, entrantes, huecos
 * pequeños) y no se extiende el borde exterior. Después, los huecos cerrados más anchos que el cierre se rellenan
 * enteros si caben en los límites y su borde es sobre todo suelo. Las celdas con un span no caminable a la altura del
 * suelo (ruido, losa vista desde abajo) pasan a caminables; las vacías reciben un relleno a la altura armónica de su
 * borde, siempre que ningún escalón supere maxStep.
 */
function closeGaps(g: SpanColumns, compSpans: Int32Array, colOf: Int32Array, o: GapOptions, st: GapState) {
  const { w, h, start, smin, smax, area } = g;
  let x0 = w, x1 = -1, z0 = h, z1 = -1;
  for (const i of compSpans) {
    const c = colOf[i], x = c % w, z = (c - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }
  const m = o.r + 2;
  const X0 = x0 - m, Z0 = z0 - m, W = x1 - x0 + 1 + 2 * m, D = z1 - z0 + 1 + 2 * m, N = W * D;
  const columnOf = (k: number) => {
    const lx = k % W, gx = X0 + lx, gz = Z0 + (k - lx) / W;
    return gx < 0 || gz < 0 || gx >= w || gz >= h ? -1 : gx + gz * w;
  };
  const queue = new Int32Array(N);
  let qh = 0, qt = 0;
  const level = new Int16Array(N).fill(-1);
  // Vecinas de la misma capa: la superficie puede subir por una escalera y pasar sobre sí misma
  const sameLayer = (k: number, kk: number) => Math.abs(level[k] - level[kk]) <= o.climb;
  const bfs = (dist: Int16Array, limit: number, through: (k: number) => boolean, dirs: number) => {
    while (qh < qt) {
      const k = queue[qh++];
      if (dist[k] >= limit) continue;
      const lx = k % W, lz = (k - lx) / W;
      for (let d = 0; d < dirs; d++) {
        const nx = lx + DIRS[d][0], nz = lz + DIRS[d][1];
        if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
        const kk = nx + nz * W;
        if (dist[kk] >= 0 || !through(kk) || !sameLayer(k, kk)) continue;
        dist[kk] = dist[k] + 1;
        queue[qt++] = kk;
      }
    }
  };

  // Nivel de referencia de cada celda: el del suelo de la superficie más cercano
  const seen = new Int16Array(N).fill(-1);
  for (const i of compSpans) {
    const c = colOf[i], x = c % w, z = (c - x) / w;
    const k = x - X0 + (z - Z0) * W;
    level[k] = smax[i];
    seen[k] = 0;
    queue[qt++] = k;
  }
  while (qh < qt) {
    const k = queue[qh++], lx = k % W, lz = (k - lx) / W;
    for (const [dx, dz] of DIRS) {
      const nx = lx + dx, nz = lz + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
      const kk = nx + nz * W;
      if (seen[kk] >= 0) continue;
      seen[kk] = 0;
      level[kk] = level[k];
      queue[qt++] = kk;
    }
  }

  const cls = new Uint8Array(N);
  const top = new Int16Array(N);
  const span = new Int32Array(N).fill(-1);
  for (let k = 0; k < N; k++) {
    const c = columnOf(k);
    if (c < 0) { cls[k] = CELL_VOID; continue; }
    const t = level[k];
    let floor = -1, cand = -1, blocked = false, drop = false;
    for (let j = start[c]; j < start[c + 1]; j++) {
      const tp = smax[j];
      if (tp >= t - o.climb && tp <= t + o.climb && g.clearance(c, j) >= o.H) {
        if (area[j] === AREA_WALKABLE) { floor = j; break; }
        if (tp >= t - 1) cand = j;
        continue;
      }
      if (smin[j] < t + o.H && tp >= t - 1) blocked = true;
      else if (area[j] === AREA_WALKABLE && tp < t - o.climb && tp >= t - o.probe) drop = true;
    }
    if (floor >= 0) { cls[k] = CELL_FLOOR; top[k] = smax[floor]; }
    else if (blocked) cls[k] = CELL_BLOCKED;
    else if (cand >= 0) { cls[k] = CELL_RELABEL; top[k] = smax[cand]; span[k] = cand; }
    else cls[k] = drop ? CELL_VOID : CELL_EMPTY;
  }
  const fillable = (k: number) => cls[k] === CELL_EMPTY || cls[k] === CELL_RELABEL;

  // Cierre: dilatación desde el suelo y erosión desde el vacío
  const distF = new Int16Array(N).fill(-1);
  qh = qt = 0;
  for (let k = 0; k < N; k++) if (cls[k] === CELL_FLOOR) { distF[k] = 0; queue[qt++] = k; }
  bfs(distF, o.r, fillable, 8);
  const distV = new Int16Array(N).fill(-1);
  qh = qt = 0;
  for (let k = 0; k < N; k++) {
    if (cls[k] === CELL_VOID || (fillable(k) && distF[k] < 0)) { distV[k] = 0; queue[qt++] = k; }
  }
  bfs(distV, o.r, k => distF[k] > 0, 8);
  const fill = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (distF[k] > 0 && distV[k] < 0) fill[k] = 1;

  // Huecos cerrados más anchos que el cierre
  const inRegion = new Uint8Array(N);
  const depth = new Int16Array(N).fill(-1);
  for (let k0 = 0; k0 < N; k0++) {
    if (!fillable(k0) || fill[k0] || inRegion[k0]) continue;
    const cells = [k0];
    inRegion[k0] = 1;
    let open = false, floorEdge = 0, wallEdge = 0, topSum = 0;
    for (let q = 0; q < cells.length; q++) {
      const k = cells[q], lx = k % W, lz = (k - lx) / W;
      if (lx === 0 || lz === 0 || lx === W - 1 || lz === D - 1) open = true;
      for (let d = 0; d < 4; d++) {
        const nx = lx + DIRS[d][0], nz = lz + DIRS[d][1];
        if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
        const kk = nx + nz * W;
        if (!sameLayer(k, kk)) { wallEdge++; continue; }
        if (fillable(kk) && !fill[kk]) {
          if (!inRegion[kk]) { inRegion[kk] = 1; cells.push(kk); }
        } else if (cls[kk] === CELL_VOID) open = true;
        else if (cls[kk] === CELL_FLOOR || fill[kk]) { floorEdge++; topSum += level[kk]; }
        else wallEdge++;
      }
    }
    if (open || !floorEdge) continue;
    const member = (kk: number) => fillable(kk) && !fill[kk];
    qh = qt = 0;
    for (const k of cells) {
      const lx = k % W, lz = (k - lx) / W;
      for (let d = 0; d < 4; d++) {
        const nx = lx + DIRS[d][0], nz = lz + DIRS[d][1];
        if (nx < 0 || nz < 0 || nx >= W || nz >= D || !member(nx + nz * W) || !sameLayer(k, nx + nz * W)) { depth[k] = 1; queue[qt++] = k; break; }
      }
    }
    bfs(depth, 0x7fff, member, 4);
    let halfWidth = 0;
    for (const k of cells) halfWidth = Math.max(halfWidth, depth[k]);
    if (cells.length <= o.maxCells && halfWidth <= o.maxHalfWidth && floorEdge >= 0.6 * (floorEdge + wallEdge)) {
      for (const k of cells) fill[k] = 2;
      st.holes++;
      st.holeCells += cells.length;
    } else if (cells.length >= MIN_REPORTED_HOLE) {
      let sx = 0, sz = 0;
      for (const k of cells) { const lx = k % W; sx += lx; sz += (k - lx) / W; }
      st.open.push({ gx: X0 + sx / cells.length, gz: Z0 + sz / cells.length, top: Math.round(topSum / floorEdge), cells: cells.length, halfWidth });
    }
  }

  // Alturas: armónicas entre el suelo del borde (fijo) y los spans que se marcarán caminables (fijos)
  const hgt = new Float32Array(N);
  const unknown: number[] = [];
  for (let k = 0; k < N; k++) {
    if (cls[k] === CELL_FLOOR || (fill[k] && cls[k] === CELL_RELABEL)) hgt[k] = top[k];
    else if (fill[k]) { hgt[k] = level[k]; unknown.push(k); }
  }
  const support = (k: number, kk: number) => (cls[kk] === CELL_FLOOR || fill[kk] > 0) && sameLayer(k, kk);
  for (let it = 0; it < 300 && unknown.length; it++) {
    let change = 0;
    for (const k of unknown) {
      const lx = k % W, lz = (k - lx) / W;
      let s = 0, n = 0;
      for (let d = 0; d < 4; d++) {
        const nx = lx + DIRS[d][0], nz = lz + DIRS[d][1];
        if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
        const kk = nx + nz * W;
        if (support(k, kk)) { s += hgt[kk]; n++; }
      }
      if (!n) continue;
      change = Math.max(change, Math.abs(s / n - hgt[k]));
      hgt[k] = s / n;
    }
    if (change < 0.02) break;
  }

  // Cada región de relleno se descarta entera si deja un escalón mayor que maxStep
  const done = new Uint8Array(N);
  for (let k0 = 0; k0 < N; k0++) {
    if (!fill[k0] || done[k0]) continue;
    const cells = [k0];
    done[k0] = 1;
    let steep = false;
    for (let q = 0; q < cells.length; q++) {
      const k = cells[q], lx = k % W, lz = (k - lx) / W;
      for (let d = 0; d < 4; d++) {
        const nx = lx + DIRS[d][0], nz = lz + DIRS[d][1];
        if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
        const kk = nx + nz * W;
        if (!support(k, kk)) continue;
        if (Math.abs(hgt[kk] - hgt[k]) > o.maxStep) steep = true;
        if (fill[kk] && !done[kk]) { done[kk] = 1; cells.push(kk); }
      }
    }
    if (steep) continue;
    for (const k of cells) {
      const c = columnOf(k);
      if (cls[k] === CELL_RELABEL) {
        if (st.relabeled.has(span[k])) continue;
        g.setArea(span[k], AREA_WALKABLE);
        st.relabeled.add(span[k]);
      } else {
        const t = Math.round(hgt[k]);
        const prev = st.filled.get(c);
        if (prev?.some(p => Math.abs(p - t) <= o.climb)) continue;
        if (prev) prev.push(t); else st.filled.set(c, [t]);
        st.quads.push({ c, top: t });
      }
      if (fill[k] === 1) st.closedCells++;
    }
  }
}

interface StairCluster { gx: number; gz: number; top: number; rise: number; cells: number; slopeDeg: number }

/**
 * Escaleras y rampas: el escaneo las deja con picos en los peldaños, huecos, peldaños fundidos y restos flotando encima.
 * recast las corta (cada pico es un obstáculo que la erosión agranda, cada hueco un borde) y flattenSpikes no las ve
 * porque el suelo de alrededor no está a una sola altura. Aquí cada suelo caminable ajusta un plano robusto en 1,1 m a
 * la redonda; los que suben entre 14° y 50° y forman una superficie que sube al menos 0,6 m son una escalera. Su planta
 * se cierra (picos y huecos de hasta ~0,6 m) y, en cada columna, la superficie pasa a la rampa ajustada: los peldaños
 * se recortan o se rellenan hasta ella y se quita lo que haya en la altura libre encima (picos, barandas fundidas,
 * basura), salvo pisos y descansos reales (suelos planos grandes) y otras escaleras.
 */
function rebuildStairs(g: SpanColumns, H: number, climb: number, cs: number, ch: number) {
  const { w, h, start, smin, smax, area } = g;
  const n = g.n;
  const colOf = g.columns();
  const walk = (i: number) => area[i] === AREA_WALKABLE;
  const perCell = cs / ch;
  const deg = Math.PI / 180;
  const tanMax = Math.tan(55 * deg) * perCell;
  const gMin = Math.tan(STAIR_MIN_SLOPE_DEG * deg) * perCell;
  const gMax = Math.tan(STAIR_MAX_SLOPE_DEG * deg) * perCell;
  const R = STAIR_FIT_R;
  const minSamples = Math.ceil(STAIR_MIN_SAMPLES * (2 * R + 1) ** 2);
  const fit = new Float32Array(n);
  const grad = new Float32Array(n);
  const cand = new Uint8Array(n);
  const sx = new Float32Array((2 * R + 1) ** 2), sz = new Float32Array(sx.length), sh = new Float32Array(sx.length);

  // Mínimos cuadrados h = a + b·x + c·z (Cramer)
  const plane = (m: number, keep: (k: number) => boolean): [number, number, number] | null => {
    let N = 0, X = 0, Z = 0, Y = 0, XX = 0, ZZ = 0, XZ = 0, XY = 0, ZY = 0;
    for (let k = 0; k < m; k++) {
      if (!keep(k)) continue;
      const x = sx[k], z = sz[k], y = sh[k];
      N++; X += x; Z += z; Y += y; XX += x * x; ZZ += z * z; XZ += x * z; XY += x * y; ZY += z * y;
    }
    if (N < minSamples) return null;
    const det = N * (XX * ZZ - XZ * XZ) - X * (X * ZZ - XZ * Z) + Z * (X * XZ - XX * Z);
    if (Math.abs(det) < 1e-9) return null;
    return [
      (Y * (XX * ZZ - XZ * XZ) - X * (XY * ZZ - XZ * ZY) + Z * (XY * XZ - XX * ZY)) / det,
      (N * (XY * ZZ - XZ * ZY) - Y * (X * ZZ - XZ * Z) + Z * (X * ZY - XY * Z)) / det,
      (N * (XX * ZY - XY * XZ) - X * (X * ZY - XY * Z) + Y * (X * XZ - XX * Z)) / det,
    ];
  };
  // Suelo caminable de la columna más cercano en altura a `top` (a lo sumo `lim` celdas), o -1
  const nearest = (nc: number, top: number, lim: number) => {
    let best = -1, bd = lim + 1;
    for (let k = start[nc]; k < start[nc + 1]; k++) {
      if (!walk(k)) continue;
      const d = Math.abs(smax[k] - top);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  };

  for (let i = 0; i < n; i++) {
    if (!walk(i)) continue;
    const c = colOf[i], x = c % w, z = (c - x) / w;
    // Atajo: con los cuatro puntos a R celdas casi a la misma altura es suelo plano
    let flat = true;
    for (let d = 0; d < 4 && flat; d++) {
      const nx = x + DIRS[d][0] * R, nz = z + DIRS[d][1] * R;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) { flat = false; break; }
      const k = nearest(nx + nz * w, smax[i], climb);
      flat = k >= 0 && Math.abs(smax[k] - smax[i]) <= 1;
    }
    if (flat) continue;
    let m = 0;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const k = nearest(nx + nz * w, smax[i], Math.ceil(Math.hypot(dx, dz) * tanMax) + 2);
      if (k < 0) continue;
      sx[m] = dx; sz[m] = dz; sh[m] = smax[k] - smax[i]; m++;
    }
    const first = plane(m, () => true);
    if (!first) continue;
    const p = plane(m, k => Math.abs(sh[k] - (first[0] + first[1] * sx[k] + first[2] * sz[k])) <= STAIR_OUTLIER) ?? first;
    const gr = Math.hypot(p[1], p[2]);
    if (gr < gMin || gr > gMax) continue;
    cand[i] = 1;
    fit[i] = smax[i] + p[0];
    grad[i] = gr;
  }

  // Suelos planos grandes que no son escalera (pisos, descansos, la losa de arriba): nunca se recortan ni se quitan
  const protectedSpan = new Uint8Array(n);
  const flatLabel = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  for (let i0 = 0; i0 < n; i0++) {
    if (!walk(i0) || cand[i0] || flatLabel[i0] >= 0) continue;
    let qh = 0, qt = 0;
    queue[qt++] = i0;
    flatLabel[i0] = i0;
    while (qh < qt) {
      const i = queue[qh++], c = colOf[i], x = c % w, z = (c - x) / w;
      for (let d = 0; d < 4; d++) {
        const nx = x + DIRS[d][0], nz = z + DIRS[d][1];
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        const nc = nx + nz * w;
        for (let k = start[nc]; k < start[nc + 1]; k++) {
          if (flatLabel[k] >= 0 || !walk(k) || cand[k] || Math.abs(smax[k] - smax[i]) > 1) continue;
          flatLabel[k] = i0;
          queue[qt++] = k;
        }
      }
    }
    if (qt >= PROTECTED_FLOOR_CELLS) for (let q = 0; q < qt; q++) protectedSpan[queue[q]] = 1;
  }

  // Superficie en 2,5D: una columna puede tener varias (tramos uno encima de otro en la caja de escalera)
  const nCol: number[] = [], nH: number[] = [], nFit: number[] = [], nW: number[] = [], nMember: number[] = [], nGrad: number[] = [], nBorn: number[] = [];
  const nRegion: number[] = [];
  const alive: number[] = [];
  const byCol = new Map<number, number[]>();
  const find = (c: number, top: number) => {
    let best = -1, bd = climb + 1e-6;
    for (const v of byCol.get(c) ?? []) {
      if (!alive[v]) continue;
      const d = Math.abs(nH[v] - top);
      if (d <= bd) { bd = d; best = v; }
    }
    return best;
  };
  const add = (c: number, top: number, member: number, gr: number, born: number) => {
    const v = nCol.length;
    nCol.push(c); nH.push(top); nFit.push(top); nW.push(1); nMember.push(member); nGrad.push(gr); nBorn.push(born); nRegion.push(-1); alive.push(1);
    const list = byCol.get(c);
    if (list) list.push(v); else byCol.set(c, [v]);
    return v;
  };
  for (let i = 0; i < n; i++) {
    if (!cand[i]) continue;
    const v = find(colOf[i], fit[i]);
    if (v >= 0) {
      // El cuerpo y la cara de un mismo peldaño: una sola superficie
      nFit[v] = (nFit[v] * nW[v] + fit[i]) / (nW[v] + 1);
      nH[v] = nFit[v];
      nW[v]++;
    } else add(colOf[i], fit[i], 1, grad[i], -1);
  }
  const neighbor = (v: number, d: number) => {
    const c = nCol[v], x = c % w + DIRS[d][0], z = (c - c % w) / w + DIRS[d][1];
    return x < 0 || z < 0 || x >= w || z >= h ? -1 : x + z * w;
  };
  // Cierre: dilatar K columnas (altura = media de quien la propone) y erosionar K solo lo añadido
  const K = STAIR_CLOSE;
  const wallCells = Math.round(STAIR_WALL_M / ch);
  const hasWall = (c: number, top: number) => {
    for (let k = start[c]; k < start[c + 1]; k++) if (smin[k] <= top + climb && smax[k] >= top + wallCells) return true;
    return false;
  };
  for (let it = 0; it < K; it++) {
    const count = nCol.length;
    for (let v = 0; v < count; v++) {
      if (!alive[v]) continue;
      for (let d = 0; d < 8; d++) {
        const nc = neighbor(v, d);
        if (nc < 0) continue;
        const u = find(nc, nH[v]);
        if (u >= 0) {
          if (!nMember[u] && nBorn[u] === it) {
            nH[u] = (nH[u] * nW[u] + nH[v]) / (nW[u] + 1);
            nFit[u] = nH[u];
            nW[u]++;
          }
          continue;
        }
        if (hasWall(nc, nH[v])) continue;
        add(nc, nH[v], 0, 0, it);
      }
    }
  }
  for (let it = 0; it < K; it++) {
    const dead: number[] = [];
    for (let v = 0; v < nCol.length; v++) {
      if (!alive[v] || nMember[v]) continue;
      for (let d = 0; d < 8; d++) {
        const nc = neighbor(v, d);
        if (nc < 0 || find(nc, nH[v]) < 0) { dead.push(v); break; }
      }
    }
    for (const v of dead) alive[v] = 0;
  }

  // Escaleras: superficies (ya cerradas) que suben lo suficiente y llegan a un suelo abajo y a otro arriba; un montón
  // de basura inclinado solo toca el de abajo
  const stats: Array<{ lo: number; hi: number; grad: number }> = [];
  const comp = new Int32Array(nCol.length).fill(-1);
  const nodeQueue = new Int32Array(nCol.length);
  const realFloor = (c: number, top: number) => {
    for (let k = start[c]; k < start[c + 1]; k++) if (walk(k) && !cand[k] && Math.abs(smax[k] - top) <= climb) return true;
    return false;
  };
  for (let v0 = 0; v0 < nCol.length; v0++) {
    if (!alive[v0] || comp[v0] >= 0) continue;
    let qh = 0, qt = 0;
    nodeQueue[qt++] = v0;
    comp[v0] = v0;
    let lo = Infinity, hi = -Infinity, gsum = 0, members = 0;
    while (qh < qt) {
      const v = nodeQueue[qh++];
      lo = Math.min(lo, nH[v]);
      hi = Math.max(hi, nH[v]);
      if (nMember[v]) { gsum += nGrad[v]; members++; }
      for (let d = 0; d < 8; d++) {
        const nc = neighbor(v, d);
        const u = nc < 0 ? -1 : find(nc, nH[v]);
        if (u < 0 || comp[u] >= 0) continue;
        comp[u] = v0;
        nodeQueue[qt++] = u;
      }
    }
    let low = false, high = false;
    for (let q = 0; q < qt && !(low && high); q++) {
      const v = nodeQueue[q];
      const nearLow = nH[v] <= lo + climb, nearHigh = nH[v] >= hi - climb;
      if (!nearLow && !nearHigh) continue;
      for (let d = 0; d < 8; d++) {
        const nc = neighbor(v, d);
        if (nc < 0 || !realFloor(nc, nH[v])) continue;
        if (nearLow) low = true;
        if (nearHigh) high = true;
      }
    }
    const keep = (hi - lo) * ch >= STAIR_MIN_RISE_M && qt * cs * cs >= STAIR_MIN_AREA_M2 && low && high && members > 0;
    for (let q = 0; q < qt; q++) {
      const v = nodeQueue[q];
      if (keep) nRegion[v] = stats.length; else alive[v] = 0;
    }
    if (keep) stats.push({ lo, hi, grad: gsum / members });
  }

  // Suavizado con los pisos de alrededor como borde: la rampa empalma con el descanso y el piso sin escalón
  const links: number[][] = [];
  const border: number[] = [], borderN: number[] = [];
  for (let v = 0; v < nCol.length; v++) {
    const list: number[] = [];
    let bs = 0, bn = 0;
    if (alive[v]) {
      for (let d = 0; d < 4; d++) {
        const nc = neighbor(v, d);
        if (nc < 0) continue;
        const u = find(nc, nH[v]);
        if (u >= 0) { list.push(u); continue; }
        const k = nearest(nc, nH[v], climb);
        if (k >= 0) { bs += smax[k]; bn++; }
      }
    }
    links.push(list);
    border.push(bs);
    borderN.push(bn);
  }
  let cur = Float64Array.from(nH);
  for (let it = 0; it < STAIR_SMOOTH_ITERS; it++) {
    const next = cur.slice();
    for (let v = 0; v < nCol.length; v++) {
      if (!alive[v]) continue;
      const lambda = nMember[v] ? STAIR_DATA_WEIGHT : 0;
      let sum = lambda * nFit[v] + border[v], cnt = lambda + borderN[v];
      for (const u of links[v]) { sum += cur[u]; cnt++; }
      if (cnt > 0) next[v] = sum / cnt;
    }
    cur = next;
  }

  // Cada columna toma sus superficies: el suelo más cercano pasa a la rampa, lo de encima (picos, basura) se quita
  const quads: Array<{ c: number; top: number }> = [];
  const cells = new Array<number>(stats.length).fill(0);
  const sumX = new Array<number>(stats.length).fill(0), sumZ = new Array<number>(stats.length).fill(0);
  for (const [c, list] of byCol) {
    const surfaces = list.filter(v => alive[v]).map(v => ({ s: Math.round(cur[v]), r: nRegion[v] }))
      .sort((a, b) => a.s - b.s)
      .filter((e, i, arr) => i === 0 || e.s - arr[i - 1].s > climb);
    if (!surfaces.length) continue;
    const S = surfaces.map(e => e.s);
    const floorOf = new Map<number, number>();
    const action = new Int8Array(start[c + 1] - start[c]); // 0 = se queda, 1 = suelo, 2 = se quita
    for (let k = start[c]; k < start[c + 1]; k++) {
      const a = k - start[c];
      if (protectedSpan[k]) continue;
      let j = -1;
      for (let q = 0; q < S.length; q++) if (Math.abs(smax[k] - S[q]) <= climb && (j < 0 || Math.abs(smax[k] - S[q]) < Math.abs(smax[k] - S[j]))) j = q;
      if (j < 0) for (let q = 0; q < S.length && j < 0; q++) if (smin[k] < S[q] - climb && smax[k] > S[q] + climb) j = q;
      if (j >= 0) {
        // El más alto de los que caen en esa superficie es su suelo; los demás, si son delgados, sobran
        const prev = floorOf.get(j);
        if (prev !== undefined) action[prev - start[c]] = smin[prev] >= S[j] - climb ? 2 : 0;
        floorOf.set(j, k);
        action[a] = 1;
      } else if (S.some(s => smin[k] <= s + H && smax[k] > s + climb)) {
        action[a] = 2;
      }
    }
    const done = new Set<number>();
    for (const [j, k] of floorOf) {
      if (action[k - start[c]] !== 1) continue;
      let above = Infinity;
      for (let q = k + 1; q < start[c + 1]; q++) if (action[q - start[c]] !== 2) { above = smin[q]; break; }
      const top = Math.min(S[j], above - 1);
      if (top <= smin[k]) { action[k - start[c]] = 2; continue; }
      g.setTop(k, top);
      g.setArea(k, AREA_WALKABLE);
      done.add(j);
    }
    for (let k = start[c]; k < start[c + 1]; k++) {
      const a = k - start[c];
      if (protectedSpan[k]) {
        for (let j = 0; j < S.length; j++) if (Math.abs(smax[k] - S[j]) <= climb) done.add(j);
      } else if (action[a] === 2) g.unlink(c, k);
    }
    for (let j = 0; j < S.length; j++) {
      if (!done.has(j)) quads.push({ c, top: S[j] });
      const r = surfaces[j].r;
      cells[r]++;
      sumX[r] += c % w;
      sumZ[r] += (c - c % w) / w;
    }
  }
  const regions: StairCluster[] = stats.map((st, r) => ({
    gx: Math.round(sumX[r] / Math.max(1, cells[r])), gz: Math.round(sumZ[r] / Math.max(1, cells[r])),
    top: (st.lo + st.hi) / 2, rise: st.hi - st.lo, cells: cells[r],
    slopeDeg: Math.atan(st.grad / perCell) / deg,
  }));
  return { quads, regions };
}

function fillGeometry(g: SpanColumns, fills: Array<{ c: number; top: number }>, bmin: number[], cs: number, ch: number) {
  const e = cs * 0.01;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const { c, top } of fills) {
    const x = c % g.w, z = (c - x) / g.w;
    const x0 = bmin[0] + x * cs + e, x1 = bmin[0] + (x + 1) * cs - e;
    const z0 = bmin[2] + z * cs + e, z1 = bmin[2] + (z + 1) * cs - e;
    const y = bmin[1] + (top - 0.5) * ch;
    const v = pos.length / 3;
    pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
    // Normal hacia arriba según recast (calcTriNormal)
    idx.push(v, v + 3, v + 2, v, v + 2, v + 1);
  }
  return { positions: pos, indices: idx };
}

function markBlocked(ctx: RecastBuildContext, chf: ReturnType<typeof allocCompactHeightfield>, b: BlockedArea) {
  if (b.points.length < 3) return;
  const va = new VerticesArray();
  try {
    va.copy(new Float32Array(b.points.flatMap(p => [p.x, p.y, p.z])));
    markConvexPolyArea(ctx, va, b.points.length, b.hmin, b.hmax, Recast.RC_NULL_AREA, chf);
  } finally {
    va.destroy();
  }
}

export function generateNavMesh(
  positions: Float32Array,
  rawIndices: Uint32Array,
  connections: OffMeshConnection[],
  s: WalkerSettings,
  detail: DetailSettings,
  repair: RepairSettings = DEFAULT_REPAIR,
  blocked: BlockedArea[] = [],
): { navMesh: NavMesh; report: BuildReport } {
  const ms: Record<string, number> = {};
  let t0 = performance.now();
  const lap = (name: string) => { const t = performance.now(); ms[name] = Math.round(t - t0); t0 = t; };
  const cells = walkerCells(s);
  const { cellSize: cs, cellHeight: ch } = s;
  const cellArea = cs * cs;
  const report: BuildReport = {
    triangles: rawIndices.length / 3, droppedTriangles: 0, repaired: false, floaters: { clusters: 0, spans: 0 }, flipped: false,
    invertedFloorM2: 0, invertedRejectedM2: 0, spikes: 0, gapsClosedM2: 0, holesFilled: 0, holesFilledM2: 0, openHoles: [], stairs: [], ms,
  };

  const clean = sanitize(positions, rawIndices);
  report.droppedTriangles = clean.dropped;
  if (!clean.indices.length) throw new Error('No hay triángulos válidos para generar el navmesh');
  const { bmin, bmax } = clean;
  const ctx = new RecastBuildContext();
  const grid = calcGridSize(bmin as [number, number, number], bmax as [number, number, number], cs);
  const hf = allocHeightfield();
  let hfAlive = true;
  let chf: ReturnType<typeof allocCompactHeightfield> | null = null;
  let cset: ReturnType<typeof allocContourSet> | null = null;
  let pmesh: ReturnType<typeof allocPolyMesh> | null = null;
  let dmesh: ReturnType<typeof allocPolyMeshDetail> | null = null;
  try {
    if (!createHeightfield(ctx, hf, grid.width, grid.height, bmin as [number, number, number], bmax as [number, number, number], cs, ch)) {
      throw new Error('No se pudo crear el heightfield');
    }
    const areas = triangleAreas(positions, clean.indices, s.walkableSlopeAngle, repair.orientation);
    rasterize(ctx, hf, positions, clean.indices, areas, cells.climb);
    lap('rasterize');

    let g: SpanColumns | null = null;
    try {
      g = new SpanColumns(hf);
    } catch {
      g = null;
    }
    if (g) {
      report.repaired = true;
      if (repair.floaterMaxArea > 0) {
        report.floaters = removeFloaters(g, Math.round(repair.floaterMaxArea / cellArea), Math.round(0.6 / ch));
        g.read();
        lap('floaters');
      }
      if (repair.orientation && detectFlip(g, cells.height)) {
        flipOrientation(g);
        report.flipped = true;
      }
      const colOf = g.columns();
      const surfaces = classifySurfaces(g, colOf, cells.height, cells.climb, Math.round(TRUSTED_FLOOR_M2 / cellArea), Math.round(CEILING_PROBE_M / ch));
      report.invertedFloorM2 = +(surfaces.accepted * cellArea).toFixed(1);
      report.invertedRejectedM2 = +(surfaces.rejected * cellArea).toFixed(1);
      lap('orientation');
      if (repair.spikeMaxArea > 0) {
        report.spikes = flattenSpikes(g, cells.height, cells.climb, Math.max(1, Math.round(repair.spikeMaxArea / cellArea)), Math.round(SPIKE_MAX_RISE_M / ch));
        lap('spikes');
      }
      if (repair.gapMaxWidth > 0 || repair.holeMaxWidth > 0) {
        const st: GapState = { filled: new Map(), quads: [], relabeled: new Set(), closedCells: 0, holes: 0, holeCells: 0, open: [] };
        const opts: GapOptions = {
          H: cells.height,
          climb: cells.climb,
          r: Math.max(0, Math.round(repair.gapMaxWidth / cs / 2)),
          maxHalfWidth: Math.round(repair.holeMaxWidth / cs / 2),
          maxCells: Math.round(repair.holeMaxArea / cellArea),
          probe: Math.round(repair.holeDropProbe / ch),
          maxStep: cells.climb,
        };
        for (const comp of surfaces.trustedComps) closeGaps(g, comp, colOf, opts, st);
        if (st.quads.length) {
          const fill = fillGeometry(g, st.quads, bmin, cs, ch);
          rasterize(ctx, hf, fill.positions, fill.indices, new Uint8Array(fill.indices.length / 3).fill(AREA_WALKABLE), cells.climb);
        }
        report.gapsClosedM2 = +(st.closedCells * cellArea).toFixed(1);
        report.holesFilled = st.holes;
        report.holesFilledM2 = +(st.holeCells * cellArea).toFixed(1);
        report.openHoles = st.open
          .sort((a, b) => b.cells - a.cells)
          .slice(0, 20)
          .map(o => ({
            x: +(bmin[0] + (o.gx + 0.5) * cs).toFixed(2),
            y: +(bmin[1] + o.top * ch).toFixed(2),
            z: +(bmin[2] + (o.gz + 0.5) * cs).toFixed(2),
            areaM2: +(o.cells * cellArea).toFixed(1),
            widthM: +(o.halfWidth * 2 * cs).toFixed(1),
          }));
        lap('gaps');
      }
      if (repair.stairs) {
        g.read();
        const stairs = rebuildStairs(g, cells.height, cells.climb, cs, ch);
        if (stairs.quads.length) {
          const fill = fillGeometry(g, stairs.quads, bmin, cs, ch);
          rasterize(ctx, hf, fill.positions, fill.indices, new Uint8Array(fill.indices.length / 3).fill(AREA_WALKABLE), cells.climb);
        }
        report.stairs = stairs.regions.map(r => ({
          x: +(bmin[0] + (r.gx + 0.5) * cs).toFixed(2),
          y: +(bmin[1] + r.top * ch).toFixed(2),
          z: +(bmin[2] + (r.gz + 0.5) * cs).toFixed(2),
          riseM: +(r.rise * ch).toFixed(2),
          areaM2: +(r.cells * cellArea).toFixed(1),
          slopeDeg: Math.round(r.slopeDeg),
        }));
        lap('stairs');
      }
    }

    filterLowHangingWalkableObstacles(ctx, cells.climb, hf);
    filterLedgeSpans(ctx, cells.height, cells.climb, hf);
    filterWalkableLowHeightSpans(ctx, cells.height, hf);
    chf = allocCompactHeightfield();
    if (!buildCompactHeightfield(ctx, cells.height, cells.climb, hf, chf)) throw new Error('No se pudo compactar el heightfield');
    freeHeightfield(hf);
    hfAlive = false;
    lap('filter');
    if (!erodeWalkableArea(ctx, cells.radius, chf)) throw new Error('No se pudo erosionar el área caminable');
    // Tras la erosión, como los volúmenes de RecastDemo: el corte queda exacto y no se come el pasillo de al lado
    for (const b of blocked) markBlocked(ctx, chf, b);
    if (!buildDistanceField(ctx, chf)) throw new Error('No se pudo calcular el campo de distancias');
    if (!buildRegions(ctx, chf, 0, 8 * 8, 20 * 20)) throw new Error('No se pudieron construir las regiones');
    lap('regions');
    cset = allocContourSet();
    if (!buildContours(ctx, chf, 1.3, 12, cset, Recast.RC_CONTOUR_TESS_WALL_EDGES)) throw new Error('No se pudieron trazar los contornos');
    pmesh = allocPolyMesh();
    if (!buildPolyMesh(ctx, cset, 6, pmesh)) throw new Error('No se pudieron triangular los contornos');
    dmesh = allocPolyMeshDetail();
    const sampleDist = detail.detailSampleDist < 0.9 ? 0 : cs * detail.detailSampleDist;
    if (!buildPolyMeshDetail(ctx, pmesh, chf, sampleDist, ch * detail.detailSampleMaxError, dmesh)) throw new Error('No se pudo construir el detalle de alturas');
    lap('polymesh');

    for (let i = 0; i < pmesh.npolys(); i++) {
      if (pmesh.areas(i) === Recast.RC_WALKABLE_AREA) pmesh.setAreas(i, 0);
      if (pmesh.areas(i) === 0) pmesh.setFlags(i, 1);
    }
    const params = new NavMeshCreateParams();
    params.setPolyMeshCreateParams(pmesh);
    params.setPolyMeshDetailCreateParams(dmesh);
    params.setWalkableHeight(cells.height * ch);
    params.setWalkableRadius(cells.radius * cs);
    params.setWalkableClimb(cells.climb * ch);
    params.setCellSize(cs);
    params.setCellHeight(ch);
    params.setBuildBvTree(true);
    if (connections.length) params.setOffMeshConnections(connections);
    const created = createNavMeshData(params);
    if (!created.success) throw new Error('No se pudieron crear los datos de Detour');
    const navMesh = new NavMesh();
    if (!navMesh.initSolo(created.navMeshData)) {
      created.navMeshData.destroy();
      throw new Error('No se pudo inicializar el navmesh');
    }
    lap('detour');
    return { navMesh, report };
  } finally {
    if (hfAlive) freeHeightfield(hf);
    if (chf) freeCompactHeightfield(chf);
    if (cset) freeContourSet(cset);
    if (pmesh) freePolyMesh(pmesh);
    if (dmesh) freePolyMeshDetail(dmesh);
  }
}
