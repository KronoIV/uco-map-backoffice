import { Box, Paper, Skeleton, Tooltip, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';

interface Props {
  title: string;
  /** Qué representa y en qué periodo (se muestra bajo el título). */
  subtitle?: string;
  /** Cómo se calcula (ícono de información). */
  info?: string;
  action?: React.ReactNode;
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyText?: string;
  minHeight?: number;
  children?: React.ReactNode;
}

export const cardSx = {
  bgcolor: '#fff',
  border: '1px solid #F1F1F1',
  borderRadius: '18px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
} as const;

/** Contenedor de cada gráfico con título explicativo y estados de carga, error y sin datos. */
export default function ChartCard({
  title, subtitle, info, action, loading, error, empty, emptyText, minHeight = 180, children,
}: Props) {
  return (
    <Paper sx={{ ...cardSx, p: { xs: 2, md: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography component="h3" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{title}</Typography>
            {info && (
              <Tooltip title={info} arrow>
                <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} aria-label={info} />
              </Tooltip>
            )}
          </Box>
          {subtitle && <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{subtitle}</Typography>}
        </Box>
        {action}
      </Box>
      <Box sx={{ flex: 1, minHeight, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <Skeleton variant="rounded" sx={{ flex: 1, minHeight, borderRadius: '12px' }} />
        ) : error ? (
          <EmptyState icon={<ErrorOutlineRoundedIcon />} text="No se pudieron cargar los datos. Intenta actualizar." tone="error" />
        ) : empty ? (
          <EmptyState icon={<InsightsRoundedIcon />} text={emptyText ?? 'Sin datos en este periodo'} />
        ) : children}
      </Box>
    </Paper>
  );
}

export function EmptyState({ icon, text, tone }: { icon: React.ReactNode; text: string; tone?: 'error' }) {
  return (
    <Box
      sx={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 1, py: 3, px: 2, textAlign: 'center', borderRadius: '12px', bgcolor: '#FAFAFA',
        color: tone === 'error' ? 'error.main' : 'text.secondary',
        '& svg': { fontSize: 28, opacity: 0.6 },
      }}
    >
      {icon}
      <Typography sx={{ fontSize: '0.8rem', maxWidth: 320 }}>{text}</Typography>
    </Box>
  );
}
