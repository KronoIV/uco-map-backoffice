import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AnalyticsQuery } from '../types/analytics';

export type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'custom';

export interface PeriodState {
  preset: PeriodPreset;
  /** yyyy-MM-dd (solo en personalizado) */
  desde: string;
  hasta: string;
  platform: string;
  query: AnalyticsQuery;
  label: string;
  previousLabel: string;
  setPreset: (p: PeriodPreset) => void;
  setCustom: (desde: string, hasta: string) => void;
  setPlatform: (platform: string) => void;
  /** Recalcula «hasta ahora» y vuelve a pedir los datos. */
  refresh: () => void;
}

const PRESETS: PeriodPreset[] = ['today', '7d', '30d', 'month', 'custom'];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDay(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toInputDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shortRange(from: Date, to: Date) {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const last = new Date(to.getTime() - 1);
  const a = from.toLocaleDateString('es-CO', opts);
  const b = last.toLocaleDateString('es-CO', opts);
  return a === b ? a : `${a} – ${b}`;
}

/** Rango [from, to) del periodo; los presets terminan «ahora» (el día de hoy cuenta hasta este momento). */
export function computeRange(preset: PeriodPreset, desde: string, hasta: string, now: number) {
  const end = new Date(now);
  const today = startOfDay(end);
  let from: Date;
  let to = end;
  switch (preset) {
    case 'today': from = today; break;
    case '30d': from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29); break;
    case 'month': from = new Date(today.getFullYear(), today.getMonth(), 1); break;
    case 'custom': {
      from = desde ? parseDay(desde) : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
      const last = hasta ? parseDay(hasta) : today;
      const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      to = next.getTime() < now ? next : end;
      if (from >= to) from = startOfDay(new Date(to.getTime() - 1));
      break;
    }
    default: from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  }
  const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
  return { from, to, prevFrom };
}

const PRESET_LABEL: Record<PeriodPreset, string> = {
  today: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  month: 'Este mes',
  custom: 'Personalizado',
};

export const PERIOD_OPTIONS = PRESETS.map(p => ({ value: p, label: PRESET_LABEL[p] }));

/** Periodo y plataforma en la URL: se comparten entre el Dashboard y Actividad y sobreviven al recargar. */
export function usePeriod(): PeriodState {
  const [params, setParams] = useSearchParams();
  const raw = params.get('periodo') as PeriodPreset | null;
  const preset: PeriodPreset = raw && PRESETS.includes(raw) ? raw : '7d';
  const desde = params.get('desde') ?? '';
  const hasta = params.get('hasta') ?? '';
  const platform = params.get('plataforma') ?? '';
  const [now, setNow] = useState(() => Date.now());

  const update = useCallback((patch: Record<string, string | null>) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      return next;
    }, { replace: true });
    setNow(Date.now());
  }, [setParams]);

  const range = useMemo(() => computeRange(preset, desde, hasta, now), [preset, desde, hasta, now]);

  const label = preset === 'custom' || preset === 'month'
    ? shortRange(range.from, range.to)
    : `${PRESET_LABEL[preset]} · ${shortRange(range.from, range.to)}`;
  const previousLabel = preset === 'today' ? 'ayer a esta hora' : shortRange(range.prevFrom, range.from);

  return {
    preset, desde, hasta, platform,
    query: { from: range.from.toISOString(), to: range.to.toISOString(), platform: platform || undefined },
    label,
    previousLabel,
    setPreset: p => update({ periodo: p, desde: null, hasta: null }),
    setCustom: (d, h) => update({ periodo: 'custom', desde: d || null, hasta: h || null }),
    setPlatform: p => update({ plataforma: p || null }),
    refresh: () => setNow(Date.now()),
  };
}
