import { buildNavMesh, type OffMeshConnectionInput } from '../utils/navmesh';
import type { ArPoint } from '../types';

export interface GenerateRequest {
  positions: Float32Array;
  indices: Uint32Array;
  connections: OffMeshConnectionInput[];
  patches: { points: ArPoint[] }[];
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<GenerateRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

ctx.onmessage = async e => {
  try {
    const { data, preview, patchChecks, removed } = await buildNavMesh(
      e.data.positions, e.data.indices, e.data.connections, e.data.patches,
    );
    ctx.postMessage({ ok: true, data, preview, patchChecks, removed }, [data.buffer, preview.positions.buffer, preview.indices.buffer]);
  } catch (err) {
    ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
