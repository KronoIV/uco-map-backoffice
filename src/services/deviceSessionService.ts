import api from './api';
import type { DeviceSession, SessionStats } from '../types';

export const deviceSessionService = {
  getAll: () => api.get<DeviceSession[]>('/api/sessions').then(r => r.data),
  getStats: () => api.get<SessionStats>('/api/sessions/stats').then(r => r.data),
};
