import api from './api';
import type { Room } from '../types';

export const roomService = {
  getAll: () => api.get<Room[]>('/api/rooms').then(r => r.data),
  getById: (id: string) => api.get<Room>(`/api/rooms/${id}`).then(r => r.data),
  create: (data: Partial<Room>) => api.post<Room>('/api/rooms', data).then(r => r.data),
  update: (id: string, data: Partial<Room>) =>
    api.put<Room>(`/api/rooms/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/rooms/${id}`),
};
