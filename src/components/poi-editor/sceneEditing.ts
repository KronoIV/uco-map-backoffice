import * as THREE from 'three';
import type { ArPoint, ScanEditMesh } from '../../types';
import type { NavMeshPreview } from '../../utils/navmesh';
import { meshKey, planArea, toRanges } from '../../utils/mapEdits';

export type EditMode = 'none' | 'model' | 'nav';
/** Modelo: fragmento, pincel, área. Malla: polígono, área, corte de paso. */
export type EditTool = 'fragment' | 'brush' | 'box' | 'poly' | 'barrier';

/** Naranja = modelo 3D, azul = malla de navegación: el mismo color en el panel, la barra del visor y el marco. */
export const MODE_COLORS = { model: '#ef6c00', nav: '#0277bd' } as const;

export interface SelectionSummary {
  model: { triangles: number; areaM2: number; center: ArPoint | null; truncated: boolean };
  nav: { polys: number; areaM2: number; center: ArPoint | null; connections: string[]; blocks: string[] };
}

export const EMPTY_SELECTION: SelectionSummary = {
  model: { triangles: 0, areaM2: 0, center: null, truncated: false },
  nav: { polys: 0, areaM2: 0, center: null, connections: [], blocks: [] },
};

/** Edición guardada o pendiente que el visor aplica al escaneo. */
export interface ViewerScanEdit {
  key: string;
  meshes: ScanEditMesh[];
}

export interface ScreenRect { x0: number; y0: number; x1: number; y1: number }

// Un fragmento conectado no crece más allá de esto aunque el alcance sea grande (todo el edificio está unido)
const MAX_FRAGMENT_TRIS = 400_000;
// Vértices a menos de 1 mm son el mismo (el GLB los separa en las costuras de textura)
const WELD_SCALE = 1000;

const round3 = (v: number) => Math.round(v * 1000) / 1000;

interface Adjacency {
  weld: Uint32Array;
  start: Uint32Array;
  tris: Uint32Array;
}

/** Malla del escaneo editable: índice original, triángulos quitados y seleccionados. */
interface EditMesh {
  key: string;
  map: string;
  ordinal: number;
  mesh: THREE.Mesh;
  original: Uint32Array;
  groups: { start: number; count: number; materialIndex?: number }[];
  triCount: number;
  removed: Uint8Array;
  /** Triángulo original de cada triángulo del índice actual (faceIndex del raycast). */
  current: Uint32Array | null;
  selected: Uint8Array;
  selCount: number;
  selArea: number;
  selSum: [number, number, number];
  centroids?: Float32Array;
  areas?: Float32Array;
  box?: THREE.Box3;
  adjacency?: Adjacency;
  selOverlay?: THREE.Mesh;
  ghostOverlay?: THREE.Mesh;
}

/** Profundidad del modelo vista desde la cámara, leída una vez: punto 3D bajo el cursor y prueba de visibilidad. */
export class DepthSnapshot {
  readonly width: number;
  readonly height: number;
  readonly cssWidth: number;
  readonly cssHeight: number;
  private readonly data: Uint8Array;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly signature: string;

  constructor(data: Uint8Array, width: number, height: number, cssWidth: number, cssHeight: number, camera: THREE.PerspectiveCamera) {
    this.data = data;
    this.width = width;
    this.height = height;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.camera = camera.clone();
    this.signature = DepthSnapshot.signatureOf(camera, cssWidth, cssHeight);
  }

  static signatureOf(camera: THREE.PerspectiveCamera, w: number, h: number) {
    camera.updateMatrixWorld();
    return `${camera.matrixWorld.elements.map(v => v.toFixed(5)).join(',')}|${camera.projectionMatrix.elements.map(v => v.toFixed(5)).join(',')}|${w}x${h}`;
  }

  matches(camera: THREE.PerspectiveCamera, w: number, h: number) {
    return this.signature === DepthSnapshot.signatureOf(camera, w, h);
  }

  /** Profundidad (0–1) en un píxel del buffer; null si no hay modelo. */
  private depthAtPixel(px: number, py: number): number | null {
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return null;
    const i = ((this.height - 1 - py) * this.width + px) * 4;
    const d = this.data;
    // packDepthToRGBA de three (r170): byte más significativo en R
    const depth = d[i] / 256 + d[i + 1] / 65536 + d[i + 2] / 16777216 + d[i + 3] / (255 * 16777216);
    return depth >= 0.999999 ? null : depth;
  }

  private viewZ(depth: number) {
    const { near, far } = this.camera;
    return (near * far) / ((far - near) * depth - far);
  }

  /** Punto del modelo bajo (x, y) en píxeles CSS del lienzo. */
  worldAt(x: number, y: number): THREE.Vector3 | null {
    const px = Math.floor((x / this.cssWidth) * this.width);
    const py = Math.floor((y / this.cssHeight) * this.height);
    const depth = this.depthAtPixel(px, py);
    if (depth === null) return null;
    return new THREE.Vector3((x / this.cssWidth) * 2 - 1, -(y / this.cssHeight) * 2 + 1, depth * 2 - 1).unproject(this.camera);
  }

  /** Si un punto con NDC (nx, ny) y profundidad de vista vz es lo primero que se ve (±tolerancia). */
  visibleNdc(nx: number, ny: number, vz: number, tolerance: number) {
    const px = Math.floor(((nx + 1) / 2) * this.width);
    const py = Math.floor(((1 - ny) / 2) * this.height);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const depth = this.depthAtPixel(px + dx, py + dy);
        if (depth === null) return true;
        if (this.viewZ(depth) - vz <= tolerance + Math.abs(vz) * 0.01) return true;
      }
    }
    return false;
  }
}

/** Proyecta puntos del mundo a NDC con la cámara actual, sin crear vectores. */
class Projector {
  private readonly m: number[];
  private readonly v: number[];

  constructor(camera: THREE.PerspectiveCamera) {
    camera.updateMatrixWorld();
    this.m = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements;
    this.v = camera.matrixWorldInverse.elements;
  }

  /** [nx, ny, viewZ] o null si queda detrás de la cámara. */
  project(x: number, y: number, z: number, out: [number, number, number]): boolean {
    const m = this.m;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 1e-6) return false;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    const v = this.v;
    out[2] = v[2] * x + v[6] * y + v[10] * z + v[14];
    return true;
  }
}

function inRect(nx: number, ny: number, r: ScreenRect) {
  return nx >= r.x0 && nx <= r.x1 && ny >= r.y0 && ny <= r.y1;
}

/** Selección y borrado de triángulos del escaneo sin tocar el GLB: se cambia el índice que se dibuja y entra a recast. */
export class ModelEditing {
  private readonly root: THREE.Group;
  private readonly clipPlane: THREE.Plane;
  private readonly meshes = new Map<string, EditMesh>();
  private readonly byMesh = new WeakMap<THREE.Object3D, EditMesh>();
  private edits: ViewerScanEdit[] = [];
  private showRemoved = false;
  truncated = false;
  readonly selMat = new THREE.MeshBasicMaterial({
    color: 0xff6d00, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  readonly ghostMat = new THREE.MeshBasicMaterial({
    color: 0xff1744, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide,
  });

  constructor(root: THREE.Group, clipPlane: THREE.Plane) {
    this.root = root;
    this.clipPlane = clipPlane;
    this.selMat.clippingPlanes = [clipPlane];
    this.ghostMat.clippingPlanes = [clipPlane];
  }

  /** Registra las mallas de un mapa recién cargado, en el orden del GLB (luego hay que volver a aplicar las ediciones). */
  register(map: string, scene: THREE.Object3D) {
    scene.updateMatrixWorld(true);
    let ordinal = 0;
    scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      const pos = mesh.isMesh ? mesh.geometry.getAttribute('position') : undefined;
      if (!pos || pos.itemSize !== 3) return;
      const geo = mesh.geometry;
      const original = geo.index
        ? Uint32Array.from(geo.index.array as ArrayLike<number>)
        : Uint32Array.from({ length: pos.count }, (_, i) => i);
      const triCount = Math.floor(original.length / 3);
      const em: EditMesh = {
        key: meshKey(map, ordinal++),
        map,
        ordinal: ordinal - 1,
        mesh,
        original,
        groups: geo.groups.map(g => ({ ...g })),
        triCount,
        removed: new Uint8Array(triCount),
        current: null,
        selected: new Uint8Array(triCount),
        selCount: 0,
        selArea: 0,
        selSum: [0, 0, 0],
      };
      if (!geo.index) geo.setIndex(new THREE.BufferAttribute(original.slice(), 1));
      this.meshes.set(em.key, em);
      this.byMesh.set(mesh, em);
    });
  }

  unregister(map: string) {
    for (const [key, em] of this.meshes) {
      if (em.map !== map) continue;
      this.disposeOverlay(em, 'selOverlay');
      this.disposeOverlay(em, 'ghostOverlay');
      this.meshes.delete(key);
    }
  }

  /** Cambia la lista de ediciones activas; devuelve las que no casan con su malla (mapa reprocesado). */
  setEdits(edits: ViewerScanEdit[]): string[] {
    this.edits = edits;
    return this.applyEdits();
  }

  setShowRemoved(show: boolean) {
    this.showRemoved = show;
    for (const em of this.meshes.values()) this.updateGhost(em);
  }

  private applyEdits(): string[] {
    const mismatched = new Set<string>();
    const masks = new Map<string, Uint8Array>();
    for (const em of this.meshes.values()) masks.set(em.key, new Uint8Array(em.triCount));
    for (const edit of this.edits) {
      for (const m of edit.meshes) {
        const key = meshKey(m.map, m.mesh);
        const mask = masks.get(key);
        const em = this.meshes.get(key);
        if (!mask || !em) continue;
        if (em.triCount !== m.triangles) { mismatched.add(edit.key); continue; }
        for (let i = 0; i + 1 < m.ranges.length; i += 2) mask.fill(1, m.ranges[i], Math.min(em.triCount, m.ranges[i] + m.ranges[i + 1]));
      }
    }
    for (const [key, mask] of masks) {
      const em = this.meshes.get(key)!;
      let same = true;
      for (let t = 0; t < em.triCount && same; t++) same = mask[t] === em.removed[t];
      if (same) continue;
      em.removed = mask;
      this.rebuildIndex(em);
      let changedSel = false;
      for (let t = 0; t < em.triCount; t++) {
        if (em.selected[t] && mask[t]) { this.setSelected(em, t, false); changedSel = true; }
      }
      if (changedSel) this.updateSelOverlay(em);
      this.updateGhost(em);
    }
    return [...mismatched];
  }

  private rebuildIndex(em: EditMesh) {
    const { original, removed, triCount } = em;
    let kept = 0;
    for (let t = 0; t < triCount; t++) if (!removed[t]) kept++;
    const index = new Uint32Array(kept * 3);
    const current = new Uint32Array(kept);
    const geo = em.mesh.geometry;
    const ranges = em.groups.length ? em.groups : [{ start: 0, count: triCount * 3 }];
    const groups: { start: number; count: number; materialIndex?: number }[] = [];
    let k = 0;
    for (const g of ranges) {
      const from = k;
      for (let t = Math.floor(g.start / 3), end = Math.floor((g.start + g.count) / 3); t < end && t < triCount; t++) {
        if (removed[t]) continue;
        index[k * 3] = original[t * 3];
        index[k * 3 + 1] = original[t * 3 + 1];
        index[k * 3 + 2] = original[t * 3 + 2];
        current[k++] = t;
      }
      groups.push({ start: from * 3, count: (k - from) * 3, materialIndex: (g as { materialIndex?: number }).materialIndex });
    }
    geo.setIndex(new THREE.BufferAttribute(k === kept ? index : index.slice(0, k * 3), 1));
    if (em.groups.length) {
      geo.clearGroups();
      for (const g of groups) geo.addGroup(g.start, g.count, g.materialIndex);
    }
    em.current = k === kept ? current : current.slice(0, k);
  }

  private ensureGeometry(em: EditMesh) {
    if (em.centroids) return;
    const pos = em.mesh.geometry.getAttribute('position');
    const mw = em.mesh.matrixWorld;
    const c = new Float32Array(em.triCount * 3);
    const areas = new Float32Array(em.triCount);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
    const box = new THREE.Box3();
    for (let t = 0; t < em.triCount; t++) {
      a.fromBufferAttribute(pos, em.original[t * 3]).applyMatrix4(mw);
      b.fromBufferAttribute(pos, em.original[t * 3 + 1]).applyMatrix4(mw);
      d.fromBufferAttribute(pos, em.original[t * 3 + 2]).applyMatrix4(mw);
      c[t * 3] = (a.x + b.x + d.x) / 3;
      c[t * 3 + 1] = (a.y + b.y + d.y) / 3;
      c[t * 3 + 2] = (a.z + b.z + d.z) / 3;
      b.sub(a);
      d.sub(a);
      areas[t] = b.cross(d).length() / 2;
      box.expandByPoint(a.set(c[t * 3], c[t * 3 + 1], c[t * 3 + 2]));
    }
    em.centroids = c;
    em.areas = areas;
    em.box = box;
  }

  /** Vértices soldados por posición y, por cada uno, sus triángulos: para crecer un fragmento conectado. */
  private ensureAdjacency(em: EditMesh): Adjacency {
    if (em.adjacency) return em.adjacency;
    const pos = em.mesh.geometry.getAttribute('position');
    const n = pos.count;
    const q = new Int32Array(n * 3);
    for (let i = 0; i < n; i++) {
      q[i * 3] = Math.round(pos.getX(i) * WELD_SCALE);
      q[i * 3 + 1] = Math.round(pos.getY(i) * WELD_SCALE);
      q[i * 3 + 2] = Math.round(pos.getZ(i) * WELD_SCALE);
    }
    const order = new Uint32Array(n);
    for (let i = 0; i < n; i++) order[i] = i;
    order.sort((a, b) => q[a * 3] - q[b * 3] || q[a * 3 + 1] - q[b * 3 + 1] || q[a * 3 + 2] - q[b * 3 + 2]);
    const weld = new Uint32Array(n);
    let id = -1;
    for (let i = 0; i < n; i++) {
      const v = order[i], p = i > 0 ? order[i - 1] : -1;
      if (p < 0 || q[v * 3] !== q[p * 3] || q[v * 3 + 1] !== q[p * 3 + 1] || q[v * 3 + 2] !== q[p * 3 + 2]) id++;
      weld[v] = id;
    }
    const count = new Uint32Array(id + 2);
    for (let i = 0; i < em.original.length; i++) count[weld[em.original[i]] + 1]++;
    for (let i = 1; i < count.length; i++) count[i] += count[i - 1];
    const start = count.slice();
    const tris = new Uint32Array(em.original.length);
    const fill = count.slice();
    for (let i = 0; i < em.original.length; i++) tris[fill[weld[em.original[i]]]++] = Math.floor(i / 3);
    em.adjacency = { weld, start, tris };
    return em.adjacency;
  }

  private setSelected(em: EditMesh, t: number, on: boolean) {
    if (!!em.selected[t] === on) return;
    this.ensureGeometry(em);
    const s = on ? 1 : -1;
    em.selected[t] = on ? 1 : 0;
    em.selCount += s;
    em.selArea += s * em.areas![t];
    em.selSum[0] += s * em.centroids![t * 3];
    em.selSum[1] += s * em.centroids![t * 3 + 1];
    em.selSum[2] += s * em.centroids![t * 3 + 2];
  }

  private selectable(em: EditMesh, t: number) {
    return !em.removed[t] && em.centroids![t * 3 + 1] <= this.clipPlane.constant + 0.01;
  }

  /** Triángulo original del impacto de un raycast contra el escaneo. */
  hitTriangle(hit: THREE.Intersection): { em: EditMesh; tri: number } | null {
    const em = this.byMesh.get(hit.object);
    if (!em || hit.faceIndex == null) return null;
    const tri = em.current ? em.current[hit.faceIndex] : hit.faceIndex;
    return tri === undefined ? null : { em, tri };
  }

  /** Clic: el trozo conectado al triángulo tocado, hasta `reach` metros del punto. */
  selectFragment(hit: THREE.Intersection, reach: number, subtract: boolean) {
    const found = this.hitTriangle(hit);
    if (!found) return;
    const { em, tri } = found;
    this.ensureGeometry(em);
    const adj = this.ensureAdjacency(em);
    const c = em.centroids!;
    const p = hit.point;
    const r2 = reach * reach;
    const visited = new Uint8Array(em.triCount);
    const queue = [tri];
    visited[tri] = 1;
    let truncated = false;
    let taken = 0;
    while (queue.length) {
      const t = queue.pop()!;
      this.setSelected(em, t, !subtract);
      if (++taken >= MAX_FRAGMENT_TRIS) { truncated = true; break; }
      for (let k = 0; k < 3; k++) {
        const w = adj.weld[em.original[t * 3 + k]];
        for (let i = adj.start[w]; i < adj.start[w + 1]; i++) {
          const u = adj.tris[i];
          if (visited[u] || !this.selectable(em, u)) continue;
          visited[u] = 1;
          const dx = c[u * 3] - p.x, dy = c[u * 3 + 1] - p.y, dz = c[u * 3 + 2] - p.z;
          if (dx * dx + dy * dy + dz * dz > r2) { truncated = true; continue; }
          queue.push(u);
        }
      }
    }
    this.truncated = truncated;
    this.updateSelOverlay(em);
  }

  /** Pincel: todo lo que tenga el centro a menos de `radius` del punto. */
  brush(point: THREE.Vector3, radius: number, subtract: boolean) {
    const sphere = new THREE.Sphere(point, radius);
    const r2 = radius * radius;
    for (const em of this.meshes.values()) {
      this.ensureGeometry(em);
      if (!em.box!.intersectsSphere(sphere)) continue;
      const c = em.centroids!;
      let changed = false;
      for (let t = 0; t < em.triCount; t++) {
        const dx = c[t * 3] - point.x, dy = c[t * 3 + 1] - point.y, dz = c[t * 3 + 2] - point.z;
        if (dx * dx + dy * dy + dz * dz > r2 || !!em.selected[t] === !subtract || !this.selectable(em, t)) continue;
        this.setSelected(em, t, !subtract);
        changed = true;
      }
      if (changed) this.updateSelOverlay(em);
    }
    this.truncated = false;
  }

  /** Rectángulo en NDC: lo que cae dentro; con `depth`, solo lo que se ve (no lo tapado por paredes o pisos). */
  box(camera: THREE.PerspectiveCamera, rect: ScreenRect, depth: DepthSnapshot | null, subtract: boolean) {
    const proj = new Projector(camera);
    const out: [number, number, number] = [0, 0, 0];
    for (const em of this.meshes.values()) {
      this.ensureGeometry(em);
      const c = em.centroids!;
      let changed = false;
      for (let t = 0; t < em.triCount; t++) {
        if (!!em.selected[t] === !subtract || !this.selectable(em, t)) continue;
        if (!proj.project(c[t * 3], c[t * 3 + 1], c[t * 3 + 2], out) || !inRect(out[0], out[1], rect)) continue;
        if (depth && !depth.visibleNdc(out[0], out[1], out[2], 0.05)) continue;
        this.setSelected(em, t, !subtract);
        changed = true;
      }
      if (changed) this.updateSelOverlay(em);
    }
    this.truncated = false;
  }

  clearSelection() {
    for (const em of this.meshes.values()) {
      if (!em.selCount) continue;
      em.selected.fill(0);
      em.selCount = 0;
      em.selArea = 0;
      em.selSum = [0, 0, 0];
      this.updateSelOverlay(em);
    }
    this.truncated = false;
  }

  summary(): SelectionSummary['model'] {
    let triangles = 0, areaM2 = 0;
    const sum = [0, 0, 0];
    for (const em of this.meshes.values()) {
      triangles += em.selCount;
      areaM2 += em.selArea;
      for (let i = 0; i < 3; i++) sum[i] += em.selSum[i];
    }
    return {
      triangles,
      areaM2,
      center: triangles ? { x: round3(sum[0] / triangles), y: round3(sum[1] / triangles), z: round3(sum[2] / triangles) } : null,
      truncated: this.truncated,
    };
  }

  /** La selección como edición (rangos de triángulos por malla); null si no hay nada. */
  takeSelection(): { meshes: ScanEditMesh[]; center: ArPoint; triangleCount: number } | null {
    const s = this.summary();
    if (!s.triangles || !s.center) return null;
    const meshes: ScanEditMesh[] = [];
    for (const em of this.meshes.values()) {
      if (!em.selCount) continue;
      const ids: number[] = [];
      for (let t = 0; t < em.triCount; t++) if (em.selected[t]) ids.push(t);
      meshes.push({ map: em.map, mesh: em.ordinal, triangles: em.triCount, ranges: toRanges(ids) });
    }
    return { meshes, center: s.center, triangleCount: s.triangles };
  }

  private overlay(em: EditMesh, which: 'selOverlay' | 'ghostOverlay', mask: Uint8Array, count: number, mat: THREE.Material, order: number) {
    this.disposeOverlay(em, which);
    if (!count) return;
    const idx = new Uint32Array(count * 3);
    let k = 0;
    for (let t = 0; t < em.triCount && k < idx.length; t++) {
      if (!mask[t]) continue;
      idx[k++] = em.original[t * 3];
      idx[k++] = em.original[t * 3 + 1];
      idx[k++] = em.original[t * 3 + 2];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', em.mesh.geometry.getAttribute('position'));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const overlay = new THREE.Mesh(geo, mat);
    overlay.matrixAutoUpdate = false;
    overlay.matrix.copy(em.mesh.matrixWorld);
    overlay.renderOrder = order;
    overlay.raycast = () => {};
    this.root.add(overlay);
    em[which] = overlay;
  }

  private updateSelOverlay(em: EditMesh) {
    this.overlay(em, 'selOverlay', em.selected, em.selCount, this.selMat, 4);
  }

  private updateGhost(em: EditMesh) {
    let count = 0;
    if (this.showRemoved) for (let t = 0; t < em.triCount; t++) count += em.removed[t];
    this.overlay(em, 'ghostOverlay', em.removed, count, this.ghostMat, 3);
  }

  private disposeOverlay(em: EditMesh, which: 'selOverlay' | 'ghostOverlay') {
    const o = em[which];
    if (!o) return;
    this.root.remove(o);
    // El atributo de posición es el de la malla original: solo se libera el índice propio
    o.geometry.deleteAttribute('position');
    o.geometry.dispose();
    em[which] = undefined;
  }

  dispose() {
    for (const em of this.meshes.values()) {
      this.disposeOverlay(em, 'selOverlay');
      this.disposeOverlay(em, 'ghostOverlay');
    }
    this.meshes.clear();
    this.selMat.dispose();
    this.ghostMat.dispose();
  }
}

/** Selección de polígonos del navmesh mostrado, de conexiones y de bloqueos existentes. */
export class NavEditing {
  private readonly root: THREE.Group;
  private readonly clipPlane: THREE.Plane;
  private preview: NavMeshPreview | null = null;
  private polyTris: { start: Uint32Array; tris: Uint32Array } | null = null;
  private centroids: Float32Array | null = null;
  private readonly selected = new Set<number>();
  readonly connections = new Set<string>();
  readonly blocks = new Set<string>();
  private overlay: THREE.Mesh | null = null;
  private readonly mat = new THREE.MeshBasicMaterial({
    color: 0xffab00, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  });

  constructor(root: THREE.Group, clipPlane: THREE.Plane) {
    this.root = root;
    this.clipPlane = clipPlane;
    this.mat.clippingPlanes = [clipPlane];
  }

  setPreview(preview: NavMeshPreview | null) {
    if (preview === this.preview) return;
    this.preview = preview;
    this.selected.clear();
    this.polyTris = null;
    this.centroids = null;
    if (preview?.polyStart) {
      const polys = preview.polyStart.length - 1;
      const count = new Uint32Array(polys + 1);
      for (const p of preview.triPoly) count[p + 1]++;
      for (let i = 1; i <= polys; i++) count[i] += count[i - 1];
      const fill = count.slice();
      const tris = new Uint32Array(preview.triPoly.length);
      preview.triPoly.forEach((p, t) => { tris[fill[p]++] = t; });
      this.polyTris = { start: count, tris };
      const c = new Float32Array(polys * 3);
      for (let p = 0; p < polys; p++) {
        const a = preview.polyStart[p], b = preview.polyStart[p + 1];
        for (let v = a; v < b; v++) for (let k = 0; k < 3; k++) c[p * 3 + k] += preview.polyVerts[v * 3 + k] / (b - a);
      }
      this.centroids = c;
    }
    this.updateOverlay();
  }

  get polyCount() { return this.preview?.polyStart ? this.preview.polyStart.length - 1 : 0; }

  /** Polígono del triángulo tocado en la malla mostrada. */
  pickTriangle(faceIndex: number, subtract: boolean) {
    const p = this.preview?.triPoly?.[faceIndex];
    if (p === undefined) return;
    if (subtract) this.selected.delete(p); else this.selected.add(p);
    this.updateOverlay();
  }

  toggle(set: Set<string>, id: string) {
    if (set.has(id)) set.delete(id); else set.add(id);
  }

  box(camera: THREE.PerspectiveCamera, rect: ScreenRect, depth: DepthSnapshot | null, subtract: boolean) {
    const c = this.centroids;
    if (!c) return;
    const proj = new Projector(camera);
    const out: [number, number, number] = [0, 0, 0];
    const limit = this.clipPlane.constant + 0.5;
    for (let p = 0; p < c.length / 3; p++) {
      if (c[p * 3 + 1] > limit) continue;
      if (!proj.project(c[p * 3], c[p * 3 + 1], c[p * 3 + 2], out) || !inRect(out[0], out[1], rect)) continue;
      if (depth && !depth.visibleNdc(out[0], out[1], out[2], 0.3)) continue;
      if (subtract) this.selected.delete(p); else this.selected.add(p);
    }
    this.updateOverlay();
  }

  clearSelection() {
    this.selected.clear();
    this.connections.clear();
    this.blocks.clear();
    this.updateOverlay();
  }

  private polygon(p: number): ArPoint[] {
    const pv = this.preview!;
    const out: ArPoint[] = [];
    for (let v = pv.polyStart[p]; v < pv.polyStart[p + 1]; v++) {
      out.push({ x: round3(pv.polyVerts[v * 3]), y: round3(pv.polyVerts[v * 3 + 1]), z: round3(pv.polyVerts[v * 3 + 2]) });
    }
    return out;
  }

  summary(): SelectionSummary['nav'] {
    let areaM2 = 0;
    const sum = [0, 0, 0];
    for (const p of this.selected) {
      areaM2 += planArea(this.polygon(p));
      for (let k = 0; k < 3; k++) sum[k] += this.centroids![p * 3 + k];
    }
    const n = this.selected.size;
    return {
      polys: n,
      areaM2,
      center: n ? { x: round3(sum[0] / n), y: round3(sum[1] / n), z: round3(sum[2] / n) } : null,
      connections: [...this.connections],
      blocks: [...this.blocks],
    };
  }

  /** Contornos convexos de los polígonos seleccionados. */
  takePolygons(): ArPoint[][] {
    return [...this.selected].sort((a, b) => a - b).map(p => this.polygon(p));
  }

  private updateOverlay() {
    if (this.overlay) {
      this.root.remove(this.overlay);
      this.overlay.geometry.dispose();
      this.overlay = null;
    }
    const pv = this.preview;
    if (!pv || !this.polyTris || !this.selected.size) return;
    const idx: number[] = [];
    for (const p of this.selected) {
      for (let i = this.polyTris.start[p]; i < this.polyTris.start[p + 1]; i++) {
        const t = this.polyTris.tris[i];
        idx.push(pv.indices[t * 3], pv.indices[t * 3 + 1], pv.indices[t * 3 + 2]);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pv.positions, 3));
    geo.setIndex(idx);
    this.overlay = new THREE.Mesh(geo, this.mat);
    this.overlay.position.y = 0.05;
    this.overlay.renderOrder = 6;
    this.overlay.raycast = () => {};
    this.root.add(this.overlay);
  }

  dispose() {
    this.selected.clear();
    this.updateOverlay();
    this.mat.dispose();
  }
}
