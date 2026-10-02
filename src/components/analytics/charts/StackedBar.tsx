import { Box, Tooltip, Typography } from '@mui/material';

export interface StackSegment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  title: string;
  segments: StackSegment[];
  /** Cifra destacada a la derecha (p. ej. «82 % aceptan»). */
  headline?: string;
}

/** Una barra 100 % apilada: cómo se reparte un total en estados. */
export default function StackedBar({ title, segments, headline }: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{title}</Typography>
        {headline && <Typography sx={{ fontSize: '0.8rem', fontWeight: 700 }}>{headline}</Typography>}
      </Box>
      <Box sx={{ display: 'flex', height: 14, borderRadius: 100, overflow: 'hidden', bgcolor: '#F3F4F6' }}>
        {total > 0 && segments.filter(s => s.value > 0).map(s => (
          <Tooltip key={s.label} arrow
                   title={`${s.label}: ${s.value.toLocaleString('es-CO')} (${Math.round((s.value / total) * 100)} %)`}>
            <Box sx={{ width: `${(s.value / total) * 100}%`, bgcolor: s.color, transition: 'width 0.5s ease' }} />
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
}
