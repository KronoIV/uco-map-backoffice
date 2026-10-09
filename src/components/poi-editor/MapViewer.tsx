import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { ArPoint, MapMesh } from '../../types';
import type { NavMeshPreview } from '../../utils/navmesh';
import { triangulatePatch } from '../../utils/navPatches';

export type MarkerKind = 'room' | 'selected' | 'draft' | 'reference';

export interface ViewerMarker {
  id: string;
  label: string;
  position: ArPoint;
  kind: MarkerKind;
}

export interface ViewerConnection {
  id: string;
  label: string;
  start: ArPoint;
  end: ArPoint | null;
  selected: boolean;
}

export interface ViewerPatch {
  id: string;
  label: string;
  points: ArPoint[];
  selected: boolean;
  /** Se puede tocar para editarlo (no mientras se dibuja otro). */
  selectable: boolean;
}

export interface MapViewerApi {
  /** Triángulos de las mallas cargadas en el espacio del mapa (entrada para recast). */
  collectGeometry(): { positions: Float32Array; indices: Uint32Array; meshNames: string[] };
}

interface MapViewerProps {
  meshes: MapMesh[];
  markers: ViewerMarker[];
  connections: ViewerConnection[];
  patches: ViewerPatch[];
  navMesh: NavMeshPreview | null;
  clipY: number | null;
  /** Altura del último punto: el clic cae ahí si no hay piso debajo, si toca una pared o con Shift. */
  pickPlaneY: number | null;
  focus: ArPoint | null;
  onPick: (p: ArPoint) => void;
  onMarkerClick: (id: string) => void;
  onBounds: (minY: number, maxY: number) => void;
  onProgress: (name: string, pct: number | null) => void;
  onError: (message: string) => void;
  onReady?: (api: MapViewerApi) => void;
}

const CACHE_NAME = 'ucomap-multiset-meshes';
const NO_CLIP = 1e6;
// Normal más horizontal que esto = pared: el clic no está sobre el piso
const WALL_NORMAL_Y = 0.5;
const MOVE_SPEED = 6;
const FAST_FACTOR = 3;
const TURN_SPEED = Math.PI / 2;
// Sin llegar a mirar recto arriba/abajo, donde el giro horizontal se vuelve inestable
const MIN_POLAR = 0.05;
const MAX_POLAR = Math.PI - 0.05;
// [adelante, derecha, arriba] por tecla (e.code, independiente de la distribución del teclado)
const MOVE_KEYS: Record<string, [number, number, number]> = {
  KeyW: [1, 0, 0],
  KeyS: [-1, 0, 0],
  KeyD: [0, 1, 0],
  KeyA: [0, -1, 0],
  KeyE: [0, 0, 1], KeyQ: [0, 0, -1],
};
// [giro a la izquierda, mirar arriba]
const LOOK_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [1, 0], ArrowRight: [-1, 0],
  ArrowUp: [0, 1], ArrowDown: [0, -1],
};

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
    || ['combobox', 'listbox', 'option', 'menuitem'].includes(el.getAttribute('role') ?? '');
}
const MARKER_COLORS: Record<MarkerKind, number> = {
  room: 0x00a86b,
  selected: 0x1e88e5,
  draft: 0xffb300,
  reference: 0x9e9e9e,
};

async function fetchMesh(url: string, onPct: (pct: number) => void): Promise<ArrayBuffer> {
  // Las URLs firmadas cambian en cada petición: se cachea por la ruta sin query string
  const key = url.split('?')[0];
  const cache = 'caches' in window ? await caches.open(CACHE_NAME) : null;
  const hit = await cache?.match(key);
  if (hit) return hit.arrayBuffer();

  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('Content-Length')) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total) onPct(Math.round((loaded / total) * 100));
  }
  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) { buffer.set(c, offset); offset += c.length; }

  try {
    await cache?.put(key, new Response(buffer, { headers: { 'Content-Type': 'model/gltf-binary' } }));
  } catch { /* cuota del navegador agotada: se descargará de nuevo la próxima vez */ }
  return buffer.buffer;
}

class ViewerEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly labels: CSS2DRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
  readonly controls: OrbitControls;
  readonly meshRoot = new THREE.Group();
  readonly markerRoot = new THREE.Group();
  readonly connRoot = new THREE.Group();
  readonly navRoot = new THREE.Group();
  readonly patchRoot = new THREE.Group();
  readonly clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), NO_CLIP);
  readonly loader: GLTFLoader;
  readonly draco: DRACOLoader;
  readonly loaded = new Map<string, THREE.Object3D>();
  readonly pending = new Set<string>();
  wanted = new Set<string>();
  props: MapViewerProps;
  framed = false;
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private readonly markerGeo = {
    head: new THREE.SphereGeometry(0.3, 16, 12),
    stem: new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8).translate(0, 0.6, 0),
    base: new THREE.RingGeometry(0.2, 0.3, 24).rotateX(-Math.PI / 2),
  };
  private readonly markerMat = new Map<MarkerKind, THREE.MeshBasicMaterial>();
  private readonly connMat = {
    line: new THREE.LineBasicMaterial({ color: 0xff9800, depthTest: false, transparent: true }),
    lineSelected: new THREE.LineBasicMaterial({ color: 0x1e88e5, depthTest: false, transparent: true }),
    end: new THREE.MeshBasicMaterial({ color: 0xff9800, depthTest: false, transparent: true }),
    endSelected: new THREE.MeshBasicMaterial({ color: 0x1e88e5, depthTest: false, transparent: true }),
  };
  private readonly connEndGeo = new THREE.SphereGeometry(0.18, 12, 8);
  private readonly patchMat = {
    fill: new THREE.MeshBasicMaterial({ color: 0x29b6f6, transparent: true, opacity: 0.18, depthTest: false, side: THREE.DoubleSide }),
    fillSelected: new THREE.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.5, depthTest: false, side: THREE.DoubleSide }),
    line: new THREE.LineBasicMaterial({ color: 0x0288d1, depthTest: false, transparent: true }),
    lineSelected: new THREE.LineBasicMaterial({ color: 0xff6f00, depthTest: false, transparent: true }),
    vertex: new THREE.MeshBasicMaterial({ color: 0xff6f00, depthTest: false, transparent: true }),
  };
  private readonly patchVertexGeo = new THREE.SphereGeometry(0.07, 10, 6);
  private readonly navMat = new THREE.MeshBasicMaterial({
    color: 0x00e676, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  private readonly container: HTMLElement;
  private downAt: { x: number; y: number } | null = null;
  private readonly keys = new Set<string>();
  private fast = false;
  private readonly clock = new THREE.Clock();

  constructor(container: HTMLElement, props: MapViewerProps) {
    this.container = container;
    this.props = props;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    container.appendChild(this.labels.domElement);

    this.scene.background = new THREE.Color(0x1b1f24);
    this.scene.add(this.meshRoot, this.navRoot, this.patchRoot, this.connRoot, this.markerRoot);
    this.navMat.clippingPlanes = [this.clipPlane];
    this.raycaster.params.Line = { threshold: 0.2 };
    this.camera.position.set(40, 50, 40);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.draco = new DRACOLoader().setDecoderPath('/draco/');
    this.loader = new GLTFLoader().setDRACOLoader(this.draco);

    for (const [kind, color] of Object.entries(MARKER_COLORS)) {
      this.markerMat.set(kind as MarkerKind, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true }));
    }

    this.renderer.domElement.addEventListener('pointerdown', this.handleDown);
    this.renderer.domElement.addEventListener('pointerup', this.handleUp);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.releaseKeys);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.renderer.setAnimationLoop(() => {
      this.move(Math.min(this.clock.getDelta(), 0.1));
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.labels.render(this.scene, this.camera);
    });
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setMeshes(meshes: MapMesh[]) {
    this.wanted = new Set(meshes.map(m => m.name));
    for (const [name, obj] of this.loaded) {
      if (!this.wanted.has(name)) {
        this.meshRoot.remove(obj);
        this.disposeObject(obj);
        this.loaded.delete(name);
      }
    }
    for (const mesh of meshes) {
      if (!this.loaded.has(mesh.name) && !this.pending.has(mesh.name)) void this.loadMesh(mesh);
    }
    this.emitBounds();
  }

  private async loadMesh(mesh: MapMesh) {
    this.pending.add(mesh.name);
    this.props.onProgress(mesh.name, 0);
    try {
      const buffer = await fetchMesh(mesh.url, pct => this.props.onProgress(mesh.name, pct));
      const gltf = await this.loader.parseAsync(buffer, '');
      if (!this.wanted.has(mesh.name)) { this.disposeObject(gltf.scene); return; }

      // MultiSet usa mano izquierda: misma conversión que MultiSetModel en Mattercraft
      const { position: p, rotation: r } = mesh;
      gltf.scene.position.set(-p.x, p.y, p.z);
      gltf.scene.quaternion.set(r.qx, -r.qy, -r.qz, r.qw);
      gltf.scene.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          mat.clippingPlanes = [this.clipPlane];
          mat.side = THREE.DoubleSide;
        }
      });
      this.meshRoot.add(gltf.scene);
      this.loaded.set(mesh.name, gltf.scene);
      this.emitBounds();
      if (!this.framed) this.frameAll();
    } catch (err) {
      this.props.onError(`No se pudo cargar el mapa ${mesh.name}: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.pending.delete(mesh.name);
      this.props.onProgress(mesh.name, null);
    }
  }

  private emitBounds() {
    const box = new THREE.Box3().setFromObject(this.meshRoot);
    if (!box.isEmpty()) this.props.onBounds(box.min.y, box.max.y);
  }

  private frameAll() {
    const box = new THREE.Box3().setFromObject(this.meshRoot);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(0.4, 0.8, 0.4).multiplyScalar(size));
    this.framed = true;
  }

  setClipY(y: number | null) {
    this.clipPlane.constant = y ?? NO_CLIP;
    this.updateMarkerVisibility();
  }

  setNavMesh(preview: NavMeshPreview | null) {
    for (const child of [...this.navRoot.children]) {
      (child as THREE.Mesh).geometry.dispose();
      this.navRoot.remove(child);
    }
    if (!preview) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(preview.positions, 3));
    geo.setIndex(new THREE.BufferAttribute(preview.indices, 1));
    const mesh = new THREE.Mesh(geo, this.navMat);
    mesh.position.y = 0.03;
    mesh.renderOrder = 5;
    this.navRoot.add(mesh);
  }

  setConnections(connections: ViewerConnection[]) {
    this.clearLabels(this.connRoot);
    for (const c of connections) {
      const group = new THREE.Group();
      group.userData = { markerId: `conn:${c.id}`, minY: Math.min(c.start.y, c.end?.y ?? c.start.y), keep: c.selected };
      const endMat = c.selected ? this.connMat.endSelected : this.connMat.end;
      const points = [c.start, ...(c.end ? [c.end] : [])];
      for (const p of points) {
        const s = new THREE.Mesh(this.connEndGeo, endMat);
        s.position.set(p.x, p.y, p.z);
        s.renderOrder = 11;
        s.userData.markerId = `conn:${c.id}`;
        group.add(s);
      }
      if (c.end) {
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(c.start.x, c.start.y, c.start.z),
            new THREE.Vector3(c.end.x, c.end.y, c.end.z),
          ]),
          c.selected ? this.connMat.lineSelected : this.connMat.line,
        );
        line.renderOrder = 11;
        line.userData.markerId = `conn:${c.id}`;
        group.add(line);
      }
      if (c.selected || !c.end) {
        const el = document.createElement('div');
        el.textContent = c.label;
        Object.assign(el.style, {
          padding: '2px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
          color: '#fff', background: c.selected ? '#1e88e5cc' : '#ff9800cc', whiteSpace: 'nowrap',
        });
        const label = new CSS2DObject(el);
        const end = c.end ?? c.start;
        label.position.set((c.start.x + end.x) / 2, Math.max(c.start.y, end.y) + 0.6, (c.start.z + end.z) / 2);
        group.add(label);
      }
      this.connRoot.add(group);
    }
    this.updateMarkerVisibility();
  }

  setPatches(patches: ViewerPatch[]) {
    this.clearLabels(this.patchRoot);
    for (const p of patches) {
      const group = new THREE.Group();
      group.userData = { minY: Math.min(...p.points.map(q => q.y)), keep: p.selected };
      const markerId = p.selectable ? `patch:${p.id}` : undefined;
      const vectors = p.points.map(q => new THREE.Vector3(q.x, q.y, q.z));

      const tris = triangulatePatch(p.points);
      if (tris.length) {
        const geo = new THREE.BufferGeometry().setFromPoints(vectors);
        geo.setIndex(tris);
        const fill = new THREE.Mesh(geo, p.selected ? this.patchMat.fillSelected : this.patchMat.fill);
        fill.position.y = 0.04;
        fill.renderOrder = 7;
        fill.userData.markerId = markerId;
        group.add(fill);
      }
      if (vectors.length > 1) {
        const outline = new (vectors.length > 2 ? THREE.LineLoop : THREE.Line)(
          new THREE.BufferGeometry().setFromPoints(vectors),
          p.selected ? this.patchMat.lineSelected : this.patchMat.line,
        );
        outline.renderOrder = 8;
        outline.userData.markerId = markerId;
        group.add(outline);
      }
      if (p.selected) {
        for (const v of vectors) {
          const dot = new THREE.Mesh(this.patchVertexGeo, this.patchMat.vertex);
          dot.position.copy(v);
          dot.renderOrder = 9;
          group.add(dot);
        }
        const el = document.createElement('div');
        el.textContent = p.label;
        Object.assign(el.style, {
          padding: '2px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
          color: '#fff', background: '#ff6f00cc', whiteSpace: 'nowrap',
        });
        const label = new CSS2DObject(el);
        const box = new THREE.Box3().setFromPoints(vectors);
        label.position.set((box.min.x + box.max.x) / 2, box.max.y + 0.6, (box.min.z + box.max.z) / 2);
        group.add(label);
      }
      this.patchRoot.add(group);
    }
    this.updateMarkerVisibility();
  }

  collectGeometry() {
    this.meshRoot.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    let vertexCount = 0;
    let indexCount = 0;
    this.meshRoot.traverse(o => {
      const m = o as THREE.Mesh;
      const pos = m.isMesh ? m.geometry.getAttribute('position') : undefined;
      if (!pos || pos.itemSize !== 3) return;
      meshes.push(m);
      vertexCount += pos.count;
      indexCount += m.geometry.index ? m.geometry.index.count : pos.count;
    });
    const positions = new Float32Array(vertexCount * 3);
    const indices = new Uint32Array(indexCount);
    const v = new THREE.Vector3();
    let vo = 0;
    let io = 0;
    for (const m of meshes) {
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        positions[(vo + i) * 3] = v.x;
        positions[(vo + i) * 3 + 1] = v.y;
        positions[(vo + i) * 3 + 2] = v.z;
      }
      const index = m.geometry.index;
      if (index) for (let j = 0; j < index.count; j++) indices[io + j] = index.getX(j) + vo;
      else for (let j = 0; j < pos.count; j++) indices[io + j] = vo + j;
      io += index ? index.count : pos.count;
      vo += pos.count;
    }
    return { positions, indices, meshNames: [...this.loaded.keys()] };
  }

  private clearLabels(root: THREE.Object3D) {
    for (const child of [...root.children]) {
      child.traverse(o => {
        if (o instanceof CSS2DObject) o.element.remove();
        if (o instanceof THREE.Line) o.geometry.dispose();
        if (o instanceof THREE.Mesh && o.geometry !== this.patchVertexGeo && root === this.patchRoot) o.geometry.dispose();
      });
      root.remove(child);
    }
  }

  setMarkers(markers: ViewerMarker[]) {
    this.clearLabels(this.markerRoot);
    for (const m of markers) {
      const group = new THREE.Group();
      group.position.set(m.position.x, m.position.y, m.position.z);
      group.userData = { markerId: m.id, kind: m.kind };
      const mat = this.markerMat.get(m.kind)!;
      const base = new THREE.Mesh(this.markerGeo.base, mat);
      const stem = new THREE.Mesh(this.markerGeo.stem, mat);
      const head = new THREE.Mesh(this.markerGeo.head, mat);
      head.position.y = 1.2;
      for (const part of [base, stem, head]) { part.renderOrder = 10; part.userData.markerId = m.id; }
      group.add(base, stem, head);

      const el = document.createElement('div');
      el.textContent = m.label;
      Object.assign(el.style, {
        padding: '2px 6px',
        borderRadius: '6px',
        fontSize: m.kind === 'reference' ? '10px' : '11px',
        fontWeight: m.kind === 'reference' ? '400' : '600',
        color: '#fff',
        background: `#${MARKER_COLORS[m.kind].toString(16).padStart(6, '0')}cc`,
        whiteSpace: 'nowrap',
      });
      const label = new CSS2DObject(el);
      label.position.y = 1.75;
      group.add(label);
      this.markerRoot.add(group);
    }
    this.updateMarkerVisibility();
  }

  private updateMarkerVisibility() {
    const limit = this.clipPlane.constant;
    for (const g of this.markerRoot.children) {
      const keep = g.userData.kind === 'draft' || g.userData.kind === 'selected';
      g.visible = keep || g.position.y <= limit + 0.5;
    }
    for (const g of this.connRoot.children) {
      g.visible = g.userData.keep || g.userData.minY <= limit + 0.5;
    }
    for (const g of this.patchRoot.children) {
      g.visible = g.userData.keep || g.userData.minY <= limit + 0.5;
    }
  }

  focusOn(p: ArPoint) {
    const target = new THREE.Vector3(p.x, p.y, p.z);
    const offset = this.camera.position.clone().sub(this.controls.target).setLength(18);
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(offset);
  }

  private handleDown = (e: PointerEvent) => { this.downAt = { x: e.clientX, y: e.clientY }; };

  private handleKeyDown = (e: KeyboardEvent) => {
    this.fast = e.shiftKey;
    if (!(e.code in MOVE_KEYS || e.code in LOOK_KEYS) || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    e.preventDefault();
    this.keys.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.fast = e.shiftKey;
    this.keys.delete(e.code);
  };

  private releaseKeys = () => { this.keys.clear(); };

  /** Desplaza cámara y punto de giro juntos, en el plano del piso según hacia dónde se mira. */
  private move(dt: number) {
    if (!this.keys.size) return;
    this.look(dt);
    let f = 0, r = 0, u = 0;
    for (const k of this.keys) {
      const m = MOVE_KEYS[k];
      if (m) { f += m[0]; r += m[1]; u += m[2]; }
    }
    const forward = this.camera.getWorldDirection(new THREE.Vector3()).setY(0);
    // Mirando recto hacia abajo: "adelante" es la parte de arriba de la pantalla
    if (forward.lengthSq() < 1e-6) forward.set(0, 1, 0).applyQuaternion(this.camera.quaternion).setY(0);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
    const step = new THREE.Vector3()
      .addScaledVector(forward, f)
      .addScaledVector(right, r)
      .addScaledVector(this.camera.up, u);
    if (step.lengthSq() === 0) return;
    step.normalize().multiplyScalar(MOVE_SPEED * (this.fast ? FAST_FACTOR : 1) * dt);
    this.camera.position.add(step);
    this.controls.target.add(step);
  }

  /** Gira la mirada sobre la posición de la cámara (primera persona): mueve el punto de giro, no la cámara. */
  private look(dt: number) {
    let yaw = 0, pitch = 0;
    for (const k of this.keys) {
      const l = LOOK_KEYS[k];
      if (l) { yaw += l[0]; pitch += l[1]; }
    }
    if (!yaw && !pitch) return;
    const angle = TURN_SPEED * (this.fast ? 2 : 1) * dt;
    const offset = new THREE.Spherical().setFromVector3(this.controls.target.clone().sub(this.camera.position));
    offset.theta += yaw * angle;
    offset.phi = THREE.MathUtils.clamp(offset.phi - pitch * angle, MIN_POLAR, MAX_POLAR);
    this.controls.target.copy(this.camera.position).add(new THREE.Vector3().setFromSpherical(offset));
  }

  private handleUp = (e: PointerEvent) => {
    const start = this.downAt;
    this.downAt = null;
    // Si hubo arrastre es una rotación de cámara, no un clic
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5 || e.button !== 0) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);

    const markerHit = this.raycaster
      .intersectObjects([...this.markerRoot.children, ...this.connRoot.children, ...this.patchRoot.children], true)
      .find(h => h.object.userData.markerId && h.object.parent?.visible);
    if (markerHit) { this.props.onMarkerClick(markerHit.object.userData.markerId); return; }

    const limit = this.clipPlane.constant + 0.01;
    const hit = this.raycaster.intersectObjects(this.meshRoot.children, true).find(h => h.point.y <= limit);
    const planeY = this.props.pickPlaneY;
    let point = hit?.point ?? null;
    const onWall = !!hit?.face
      && Math.abs(hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y) < WALL_NORMAL_Y;
    if (planeY !== null && (!point || onWall || e.shiftKey)) {
      point = this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), new THREE.Vector3());
    }
    if (point) this.props.onPick({ x: round(point.x), y: round(point.y), z: round(point.z) });
  };

  private disposeObject(obj: THREE.Object3D) {
    obj.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    });
  }

  dispose() {
    this.wanted = new Set();
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handleDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handleUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.releaseKeys);
    this.controls.dispose();
    for (const obj of this.loaded.values()) this.disposeObject(obj);
    this.markerMat.forEach(m => m.dispose());
    Object.values(this.markerGeo).forEach(g => g.dispose());
    Object.values(this.connMat).forEach(m => m.dispose());
    this.connEndGeo.dispose();
    this.clearLabels(this.patchRoot);
    Object.values(this.patchMat).forEach(m => m.dispose());
    this.patchVertexGeo.dispose();
    this.setNavMesh(null);
    this.navMat.dispose();
    this.clearLabels(this.connRoot);
    this.clearLabels(this.markerRoot);
    this.draco.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}

function round(v: number) {
  return Math.round(v * 1000) / 1000;
}

export default function MapViewer(props: MapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ViewerEngine | null>(null);

  useEffect(() => {
    const engine = new ViewerEngine(containerRef.current!, props);
    engineRef.current = engine;
    props.onReady?.({ collectGeometry: () => engine.collectGeometry() });
    return () => { engine.dispose(); engineRef.current = null; };
    // El motor se crea una sola vez; las props se actualizan en los efectos siguientes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (engineRef.current) engineRef.current.props = props; });
  useEffect(() => { engineRef.current?.setMeshes(props.meshes); }, [props.meshes]);
  useEffect(() => { engineRef.current?.setMarkers(props.markers); }, [props.markers]);
  useEffect(() => { engineRef.current?.setConnections(props.connections); }, [props.connections]);
  useEffect(() => { engineRef.current?.setPatches(props.patches); }, [props.patches]);
  useEffect(() => { engineRef.current?.setNavMesh(props.navMesh); }, [props.navMesh]);
  useEffect(() => { engineRef.current?.setClipY(props.clipY); }, [props.clipY]);
  useEffect(() => { if (props.focus) engineRef.current?.focusOn(props.focus); }, [props.focus]);

  return <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }} />;
}
