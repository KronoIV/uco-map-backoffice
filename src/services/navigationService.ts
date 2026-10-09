import api from './api';
import type { NavConnection, NavMeshInfo, NavPatch } from '../types';

const BASE = '/api/navigation';

export const navigationService = {
  getConnections: () => api.get<NavConnection[]>(`${BASE}/connections`).then(r => r.data),
  createConnection: (c: NavConnection) => api.post<NavConnection>(`${BASE}/connections`, c).then(r => r.data),
  updateConnection: (id: string, c: NavConnection) =>
    api.put<NavConnection>(`${BASE}/connections/${id}`, c).then(r => r.data),
  deleteConnection: (id: string) => api.delete(`${BASE}/connections/${id}`),

  getPatches: () => api.get<NavPatch[]>(`${BASE}/patches`).then(r => r.data),
  createPatch: (p: NavPatch) => api.post<NavPatch>(`${BASE}/patches`, p).then(r => r.data),
  updatePatch: (id: string, p: NavPatch) => api.put<NavPatch>(`${BASE}/patches/${id}`, p).then(r => r.data),
  deletePatch: (id: string) => api.delete(`${BASE}/patches/${id}`),

  getNavMeshInfo: () => api.get<NavMeshInfo | null>(`${BASE}/navmesh/info`).then(r => r.data),

  /** Navmesh publicado; null si no hay (la app usa el que trae incluido). */
  getNavMesh: async (): Promise<Uint8Array | null> => {
    try {
      const r = await api.get<ArrayBuffer>(`${BASE}/navmesh`, { responseType: 'arraybuffer' });
      return new Uint8Array(r.data);
    } catch (err) {
      if ((err as { response?: { status?: number } }).response?.status === 404) return null;
      throw err;
    }
  },

  saveNavMesh: (data: Uint8Array) =>
    api.put(`${BASE}/navmesh`, data.slice().buffer, {
      headers: { 'Content-Type': 'application/octet-stream' },
      timeout: 60000,
    }),
};
