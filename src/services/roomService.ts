import api from './api';
import type { ArPoint, Room } from '../types';

export const roomService = {
  getAll: () => api.get<Room[]>('/api/rooms').then(r => r.data),
  getById: (id: string) => api.get<Room>(`/api/rooms/${encodeURIComponent(id)}`).then(r => r.data),
  create: (data: Partial<Room>) => api.post<Room>('/api/rooms', data).then(r => r.data),
  update: (id: string, data: Partial<Room>) =>
    api.put<Room>(`/api/rooms/${encodeURIComponent(id)}`, data).then(r => r.data),
  setArPosition: (id: string, arPosition: ArPoint | null) =>
    api.patch<Room>(`/api/rooms/${encodeURIComponent(id)}`, { arPosition }).then(r => r.data),
  delete: (id: string) => api.delete(`/api/rooms/${encodeURIComponent(id)}`),
};
