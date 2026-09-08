import api from './api';
import type { Building, MapConfig, PoiClip } from '../types';

export const buildingService = {
  getAll: () => api.get<Building[]>('/api/buildings').then(r => r.data),
  getById: (id: string) => api.get<Building>(`/api/buildings/${id}`).then(r => r.data),
  create: (data: Partial<Building>) => api.post<Building>('/api/buildings', data).then(r => r.data),
  update: (id: string, data: Partial<Building>) =>
    api.put<Building>(`/api/buildings/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/buildings/${id}`),

  getMapConfig: () => api.get<MapConfig>('/api/map/config').then(r => r.data),
  updateMapConfig: (data: Partial<MapConfig>) =>
    api.put<MapConfig>('/api/map/config', data).then(r => r.data),

  getClips: () => api.get<PoiClip[]>('/api/poi-clips').then(r => r.data),
  createClip: (data: Partial<PoiClip>) => api.post<PoiClip>('/api/poi-clips', data).then(r => r.data),
  deleteClip: (clipId: string) => api.delete(`/api/poi-clips/${clipId}`),
};
