import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Divider, FormControl, FormControlLabel, InputLabel, LinearProgress, MenuItem,
  Paper, Select, Skeleton, Switch, TextField, Typography,
} from '@mui/material';
import { useMultiSetUsage, useUpdateMultiSetUsage } from '../hooks/useMultiSetUsage';
import { resolveApiError } from '../services/api';
import { fmtDateTime, fmtNumber } from '../utils/analyticsFormat';
import type { MultiSetPlan, MultiSetUsage } from '../types';

const PLANS: Record<MultiSetPlan, { label: string; limit: number; monthly: boolean }> = {
  FREE:   { label: 'Free — 1.000 llamadas en total', limit: 1000, monthly: false },
  LITE:   { label: 'Lite — 10.000 llamadas al mes', limit: 10000, monthly: true },
  PLUS:   { label: 'Plus — 50.000 llamadas al mes', limit: 50000, monthly: true },
  CUSTOM: { label: 'Personalizado', limit: 0, monthly: true },
};

const LEVEL_COLOR = { unconfigured: 'inherit', ok: 'success', warning: 'warning', critical: 'error', disabled: 'error' } as const;

const pct = (u: MultiSetUsage) => `${u.percent.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;

function statusText(u: MultiSetUsage): string | null {
  switch (u.level) {
    case 'disabled':
      return `La guía con cámara se apagó automáticamente el ${fmtDateTime(u.autoDisabledAt)} al llegar al ${u.autoDisablePercent} % del plan. `
        + (u.monthly ? 'Se encenderá sola cuando empiece el nuevo ciclo' : 'Se encenderá sola si amplías el plan')
        + ' o puedes encenderla tú en «Parámetros» (enableIndoorARNavigation).';
    case 'critical':
      return u.arEnabled
        ? `El uso estimado (${pct(u)}) superó el umbral del ${u.autoDisablePercent} % y la guía con cámara sigue encendida porque se encendió a mano.`
        : `El uso estimado (${pct(u)}) superó el umbral del ${u.autoDisablePercent} %.`;
    case 'warning':
      return `El uso estimado de MultiSet va en ${pct(u)}. Al llegar al ${u.autoDisablePercent} % la guía con cámara se apagará sola.`;
    default:
      return null;
  }
}

/** Aviso para el dashboard: solo aparece cuando el cupo necesita atención. */
export function MultiSetUsageAlert() {
  const { data } = useMultiSetUsage();
  const text = data && statusText(data);
  if (!data || !text) return null;
  return (
    <Alert
      severity={data.level === 'warning' ? 'warning' : 'error'}
      sx={{ mb: 2 }}
      action={<Button component={RouterLink} to="/settings" color="inherit" size="small">Ver cupo</Button>}
    >
      {text}
    </Alert>
  );
}

function UsageForm({ usage, onSaved }: { usage: MultiSetUsage; onSaved: (msg: string) => void }) {
  const update = useUpdateMultiSetUsage();
  const [plan, setPlan] = useState<MultiSetPlan>(usage.plan);
  const [limit, setLimit] = useState(String(usage.limit || ''));
  const [monthly, setMonthly] = useState(usage.monthly);
  const [resetDay, setResetDay] = useState(String(usage.resetDay));
  const [threshold, setThreshold] = useState(String(usage.autoDisablePercent));
  const [portalUsed, setPortalUsed] = useState('');

  const custom = plan === 'CUSTOM';
  const limitN = Number(limit);
  const dayN = Number(resetDay);
  const thresholdN = Number(threshold);
  const portalN = portalUsed.trim() === '' ? null : Number(portalUsed);
  const valid = Number.isInteger(limitN) && limitN >= 0
    && (!monthly || (Number.isInteger(dayN) && dayN >= 1 && dayN <= 28))
    && thresholdN >= 50 && thresholdN <= 100
    && (portalN === null || (Number.isInteger(portalN) && portalN >= 0));

  function choosePlan(p: MultiSetPlan) {
    setPlan(p);
    if (p !== 'CUSTOM') {
      setLimit(String(PLANS[p].limit));
      setMonthly(PLANS[p].monthly);
    }
  }

  function save() {
    update.mutate(
      { plan, limit: limitN, monthly, resetDay: monthly ? dayN : 1, autoDisablePercent: thresholdN, portalUsed: portalN },
      {
        onSuccess: () => { setPortalUsed(''); onSaved('Cupo de MultiSet guardado'); },
        onError: err => onSaved(resolveApiError(err)),
      },
    );
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
      <FormControl size="small" sx={{ gridColumn: { sm: '1 / -1' } }}>
        <InputLabel>Plan de MultiSet</InputLabel>
        <Select label="Plan de MultiSet" value={plan} onChange={e => choosePlan(e.target.value as MultiSetPlan)}>
          {(Object.keys(PLANS) as MultiSetPlan[]).map(p => <MenuItem key={p} value={p}>{PLANS[p].label}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField size="small" label="Llamadas incluidas" type="number" value={limit} disabled={!custom}
        onChange={e => setLimit(e.target.value)} slotProps={{ htmlInput: { min: 0 } }} />
      <FormControlLabel disabled={!custom} label="Se renueva cada mes"
        control={<Switch checked={monthly} onChange={(_, v) => setMonthly(v)} />} />
      {monthly && (
        <TextField size="small" label="Día de renovación" type="number" value={resetDay}
          onChange={e => setResetDay(e.target.value)} slotProps={{ htmlInput: { min: 1, max: 28 } }}
          helperText="Día del mes en que empieza tu ciclo de facturación (1–28)" />
      )}
      <TextField size="small" label="Apagar la guía al llegar a (%)" type="number" value={threshold}
        onChange={e => setThreshold(e.target.value)} slotProps={{ htmlInput: { min: 50, max: 100, step: 0.5 } }} />
      <TextField size="small" label="Uso actual según el portal (opcional)" type="number" value={portalUsed}
        onChange={e => setPortalUsed(e.target.value)} slotProps={{ htmlInput: { min: 0 } }}
        sx={{ gridColumn: { sm: '1 / -1' } }}
        helperText="Cópialo de developer.multiset.ai → Account. La estimación seguirá sumando desde ese número; así corriges las llamadas que no se pueden contar." />
      <Box sx={{ gridColumn: { sm: '1 / -1' }, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={save} disabled={!valid || update.isPending}
          sx={{ borderRadius: '100px', height: 34, fontSize: '0.8125rem' }}>
          Guardar cupo
        </Button>
      </Box>
    </Box>
  );
}

export default function MultiSetUsageCard({ onMessage }: { onMessage: (msg: string) => void }) {
  const { data: u, isLoading, error } = useMultiSetUsage();
  const text = u && statusText(u);

  return (
    <Paper sx={{ borderRadius: '18px', border: '1px solid #F1F1F1', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', p: 3 }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>Cupo de MultiSet (guía con cámara)</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Estimación con las llamadas que informa la app en cada recorrido y las que hace el servidor.
        Consultarla no gasta llamadas de MultiSet. Al llegar al umbral se apaga la guía con cámara, igual que al apagarla a mano.
      </Typography>
      <Divider sx={{ mb: 2 }} />

      {isLoading ? <Skeleton variant="rounded" height={160} /> : error || !u ? (
        <Alert severity="error">No se pudo cargar el cupo de MultiSet.</Alert>
      ) : (
        <>
          {u.level === 'unconfigured' ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Elige tu plan para activar el apagado automático. Mientras no haya plan, la guía nunca se apaga sola.
            </Alert>
          ) : (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                  {fmtNumber(u.used)} <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                    de {fmtNumber(u.limit)} llamadas
                  </Typography>
                </Typography>
                <Typography sx={{ fontWeight: 600 }}>{pct(u)}</Typography>
              </Box>
              <LinearProgress variant="determinate" value={Math.min(100, u.percent)} color={LEVEL_COLOR[u.level]}
                sx={{ height: 8, borderRadius: 4 }} aria-label="Uso estimado del plan de MultiSet" />
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, fontSize: '0.78rem' }}>
                {u.monthly && u.periodStart && u.periodEnd
                  ? `Ciclo del ${fmtDateTime(u.periodStart)} al ${fmtDateTime(u.periodEnd)}. `
                  : 'Cupo total del plan (no se renueva). '}
                {u.baselineUsed != null && u.baselineAt && `Portal: ${fmtNumber(u.baselineUsed)} el ${fmtDateTime(u.baselineAt)} · `}
                App: {fmtNumber(u.appCalls)} · Servidor: {fmtNumber(u.backendCalls)}
              </Typography>
            </Box>
          )}
          {text && <Alert severity={u.level === 'warning' ? 'warning' : 'error'} sx={{ mb: 2 }}>{text}</Alert>}
          <UsageForm key={`${u.plan}-${u.limit}-${u.monthly}-${u.resetDay}-${u.autoDisablePercent}`} usage={u} onSaved={onMessage} />
        </>
      )}
    </Paper>
  );
}
