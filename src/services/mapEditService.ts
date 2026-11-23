import api from './api';
import type { NavBlock, ScanEdit } from '../types';

const BASE = '/api/navigation';

export const mapEditService = {
  getScanEdits: () => api.get<ScanEdit[]>(`${BASE}/scan-edits`).then(r => r.data),
  createScanEdit: (e: ScanEdit) => api.post<ScanEdit>(`${BASE}/scan-edits`, e, { timeout: 60000 }).then(r => r.data),
  deleteScanEdit: (id: string) => api.delete(`${BASE}/scan-edits/${id}`),

  getBlocks: () => api.get<NavBlock[]>(`${BASE}/blocks`).then(r => r.data),
  createBlock: (b: NavBlock) => api.post<NavBlock>(`${BASE}/blocks`, b).then(r => r.data),
  deleteBlock: (id: string) => api.delete(`${BASE}/blocks/${id}`),
};
