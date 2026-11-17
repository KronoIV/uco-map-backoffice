import api from './api';
import type { MapMesh, MultiSetUsage, MultiSetUsageRequest } from '../types';

export const multisetService = {
  // El backend consulta MultiSet y firma las URLs; puede tardar más que el timeout por defecto
  getMapMeshes: () =>
    api.get<MapMesh[]>('/api/multiset/map-meshes', { timeout: 60000 }).then(r => r.data),
  // Estimación local: no gasta llamadas de MultiSet
  getUsage: () => api.get<MultiSetUsage>('/api/multiset/usage').then(r => r.data),
  updateUsage: (data: MultiSetUsageRequest) =>
    api.put<MultiSetUsage>('/api/multiset/usage', data).then(r => r.data),
};
