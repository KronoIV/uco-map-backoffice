// Tipos del VPS propio (vps-server). Poses en S: mano derecha, Y arriba, metros (la misma convención que arPosition).

export interface VpsToken {
  token: string;
  expiresAt: string;
  baseUrl: string;
  mapSetId: string;
  scope: 'localize' | 'admin';
}

export interface Vec3 { x: number; y: number; z: number }
export interface Quat { x: number; y: number; z: number; w: number }
export interface VpsPose { position: Vec3; rotation: Quat }

export interface VpsFileInfo {
  sha256: string;
  size: number;
  triangles?: number | null;
  fileName?: string | null;
}

export interface VpsScan {
  id: string;
  mapId: string;
  createdAt: string;
  createdBy?: string;
  source?: string | null;
  files: Partial<Record<'textured' | 'raw', VpsFileInfo>>;
  /** URLs firmadas de los archivos (solo en la lista de escaneos de un mapa). */
  urls?: Partial<Record<'textured' | 'raw', string>>;
}

export interface VpsMap {
  id: string;
  mapSetId: string;
  code: string;
  name: string;
  order?: number;
  createdAt?: string;
  inHeadRevision: boolean;
  pose: VpsPose | null;
  scan: VpsScan | null;
}

export interface VpsRevisionSummary {
  id: string;
  number: number;
  note?: string | null;
  createdAt: string;
  createdBy?: string | null;
  maps: number;
}

export interface VpsRevision extends VpsRevisionSummary {
  poses: Record<string, VpsPose>;
  scans: Record<string, string>;
}

export type VpsRecallKey = 'recall@0.25m2deg' | 'recall@0.5m5deg' | 'recall@1.0m10deg';

/** Resumen de la evaluación con imágenes sintéticas (evaluate.py → summarize). */
export type VpsEvalSummary = Partial<Record<VpsRecallKey, number>> & {
  queries: number;
  accepted: number;
  falsePositives: number;
  falsePositiveRate: number;
  medianPosErrM: number | null;
  medianRotErrDeg: number | null;
  latencyMsP50: number | null;
  latencyMsP90: number | null;
  rejections: Record<string, number>;
  name?: string;
};

export interface VpsEvaluation {
  default?: VpsEvalSummary | null;
  calibrated?: VpsEvalSummary | null;
  perMap?: Record<string, VpsEvalSummary>;
  calibration?: { samples?: number; positives?: number; usable?: boolean; brier?: number; acceptMinProb?: number };
  error?: string | null;
  at?: string;
}

export type VpsBuildStatus = 'queued' | 'running' | 'ready' | 'failed' | 'cancelled';

export interface VpsBuild {
  id: string;
  mapSetId?: string;
  revisionId?: string;
  revisionNumber: number;
  status: VpsBuildStatus;
  spaceId?: string | null;
  counts?: { keyframes?: number; points?: number } | null;
  bytes?: number | null;
  evaluation?: VpsEvaluation | null;
  error?: string | null;
  createdAt: string;
  createdBy?: string | null;
  finishedAt?: string | null;
  jobId?: string | null;
}

export type VpsJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface VpsJob {
  id: string;
  type: 'build' | 'evaluate';
  mapSetId?: string;
  status: VpsJobStatus;
  progress?: { stage: string; done: number; total: number; message?: string | null } | null;
  payload?: { buildId?: string } & Record<string, unknown>;
  error?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface VpsMapSet {
  id: string;
  name: string;
  frame?: 'rhs';
  activeBuildId?: string | null;
  previousBuildId?: string | null;
  activeSpaceId?: string | null;
  headRevisionId?: string | null;
  activeBuild?: VpsBuild | null;
  previousBuild?: VpsBuild | null;
}

export interface VpsMapSetDetail extends VpsMapSet {
  maps: VpsMap[];
  headRevision: VpsRevision | null;
}

export interface VpsActivation {
  id: string;
  kind: 'activate' | 'rollback';
  buildId: string;
  previousBuildId?: string | null;
  spaceId?: string | null;
  note?: string | null;
  at: string;
  by?: string | null;
}

export interface VpsMeshItem {
  name: string;
  mapId: string;
  mapCode: string;
  url: string;
  position: Vec3;
  rotation: { qx: number; qy: number; qz: number; qw: number };
  frame: 'rhs';
  sha256: string;
  size: number;
  triangles?: number | null;
}

export interface VpsMeshes {
  mapSetId: string;
  revision: number;
  revisionId: string;
  spaceId: string;
  frame: 'rhs';
  meshes: VpsMeshItem[];
}

export interface VpsUpload {
  id: string;
  chunkSize: number;
  chunks: number;
  status?: string;
}

export interface VpsSolveResult { pose: VpsPose; residualsM: number[]; rmsM: number; maxM: number }
export interface VpsIcpResult { pose: VpsPose; rmsM: number; fitness: number; iterations: number; points: number }

export interface VpsIntrinsics { fx: number; fy: number; px: number; py: number; width: number; height: number }

export interface VpsLocalizeResult {
  poseFound: boolean;
  confidence: number;
  pose: VpsPose | null;
  mapCodes: string[];
  spaceId: string | null;
  buildId: string | null;
  reason: string | null;
  message: string | null;
  intrinsics?: VpsIntrinsics | null;
  serverTimeMs?: number;
  cached?: boolean;
  requestId?: string;
  timings?: Record<string, number>;
}

export interface VpsLogStats {
  requests: number;
  found: number;
  foundRate: number | null;
  cached: number;
  serverMsP50: number | null;
  serverMsP90: number | null;
  rejections: Record<string, number>;
}

export interface VpsLogItem {
  id: string;
  at: string;
  poseFound: boolean;
  reason?: string | null;
  confidence?: number | null;
  serverTimeMs?: number | null;
  cached?: boolean;
  mapCodes?: string[];
  sub?: string | null;
  buildId?: string | null;
  mode?: string | null;
  /** Lo que manda el cliente en meta.client (app, plataforma, versión…). */
  client?: Record<string, string> | null;
}
