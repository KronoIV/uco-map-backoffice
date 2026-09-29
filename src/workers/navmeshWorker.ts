import { buildNavMesh, type OffMeshConnectionInput } from '../utils/navmesh';

export interface GenerateRequest {
  positions: Float32Array;
  indices: Uint32Array;
  connections: OffMeshConnectionInput[];
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<GenerateRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

ctx.onmessage = async e => {
  try {
    const { data, preview } = await buildNavMesh(e.data.positions, e.data.indices, e.data.connections);
    ctx.postMessage({ ok: true, data, preview }, [data.buffer, preview.positions.buffer, preview.indices.buffer]);
  } catch (err) {
    ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
