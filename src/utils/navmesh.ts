import { init, importNavMesh, exportNavMesh, getNavMeshPositionsAndIndices, type NavMesh } from 'recast-navigation';
import { generateSoloNavMesh } from 'recast-navigation/generators';

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
  positions: Float32Array,
  indices: Uint32Array,
  connections: OffMeshConnectionInput[],
): Promise<{ data: Uint8Array; preview: NavMeshPreview }> {
  await initRecast();
  const s = NAVMESH_SETTINGS;
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
    return { data: exportNavMesh(result.navMesh).slice(), preview: describeNavMesh(result.navMesh) };
  } finally {
    result.navMesh.destroy();
  }
}
