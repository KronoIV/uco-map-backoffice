// Respuestas de GET /api/analytics y /api/analytics/trips (tiempos en ms, distancias en m).

/** previous es null cuando el periodo anterior es de antes de que existiera el dato. */
export interface Metric {
  value: number | null;
  previous: number | null;
}

export interface AnalyticsPeriod {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  timezone: string;
  platform: string | null;
}

export interface Bucket { label: string; count: number }
export interface Count { key: string; count: number }

export interface DayPoint {
  date: string; // yyyy-MM-dd
  activeUsers: number;
  newUsers: number;
  sessions: number;
  activeMs: number;
  trips: number;
  arrived: number;
}

export interface Durations {
  count: number;
  meanMs: number | null;
  medianMs: number | null;
  p75Ms: number | null;
  p90Ms: number | null;
  p95Ms: number | null;
  totalMs: number;
  histogram: Bucket[];
}

export interface FeatureUsage { key: string; sessions: number; users: number; uses: number }

export interface PermissionStat {
  permission: 'camera' | 'location' | 'motion';
  granted: number;
  denied: number;
  blocked: number;
  pending: number;
  unavailable: number;
  notRequired: number;
}

export interface PermissionDay {
  date: string;
  users: number;
  allGranted: number;
  cameraGranted: number;
  locationGranted: number;
  motionGranted: number;
  motionRequired: number;
}

export interface Problem { code: string; count: number; base: number }

export interface AnalyticsOverview {
  period: AnalyticsPeriod;
  summary: {
    activeUsers: Metric;
    newUsers: Metric;
    returningUsers: Metric;
    sessions: Metric;
    sessionsPerUser: Metric;
    totalActiveMs: Metric;
    avgSessionMs: Metric;
    medianSessionMs: Metric;
    trips: Metric;
    arrivedTrips: Metric;
    abandonedTrips: Metric;
    completionRate: Metric;
  };
  daily: DayPoint[];
  /** [día de la semana: 0 = lunes][hora 0–23] */
  sessionsByWeekdayHour: number[][];
  sessionDurations: Durations;
  users: { active: number; newUsers: number; returning: number; sessionsPerUser: Bucket[] };
  devices: {
    users: number;
    platforms: Count[];
    browsers: Count[];
    os: Count[];
    appVersions: Count[];
    networks: Count[];
  };
  features: FeatureUsage[];
  permissions: {
    usersWithData: number;
    byPermission: PermissionStat[];
    grantedOfThree: Count[];
    daily: PermissionDay[];
  };
  problems: Problem[];
  coverage: { sessionsSince: string | null; tripsSince: string | null; devicesSince: string | null };
}

export interface TripAnalytics {
  period: AnalyticsPeriod;
  summary: {
    total: Metric;
    arrived: Metric;
    abandoned: Metric;
    inProgress: number;
    completionRate: Metric;
    medianDurationMs: number | null;
    p75DurationMs: number | null;
    p90DurationMs: number | null;
    avgDurationMs: number | null;
    medianAbandonMs: number | null;
    avgRouteM: number | null;
    arUsageRate: number | null;
    medianLocalizedMs: number | null;
    avgVpsFailures: number | null;
    withOrigin: number;
  };
  destinations: {
    building: string | null;
    buildingLabel: string | null;
    roomName: string;
    total: number;
    arrived: number;
    abandoned: number;
    completionRate: number | null;
    medianDurationMs: number | null;
    avgDurationMs: number | null;
    avgRouteM: number | null;
  }[];
  origins: { label: string; total: number; arrived: number }[];
  routes: {
    origin: string;
    destination: string;
    building: string | null;
    total: number;
    arrived: number;
    medianDurationMs: number | null;
    avgRouteM: number | null;
  }[];
  abandonStages: Count[];
  abandonReasons: Count[];
  startModes: Count[];
  startDistances: Bucket[];
  daily: { date: string; total: number; arrived: number; abandoned: number }[];
  byWeekdayHour: number[][];
  originPoints: { lat: number; lng: number; weight: number }[];
  destinationPoints: { building: string; label: string; lat: number; lng: number; total: number; arrived: number }[];
  buildings: string[];
}

export interface AnalyticsQuery {
  from: string;
  to: string;
  platform?: string;
  building?: string;
}
