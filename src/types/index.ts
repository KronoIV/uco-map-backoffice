// ──────────────── API Contract ───────────────────────────────
export interface ApiSuccess<T> {
  data: T;
  succeeded: true;
}

export interface ApiError {
  error: string;
  succeeded: false;
  details?: Record<string, string>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ──────────────── Common ──────────────────────────────────────
export interface GpsPoint {
  lat: number;
  lng: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

// ──────────────── Graph ───────────────────────────────────────
export type NodeType = 'BUILDING' | 'ENTRANCE' | 'WAYPOINT';

export interface GraphNode {
  nodeId: string;
  gps: GpsPoint;
  pixel: PixelPoint;
  label?: string;
  nodeType: NodeType;
  active: boolean;
}

export interface GraphEdge {
  id: string;
  nodeA: string;
  nodeB: string;
  active: boolean;
}

// ──────────────── Building ────────────────────────────────────
export interface Building {
  buildingId: string;
  label: string;
  color?: string;
  category?: string;
  gps?: GpsPoint;
  active: boolean;
}

// ──────────────── Room ────────────────────────────────────────
/** Posición en metros dentro del mapa MultiSet (mismo espacio que la escena de Mattercraft). */
export interface ArPoint {
  x: number;
  y: number;
  z: number;
}

export interface Room {
  id?: string;
  roomId: string;
  name: string;
  category: string;
  stateId: string;
  modelUrl?: string;
  arPosition?: ArPoint | null;
  active: boolean;
}

// ──────────────── MultiSet ─────────────────────────────────────
export interface MapMesh {
  name: string;
  url: string;
  position: { x: number; y: number; z: number };
  rotation: { qx: number; qy: number; qz: number; qw: number };
}

// ──────────────── Navegación (navmesh) ─────────────────────────
/** Enlace entre dos zonas del navmesh sin suelo continuo (escaleras). */
export interface NavConnection {
  id?: string;
  label: string;
  group?: string;
  start: ArPoint;
  end: ArPoint;
  radius: number;
  bidirectional: boolean;
}

export interface NavMeshInfo {
  updatedAt: string;
  updatedBy: string;
  sizeBytes: number;
}

// ──────────────── PoiClip ─────────────────────────────────────
export interface PoiClip {
  clipId: string;
  displayName: string;
  active: boolean;
}

// ──────────────── MapConfig ───────────────────────────────────
export interface MapConfig {
  id?: string;
  mapBounds?: number[][];
  zoomThreshold?: number;
}

// ──────────────── DeviceSession ───────────────────────────────
export interface DeviceSession {
  id: string;
  deviceId: string;
  platform: string;
  userAgent?: string;
  ipAddress?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  language?: string;
  timezone?: string;
  screenResolution?: string;
  networkType?: string;
  firstSeen: string; // ISO-8601
  lastSeen: string;  // ISO-8601
  /** Pings recibidos (la app avisa cada 2 min y en cada pantalla): no son visitas. */
  sessionCount: number;
  /** Visitas reales; 0 en dispositivos que solo usaron versiones anteriores a la 2.1. */
  visitCount?: number;
  /** Tiempo de uso real sumado de todas sus visitas (ms). */
  totalActiveMs?: number;
  permissions?: PermissionSnapshot;
}

export interface PermissionSnapshot {
  camera?: string;
  location?: string;
  motion?: string;
}

export interface SessionStats {
  totalDevices: number;
  /** Pings acumulados (histórico). */
  totalSessions: number;
  byPlatform: Record<string, number>;
  /** Con ping en los últimos 10 min */
  activeNow: number;
  /** Con ping en las últimas 24 h (incluye activeNow) */
  activeToday: number;
  totalVisits?: number;
  totalActiveMs?: number;
}

export type SessionStatusFilter = 'all' | 'active' | 'today' | 'inactive';

/** Página de resultados del backend; page empieza en 0. */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// ──────────────── NavigationTrip ──────────────────────────────
export type TripStatus = 'IN_PROGRESS' | 'ARRIVED' | 'ABANDONED';

export interface NavigationTrip {
  id: string;
  tripId: string;
  deviceId: string;
  platform?: string;
  roomId?: string;
  roomName: string;
  building?: string;
  startMode?: 'indoor' | 'outdoor' | 'ask';
  startDistanceM?: number;
  startAccuracyM?: number;
  startLat?: number;
  startLng?: number;
  status: TripStatus;
  endReason?: string;
  startedAt: string; // ISO-8601
  endedAt?: string;
  lastSeenAt?: string;
  durationMs?: number;
  buildingReachedMs?: number;
  localizedMs?: number;
  outdoorRouteM?: number;
  indoorRouteM?: number;
  modeSwitches?: number;
  vpsFailures?: number;
  usedAR?: boolean;
}

export interface TripFilters {
  from?: string; // ISO-8601
  to?: string;
  building?: string;
}

export interface TripDestinationStats {
  building?: string;
  roomName: string;
  total: number;
  finished: number;
  arrived: number;
  avgArrivalMs: number | null;
  medianArrivalMs: number | null;
}

export interface TripSummary {
  total: number;
  finished: number;
  arrived: number;
  inProgress: number;
  avgArrivalMs: number | null;
  medianArrivalMs: number | null;
  avgLocalizedMs: number | null;
  avgVpsFailures: number | null;
  byDestination: TripDestinationStats[];
  abandonReasons: { reason: string; count: number }[];
  buildings: string[];
}

// ──────────────── AppSetting (Feature Flags) ────────────────
export type SettingType = 'BOOLEAN' | 'STRING' | 'NUMBER' | 'JSON';

export interface AppSetting {
  key: string;
  value: string;
  type: SettingType;
  description?: string;
  category?: string;
  active: boolean;
  updatedAt?: string; // ISO-8601
}

// ──────────────── Auth ────────────────────────────────────────
export interface AppUser {
  email: string;
  role: string;
}

export interface AuthLoginResponse {
  token: string;
  email: string;
  role: string;
}

// ──────────────── User (admin module) ─────────────────────────
export interface AdminUser {
  id: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  passwordChangedAt?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
  active?: boolean;
}