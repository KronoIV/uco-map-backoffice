import { Box, IconButton, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { PERIOD_OPTIONS, toInputDate } from '../../hooks/usePeriod';
import type { PeriodPreset, PeriodState } from '../../hooks/usePeriod';
import { PLATFORM_LABEL, PLATFORM_OPTIONS } from '../../utils/analyticsFormat';

interface Props {
  period: PeriodState;
  fetching?: boolean;
  /** Filtros extra de la página (p. ej. edificio). */
  children?: React.ReactNode;
}

/** Periodo, plataforma y comparación: el mismo control en todo el panel de analítica. */
export default function PeriodFilter({ period, fetching, children }: Props) {
  const today = toInputDate(new Date());
  return (
    <Box
      sx={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5,
        p: 1.5, mb: 3, bgcolor: '#fff', border: '1px solid #F1F1F1', borderRadius: '16px',
      }}
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        value={period.preset}
        onChange={(_, v: PeriodPreset | null) => v && period.setPreset(v)}
        aria-label="Periodo"
        sx={{
          flexWrap: 'wrap',
          '& .MuiToggleButton-root': {
            textTransform: 'none', border: 'none', borderRadius: '10px !important', px: 1.5, py: 0.5,
            fontWeight: 600, color: 'text.secondary',
            '&.Mui-selected': { bgcolor: '#E6FBF3', color: '#047857' },
          },
        }}
      >
        {PERIOD_OPTIONS.map(o => <ToggleButton key={o.value} value={o.value}>{o.label}</ToggleButton>)}
      </ToggleButtonGroup>

      {period.preset === 'custom' && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            type="date" size="small" label="Desde" value={period.desde}
            onChange={e => period.setCustom(e.target.value, period.hasta)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: period.hasta || today } }}
          />
          <TextField
            type="date" size="small" label="Hasta" value={period.hasta}
            onChange={e => period.setCustom(period.desde, e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: period.desde, max: today } }}
          />
        </Box>
      )}

      <TextField
        select size="small" label="Dispositivo" value={period.platform}
        onChange={e => period.setPlatform(e.target.value)} sx={{ minWidth: 170 }}
      >
        <MenuItem value="">Todos</MenuItem>
        {PLATFORM_OPTIONS.map(p => <MenuItem key={p} value={p}>{PLATFORM_LABEL[p] ?? p}</MenuItem>)}
      </TextField>

      {children}

      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
        <CalendarMonthRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Box>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.2 }}>{period.label}</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.2 }}>
            Comparado con {period.previousLabel}
          </Typography>
        </Box>
        <Tooltip title="Actualizar datos">
          <span>
            <IconButton
              size="small" onClick={period.refresh} disabled={fetching} aria-label="Actualizar datos"
              sx={{ border: '1px solid #E5E7EB', borderRadius: '8px' }}
            >
              <RefreshRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}
