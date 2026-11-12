import type { ArPoint } from '../types';

/** Parada en edición: `button` vacío = el número del piso. */
export interface DraftStop {
  floor: number;
  button: string;
  point: ArPoint;
}

// Altura típica entre pisos, solo para proponer el número de una parada nueva (el admin lo corrige si hace falta)
const STOREY_M = 3.5;
// Las mismas reglas del backend (NavigationService): cada piso más arriba que el anterior, puertas cercanas en planta
const MIN_STOP_RISE_M = 1.5;
const MAX_STOP_SPREAD_M = 20;
const MIN_FLOOR = -5;
const MAX_FLOOR = 60;
export const MAX_BUTTON_LENGTH = 6;

/**
 * Agrega la parada del clic `p`, ordenadas de abajo hacia arriba. Un clic en un piso que ya tiene parada mueve esa
 * parada en vez de crear otra; el número de un piso nuevo se propone por su altura respecto de los ya marcados.
 */
export function addElevatorStop(stops: DraftStop[], p: ArPoint): DraftStop[] {
  const same = stops.findIndex(s => Math.abs(s.point.y - p.y) < MIN_STOP_RISE_M);
  if (same >= 0) return stops.map((s, i) => (i === same ? { ...s, point: p } : s));
  return [...stops, { floor: suggestFloor(stops, p.y), button: '', point: p }].sort((a, b) => a.point.y - b.point.y);
}

function suggestFloor(stops: DraftStop[], y: number): number {
  if (!stops.length) return 1;
  const near = stops.reduce((b, s) => (Math.abs(s.point.y - y) < Math.abs(b.point.y - y) ? s : b));
  const dir = y > near.point.y ? 1 : -1;
  let floor = near.floor + dir * Math.max(1, Math.round(Math.abs(y - near.point.y) / STOREY_M));
  while (stops.some(s => s.floor === floor)) floor += dir;
  return floor;
}

/** Qué impide guardar el ascensor (las reglas del backend con un mensaje claro), o null si se puede guardar. */
export function elevatorProblem(stops: DraftStop[]): string | null {
  if (stops.length < 2) return 'Marca la puerta del ascensor en al menos dos pisos.';
  if (stops.some(s => !Number.isInteger(s.floor) || s.floor < MIN_FLOOR || s.floor > MAX_FLOOR)) {
    return `Los pisos van de ${MIN_FLOOR} a ${MAX_FLOOR}.`;
  }
  if (stops.some(s => s.button.trim().length > MAX_BUTTON_LENGTH)) {
    return `El texto de un botón tiene más de ${MAX_BUTTON_LENGTH} caracteres.`;
  }
  const sorted = [...stops].sort((a, b) => a.floor - b.floor);
  for (let i = 1; i < sorted.length; i++) {
    const lower = sorted[i - 1], upper = sorted[i];
    if (upper.floor === lower.floor) return `Hay dos paradas con el piso ${upper.floor}.`;
    if (upper.point.y - lower.point.y < MIN_STOP_RISE_M) {
      return `El piso ${upper.floor} no queda por encima del ${lower.floor}: revisa los números o los puntos.`;
    }
  }
  for (const a of stops) {
    for (const b of stops) {
      if (Math.hypot(a.point.x - b.point.x, a.point.z - b.point.z) > MAX_STOP_SPREAD_M) {
        return `Hay paradas a más de ${MAX_STOP_SPREAD_M} m entre sí: deben ser puertas del mismo ascensor.`;
      }
    }
  }
  return null;
}
