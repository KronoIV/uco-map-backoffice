import api from './api';
import type { CampusEvent } from '../types';

export type CampusEventInput = Omit<CampusEvent, 'id' | 'createdAt' | 'updatedAt'>;

export const eventService = {
  getAll: () => api.get<CampusEvent[]>('/api/events').then(r => r.data),
  create: (data: CampusEventInput) => api.post<CampusEvent>('/api/events', data).then(r => r.data),
  update: (id: string, data: CampusEventInput) =>
    api.put<CampusEvent>(`/api/events/${encodeURIComponent(id)}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/events/${encodeURIComponent(id)}`),
};
