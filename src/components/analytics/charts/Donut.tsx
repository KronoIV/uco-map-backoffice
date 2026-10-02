import { Box, Typography } from '@mui/material';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
}

/** Composición de un total en pocas partes (máximo 4–5 segmentos para que se lea bien). */
export default function Donut({ segments, centerValue, centerLabel, size = 150 }: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
      <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" width={size} height={size} role="img"
             aria-label={segments.map(s => `${s.label}: ${s.value}`).join(', ')}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="#F3F4F6" strokeWidth="14" />
          {total > 0 && segments.map(s => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="14"
                strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
                transform="rotate(-90 50 50)"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1 }}>{centerValue}</Typography>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textAlign: 'center', maxWidth: size * 0.55 }}>
            {centerLabel}
          </Typography>
        </Box>
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 140 }}>
        {segments.map(s => (
          <Box component="li" key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: s.color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.8rem', flex: 1 }}>{s.label}</Typography>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
              {s.value.toLocaleString('es-CO')}
              <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                {total > 0 ? ` · ${Math.round((s.value / total) * 100)} %` : ''}
              </Box>
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
