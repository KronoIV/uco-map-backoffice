import * as THREE from 'three';
import type { Quat, VpsBuildStatus, VpsEvalSummary, VpsJobStatus, VpsMapSetDetail, VpsPose } from '../../types/vps';

// Textos y conversiones del VPS propio compartidos por las pestañas.

export interface VpsTabProps {
  mapSetId: string;
  detail: VpsMapSetDetail;
  notify: (message: string) => void;
}

export const BUILD_STATUS: Record<VpsBuildStatus, { label: string; color: 'default' | 'info' | 'success' | 'error' | 'warning' }> = {
  queued: { label: 'En cola', color: 'default' },
  running: { label: 'Procesando', color: 'info' },
  ready: { label: 'Listo', color: 'success' },
  failed: { label: 'Falló', color: 'error' },
  cancelled: { label: 'Cancelado', color: 'warning' },
};

export const JOB_STATUS: Record<VpsJobStatus, string> = {
  queued: 'En cola',
  running: 'En curso',
  done: 'Terminado',
  failed: 'Falló',
  cancelled: 'Cancelado',
};

export const JOB_STAGES: Record<string, string> = {
  queued: 'En cola',
  map: 'Preparando mapas',
  render: 'Generando vistas',
  assemble: 'Uniendo el paquete',
  upload: 'Guardando el paquete',
  evaluate: 'Evaluando',
};

export const REASONS: Record<string, string> = {
  no_candidates: 'Sin candidatos (filtros de mapa, pista o piso)',
  few_matches: 'La imagen no se parece a ninguna zona',
  few_inliers: 'Pocos puntos consistentes',
  outside_floor_band: 'Fuera de la banda de piso',
  far_from_hint: 'Lejos de la pista de posición',
  gravity_mismatch: 'Inclinación distinta a la del teléfono',
  low_confidence: 'Confianza baja',
  unknown: 'Sin motivo',
};

/** Umbrales sugeridos para publicar (evaluación sintética, ver vps-server/DESIGN.md). */
export const PUBLISH_MIN_RECALL = 0.85;

export const RECALLS = [
  { key: 'recall@0.25m2deg', label: '≤ 0,25 m · 2°' },
  { key: 'recall@0.5m5deg', label: '≤ 0,5 m · 5°' },
  { key: 'recall@1.0m10deg', label: '≤ 1 m · 10°' },
] as const;

export const shortId = (id?: string | null) => (id ? `…${id.slice(-6)}` : '—');

export function fmtBytes(n?: number | null): string {
  if (n == null) return '—';
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toLocaleString('es-CO', { maximumFractionDigits: 2 })} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`;
  return `${Math.round(n / 1024).toLocaleString('es-CO')} kB`;
}

/** Evaluación que manda: la calibrada si existe (es la que usa el servidor al localizar). */
export const mainEval = (ev?: { default?: VpsEvalSummary | null; calibrated?: VpsEvalSummary | null } | null) =>
  ev?.calibrated ?? ev?.default ?? null;

export function meetsPublishBar(ev: VpsEvalSummary | null): boolean {
  return !!ev && (ev['recall@0.5m5deg'] ?? 0) >= PUBLISH_MIN_RECALL && ev.falsePositives === 0;
}

const DEG = 180 / Math.PI;

/** Giro (yaw, alrededor de Y), cabeceo y alabeo en grados; orden YXZ como la cámara de three.js. */
export function poseAngles(q: Quat): { yaw: number; pitch: number; roll: number } {
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w), 'YXZ');
  return { yaw: e.y * DEG, pitch: e.x * DEG, roll: e.z * DEG };
}

export function quatFromAngles(yaw: number, pitch: number, roll: number): Quat {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch / DEG, yaw / DEG, roll / DEG, 'YXZ'));
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

/** Punto en S → coordenadas propias del escaneo con esa pose (inversa de la pose). */
export function worldToLocal(pose: VpsPose, p: { x: number; y: number; z: number }) {
  const v = new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(poseMatrix(pose).invert());
  return { x: v.x, y: v.y, z: v.z };
}

/** Coordenadas propias del escaneo → punto en S con esa pose. */
export function localToWorld(pose: VpsPose, p: { x: number; y: number; z: number }) {
  const v = new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(poseMatrix(pose));
  return { x: v.x, y: v.y, z: v.z };
}

function poseMatrix(pose: VpsPose): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
    new THREE.Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w),
    new THREE.Vector3(1, 1, 1),
  );
}

export const IDENTITY_POSE: VpsPose = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };

export function samePose(a: VpsPose | null | undefined, b: VpsPose | null | undefined, eps = 1e-6): boolean {
  if (!a || !b) return a === b;
  const pa = a.position, pb = b.position, ra = a.rotation, rb = b.rotation;
  const dot = Math.abs(ra.x * rb.x + ra.y * rb.y + ra.z * rb.z + ra.w * rb.w);
  return Math.abs(pa.x - pb.x) < eps && Math.abs(pa.y - pb.y) < eps && Math.abs(pa.z - pb.z) < eps && dot > 1 - eps;
}
