import { Box, Paper, Skeleton, Tooltip, Typography } from '@mui/material';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { Metric } from '../../types/analytics';
import { relativeChange } from '../../utils/analyticsFormat';
import { cardSx } from './ChartCard';

interface Props {
  label: string;
  value: string;
  /** Para la comparación con el periodo anterior. */
  metric?: Metric;
  /** Si subir es bueno (usuarios) o malo (abandonos). */
  higherIsBetter?: boolean;
  /** Para tasas: el cambio se muestra en puntos porcentuales, no en %. */
  isRate?: boolean;
  sub?: string;
  info?: string;
  previousLabel?: string;
  loading?: boolean;
}

/** Una cifra clave con su cambio frente al periodo anterior y una frase de contexto. */
export default function KpiCard({ label, value, metric, higherIsBetter = true, isRate, sub, info, previousLabel, loading }: Props) {
  if (loading) return <Skeleton variant="rounded" height={118} sx={{ borderRadius: '18px' }} />;
  return (
    <Paper sx={{ ...cardSx, p: 2.25, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>{label}</Typography>
        {info && (
          <Tooltip title={info} arrow>
            <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} aria-label={info} />
          </Tooltip>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.1 }}>{value}</Typography>
        {metric && <Delta metric={metric} higherIsBetter={higherIsBetter} isRate={isRate} previousLabel={previousLabel} />}
      </Box>
      {sub && <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.75 }}>{sub}</Typography>}
    </Paper>
  );
}

function Delta({ metric, higherIsBetter, isRate, previousLabel }: {
  metric: Metric; higherIsBetter: boolean; isRate?: boolean; previousLabel?: string;
}) {
  const { value, previous } = metric;
  const vs = previousLabel ? ` (${previousLabel})` : '';
  if (value == null || previous == null) {
    return (
      <Tooltip title="Aún no hay datos del periodo anterior para comparar" arrow>
        <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>sin comparación</Typography>
      </Tooltip>
    );
  }
  const diff = isRate ? value - previous : relativeChange(value, previous);
  if (diff == null) {
    // El periodo anterior fue 0: no hay porcentaje posible
    return value > 0
      ? <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary' }}>antes 0</Typography>
      : null;
  }
  const flat = Math.abs(diff) < 0.005;
  const good = flat ? null : (diff > 0) === higherIsBetter;
  const color = good == null ? 'text.secondary' : good ? '#047857' : '#B91C1C';
  const bg = good == null ? '#F3F4F6' : good ? '#E6FBF3' : '#FEECEC';
  const text = isRate
    ? `${diff > 0 ? '+' : ''}${(diff * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} pp`
    : `${(Math.abs(diff) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
  const before = isRate
    ? `${(previous * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`
    : previous.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  return (
    <Tooltip title={`Periodo anterior${vs}: ${before}`} arrow>
      <Box
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.25, borderRadius: '8px',
          bgcolor: bg, color, fontSize: '0.72rem', fontWeight: 700,
        }}
      >
        {!flat && !isRate && (diff > 0
          ? <ArrowUpwardRoundedIcon sx={{ fontSize: 13 }} />
          : <ArrowDownwardRoundedIcon sx={{ fontSize: 13 }} />)}
        {flat ? 'sin cambio' : text}
      </Box>
    </Tooltip>
  );
}
