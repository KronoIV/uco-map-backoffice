import api from './api';
import type { DeviceSession, PageResponse, SessionStats, SessionStatusFilter } from '../types';

export interface SessionQuery {
  q?: string;
  status?: SessionStatusFilter;
  page: number;
  size: number;
}

export const deviceSessionService = {
  getPage: ({ q, status, page, size }: SessionQuery) =>
    api.get<PageResponse<DeviceSession>>('/api/sessions', {
      params: { q: q || undefined, status: status ?? 'all', page, size },
    }).then(r => r.data),
  getStats: () => api.get<SessionStats>('/api/sessions/stats').then(r => r.data),
};
