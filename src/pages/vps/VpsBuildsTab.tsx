import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Checkbox, Chip, FormControlLabel, IconButton, LinearProgress, MenuItem, Paper, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import { vpsService } from '../../services/vpsService';
import { fmtDateTime, fmtDuration, fmtNumber, fmtPercent } from '../../utils/analyticsFormat';
import type { VpsBuild, VpsEvalSummary, VpsJob } from '../../types/vps';
import {
  BUILD_STATUS, JOB_STAGES, JOB_STATUS, PUBLISH_MIN_RECALL, REASONS, RECALLS, fmtBytes, mainEval, meetsPublishBar,
  shortId, type VpsTabProps,
} from './vpsFormat';

const isActive = (j: VpsJob) => j.status === 'queued' || j.status === 'running';
const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));
const fmtCm = (m: number | null | undefined) =>
  m == null ? '—' : `${(m * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} cm`;
const fmtDeg = (d: number | null | undefined) =>
  d == null ? '—' : `${d.toLocaleString('es-CO', { maximumFractionDigits: 2 })}°`;
const fmtMs = (ms: number | null | undefined) => (ms == null ? '—' : `${fmtNumber(ms)} ms`);

function JobRow({ job, now, onCancel, cancelling }: { job: VpsJob; now: number; onCancel: () => void; cancelling: boolean }) {
  const p = job.progress;
  const pct = p && p.total > 0 ? Math.round((p.done / p.total) * 100) : null;
  const waiting = job.status === 'queued' && now - Date.parse(job.createdAt) > 30_000;
  const elapsed = job.startedAt ? (job.finishedAt ? Date.parse(job.finishedAt) : now) - Date.parse(job.startedAt) : null;
  return (
    <Box sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {job.type === 'build' ? 'Procesamiento' : 'Evaluación'} · build {shortId(job.payload?.buildId)}
        </Typography>
        <Chip
          size="small" label={JOB_STATUS[job.status]}
          color={job.status === 'done' ? 'success' : job.status === 'failed' ? 'error' : isActive(job) ? 'info' : 'default'}
        />
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {fmtDateTime(job.createdAt)}{elapsed != null ? ` · ${fmtDuration(elapsed)}` : ''}
        </Typography>
        {isActive(job) && (
          <Tooltip title="Cancelar">
            <span>
              <IconButton size="small" disabled={cancelling} onClick={onCancel}><StopRoundedIcon fontSize="small" /></IconButton>
            </span>
          </Tooltip>
        )}
      </Stack>
      {isActive(job) && p && (
        <Box sx={{ mt: 0.75 }}>
          <Typography variant="caption" color="text.secondary">
            {JOB_STAGES[p.stage] ?? p.stage}{p.message ? ` · ${p.message}` : ''}{p.total > 0 ? ` · ${p.done}/${p.total}` : ''}
          </Typography>
          <LinearProgress variant={pct == null ? 'indeterminate' : 'determinate'} value={pct ?? undefined} />
        </Box>
      )}
      {waiting && (
        <Typography variant="caption" color="warning.main">
          Sigue en cola: revisa que el worker esté corriendo (uv run ucovps worker en vps-server).
        </Typography>
      )}
      {job.error && <Alert severity="error" sx={{ mt: 0.75, py: 0 }}>{job.error}</Alert>}
    </Box>
  );
}

function SummaryTable({ rows }: { rows: { label: string; ev: VpsEvalSummary | null | undefined }[] }) {
  const shown = rows.filter(r => r.ev);
  if (shown.length === 0) return null;
  const line = (label: string, get: (ev: VpsEvalSummary) => string) => (
    <TableRow>
      <TableCell sx={{ color: 'text.secondary' }}>{label}</TableCell>
      {shown.map(r => <TableCell key={r.label} align="right">{get(r.ev!)}</TableCell>)}
    </TableRow>
  );
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell />
            {shown.map(r => <TableCell key={r.label} align="right">{r.label}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {RECALLS.map(k => (
            <TableRow key={k.key}>
              <TableCell sx={{ color: 'text.secondary' }}>Localizadas {k.label}</TableCell>
              {shown.map(r => <TableCell key={r.label} align="right">{fmtPercent(r.ev![k.key] ?? null, 1)}</TableCell>)}
            </TableRow>
          ))}
          {line('Aceptadas', ev => `${fmtNumber(ev.accepted)} de ${fmtNumber(ev.queries)}`)}
          {line('Falsos positivos', ev => `${fmtNumber(ev.falsePositives)} (${fmtPercent(ev.falsePositiveRate, 1)})`)}
          {line('Error mediano de posición', ev => fmtCm(ev.medianPosErrM))}
          {line('Error mediano de orientación', ev => fmtDeg(ev.medianRotErrDeg))}
          {line('Tiempo p50 / p90', ev => `${fmtMs(ev.latencyMsP50)} / ${fmtMs(ev.latencyMsP90)}`)}
          {line('Rechazos', ev => Object.entries(ev.rejections ?? {}).map(([k, n]) => `${REASONS[k] ?? k}: ${n}`).join(' · ') || '—')}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function EvaluationPanel({ build }: { build: VpsBuild }) {
  const ev = build.evaluation;
  if (!ev) {
    return <Alert severity="info">Este build no tiene evaluación. Usa «Evaluar» para medir su precisión antes de publicarlo.</Alert>;
  }
  if (ev.error) return <Alert severity="error">La evaluación falló: {ev.error}</Alert>;
  const main = mainEval(ev);
  const perMap = Object.entries(ev.perMap ?? {});
  const cal = ev.calibration;
  return (
    <Stack spacing={2}>
      <Alert severity={meetsPublishBar(main) ? 'success' : 'warning'}>
        {meetsPublishBar(main)
          ? 'Cumple el mínimo sugerido para publicar'
          : `No cumple el mínimo sugerido para publicar (≥ ${fmtPercent(PUBLISH_MIN_RECALL)} localizadas a ≤ 0,5 m · 5° y 0 falsos positivos)`}
        . Son fotos sintéticas renderizadas desde las mallas: confirma con fotos reales en «Probar» o en la app.
      </Alert>
      <SummaryTable rows={[{ label: 'Sin calibrar', ev: ev.default }, { label: 'Calibrada (la que se usa)', ev: ev.calibrated }]} />
      {cal && (
        <Typography variant="caption" color="text.secondary">
          Calibración de la confianza: {cal.usable ? 'usable' : 'no usable (se usa el umbral fijo)'}
          {cal.samples != null ? ` · ${fmtNumber(cal.samples)} muestras` : ''}
          {cal.brier != null ? ` · Brier ${cal.brier.toLocaleString('es-CO', { maximumFractionDigits: 4 })}` : ''}
          {cal.acceptMinProb != null ? ` · acepta desde ${fmtPercent(cal.acceptMinProb)}` : ''}
        </Typography>
      )}
      {perMap.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Mapa</TableCell>
                <TableCell align="right">Fotos</TableCell>
                <TableCell align="right">≤ 0,5 m · 5°</TableCell>
                <TableCell align="right">Falsos positivos</TableCell>
                <TableCell align="right">Error mediano</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {perMap.map(([code, s]) => (
                <TableRow key={code}>
                  <TableCell>{s.name ?? code}</TableCell>
                  <TableCell align="right">{fmtNumber(s.queries)}</TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: (s['recall@0.5m5deg'] ?? 0) < PUBLISH_MIN_RECALL ? 'warning.main' : undefined, fontWeight: 600 }}
                  >
                    {fmtPercent(s['recall@0.5m5deg'] ?? null, 1)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: s.falsePositives > 0 ? 'error.main' : undefined }}>
                    {fmtNumber(s.falsePositives)}
                  </TableCell>
                  <TableCell align="right">{fmtCm(s.medianPosErrM)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}

export default function VpsBuildsTab({ mapSetId, detail, notify }: VpsTabProps) {
  const qc = useQueryClient();
  const [evaluate, setEvaluate] = useState(true);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const head = detail.headRevision;

  const jobsQ = useQuery({
    queryKey: ['vps', 'jobs', mapSetId],
    queryFn: () => vpsService.listJobs(mapSetId, 10),
    refetchInterval: q => (q.state.data?.some(isActive) ? 2000 : false),
  });
  const jobs = jobsQ.data ?? [];
  const activeCount = jobs.filter(isActive).length;
  const buildsQ = useQuery({
    queryKey: ['vps', 'builds', mapSetId],
    queryFn: () => vpsService.listBuilds(mapSetId),
    refetchInterval: activeCount > 0 ? 5000 : false,
  });
  const builds = buildsQ.data ?? [];

  // Al terminar un trabajo cambian los builds, la evaluación y el resumen del map set
  const prevActive = useRef(activeCount);
  useEffect(() => {
    if (prevActive.current > 0 && activeCount === 0) qc.invalidateQueries({ queryKey: ['vps'] });
    prevActive.current = activeCount;
  }, [activeCount, qc]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['vps'] });
  const start = useMutation({
    mutationFn: () => vpsService.createBuild(mapSetId, head!.id, evaluate),
    onSuccess: r => { notify(`Procesamiento de r${r.build.revisionNumber} en cola`); refresh(); },
    onError: err => notify(errMsg(err)),
  });
  const runEval = useMutation({
    mutationFn: (buildId: string) => vpsService.evaluateBuild(buildId),
    onSuccess: () => { notify('Evaluación en cola'); refresh(); },
    onError: err => notify(errMsg(err)),
  });
  const cancel = useMutation({
    mutationFn: (jobId: string) => vpsService.cancelJob(jobId),
    onSuccess: () => { notify('Cancelación pedida: el trabajo se detiene en el siguiente paso'); refresh(); },
    onError: err => notify(errMsg(err)),
  });
  const remove = useMutation({
    mutationFn: (buildId: string) => vpsService.deleteBuild(buildId),
    onSuccess: () => { notify('Build eliminado'); refresh(); },
    onError: err => notify(errMsg(err)),
  });

  const built = builds.some(b => b.revisionId === head?.id && b.status !== 'failed' && b.status !== 'cancelled');
  const busy = jobs.some(j => j.type === 'build' && isActive(j));
  const inspected = builds.find(b => b.id === inspectId) ?? builds.find(b => b.status === 'ready') ?? null;
  const usedIds = new Set([detail.activeBuildId, detail.previousBuildId].filter(Boolean));

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Paper sx={{ p: 2.5, borderRadius: '16px' }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Procesar</Typography>
          {head ? (
            <>
              <Typography variant="body2" color="text.secondary">
                Revisión r{head.number} · {head.maps} mapas · {fmtDateTime(head.createdAt)}
                {head.note ? ` · «${head.note}»` : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Genera las vistas de cada malla, extrae sus puntos y arma el paquete que usa el servidor para localizar.
                Con todos los mapas tarda decenas de minutos; puedes cerrar esta página mientras tanto.
              </Typography>
              {built && (
                <Alert severity="info" sx={{ mt: 1, py: 0 }}>
                  Esta revisión ya tiene un build. Procesarla otra vez solo sirve si cambió la configuración del servidor.
                </Alert>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: 'center' }}>
                <Button
                  variant="contained" startIcon={<PlayArrowRoundedIcon />} sx={{ borderRadius: '100px' }}
                  disabled={busy || start.isPending} onClick={() => start.mutate()}
                >
                  Procesar r{head.number}
                </Button>
                <FormControlLabel
                  control={<Checkbox size="small" checked={evaluate} onChange={e => setEvaluate(e.target.checked)} />}
                  label={<Typography variant="body2">Evaluar al terminar</Typography>}
                />
              </Stack>
              {busy && <Typography variant="caption" color="text.secondary">Ya hay un procesamiento en curso.</Typography>}
            </>
          ) : (
            <Alert severity="info">Crea una revisión en «Alineación» para poder procesarla.</Alert>
          )}
        </Paper>

        <Paper sx={{ p: 2.5, borderRadius: '16px' }}>
          <Typography sx={{ fontWeight: 700 }}>Trabajos recientes</Typography>
          {jobsQ.isError && <Alert severity="error" sx={{ mt: 1 }}>{errMsg(jobsQ.error)}</Alert>}
          {jobs.length === 0 && !jobsQ.isLoading && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No hay trabajos.</Typography>
          )}
          <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
            {jobs.map(j => (
              <JobRow
                key={j.id} job={j} now={jobsQ.dataUpdatedAt} cancelling={cancel.isPending} onCancel={() => cancel.mutate(j.id)}
              />
            ))}
          </Box>
        </Paper>
      </Box>

      <Paper sx={{ p: 2.5, borderRadius: '16px' }}>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>Builds</Typography>
        {buildsQ.isError && <Alert severity="error">{errMsg(buildsQ.error)}</Alert>}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Build</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Vistas</TableCell>
                <TableCell align="right">Puntos 3D</TableCell>
                <TableCell align="right">Tamaño</TableCell>
                <TableCell align="right">≤ 0,5 m · 5°</TableCell>
                <TableCell align="right">Falsos positivos</TableCell>
                <TableCell>Creado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {builds.map(b => {
                const ev = mainEval(b.evaluation);
                const st = BUILD_STATUS[b.status] ?? { label: b.status, color: 'default' as const };
                return (
                  <TableRow key={b.id} hover selected={b.id === inspected?.id} onClick={() => setInspectId(b.id)} sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{b.spaceId ?? `r${b.revisionNumber}`}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {shortId(b.id)}
                        {b.id === detail.activeBuildId ? ' · publicado' : b.id === detail.previousBuildId ? ' · anterior' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={st.color} label={st.label} />
                      {b.error && <Typography variant="caption" color="error" sx={{ display: 'block' }}>{b.error}</Typography>}
                    </TableCell>
                    <TableCell align="right">{fmtNumber(b.counts?.keyframes ?? null)}</TableCell>
                    <TableCell align="right">{fmtNumber(b.counts?.points ?? null)}</TableCell>
                    <TableCell align="right">{fmtBytes(b.bytes)}</TableCell>
                    <TableCell align="right">{fmtPercent(ev?.['recall@0.5m5deg'] ?? null, 1)}</TableCell>
                    <TableCell align="right">{ev ? fmtNumber(ev.falsePositives) : '—'}</TableCell>
                    <TableCell>{fmtDateTime(b.createdAt)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      <Tooltip title="Evaluar de nuevo">
                        <span>
                          <IconButton size="small" disabled={b.status !== 'ready' || runEval.isPending} onClick={() => runEval.mutate(b.id)}>
                            <FactCheckRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={usedIds.has(b.id) ? 'No se puede borrar el build publicado ni el anterior' : 'Eliminar'}>
                        <span>
                          <IconButton
                            size="small" color="error"
                            disabled={usedIds.has(b.id) || b.status === 'queued' || b.status === 'running' || remove.isPending}
                            onClick={() => { if (window.confirm('¿Eliminar este build y su paquete?')) remove.mutate(b.id); }}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {builds.length === 0 && !buildsQ.isLoading && (
                <TableRow><TableCell colSpan={9} sx={{ color: 'text.secondary' }}>Todavía no hay builds.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {inspected && (
        <Paper sx={{ p: 2.5, borderRadius: '16px' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
            <Typography sx={{ fontWeight: 700, flex: 1 }}>Evaluación</Typography>
            <TextField
              select size="small" label="Build" value={inspected.id} onChange={e => setInspectId(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              {builds.map(b => (
                <MenuItem key={b.id} value={b.id}>{b.spaceId ?? `r${b.revisionNumber}`} · {shortId(b.id)}</MenuItem>
              ))}
            </TextField>
          </Stack>
          {inspected.status === 'ready'
            ? <EvaluationPanel build={inspected} />
            : <Alert severity="info">El build aún no está listo.</Alert>}
        </Paper>
      )}
    </Stack>
  );
}
