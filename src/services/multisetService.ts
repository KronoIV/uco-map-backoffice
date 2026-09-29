import api from './api';
import type { MapMesh } from '../types';

export const multisetService = {
  // El backend consulta MultiSet y firma las URLs; puede tardar más que el timeout por defecto
  getMapMeshes: () =>
    api.get<MapMesh[]>('/api/multiset/map-meshes', { timeout: 60000 }).then(r => r.data),
};
