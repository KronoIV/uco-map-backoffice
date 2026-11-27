import api, { resolveApiError } from './api';
import type { MapMesh } from '../types';
import type {
  VpsActivation, VpsBuild, VpsIcpResult, VpsJob, VpsLocalizeResult, VpsLogItem, VpsLogStats, VpsMap, VpsMapSet,
  VpsMapSetDetail, VpsMeshes, VpsPose, Vec3, VpsRevision, VpsScan, VpsSolveResult, VpsToken, VpsUpload,
} from '../types/vps';

// El panel habla directo con el VPS (archivos de cientos de MB no pasan por el backend). El backend solo entrega
// un token de alcance admin (30 min) a los usuarios ADMIN.

const TOKEN_MARGIN_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 30_000;

export class VpsApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'VpsApiError';
    this.status = status;
    this.code = code;
  }
}

let current: { token: VpsToken; until: number } | null = null;
let pending: Promise<VpsToken> | null = null;

function adminToken(force = false): Promise<VpsToken> {
  if (!force && current && Date.now() < current.until) return Promise.resolve(current.token);
  pending ??= api.post<VpsToken>('/api/vps/admin-token')
    .then(({ data }) => {
      const expires = Date.parse(data.expiresAt);
      current = { token: data, until: Number.isFinite(expires) ? expires - TOKEN_MARGIN_MS : Date.now() + 5 * 60_000 };
      return data;
    })
    .catch((err: unknown) => {
      const status = (err as { response?: { status?: number } }).response?.status ?? 0;
      throw new VpsApiError(resolveApiError(err), status, status === 503 ? 'not_configured' : 'token');
    })
    .finally(() => { pending = null; });
  return pending;
}

type RequestOptions = RequestInit & { timeoutMs?: number };

async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;
  const t = await adminToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${t.token}`);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${t.baseUrl.replace(/\/+$/, '')}${path}`, { ...init, headers, signal: controller.signal });
  } catch {
    throw new VpsApiError(
      controller.signal.aborted ? 'El VPS propio no respondió a tiempo' : `No hay conexión con el VPS propio (${t.baseUrl})`,
      0,
      'network',
    );
  } finally {
    clearTimeout(timer);
  }
  // Token vencido o rotado en el VPS: se pide otro una sola vez
  if (res.status === 401 && !retried) {
    current = null;
    return request<T>(path, options, true);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new VpsApiError(error?.message ?? `El VPS propio respondió ${res.status}`, res.status, error?.code ?? 'http');
  }
  return body as T;
}

const post = (data?: unknown): RequestOptions => ({
  method: 'POST',
  body: data === undefined ? undefined : JSON.stringify(data),
});

const mapSetPath = (id: string) => `/v1/admin/map-sets/${encodeURIComponent(id)}`;

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** Sube un archivo por partes (el VPS fija el tamaño de cada parte) y devuelve el id de la subida completa. */
async function uploadFile(file: File, kind: 'textured' | 'raw', onProgress?: (pct: number) => void): Promise<string> {
  const data = await file.arrayBuffer();
  const sha256 = await sha256Hex(data);
  const up = await request<VpsUpload>('/v1/admin/uploads', post({ fileName: file.name, size: file.size, sha256, kind }));
  for (let i = 0; i < up.chunks; i++) {
    await request(`/v1/admin/uploads/${up.id}/chunks/${i}`, {
      method: 'PUT',
      body: data.slice(i * up.chunkSize, Math.min((i + 1) * up.chunkSize, data.byteLength)),
      headers: { 'Content-Type': 'application/octet-stream' },
      timeoutMs: 120_000,
    });
    onProgress?.(Math.round(((i + 1) / up.chunks) * 100));
  }
  // Verifica el hash y extrae triángulos y tamaño: puede tardar con mallas grandes
  await request(`/v1/admin/uploads/${up.id}/complete`, { method: 'POST', timeoutMs: 300_000 });
  return up.id;
}

const items = <T>(r: { items: T[] }) => r.items;

export interface IcpRequest {
  mapId: string;
  scanId?: string;
  pose: VpsPose;
  maxDistanceM: number;
  dof: 4 | 6;
}

export interface RevisionRequest {
  poses: Record<string, VpsPose>;
  scans: Record<string, string>;
  remove: string[];
  note: string;
}

export const vpsService = {
  token: () => adminToken(),
  status: () => request<Record<string, unknown>>('/v1/status'),
  getMapSet: (id: string) => request<VpsMapSetDetail>(mapSetPath(id)),
  getMeshes: (id: string, revision: 'active' | 'head' | number = 'active') =>
    request<VpsMeshes>(`${mapSetPath(id)}/meshes?type=textured&revision=${revision}`),
  addMap: (id: string, name: string) => request<VpsMap>(`${mapSetPath(id)}/maps`, post({ name })),
  renameMap: (mapId: string, name: string) =>
    request<VpsMap>(`/v1/admin/maps/${encodeURIComponent(mapId)}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  listScans: (mapId: string) =>
    request<{ items: VpsScan[] }>(`/v1/admin/maps/${encodeURIComponent(mapId)}/scans`).then(items),
  addScan: (mapId: string, texturedUploadId: string, rawUploadId?: string) =>
    request<VpsScan>(`/v1/admin/maps/${encodeURIComponent(mapId)}/scans`, post({ texturedUploadId, rawUploadId: rawUploadId ?? null })),
  uploadFile,
  solveAlignment: (id: string, pairs: { local: Vec3; world: Vec3 }[], dof: 4 | 6) =>
    request<VpsSolveResult>(`${mapSetPath(id)}/alignment/solve`, post({ pairs, dof })),
  refineIcp: (id: string, body: IcpRequest) =>
    request<VpsIcpResult>(`${mapSetPath(id)}/alignment/icp`, { ...post(body), timeoutMs: 180_000 }),
  listRevisions: (id: string) => request<{ items: VpsRevision[] }>(`${mapSetPath(id)}/revisions`).then(items),
  addRevision: (id: string, body: RevisionRequest) => request<VpsRevision>(`${mapSetPath(id)}/revisions`, post(body)),
  listBuilds: (id: string) => request<{ items: VpsBuild[] }>(`${mapSetPath(id)}/builds`).then(items),
  createBuild: (id: string, revisionId: string, evaluate: boolean) =>
    request<{ build: VpsBuild; job: VpsJob }>(`${mapSetPath(id)}/builds`, post({ revisionId, evaluate })),
  evaluateBuild: (buildId: string) =>
    request<{ job: VpsJob }>(`/v1/admin/builds/${encodeURIComponent(buildId)}/evaluate`, post({})),
  deleteBuild: (buildId: string) =>
    request<unknown>(`/v1/admin/builds/${encodeURIComponent(buildId)}`, { method: 'DELETE' }),
  activate: (id: string, buildId: string, note: string, force: boolean) =>
    request<VpsMapSet>(`${mapSetPath(id)}/activate`, post({ buildId, note, force })),
  rollback: (id: string, note: string) => request<VpsMapSet>(`${mapSetPath(id)}/rollback`, post({ note })),
  listActivations: (id: string) => request<{ items: VpsActivation[] }>(`${mapSetPath(id)}/activations`).then(items),
  listJobs: (id: string, limit = 20) =>
    request<{ items: VpsJob[] }>(`/v1/admin/jobs?mapSetId=${encodeURIComponent(id)}&limit=${limit}`).then(items),
  cancelJob: (jobId: string) => request<VpsJob>(`/v1/admin/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' }),
  logs: (id: string, hours = 24, limit = 50) =>
    request<{ items: VpsLogItem[]; stats: VpsLogStats; hours: number }>(`${mapSetPath(id)}/logs?hours=${hours}&limit=${limit}`),
  /** Prueba de localización con el token admin (incluye el alcance localize). */
  localize: (image: Blob, meta: Record<string, unknown>) => {
    const form = new FormData();
    form.append('image', image, 'query.jpg');
    form.append('meta', JSON.stringify(meta));
    return request<VpsLocalizeResult>('/v1/localize', { method: 'POST', body: form });
  },
};

export interface EditorMeshes {
  meshes: MapMesh[];
  spaceId: string;
}

/** Modelos del editor AR: los del build publicado del VPS propio. */
export async function loadEditorMeshes(): Promise<EditorMeshes> {
  const t = await adminToken();
  const r = await vpsService.getMeshes(t.mapSetId);
  if (r.meshes.length === 0) throw new Error('El VPS propio no tiene mapas publicados');
  return {
    spaceId: r.spaceId,
    meshes: r.meshes.map(m => ({ name: m.name, url: m.url, position: m.position, rotation: m.rotation })),
  };
}
