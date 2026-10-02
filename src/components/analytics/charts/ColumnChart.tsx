import { Box, Tooltip, Typography } from '@mui/material';

interface Props {
  items: { label: string; value: number }[];
  color?: string;
  height?: number;
  /** Texto del tooltip de cada barra. */
  describe?: (item: { label: string; value: number }, share: number) => string;
  /** Índice de la barra a destacar (p. ej. donde cae la mediana). */
  highlight?: number | null;
}

/** Distribución en columnas (histograma). */
export default function ColumnChart({ items, color = '#6366F1', height = 160, describe, highlight }: Props) {
  const max = Math.max(1, ...items.map(i => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: height + 44 }}>
      {items.map((item, idx) => {
        const share = total > 0 ? item.value / total : 0;
        return (
          <Tooltip
            key={item.label} arrow
            title={describe ? describe(item, share) : `${item.label}: ${item.value.toLocaleString('es-CO')} (${Math.round(share * 100)} %)`}
          >
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>
                {item.value > 0 ? `${Math.round(share * 100)} %` : ''}
              </Typography>
              <Box
                sx={{
                  width: '100%', maxWidth: 48, height: Math.max(2, (item.value / max) * height),
                  bgcolor: color, opacity: highlight == null || highlight === idx ? 1 : 0.45,
                  borderRadius: '6px 6px 2px 2px', transition: 'height 0.5s ease',
                }}
              />
              <Typography
                sx={{ fontSize: '0.66rem', color: 'text.secondary', textAlign: 'center', lineHeight: 1.15, minHeight: 26 }}
              >
                {item.label}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
