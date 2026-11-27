import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  Alert, Box, Button, Checkbox, Chip, Divider, IconButton, InputAdornment, LinearProgress, List, ListItemButton,
  ListItemIcon, ListItemText, MenuItem, Paper, Slider, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MapViewer, { type ViewerGizmo, type ViewerMarker } from '../../components/poi-editor/MapViewer';
import { vpsService } from '../../services/vpsService';
import { fmtDateTime, fmtPercent } from '../../utils/analyticsFormat';
import type { ArPoint, MapMesh } from '../../types';
import type { Vec3, VpsMap, VpsPose, VpsRevision, VpsScan } from '../../types/vps';
import {
  IDENTITY_POSE, localToWorld, poseAngles, quatFromAngles, samePose, worldToLocal, type VpsTabProps,
} from './vpsFormat';

interface Draft { include: boolean; scanId: string | null; pose: VpsPose }
interface Pair { local: Vec3; world: Vec3 }
type View = 'all' | 'selected' | 'others';
type GizmoMode = 'off' | 'translate' | 'rotate';

const NO_LIST: never[] = [];
const noop = () => {};
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const fmtCm = (m: number) => `${(m * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} cm`;
const fmtPoint = (p: Vec3) => `${p.x.toFixed(2)}; ${p.y.toFixed(2)}; ${p.z.toFixed(2)}`;
const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));
const scanLists = (results: UseQueryResult<VpsScan[]>[]) => results.map(r => r.data);
const SCAN_SOURCES: Record<string, string> = { upload: 'subido', import: 'importado' };

function initialDraft(m: VpsMap, head: VpsRevision | null): Draft {
  return {
    include: !!head?.poses[m.id],
    scanId: head?.scans[m.id] ?? m.scan?.id ?? null,
    pose: head?.poses[m.id] ?? m.pose ?? IDENTITY_POSE,
  };
}

/** Campo numérico que deja escribir libremente («-», «1.») y solo publica valores válidos. */
function NumField({ label, value, step, unit, onChange }: {
  label: string;
  value: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <TextField
      size="small" type="number" label={label}
      value={text ?? String(round3(value))}
      onFocus={() => setText(String(round3(value)))}
      onBlur={() => setText(null)}
      onChange={e => {
        setText(e.target.value);
        const v = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(v)) onChange(v);
      }}
      slotProps={{
        htmlInput: { step },
        input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> },
      }}
      sx={{ flex: 1, minWidth: 0 }}
    />
  );
}

export default function VpsAlignmentTab({ mapSetId, detail, notify }: VpsTabProps) {
  const qc = useQueryClient();
  const head = detail.headRevision;
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedId, setSelectedId] = useState<string | null>(detail.maps[0]?.id ?? null);
  const [dof, setDof] = useState<4 | 6>(4);
  const [view, setView] = useState<View>('all');
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('off');
  const [lastPick, setLastPick] = useState<ArPoint | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [pendingLocal, setPendingLocal] = useState<Vec3 | null>(null);
  const [pendingWorld, setPendingWorld] = useState<Vec3 | null>(null);
  const [result, setResult] = useState<{ pose: VpsPose; text: string; residuals?: number[] } | null>(null);
  const [maxDist, setMaxDist] = useState(0.3);
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [bounds, setBounds] = useState<[number, number] | null>(null);
  const [clipY, setClipY] = useState<number | null>(null);

  const scans = useQueries({
    queries: detail.maps.map(m => ({
      queryKey: ['vps', 'scans', m.id],
      queryFn: () => vpsService.listScans(m.id),
      staleTime: 5 * 60_000,
    })),
    combine: scanLists,
  });
  const scansByMap = useMemo(
    () => Object.fromEntries(detail.maps.map((m, i) => [m.id, scans[i] ?? NO_LIST])) as Record<string, VpsScan[]>,
    [detail.maps, scans],
  );

  const draftOf = (m: VpsMap) => drafts[m.id] ?? initialDraft(m, head);
  const selected = detail.maps.find(m => m.id === selectedId) ?? null;
  const selDraft = selected ? draftOf(selected) : null;

  const updateDraft = (m: VpsMap, patch: Partial<Draft>) =>
    setDrafts(prev => ({ ...prev, [m.id]: { ...(prev[m.id] ?? initialDraft(m, head)), ...patch } }));

  const selectMap = (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    clearPairs();
  };

  // Los pares guardan puntos en el marco del escaneo: no sirven para otro mapa ni para otro escaneo
  const clearPairs = () => {
    setPairs([]);
    setPendingLocal(null);
    setPendingWorld(null);
    setResult(null);
  };

  const changes = useMemo(() => {
    const poses: Record<string, VpsPose> = {};
    const scanIds: Record<string, string> = {};
    const remove: string[] = [];
    const changed = new Set<string>();
    for (const m of detail.maps) {
      const d = drafts[m.id] ?? initialDraft(m, head);
      const headPose = head?.poses[m.id];
      if (!d.include) {
        if (headPose) { remove.push(m.id); changed.add(m.id); }
        continue;
      }
      if (!d.scanId) continue;
      if (!headPose || !samePose(headPose, d.pose)) { poses[m.id] = d.pose; changed.add(m.id); }
      if (d.scanId !== head?.scans[m.id]) { scanIds[m.id] = d.scanId; changed.add(m.id); }
    }
    return { poses, scans: scanIds, remove, changed };
  }, [detail.maps, drafts, head]);

  const viewerMeshes = useMemo<MapMesh[]>(() => detail.maps.flatMap(m => {
    const d = drafts[m.id] ?? initialDraft(m, head);
    const isSelected = m.id === selectedId;
    if ((view === 'selected' && !isSelected) || (view === 'others' && isSelected) || (!d.include && !isSelected)) return [];
    const url = scansByMap[m.id]?.find(s => s.id === d.scanId)?.urls?.textured;
    if (!url) return [];
    const { position, rotation: r } = d.pose;
    return [{ name: m.name, url, position, rotation: { qx: r.x, qy: r.y, qz: r.z, qw: r.w } }];
  }), [detail.maps, drafts, head, selectedId, view, scansByMap]);

  const selPose = useMemo(() => {
    const m = detail.maps.find(x => x.id === selectedId);
    return m ? (drafts[m.id] ?? initialDraft(m, head)).pose : null;
  }, [detail.maps, selectedId, drafts, head]);
  const markers = useMemo<ViewerMarker[]>(() => {
    const out: ViewerMarker[] = [];
    pairs.forEach((p, i) => {
      out.push({ id: `w${i}`, label: `P${i + 1}`, position: p.world, kind: 'reference' });
      if (selPose) out.push({ id: `l${i}`, label: `P${i + 1}′`, position: localToWorld(selPose, p.local), kind: 'draft' });
    });
    if (pendingWorld) out.push({ id: 'pw', label: 'Campus', position: pendingWorld, kind: 'reference' });
    if (pendingLocal && selPose) out.push({ id: 'pl', label: 'Escaneo', position: localToWorld(selPose, pendingLocal), kind: 'draft' });
    if (lastPick) out.push({ id: 'pick', label: 'Clic', position: lastPick, kind: 'selected' });
    return out;
  }, [pairs, pendingWorld, pendingLocal, lastPick, selPose]);

  const addPoint = (kind: 'local' | 'world') => {
    if (!lastPick || !selPose) return;
    const local = kind === 'local' ? worldToLocal(selPose, lastPick) : pendingLocal;
    const world = kind === 'world' ? { ...lastPick } : pendingWorld;
    if (local && world) {
      setPairs(prev => [...prev, { local, world }]);
      setPendingLocal(null);
      setPendingWorld(null);
    } else if (kind === 'local') setPendingLocal(local);
    else setPendingWorld(world);
    setResult(null);
  };

  const solve = useMutation({
    mutationFn: () => vpsService.solveAlignment(mapSetId, pairs, dof),
    onSuccess: r => setResult({
      pose: r.pose,
      residuals: r.residualsM,
      text: `Por puntos: error medio ${fmtCm(r.rmsM)}, máximo ${fmtCm(r.maxM)}`,
    }),
    onError: err => notify(errMsg(err)),
  });
  const refine = useMutation({
    mutationFn: () => vpsService.refineIcp(mapSetId, {
      mapId: selected!.id,
      scanId: selDraft?.scanId ?? undefined,
      pose: selDraft!.pose,
      maxDistanceM: maxDist,
      dof,
    }),
    onSuccess: r => setResult({
      pose: r.pose,
      text: `ICP: error medio ${fmtCm(r.rmsM)}, solapamiento ${fmtPercent(r.fitness)} (${r.iterations} iteraciones)`,
    }),
    onError: err => notify(errMsg(err)),
  });
  const createRevision = useMutation({
    mutationFn: () => vpsService.addRevision(mapSetId, {
      poses: changes.poses,
      scans: changes.scans,
      remove: changes.remove,
      note: note.trim(),
    }),
    onSuccess: rev => {
      notify(rev.id === head?.id
        ? 'No hay cambios frente a la revisión actual'
        : `Revisión r${rev.number} creada. Procésala en «Procesamiento».`);
      setDrafts({});
      setNote('');
      setResult(null);
      qc.invalidateQueries({ queryKey: ['vps'] });
    },
    onError: err => notify(errMsg(err)),
  });

  const handleProgress = (name: string, pct: number | null) => setProgress(prev => {
    const next = { ...prev };
    if (pct === null) delete next[name]; else next[name] = pct;
    return next;
  });
  const handleBounds = (minY: number, maxY: number) =>
    setBounds(prev => (prev && prev[0] === minY && prev[1] === maxY ? prev : [minY, maxY]));
  const loading = Object.entries(progress);

  const angles = selPose ? poseAngles(selPose.rotation) : null;
  const setPose = (pose: VpsPose) => { if (selected) updateDraft(selected, { pose }); };
  const setPosition = (axis: 'x' | 'y' | 'z', v: number) => {
    if (selPose) setPose({ ...selPose, position: { ...selPose.position, [axis]: v } });
  };
  const setAngle = (key: 'yaw' | 'pitch' | 'roll', v: number) => {
    if (!selPose || !angles) return;
    const a = { ...angles, [key]: v };
    setPose({ ...selPose, rotation: quatFromAngles(a.yaw, a.pitch, a.roll) });
  };
  const minPairs = dof === 4 ? 2 : 3;
  const gizmo = useMemo<ViewerGizmo | null>(() => {
    const m = detail.maps.find(x => x.id === selectedId);
    return m && gizmoMode !== 'off' ? { name: m.name, mode: gizmoMode, tilt: dof === 6 } : null;
  }, [detail.maps, selectedId, gizmoMode, dof]);
  const selectedScans = selected ? scansByMap[selected.id] ?? NO_LIST : NO_LIST;
  const movedPublished = !!(selected && head?.poses[selected.id] && selPose && !samePose(head.poses[selected.id], selPose));

  return (
    <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 250px)', minHeight: 560 }}>
      {/* ── Mapas y pose del seleccionado ─────────────────────────── */}
      <Paper sx={{ width: 370, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <List dense sx={{ py: 0 }}>
            {detail.maps.map(m => {
              const d = draftOf(m);
              const newest = scansByMap[m.id]?.[0];
              const status = !d.scanId
                ? 'Sin escaneo: súbelo en «Mapas»'
                : newest && newest.id !== d.scanId
                  ? 'Hay un escaneo más nuevo'
                  : d.include ? 'En la revisión' : 'Fuera de la revisión';
              return (
                <ListItemButton key={m.id} selected={m.id === selectedId} onClick={() => selectMap(m.id)}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox
                      edge="start" size="small" checked={d.include} disabled={!d.scanId}
                      onClick={e => e.stopPropagation()}
                      onChange={e => updateDraft(m, { include: e.target.checked })}
                    />
                  </ListItemIcon>
                  <ListItemText primary={m.name} secondary={status} />
                  {changes.changed.has(m.id) && <Chip size="small" color="warning" label="Cambiado" sx={{ ml: 1 }} />}
                </ListItemButton>
              );
            })}
          </List>
          <Divider />

          {selected && selDraft && angles && (
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{selected.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Pose del escaneo en el espacio del campus (metros; el giro es alrededor del eje vertical)
                </Typography>
              </Box>
              <TextField
                select size="small" label="Escaneo" value={selDraft.scanId ?? ''}
                onChange={e => { updateDraft(selected, { scanId: e.target.value || null }); clearPairs(); }}
                disabled={selectedScans.length === 0}
              >
                {selectedScans.map(s => (
                  <MenuItem key={s.id} value={s.id}>
                    {fmtDateTime(s.createdAt)} · {SCAN_SOURCES[s.source ?? ''] ?? s.source ?? '—'}
                    {s.id === head?.scans[selected.id] ? ' · en la revisión' : ''}
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction="row" spacing={1}>
                {(['x', 'y', 'z'] as const).map(axis => (
                  <NumField
                    key={axis} label={axis.toUpperCase()} unit="m" step={0.01}
                    value={selDraft.pose.position[axis]} onChange={v => setPosition(axis, v)}
                  />
                ))}
              </Stack>
              <Stack direction="row" spacing={1}>
                <NumField label="Giro" unit="°" step={0.5} value={angles.yaw} onChange={v => setAngle('yaw', v)} />
                {dof === 6 && (
                  <>
                    <NumField label="Cabeceo" unit="°" step={0.5} value={angles.pitch} onChange={v => setAngle('pitch', v)} />
                    <NumField label="Alabeo" unit="°" step={0.5} value={angles.roll} onChange={v => setAngle('roll', v)} />
                  </>
                )}
              </Stack>
              {movedPublished && (
                <Alert severity="warning" sx={{ py: 0 }}>
                  Este mapa ya está en la revisión: moverlo cambia dónde caen sus puntos AR y su navmesh. Hazlo solo
                  para corregir errores.
                </Alert>
              )}
              {changes.changed.has(selected.id) && (
                <Button size="small" onClick={() => setDrafts(prev => {
                  const next = { ...prev };
                  delete next[selected.id];
                  return next;
                })}>
                  Volver a la revisión actual
                </Button>
              )}

              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Alinear por puntos</Typography>
              <Typography variant="caption" color="text.secondary">
                Con «Solo este mapa», haz clic en un detalle fácil de reconocer (esquina, columna, puerta) y tómalo como
                punto del escaneo. Con «Sin este mapa», haz clic en el mismo detalle y tómalo como punto del campus.
                Repite con {minPairs} o más detalles separados entre sí.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" disabled={!lastPick} onClick={() => addPoint('local')} sx={{ flex: 1 }}>
                  Punto del escaneo
                </Button>
                <Button size="small" variant="outlined" disabled={!lastPick} onClick={() => addPoint('world')} sx={{ flex: 1 }}>
                  Punto del campus
                </Button>
              </Stack>
              {(pendingLocal || pendingWorld) && (
                <Typography variant="caption" color="warning.main">
                  Falta el punto {pendingLocal ? 'del campus' : 'del escaneo'} para completar el par {pairs.length + 1}
                </Typography>
              )}
              {pairs.map((p, i) => (
                <Stack key={i} direction="row" sx={{ alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ flex: 1, fontFamily: 'monospace' }}>
                    P{i + 1}: {fmtPoint(p.world)}
                    {result?.residuals?.[i] != null ? ` · ${fmtCm(result.residuals[i])}` : ''}
                  </Typography>
                  <IconButton size="small" onClick={() => { setPairs(prev => prev.filter((_, j) => j !== i)); setResult(null); }}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Button
                  size="small" variant="contained" disabled={pairs.length < minPairs || solve.isPending}
                  onClick={() => solve.mutate()} sx={{ flex: 1 }}
                >
                  {solve.isPending ? 'Calculando…' : `Calcular pose (${pairs.length})`}
                </Button>
              </Stack>

              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Refinar con ICP</Typography>
              <Typography variant="caption" color="text.secondary">
                Ajusta la pose actual pegando la malla a los demás mapas de la revisión actual. Necesita una pose
                inicial cercana (menos de la distancia máxima).
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <NumField label="Distancia máx." unit="m" step={0.05} value={maxDist} onChange={v => setMaxDist(Math.min(2, Math.max(0.05, v)))} />
                <Button
                  size="small" variant="contained" disabled={!head || !selDraft.scanId || refine.isPending}
                  onClick={() => refine.mutate()} sx={{ flex: 1 }}
                >
                  {refine.isPending ? 'Refinando…' : 'Refinar'}
                </Button>
              </Stack>
              {refine.isPending && <LinearProgress />}

              {result && (
                <Alert
                  severity="info"
                  action={
                    <Stack direction="row">
                      <Button size="small" onClick={() => { setPose(result.pose); setResult(null); }}>Aplicar</Button>
                      <Button size="small" color="inherit" onClick={() => setResult(null)}>Descartar</Button>
                    </Stack>
                  }
                >
                  {result.text}
                </Alert>
              )}
            </Stack>
          )}
        </Box>

        {/* ── Nueva revisión ───────────────────────────────────────── */}
        <Stack spacing={1} sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {changes.changed.size === 0
              ? `Sin cambios frente a la revisión r${head?.number ?? '—'}`
              : `${changes.changed.size} ${changes.changed.size === 1 ? 'mapa cambiado' : 'mapas cambiados'}`}
          </Typography>
          <TextField
            size="small" label="Nota de la revisión" value={note} onChange={e => setNote(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained" size="small" sx={{ flex: 1 }}
              disabled={changes.changed.size === 0 || createRevision.isPending}
              onClick={() => createRevision.mutate()}
            >
              {createRevision.isPending ? 'Creando…' : 'Crear revisión'}
            </Button>
            <Button size="small" disabled={changes.changed.size === 0} onClick={() => setDrafts({})}>Descartar</Button>
          </Stack>
        </Stack>
      </Paper>

      {/* ── Vista previa 3D ──────────────────────────────────────── */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Stack direction="row" spacing={2} sx={{ p: 1.5, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v: View | null) => v && setView(v)}>
            <ToggleButton value="all">Todos</ToggleButton>
            <ToggleButton value="selected">Solo este mapa</ToggleButton>
            <ToggleButton value="others">Sin este mapa</ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="4 grados de libertad: posición y giro horizontal (los escaneos ya vienen nivelados). 6: también inclina el mapa.">
            <ToggleButtonGroup size="small" exclusive value={dof} onChange={(_, v: 4 | 6 | null) => v && setDof(v)}>
              <ToggleButton value={4}>4 GdL</ToggleButton>
              <ToggleButton value={6}>6 GdL</ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>
          <Tooltip title="Mover o girar el mapa seleccionado arrastrando las flechas o los anillos en el visor">
            <ToggleButtonGroup
              size="small" exclusive value={gizmoMode} disabled={!selected}
              onChange={(_, v: GizmoMode | null) => v && setGizmoMode(v)}
            >
              <ToggleButton value="off">Sin gizmo</ToggleButton>
              <ToggleButton value="translate">Mover</ToggleButton>
              <ToggleButton value="rotate">Girar</ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>
          {bounds && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 220, flex: 1 }}>
              <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>Corte de altura</Typography>
              <Slider
                size="small" min={bounds[0]} max={bounds[1]} step={0.1}
                value={clipY ?? bounds[1]}
                onChange={(_, v) => setClipY(v === bounds[1] ? null : (v as number))}
                valueLabelDisplay="auto" valueLabelFormat={v => `${v.toFixed(1)} m`}
              />
            </Box>
          )}
          {lastPick && (
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>Clic: {fmtPoint(lastPick)}</Typography>
          )}
        </Stack>
        {loading.length > 0 && (
          <Box sx={{ px: 1.5, pb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Descargando {loading.map(([n, p]) => `${n} ${p}%`).join(' · ')} (se guarda en caché del navegador)
            </Typography>
            <LinearProgress
              variant="determinate"
              value={loading.reduce((a, [, p]) => a + p, 0) / loading.length}
            />
          </Box>
        )}
        <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <MapViewer
            meshes={viewerMeshes}
            markers={markers}
            connections={NO_LIST}
            patches={NO_LIST}
            elevators={NO_LIST}
            navMesh={null}
            clipY={clipY}
            pickPlaneY={null}
            focus={null}
            onPick={p => setLastPick({ ...p })}
            onMarkerClick={noop}
            onBounds={handleBounds}
            onProgress={handleProgress}
            onError={notify}
            gizmo={gizmo}
            onGizmoChange={(position, rotation) => setPose({ position, rotation })}
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, py: 0.75 }}>
          Arrastra para rotar · clic derecho para desplazar · rueda para zoom · WASD para moverte · clic en el modelo
          para tomar un punto · con «Mover» o «Girar», arrastra las flechas o anillos del mapa seleccionado. Los cambios de pose se ven al instante; nada cambia en la app hasta crear la revisión,
          procesarla y publicarla.
        </Typography>
      </Paper>
    </Box>
  );
}
