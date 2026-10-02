// Formatos y textos de la analítica: un solo lugar para que todo el panel diga lo mismo.

const nf = new Intl.NumberFormat('es-CO');
const nf1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

export function fmtNumber(n: number | null | undefined, decimals = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  return decimals > 0 ? nf1.format(n) : nf.format(Math.round(n));
}

export function fmtPercent(ratio: number | null | undefined, decimals = 0): string {
  if (ratio == null || Number.isNaN(ratio)) return '—';
  return `${(ratio * 100).toLocaleString('es-CO', { maximumFractionDigits: decimals })} %`;
}

/** Duración legible: «45 s», «3 min 20 s», «1 h 05 min», «12 h». */
export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 && m < 10 ? `${m} min ${s % 60} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${String(m % 60).padStart(2, '0')} min` : `${h} h`;
}

export function fmtMeters(m: number | null | undefined): string {
  if (m == null) return '—';
  return m >= 1000 ? `${(m / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`;
}

export function fmtDay(isoDate: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  // yyyy-MM-dd sin hora: se interpreta como fecha local para no correr un día por la zona horaria
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', opts);
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Cambio relativo frente al periodo anterior (null si no es comparable o el anterior fue 0). */
export function relativeChange(value: number | null, previous: number | null): number | null {
  if (value == null || previous == null || previous === 0) return null;
  return (value - previous) / previous;
}

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const WEEKDAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export const PLATFORM_LABEL: Record<string, string> = {
  iOS: 'iPhone / iPad',
  Android: 'Android',
  'Desktop-Windows': 'Computador Windows',
  'Desktop-Mac': 'Computador Mac',
  'Desktop-Linux': 'Computador Linux',
  'Mobile-Other': 'Otro móvil',
  Web: 'Otro navegador',
  Postman: 'Pruebas (Postman)',
  'App-Native': 'App nativa',
  Unknown: 'Desconocido',
};

export const PLATFORM_OPTIONS = ['iOS', 'Android', 'Desktop-Windows', 'Desktop-Mac', 'Desktop-Linux'];

export const PLATFORM_COLOR: Record<string, string> = {
  iOS: '#4B5563',
  Android: '#3DDC84',
  'Desktop-Windows': '#0078D4',
  'Desktop-Mac': '#A1A1AA',
  'Desktop-Linux': '#F59E0B',
};

/** Funciones de la app según lo que registra (sessionTracker.trackView). */
export const FEATURE_LABEL: Record<string, { label: string; hint: string }> = {
  destination: { label: 'Eligió un destino', hint: 'Confirmó un lugar para navegar' },
  'mode:outdoor': { label: 'Mapa exterior', hint: 'Guía con el mapa hasta el edificio' },
  'mode:indoor': { label: 'Modo interior', hint: 'Entró al modo dentro del edificio' },
  'mode:ar-indoor': { label: 'Cámara (AR)', hint: 'Abrió la guía con cámara' },
  'ar:localized': { label: 'Ubicación con cámara', hint: 'La cámara logró ubicarlo dentro del edificio' },
  'mode:ar-arrived': { label: 'Llegó con la cámara', hint: 'La cámara confirmó la llegada al salón' },
  'mode:ar-stopped': { label: 'Cerró la cámara', hint: 'Salió de la guía con cámara' },
  'mode:arrival-screen': { label: 'Llegada sin cámara', hint: 'Llegó al edificio con la guía con cámara desactivada' },
  'tab:rooms': { label: 'Lista de lugares', hint: 'Abrió la pestaña Lugares' },
  'tab:kb': { label: 'Ayuda', hint: 'Abrió la pestaña Ayuda' },
  'tab:navigation': { label: 'Inicio', hint: 'Volvió a la pestaña Inicio' },
  search: { label: 'Búsqueda', hint: 'Escribió en el buscador' },
  'help:demo': { label: 'Tutorial de cámara', hint: 'Vio la animación de cómo usar la cámara' },
};

export const PERMISSION_LABEL: Record<string, string> = {
  camera: 'Cámara',
  location: 'Ubicación',
  motion: 'Movimiento (iPhone)',
};

export const PROBLEM_INFO: Record<string, { label: string; hint: string; baseLabel: string }> = {
  'trip-timeout': {
    label: 'Salieron de la app a mitad de recorrido',
    hint: 'La app dejó de avisar sin cerrar el recorrido (cerraron el navegador o el sistema la cerró).',
    baseLabel: 'recorridos terminados',
  },
  'trip-abandoned-outdoor': {
    label: 'Abandonaron antes de llegar al edificio',
    hint: 'Cerraron la navegación en el mapa exterior: puede indicar rutas confusas o GPS impreciso.',
    baseLabel: 'recorridos terminados',
  },
  'ar-not-located': {
    label: 'La cámara no logró ubicarlos',
    hint: 'Recorridos con cámara que terminaron sin una sola ubicación VPS.',
    baseLabel: 'recorridos con cámara',
  },
  'vps-many-failures': {
    label: 'Muchos intentos fallidos de ubicación',
    hint: 'Recorridos con cámara con 3 o más intentos de ubicación fallidos.',
    baseLabel: 'recorridos con cámara',
  },
  'gps-poor-start': {
    label: 'GPS impreciso al empezar',
    hint: 'La precisión del GPS al iniciar fue peor que 30 m: el mapa puede ubicar mal al usuario.',
    baseLabel: 'recorridos con GPS',
  },
  'camera-refused': {
    label: 'Rechazaron la cámara',
    hint: 'Usuarios cuyo último estado de la cámara es rechazado o bloqueado.',
    baseLabel: 'usuarios con datos de permisos',
  },
  'location-refused': {
    label: 'Rechazaron la ubicación',
    hint: 'Usuarios cuyo último estado de la ubicación es rechazado o bloqueado.',
    baseLabel: 'usuarios con datos de permisos',
  },
  'motion-refused': {
    label: 'Rechazaron el movimiento (iPhone)',
    hint: 'Sin este permiso la cámara no sabe hacia dónde apunta el teléfono.',
    baseLabel: 'usuarios de iPhone',
  },
  'short-sessions': {
    label: 'Visitas de menos de 10 s',
    hint: 'Abrieron la app y la cerraron casi de inmediato.',
    baseLabel: 'visitas',
  },
};

export const ABANDON_STAGE_LABEL: Record<string, { label: string; hint: string }> = {
  outdoor: { label: 'En el camino al edificio', hint: 'No llegaron a entrar al modo interior' },
  'in-building': { label: 'Dentro, sin cámara', hint: 'Llegaron al edificio pero no usaron la cámara' },
  locating: { label: 'Dentro, ubicándose', hint: 'Abrieron la cámara pero no lograron ubicarse' },
  'indoor-route': { label: 'Siguiendo las flechas', hint: 'Ya ubicados, dejaron el camino interior' },
  'changed-destination': { label: 'Cambiaron de destino', hint: 'Eligieron otro lugar a mitad de camino' },
  unknown: { label: 'Sin datos', hint: 'La app se cerró sin avisar en qué punto iba' },
};

export const END_REASON_LABEL: Record<string, string> = {
  'ar-arrival': 'Llegó (cámara)',
  'building-arrival': 'Llegó al edificio',
  closed: 'Cerró la navegación',
  'destination-changed': 'Cambió de destino',
  'page-closed': 'Cerró la app',
  timeout: 'Salió de la app sin cerrar',
};

export const START_MODE_LABEL: Record<string, string> = {
  outdoor: 'Desde fuera (mapa)',
  indoor: 'Ya en el edificio',
  ask: 'GPS dudoso (se le preguntó)',
  unknown: 'Sin dato',
};
