import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Checkbox, Chip, FormControlLabel, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import { vpsService } from '../../services/vpsService';
import { fmtDateTime, fmtNumber, fmtPercent } from '../../utils/analyticsFormat';
import type { VpsBuild } from '../../types/vps';
import { REASONS, mainEval, meetsPublishBar, shortId, type VpsTabProps } from './vpsFormat';

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));
const fmtMs = (ms: number | null | undefined) => (ms == null ? '—' : `${fmtNumber(ms)} ms`);

function BuildCard({ title, build, empty, action }: { title: string; build?: VpsBuild | null; empty: string; action?: ReactNode }) {
  const ev = mainEval(build?.evaluation);
  return (
    <Paper sx={{ p: 2.5, borderRadius: '16px', flex: 1 }}>
      <Typography variant="overline" color="text.secondary">{title}</Typography>
      {build ? (
        <>
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{build.spaceId ?? `r${build.revisionNumber}`}</Typography>
          <Typography variant="body2" color="text.secondary">
            Build {shortId(build.id)} · {fmtDateTime(build.finishedAt ?? build.createdAt)}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {ev
              ? `${fmtPercent(ev['recall@0.5m5deg'] ?? null, 1)} localizadas a ≤ 0,5 m · ${fmtNumber(ev.falsePositives)} falsos positivos`
              : 'Sin evaluación'}
          </Typography>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">{empty}</Typography>
      )}
      {action && <Box sx={{ mt: 1.5 }}>{action}</Box>}
    </Paper>
  );
}

export default function VpsPublishTab({ mapSetId, detail, notify }: VpsTabProps) {
  const qc = useQueryClient();
  const [candidateId, setCandidateId] = useState('');
  const [note, setNote] = useState('');
  const [force, setForce] = useState(false);
  const [hours, setHours] = useState(24);

  const buildsQ = useQuery({ queryKey: ['vps', 'builds', mapSetId], queryFn: () => vpsService.listBuilds(mapSetId) });
  const activationsQ = useQuery({
    queryKey: ['vps', 'activations', mapSetId],
    queryFn: () => vpsService.listActivations(mapSetId),
  });
  const logsQ = useQuery({
    queryKey: ['vps', 'logs', mapSetId, hours],
    queryFn: () => vpsService.logs(mapSetId, hours, 50),
    refetchInterval: 30_000,
  });

  const candidates = (buildsQ.data ?? []).filter(b => b.status === 'ready' && b.id !== detail.activeBuildId);
  const candidate = candidates.find(b => b.id === candidateId) ?? candidates[0] ?? null;
  const candidateEval = mainEval(candidate?.evaluation);
  const needsForce = !!candidate && (!candidate.evaluation || !!candidate.evaluation.error);

  const done = (msg: string) => {
    notify(msg);
    setNote('');
    setForce(false);
    qc.invalidateQueries({ queryKey: ['vps'] });
    qc.invalidateQueries({ queryKey: ['editor-meshes'] });
  };
  const activate = useMutation({
    mutationFn: (b: VpsBuild) => vpsService.activate(mapSetId, b.id, note.trim(), force),
    onSuccess: ms => done(`Publicado ${ms.activeSpaceId ?? ''}: la app lo usa desde la próxima localización`),
    onError: err => notify(errMsg(err)),
  });
  const rollback = useMutation({
    mutationFn: () => vpsService.rollback(mapSetId, note.trim()),
    onSuccess: ms => done(`Se volvió a ${ms.activeSpaceId ?? 'el build anterior'}`),
    onError: err => notify(errMsg(err)),
  });

  const stats = logsQ.data?.stats;
  const logs = logsQ.data?.items ?? [];

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <BuildCard title="Publicado" build={detail.activeBuild} empty="Todavía no hay un build publicado." />
        <BuildCard
          title="Anterior"
          build={detail.previousBuild}
          empty="No hay un build anterior."
          action={detail.previousBuild && (
            <Button
              size="small" variant="outlined" startIcon={<UndoRoundedIcon />} disabled={rollback.isPending}
              onClick={() => { if (window.confirm('¿Volver al build anterior? La app lo usa desde la próxima localización.')) rollback.mutate(); }}
            >
              Volver a este build
            </Button>
          )}
        />
      </Stack>

      <Paper sx={{ p: 2.5, borderRadius: '16px' }}>
        <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Publicar un build</Typography>
        {candidates.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No hay builds listos sin publicar. Procesa una revisión en «Procesamiento».
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                select size="small" label="Build" value={candidate?.id ?? ''} onChange={e => setCandidateId(e.target.value)}
                sx={{ minWidth: 260 }}
              >
                {candidates.map(b => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.spaceId ?? `r${b.revisionNumber}`} · {shortId(b.id)} · {fmtDateTime(b.finishedAt ?? b.createdAt)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small" label="Nota (qué cambió o por qué)" value={note} onChange={e => setNote(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 500 } }} sx={{ flex: 1 }}
              />
            </Stack>
            {candidate && (
              <Alert severity={needsForce ? 'warning' : meetsPublishBar(candidateEval) ? 'success' : 'warning'}>
                {needsForce
                  ? 'Este build no tiene evaluación: publícalo solo si ya lo probaste con fotos reales.'
                  : meetsPublishBar(candidateEval)
                    ? `Cumple el mínimo sugerido: ${fmtPercent(candidateEval?.['recall@0.5m5deg'] ?? null, 1)} localizadas a ≤ 0,5 m y 0 falsos positivos.`
                    : `No cumple el mínimo sugerido (${fmtPercent(candidateEval?.['recall@0.5m5deg'] ?? null, 1)} a ≤ 0,5 m, ${fmtNumber(candidateEval?.falsePositives ?? null)} falsos positivos). Revisa la evaluación antes de publicar.`}
              </Alert>
            )}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Button
                variant="contained" startIcon={<RocketLaunchRoundedIcon />} sx={{ borderRadius: '100px' }}
                disabled={!candidate || (needsForce && !force) || activate.isPending}
                onClick={() => candidate && activate.mutate(candidate)}
              >
                Publicar
              </Button>
              {needsForce && (
                <FormControlLabel
                  control={<Checkbox size="small" checked={force} onChange={e => setForce(e.target.checked)} />}
                  label={<Typography variant="body2">Publicar sin evaluación</Typography>}
                />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Publicar no mueve los puntos AR ni el navmesh: el espacio del campus es el mismo. Los teléfonos que estén
              navegando cambian de build en su siguiente localización.
            </Typography>
          </Stack>
        )}
      </Paper>

      <Paper sx={{ p: 2.5, borderRadius: '16px' }}>
        <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5 }}>
          <Typography sx={{ fontWeight: 700, flex: 1 }}>Uso del VPS propio</Typography>
          <ToggleButtonGroup exclusive size="small" value={hours} onChange={(_, v: number | null) => v && setHours(v)}>
            <ToggleButton value={1}>1 h</ToggleButton>
            <ToggleButton value={24}>24 h</ToggleButton>
            <ToggleButton value={168}>7 días</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        {logsQ.isError && <Alert severity="error">{errMsg(logsQ.error)}</Alert>}
        {stats && (
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' }, mb: 2 }}>
            {[
              { label: 'Consultas', value: fmtNumber(stats.requests) },
              { label: 'Ubicadas', value: fmtPercent(stats.foundRate, 1) },
              { label: 'Desde caché', value: fmtNumber(stats.cached) },
              { label: 'Tiempo p50', value: fmtMs(stats.serverMsP50) },
              { label: 'Tiempo p90', value: fmtMs(stats.serverMsP90) },
            ].map(k => (
              <Box key={k.label} sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.secondary">{k.label}</Typography>
                <Typography sx={{ fontWeight: 700 }}>{k.value}</Typography>
              </Box>
            ))}
          </Box>
        )}
        {stats && Object.keys(stats.rejections ?? {}).length > 0 && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, mb: 2 }}>
            {Object.entries(stats.rejections).map(([k, n]) => (
              <Chip key={k} size="small" variant="outlined" label={`${REASONS[k] ?? k}: ${fmtNumber(n)}`} />
            ))}
          </Stack>
        )}
        <TableContainer sx={{ maxHeight: 360 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Hora</TableCell>
                <TableCell>Resultado</TableCell>
                <TableCell align="right">Confianza</TableCell>
                <TableCell align="right">Tiempo</TableCell>
                <TableCell>Modo</TableCell>
                <TableCell>Cliente</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map(l => (
                <TableRow key={l.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDateTime(l.at)}</TableCell>
                  <TableCell>
                    {l.poseFound
                      ? <Chip size="small" color="success" label={l.cached ? 'Ubicada (caché)' : 'Ubicada'} />
                      : <Chip size="small" variant="outlined" label={REASONS[l.reason ?? 'unknown'] ?? l.reason} />}
                  </TableCell>
                  <TableCell align="right">{fmtPercent(l.confidence ?? null)}</TableCell>
                  <TableCell align="right">{fmtMs(l.serverTimeMs)}</TableCell>
                  <TableCell>{l.mode ?? '—'}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                    {l.client ? Object.values(l.client).join(' · ') : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && !logsQ.isLoading && (
                <TableRow><TableCell colSpan={6} sx={{ color: 'text.secondary' }}>Sin consultas en este periodo.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 2.5, borderRadius: '16px' }}>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>Historial de publicaciones</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Acción</TableCell>
                <TableCell>Espacio</TableCell>
                <TableCell>Nota</TableCell>
                <TableCell>Por</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(activationsQ.data ?? []).map(a => (
                <TableRow key={a.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDateTime(a.at)}</TableCell>
                  <TableCell>
                    <Chip size="small" color={a.kind === 'rollback' ? 'warning' : 'primary'} label={a.kind === 'rollback' ? 'Vuelta atrás' : 'Publicación'} />
                  </TableCell>
                  <TableCell>{a.spaceId ?? shortId(a.buildId)}</TableCell>
                  <TableCell>{a.note || '—'}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{a.by ?? '—'}</TableCell>
                </TableRow>
              ))}
              {(activationsQ.data ?? []).length === 0 && !activationsQ.isLoading && (
                <TableRow><TableCell colSpan={5} sx={{ color: 'text.secondary' }}>Sin publicaciones.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  );
}
