import { Box, Tooltip, Typography } from '@mui/material';
import { WEEKDAYS, WEEKDAYS_LONG } from '../../../utils/analyticsFormat';

interface Props {
  /** [día: 0 = lunes][hora 0–23] */
  grid: number[][];
  unit: string;
  color?: [number, number, number];
}

/** Cuándo se usa la app: días de la semana contra horas del día. */
export default function WeekHourHeatmap({ grid, unit, color = [0, 184, 116] }: Props) {
  const max = Math.max(1, ...grid.flat());
  // Solo las horas con actividad en algún día (la app de campus casi no se usa de madrugada)
  const used = Array.from({ length: 24 }, (_, h) => h).filter(h => grid.some(row => row[h] > 0));
  const from = used.length ? Math.max(0, Math.min(...used) - 1) : 6;
  const to = used.length ? Math.min(23, Math.max(...used) + 1) : 21;
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const [r, g, b] = color;

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `36px repeat(${hours.length}, minmax(14px, 1fr))`, gap: '3px', minWidth: 36 + hours.length * 17 }}>
        <Box />
        {hours.map(h => (
          <Typography key={h} sx={{ fontSize: '0.6rem', color: 'text.secondary', textAlign: 'center' }}>
            {h % 3 === 0 ? `${h}h` : ''}
          </Typography>
        ))}
        {grid.map((row, d) => (
          <Box key={d} sx={{ display: 'contents' }}>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', alignSelf: 'center' }}>{WEEKDAYS[d]}</Typography>
            {hours.map(h => {
              const v = row[h] ?? 0;
              const a = v === 0 ? 0 : 0.15 + 0.85 * (v / max);
              return (
                <Tooltip key={h} title={`${WEEKDAYS_LONG[d]} ${h}:00–${h + 1}:00 · ${v.toLocaleString('es-CO')} ${unit}`} arrow>
                  <Box
                    sx={{
                      aspectRatio: '1', borderRadius: '4px',
                      bgcolor: v === 0 ? '#F5F6F8' : `rgba(${r},${g},${b},${a.toFixed(2)})`,
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, justifyContent: 'flex-end' }}>
        <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>Menos</Typography>
        {[0.15, 0.4, 0.65, 1].map(a => (
          <Box key={a} sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: `rgba(${r},${g},${b},${a})` }} />
        ))}
        <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>Más</Typography>
      </Box>
    </Box>
  );
}

/** Frase con el momento de más uso (para no obligar a leer el mapa de calor). */
export function busiestSlot(grid: number[][]): { day: string; hour: number; value: number } | null {
  let best: { day: string; hour: number; value: number } | null = null;
  grid.forEach((row, d) => row.forEach((v, h) => {
    if (v > 0 && (!best || v > best.value)) best = { day: WEEKDAYS_LONG[d], hour: h, value: v };
  }));
  return best;
}
