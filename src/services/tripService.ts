import api from './api';
import type { NavigationTrip } from '../types';

export const tripService = {
  getAll: () => api.get<NavigationTrip[]>('/api/trips').then(r => r.data),
};
