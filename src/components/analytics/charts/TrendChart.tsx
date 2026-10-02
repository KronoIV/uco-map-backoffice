import { useId, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';

export interface TrendSeries {
  name: string;
  color: string;
  values: number[];
  /** Línea punteada (p. ej. una serie secundaria). */
  dashed?: boolean;
}

interface Props {
  labels: string[];
  series: TrendSeries[];
  height?: number;
  format?: (n: number) => string;
  /** Texto del eje Y para lectores de pantalla y la leyenda. */
  ariaLabel: string;
}

const PAD = { top: 12, right: 12, bottom: 26, left: 40 };
const WIDTH = 640;

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Evolución diaria: área para la serie principal y líneas para las demás, con detalle al pasar el cursor. */
export default function TrendChart({ labels, series, height = 220, format = n => n.toLocaleString('es-CO'), ariaLabel }: Props) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const max = useMemo(() => niceMax(Math.max(0, ...series.flatMap(s => s.values))), [series]);
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const n = labels.length;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const path = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const i = n <= 1 ? 0 : Math.round(((px - PAD.left) / innerW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        {series.map(s => (
          <Box key={s.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 14, height: 3, borderRadius: 2, bgcolor: s.color, opacity: s.dashed ? 0.6 : 1 }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{s.name}</Typography>
          </Box>
        ))}
      </Box>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        role="img"
        aria-label={ariaLabel}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={series[0]?.color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={series[0]?.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(max * t)} y2={y(max * t)} stroke="#F1F1F1" />
            <text x={PAD.left - 6} y={y(max * t) + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">
              {format(max * t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (i % labelEvery === 0 || i === n - 1) && (
          <text key={l + i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="#9CA3AF">{l}</text>
        ))}
        {series[0] && n > 1 && (
          <path d={`${path(series[0].values)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${gradientId})`} />
        )}
        {series.map(s => (
          <path
            key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2.2}
            strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round"
          />
        ))}
        {n === 1 && series.map(s => <circle key={s.name} cx={x(0)} cy={y(s.values[0])} r={4} fill={s.color} />)}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#D1D5DB" strokeDasharray="3 3" />
            {series.map(s => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4} fill="#fff" stroke={s.color} strokeWidth={2} />)}
          </g>
        )}
      </svg>
      {hover != null && (
        <Box
          sx={{
            position: 'absolute', top: 28, pointerEvents: 'none',
            left: `${(x(hover) / WIDTH) * 100}%`,
            transform: x(hover) > WIDTH * 0.7 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            bgcolor: '#111827', color: '#fff', borderRadius: '10px', px: 1.25, py: 0.75, boxShadow: 3, minWidth: 120,
          }}
        >
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, mb: 0.25 }}>{labels[hover]}</Typography>
          {series.map(s => (
            <Box key={s.name} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography sx={{ fontSize: '0.72rem', opacity: 0.8 }}>{s.name}</Typography>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>{format(s.values[hover])}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
