import api from './api';
import type { AdminUser, CreateUserRequest, UpdateUserRequest } from '../types';

export const userService = {
  getAll: () => api.get<AdminUser[]>('/api/users').then(r => r.data),

  getById: (id: string) => api.get<AdminUser>(`/api/users/${id}`).then(r => r.data),

  create: (data: CreateUserRequest) =>
    api.post<AdminUser>('/api/users', data).then(r => r.data),

  update: (id: string, data: UpdateUserRequest) =>
    api.put<AdminUser>(`/api/users/${id}`, data).then(r => r.data),

  // Logical deactivation — does NOT call DELETE
  setActive: (id: string, active: boolean) =>
    api.put<AdminUser>(`/api/users/${id}`, { active }).then(r => r.data),
};
