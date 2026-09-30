import api from './api';
import type { NavigationTrip, PageResponse, TripFilters, TripSummary } from '../types';

const clean = (f: TripFilters) => ({
  from: f.from || undefined,
  to: f.to || undefined,
  building: f.building || undefined,
});

export const tripService = {
  getPage: (filters: TripFilters, page: number, size: number) =>
    api.get<PageResponse<NavigationTrip>>('/api/trips', { params: { ...clean(filters), page, size } })
      .then(r => r.data),
  getSummary: (filters: TripFilters) =>
    api.get<TripSummary>('/api/trips/summary', { params: clean(filters) }).then(r => r.data),
  exportCsv: (filters: TripFilters) =>
    api.get<Blob>('/api/trips/export', { params: clean(filters), responseType: 'blob', timeout: 60_000 })
      .then(r => r.data),
};
