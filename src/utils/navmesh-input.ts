/**
 * Geometría exacta que entra a recast al generar el navmesh (escaneo con los parches ya aplicados), con las
 * conexiones y los ajustes del admin. El admin la exporta para que uco-map-app (npm run eval:experiment) compare
 * ajustes de recast sin red ni MultiSet. Copia idéntica en uco-map-app/test/eval/experiment/navmesh-input.ts.
 *
 * Formato: u32 little-endian con la longitud de la cabecera · cabecera JSON UTF-8 rellena con espacios hasta un
 * múltiplo de 4 · posiciones Float32 (x, y, z) · índices Uint32 (3 por triángulo), ambos en el orden de bytes de la
 * plataforma (little-endian en los navegadores y equipos actuales).
 */
export const NAVMESH_INPUT_FORMAT = 'ucomap-navmesh-input/1';

export interface NavMeshInputPoint { x: number; y: number; z: number }

export interface NavMeshInputHeader {
  format: string;
  createdAt: string;
  /** Ajustes del admin en metros (NAVMESH_SETTINGS) y detalle de alturas en celdas (NAVMESH_DETAIL). */
  settings: Record<string, number>;
  detail: { detailSampleDist: number; detailSampleMaxError: number };
  connections: Array<{ startPosition: NavMeshInputPoint; endPosition: NavMeshInputPoint; radius: number; bidirectional: boolean }>;
  meshNames: string[];
  /** Triángulos del escaneo descartados sobre los parches. */
  removed: number;
  /** Cantidad de floats de posiciones y de índices. */
  positions: number;
  indices: number;
}

export interface NavMeshInput {
  header: NavMeshInputHeader;
  positions: Float32Array;
  indices: Uint32Array;
}

export function encodeNavMeshInput(
  header: Omit<NavMeshInputHeader, 'format' | 'positions' | 'indices'>,
  positions: Float32Array,
  indices: Uint32Array,
) {
  const json = new TextEncoder().encode(JSON.stringify({
    ...header, format: NAVMESH_INPUT_FORMAT, positions: positions.length, indices: indices.length,
  }));
  const headerBytes = Math.ceil(json.length / 4) * 4;
  const out = new Uint8Array(4 + headerBytes + positions.byteLength + indices.byteLength);
  new DataView(out.buffer).setUint32(0, headerBytes, true);
  out.fill(0x20, 4, 4 + headerBytes);
  out.set(json, 4);
  out.set(new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength), 4 + headerBytes);
  out.set(new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength), 4 + headerBytes + positions.byteLength);
  return out;
}

export function decodeNavMeshInput(bytes: Uint8Array): NavMeshInput {
  const headerBytes = bytes.byteLength >= 4 ? new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true) : 0;
  if (!headerBytes || 4 + headerBytes > bytes.byteLength) throw new Error('No es un archivo de geometría de navmesh');
  let header: NavMeshInputHeader;
  try {
    header = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + headerBytes)));
  } catch {
    throw new Error('No es un archivo de geometría de navmesh');
  }
  if (header.format !== NAVMESH_INPUT_FORMAT) throw new Error(`Formato de geometría desconocido: ${header.format}`);
  const start = 4 + headerBytes;
  const end = start + header.positions * 4 + header.indices * 4;
  if (end !== bytes.byteLength) throw new Error('Archivo de geometría incompleto');
  // Copias alineadas: el bloque de origen no tiene por qué empezar en un múltiplo de 4
  const positions = new Float32Array(bytes.slice(start, start + header.positions * 4).buffer);
  const indices = new Uint32Array(bytes.slice(start + header.positions * 4, end).buffer);
  return { header, positions, indices };
}
