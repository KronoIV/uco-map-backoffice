import { buildNavMesh, navMeshInputFile, type OffMeshConnectionInput } from '../utils/navmesh';
import type { BlockedArea } from '../utils/navmesh-builder';
import type { ArPoint } from '../types';

export interface GenerateRequest {
  positions: Float32Array;
  indices: Uint32Array;
  connections: OffMeshConnectionInput[];
  patches: { points: ArPoint[] }[];
  /** Zonas y cortes bloqueados por el admin. */
  blocked?: BlockedArea[];
  /** 'input': no genera; devuelve el archivo con la geometría que entraría a recast (experimento offline de la app). */
  mode?: 'build' | 'input';
  meshNames?: string[];
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<GenerateRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

ctx.onmessage = async e => {
  try {
    if (e.data.mode === 'input') {
      const file = navMeshInputFile(e.data.positions, e.data.indices, e.data.connections, e.data.patches, e.data.meshNames ?? []);
      ctx.postMessage({ ok: true, file }, [file.buffer]);
      return;
    }
    const result = await buildNavMesh(e.data.positions, e.data.indices, e.data.connections, e.data.patches, e.data.blocked);
    const { preview } = result;
    ctx.postMessage({ ok: true, ...result }, [
      result.data.buffer, preview.positions.buffer, preview.indices.buffer,
      preview.triPoly.buffer, preview.polyVerts.buffer, preview.polyStart.buffer,
    ]);
  } catch (err) {
    ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
