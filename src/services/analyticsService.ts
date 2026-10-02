import api from './api';
import type { AnalyticsOverview, AnalyticsQuery, TripAnalytics } from '../types/analytics';

const TZ = 'America/Bogota';

const params = (q: AnalyticsQuery) => ({
  from: q.from,
  to: q.to,
  tz: TZ,
  platform: q.platform || undefined,
  building: q.building || undefined,
});

export const analyticsService = {
  getOverview: (q: AnalyticsQuery) =>
    api.get<AnalyticsOverview>('/api/analytics', { params: params(q), timeout: 30_000 }).then(r => r.data),
  getTrips: (q: AnalyticsQuery) =>
    api.get<TripAnalytics>('/api/analytics/trips', { params: params(q), timeout: 30_000 }).then(r => r.data),
};
