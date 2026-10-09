import { init, importNavMesh, exportNavMesh, getNavMeshPositionsAndIndices, NavMeshQuery, type NavMesh } from 'recast-navigation';
import { generateSoloNavMesh } from 'recast-navigation/generators';
import type { ArPoint } from '../types';
import { applyPatches, preparePatch, surfaceAt } from './navPatches';

// Mismos valores por defecto que el NavigationMesh de Mattercraft (@zcomponent/three-navigation)
export const NAVMESH_SETTINGS = {
  cellSize: 0.1,
  cellHeight: 0.05,
  walkableClimb: 0.3,
  walkableHeight: 2,
  walkableRadius: 0.2,
  walkableSlopeAngle: 60,
  borderSize: 0,
};

export interface NavMeshPreview {
  positions: Float32Array;
  indices: Uint32Array;
  offMeshConnections: number;
}

export interface OffMeshConnectionInput {
  startPosition: { x: number; y: number; z: number };
  endPosition: { x: number; y: number; z: number };
  radius: number;
  bidirectional: boolean;
}

export interface PatchCheck {
  /** Fracción (0–1) del interior del parche que quedó caminable. */
  walkable: number;
  /** Lados del parche por los que se llega caminando al suelo escaneado de alrededor. */
  links: number;
  sides: number;
}

const SAMPLE_STEP = 0.2;
// El borde se encoge walkableRadius sobre el vacío: no se cuenta al medir el interior
const EDGE_MARGIN = 0.3;
const PROBE_OUT = 0.6;

function distToEdges(points: ArPoint[], x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a.x - t * dx, z - a.z - t * dz));
  }
  return best;
}

/** Comprueba sobre el navmesh generado que cada parche sea caminable y esté unido al resto. */
function checkPatches(navMesh: NavMesh, patches: { points: ArPoint[] }[]): PatchCheck[] {
  const query = new NavMeshQuery(navMesh);
  const onMesh = (p: ArPoint, h: number) => {
    const r = query.findClosestPoint(p, { halfExtents: { x: h, y: 0.5, z: h } });
    return r.success && r.polyRef && Math.hypot(r.point.x - p.x, r.point.z - p.z) < 0.15 && Math.abs(r.point.y - p.y) < 0.5
      ? r.point : null;
  };
  try {
    return patches.map(({ points }) => {
      const patch = preparePatch(points);
      const samples: ArPoint[] = [];
      for (let x = patch.minX; x <= patch.maxX; x += SAMPLE_STEP) {
        for (let z = patch.minZ; z <= patch.maxZ; z += SAMPLE_STEP) {
          const y = surfaceAt(patch, x, z);
          if (y !== null && distToEdges(points, x, z) >= EDGE_MARGIN) samples.push({ x, y, z });
        }
      }
      if (!samples.length) {
        const c = points.reduce((s, p) => ({ x: s.x + p.x / points.length, y: s.y + p.y / points.length, z: s.z + p.z / points.length }), { x: 0, y: 0, z: 0 });
        samples.push(c);
      }
      const covered = samples.map(s => onMesh(s, 0.15)).filter((p): p is ArPoint => !!p);
      const start = covered[Math.floor(covered.length / 2)];

      // Un punto del suelo justo fuera de cada lado; ¿se llega caminando desde el interior del parche?
      let links = 0;
      for (let i = 0; start && i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
        const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        let nx = (b.z - a.z) / len, nz = -(b.x - a.x) / len;
        if (surfaceAt(patch, mid.x + nx * 0.05, mid.z + nz * 0.05) !== null) { nx = -nx; nz = -nz; }
        const out = { x: mid.x + nx * PROBE_OUT, y: mid.y, z: mid.z + nz * PROBE_OUT };
        const r = query.findClosestPoint(out, { halfExtents: { x: 0.3, y: 0.6, z: 0.3 } });
        if (!r.success || !r.polyRef || surfaceAt(patch, r.point.x, r.point.z) !== null) continue;
        const path = query.computePath(start, r.point).path;
        const last = path[path.length - 1];
        if (last && Math.hypot(last.x - r.point.x, last.y - r.point.y, last.z - r.point.z) < 0.3) links++;
      }
      return { walkable: covered.length / samples.length, links, sides: points.length };
    });
  } finally {
    query.destroy();
  }
}

let ready: Promise<void> | null = null;
export const initRecast = () => (ready ??= init());

function describeNavMesh(navMesh: NavMesh): NavMeshPreview {
  const [positions, indices] = getNavMeshPositionsAndIndices(navMesh);
  let offMeshConnections = 0;
  for (let i = 0; i < navMesh.getMaxTiles(); i++) {
    const header = navMesh.getTile(i).header();
    if (header) offMeshConnections += header.offMeshConCount();
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices), offMeshConnections };
}

export async function readNavMesh(data: Uint8Array): Promise<NavMeshPreview> {
  await initRecast();
  const { navMesh } = importNavMesh(data);
  if (!navMesh) throw new Error('Archivo de navmesh inválido');
  try {
    return describeNavMesh(navMesh);
  } finally {
    navMesh.destroy();
  }
}

export async function buildNavMesh(
  scanPositions: Float32Array,
  scanIndices: Uint32Array,
  connections: OffMeshConnectionInput[],
  patches: { points: ArPoint[] }[] = [],
): Promise<{ data: Uint8Array; preview: NavMeshPreview; patchChecks: PatchCheck[]; removed: number }> {
  await initRecast();
  const s = NAVMESH_SETTINGS;
  // Dentro del parche se reemplaza el escaneo desde su superficie hasta la altura libre: hasta un peldaño
  // unos centímetros por encima actúa como techo bajo y recast corta la ruta
  const { positions, indices, removed } = applyPatches(scanPositions, scanIndices, patches, {
    from: -s.cellHeight, to: s.walkableHeight,
  });
  // Misma conversión a unidades de celda que hace Mattercraft en NavigationMesh.generate()
  const result = generateSoloNavMesh(positions, indices, {
    cs: s.cellSize,
    ch: s.cellHeight,
    walkableClimb: s.walkableClimb / s.cellHeight,
    walkableRadius: s.walkableRadius / s.cellSize,
    walkableSlopeAngle: s.walkableSlopeAngle,
    walkableHeight: s.walkableHeight / s.cellHeight,
    borderSize: s.borderSize / s.cellSize,
    offMeshConnections: connections,
  });
  if (!result.success || !result.navMesh) throw new Error(result.error ?? 'No se pudo generar el navmesh');
  try {
    return {
      data: exportNavMesh(result.navMesh).slice(),
      preview: describeNavMesh(result.navMesh),
      patchChecks: checkPatches(result.navMesh, patches),
      removed,
    };
  } finally {
    result.navMesh.destroy();
  }
}
