import { Box, Tooltip, Typography } from '@mui/material';

export interface BarItem {
  key: string;
  label: string;
  value: number;
  /** Texto a la derecha (si no, valor y porcentaje del total). */
  display?: string;
  hint?: string;
  color?: string;
}

interface Props {
  items: BarItem[];
  /** Base del porcentaje; por defecto la suma de los valores. */
  total?: number;
  color?: string;
  max?: number;
  showPercent?: boolean;
}

/** Ranking horizontal: más fácil de leer que una torta cuando hay muchas categorías. */
export default function BarList({ items, total, color = '#00b874', max, showPercent = true }: Props) {
  const base = total ?? items.reduce((s, i) => s + i.value, 0);
  const top = max ?? Math.max(1, ...items.map(i => i.value));
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {items.map(item => {
        const pct = base > 0 ? item.value / base : 0;
        const row = (
          <Box component="li" key={item.key}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                {item.display ?? `${item.value.toLocaleString('es-CO')}${showPercent ? ` · ${Math.round(pct * 100)} %` : ''}`}
              </Typography>
            </Box>
            <Box sx={{ height: 8, bgcolor: '#F3F4F6', borderRadius: 100, overflow: 'hidden' }}>
              <Box
                sx={{
                  height: '100%', width: `${(item.value / top) * 100}%`, bgcolor: item.color ?? color,
                  borderRadius: 100, transition: 'width 0.5s ease',
                }}
              />
            </Box>
          </Box>
        );
        return item.hint
          ? <Tooltip key={item.key} title={item.hint} placement="top-start" arrow>{row}</Tooltip>
          : row;
      })}
    </Box>
  );
}
