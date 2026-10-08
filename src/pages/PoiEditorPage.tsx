import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, InputAdornment, LinearProgress, List, ListItemButton, ListItemIcon,
  ListItemText, OutlinedInput, Paper, Slider, Stack, Switch, FormControlLabel, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import MapViewer, { type MapViewerApi, type ViewerMarker } from '../components/poi-editor/MapViewer';
import NavigationPanel from '../components/poi-editor/NavigationPanel';
import { useNavigationEditor } from '../components/poi-editor/useNavigationEditor';
import { roomService } from '../services/roomService';
import { multisetService } from '../services/multisetService';
import { resolveApiError } from '../services/api';
import scenePinsData from '../data/scenePins.json';
import type { ArPoint, Room } from '../types';

interface ScenePin {
  label: string;
  building: string;
  floor: string;
  position: [number, number, number];
  stateIds: string[];
}

// Pines que existían en Scene.zcomp (Mattercraft), extraídos una sola vez como referencia
const scenePins = scenePinsData as ScenePin[];

const toPoint = (p: [number, number, number]): ArPoint => ({ x: p[0], y: p[1], z: p[2] });
const pinForRoom = (room: Room) => scenePins.find(p => p.stateIds.includes(room.stateId));
const fmt = (p: ArPoint) => `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`;

export default function PoiEditorPage() {
  const qc = useQueryClient();
  const roomsQ = useQuery({ queryKey: ['rooms'], queryFn: roomService.getAll });
  const meshesQ = useQuery({
    queryKey: ['multiset-meshes'],
    queryFn: multisetService.getMapMeshes,
    staleTime: 30 * 60 * 1000,
  });

  const [hiddenMaps, setHiddenMaps] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ArPoint | null>(null);
  const [focus, setFocus] = useState<ArPoint | null>(null);
  const [bounds, setBounds] = useState<[number, number] | null>(null);
  const [clipY, setClipY] = useState<number | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [showReference, setShowReference] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'rooms' | 'nav'>('rooms');
  const [approxFocus, setApproxFocus] = useState(false);
  const viewerApiRef = useRef<MapViewerApi | null>(null);
  const nav = useNavigationEditor(() => viewerApiRef.current, (meshesQ.data ?? []).map(m => m.name), setFocus);

  const rooms = useMemo(
    () => [...(roomsQ.data ?? [])].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [roomsQ.data],
  );
  const selected = rooms.find(r => r.roomId === selectedId) ?? null;
  const importable = rooms.filter(r => !r.arPosition && pinForRoom(r));

  const visibleMeshes = useMemo(
    () => (meshesQ.data ?? []).filter(m => !hiddenMaps.has(m.name)),
    [meshesQ.data, hiddenMaps],
  );

  const markers = useMemo<ViewerMarker[]>(() => {
    const list: ViewerMarker[] = [];
    const placedStateIds = new Set(rooms.filter(r => r.arPosition).map(r => r.stateId));
    if (showReference) {
      scenePins
        .filter(p => !p.stateIds.some(s => placedStateIds.has(s)))
        .forEach((p, i) => list.push({ id: `ref:${i}`, label: p.label, position: toPoint(p.position), kind: 'reference' }));
    }
    for (const r of rooms) {
      if (!r.arPosition) continue;
      const isSel = r.roomId === selectedId;
      if (isSel && draft) continue;
      list.push({ id: `room:${r.roomId}`, label: r.name, position: r.arPosition, kind: isSel ? 'selected' : 'room' });
    }
    if (selected && draft) list.push({ id: 'draft', label: selected.name, position: draft, kind: 'draft' });
    return list;
  }, [rooms, selectedId, selected, draft, showReference]);

  const saveMut = useMutation({
    mutationFn: ({ roomId, pos }: { roomId: string; pos: ArPoint | null }) => roomService.setArPosition(roomId, pos),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); setDraft(null); setError(null); },
    onError: err => setError(resolveApiError(err)),
  });

  const importMut = useMutation({
    mutationFn: async () => {
      for (const r of importable) await roomService.setArPosition(r.roomId, toPoint(pinForRoom(r)!.position));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
    onError: err => setError(resolveApiError(err)),
  });

  const knownPosition = (room: Room) =>
    room.arPosition ?? (pinForRoom(room) ? toPoint(pinForRoom(room)!.position) : null);

  // Sin punto propio: centro de los salones de la misma categoría (su edificio)
  const buildingCenter = (room: Room): ArPoint | null => {
    const pts = rooms
      .filter(r => r.category === room.category && r.roomId !== room.roomId)
      .map(knownPosition)
      .filter((p): p is ArPoint => p !== null);
    if (!pts.length) return null;
    const sum = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y, z: a.z + p.z }), { x: 0, y: 0, z: 0 });
    return { x: sum.x / pts.length, y: sum.y / pts.length, z: sum.z / pts.length };
  };

  const selectRoom = (room: Room) => {
    setSelectedId(room.roomId);
    setDraft(null);
    const exact = knownPosition(room);
    const target = exact ?? buildingCenter(room);
    setApproxFocus(!exact && !!target);
    if (target) setFocus({ ...target });
  };

  const handleMarkerClick = (id: string) => {
    if (id.startsWith('conn:')) {
      setTab('nav');
      nav.select(id.slice(5));
    } else if (id.startsWith('patch:')) {
      setTab('nav');
      nav.selectPatch(id.slice(6));
    } else if (id.startsWith('room:')) {
      const room = rooms.find(r => r.roomId === id.slice(5));
      if (room) selectRoom(room);
    } else if (id.startsWith('ref:') && selected) {
      setDraft(toPoint(scenePins[Number(id.slice(4))].position));
    }
  };

  const handleBounds = (minY: number, maxY: number) => {
    setBounds(prev => (prev && prev[0] === minY && prev[1] === maxY ? prev : [minY, maxY]));
  };

  const handleProgress = (name: string, pct: number | null) => {
    setProgress(prev => {
      const next = { ...prev };
      if (pct === null) delete next[name]; else next[name] = pct;
      return next;
    });
  };

  const editing = draft ?? selected?.arPosition ?? null;
  const filtered = rooms.filter(r => `${r.name} ${r.roomId} ${r.category}`.toLowerCase().includes(search.toLowerCase()));
  const loading = Object.entries(progress);

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {importable.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
          <Tooltip title="Copia la posición de los pines que ya existían en Mattercraft a los salones que aún no tienen punto">
            <Button size="small" variant="outlined" startIcon={<HistoryRoundedIcon />} disabled={importMut.isPending} onClick={() => importMut.mutate()}>
              Importar de Mattercraft ({importable.length})
            </Button>
          </Tooltip>
        </Box>
      )}

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      {meshesQ.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          No se pudieron obtener los modelos de MultiSet. Verifica MULTISET_CLIENT_ID / MULTISET_CLIENT_SECRET en el backend.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        {/* ── Panel de salones ─────────────────────────────────────── */}
        <Paper sx={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}>
            <Tab value="rooms" label="Salones" sx={{ minHeight: 40 }} />
            <Tab value="nav" label="Navegación" sx={{ minHeight: 40 }} />
          </Tabs>
          {tab === 'nav' ? <NavigationPanel nav={nav} /> : (<>
          <Box sx={{ p: 1.5 }}>
            <OutlinedInput
              size="small" fullWidth placeholder="Buscar salón…" value={search}
              onChange={e => setSearch(e.target.value)}
              startAdornment={<InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment>}
            />
          </Box>
          {roomsQ.isLoading && <LinearProgress />}
          <List dense sx={{ flex: 1, overflowY: 'auto', py: 0 }}>
            {filtered.map(r => (
              <ListItemButton key={r.roomId} selected={r.roomId === selectedId} onClick={() => selectRoom(r)}>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  {r.arPosition
                    ? <CheckCircleRoundedIcon fontSize="small" color="success" />
                    : <RadioButtonUncheckedRoundedIcon fontSize="small" color={pinForRoom(r) ? 'warning' : 'disabled'} />}
                </ListItemIcon>
                <ListItemText
                  primary={r.name}
                  secondary={r.arPosition ? fmt(r.arPosition) : pinForRoom(r) ? 'Solo en Mattercraft' : 'Sin punto'}
                />
                <Chip size="small" label={r.category} sx={{ ml: 1 }} />
              </ListItemButton>
            ))}
          </List>

          {selected && (
            <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{selected.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {draft
                  ? 'Punto nuevo sin guardar'
                  : selected.arPosition
                    ? 'Punto guardado'
                    : approxFocus
                      ? `Sin punto: la vista se centró en el edificio ${selected.category}. Haz clic en el modelo para ubicarlo.`
                      : 'Haz clic en el modelo 3D para ubicar el punto'}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ my: 1 }}>
                {(['x', 'y', 'z'] as const).map(axis => (
                  <TextField
                    key={axis} size="small" type="number" label={axis.toUpperCase()}
                    value={editing ? editing[axis] : ''}
                    onChange={e => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) setDraft({ ...(editing ?? { x: 0, y: 0, z: 0 }), [axis]: v });
                    }}
                    slotProps={{ htmlInput: { step: 0.1 } }}
                  />
                ))}
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                <Button
                  size="small" variant="contained" disabled={!draft || saveMut.isPending}
                  onClick={() => saveMut.mutate({ roomId: selected.roomId, pos: draft })}
                >
                  Guardar
                </Button>
                <Button size="small" disabled={!draft} onClick={() => setDraft(null)}>Descartar</Button>
                {!draft && pinForRoom(selected) && (
                  <Button size="small" onClick={() => setDraft(toPoint(pinForRoom(selected)!.position))}>Usar pin de Mattercraft</Button>
                )}
                {selected.arPosition && !draft && (
                  <Button size="small" color="error" disabled={saveMut.isPending}
                    onClick={() => saveMut.mutate({ roomId: selected.roomId, pos: null })}>
                    Quitar punto
                  </Button>
                )}
              </Stack>
            </Box>
          )}
          </>)}
        </Paper>

        {/* ── Visor 3D ─────────────────────────────────────────────── */}
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <Stack direction="row" spacing={2} sx={{ p: 1.5, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
            <Stack direction="row" spacing={1}>
              {(meshesQ.data ?? []).map(m => (
                <Chip
                  key={m.name} label={m.name} size="small"
                  color={hiddenMaps.has(m.name) ? 'default' : 'primary'}
                  variant={hiddenMaps.has(m.name) ? 'outlined' : 'filled'}
                  onClick={() => setHiddenMaps(prev => {
                    const next = new Set(prev);
                    if (next.has(m.name)) next.delete(m.name); else next.add(m.name);
                    return next;
                  })}
                />
              ))}
            </Stack>
            {bounds && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 260, flex: 1 }}>
                <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>Corte de altura</Typography>
                <Slider
                  size="small" min={bounds[0]} max={bounds[1]} step={0.1}
                  value={clipY ?? bounds[1]}
                  onChange={(_, v) => setClipY(v === bounds[1] ? null : (v as number))}
                  valueLabelDisplay="auto" valueLabelFormat={v => `${v.toFixed(1)} m`}
                />
              </Box>
            )}
            <FormControlLabel
              control={<Switch size="small" checked={showReference} onChange={e => setShowReference(e.target.checked)} />}
              label={<Typography variant="caption">Pines de Mattercraft</Typography>}
            />
          </Stack>
          {(meshesQ.isLoading || loading.length > 0) && (
            <Box sx={{ px: 1.5, pb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {meshesQ.isLoading
                  ? 'Consultando MultiSet…'
                  : `Descargando ${loading.map(([n, p]) => `${n} ${p}%`).join(' · ')} (se guarda en caché del navegador)`}
              </Typography>
              <LinearProgress
                variant={loading.length ? 'determinate' : 'indeterminate'}
                value={loading.length ? loading.reduce((a, [, p]) => a + p, 0) / loading.length : undefined}
              />
            </Box>
          )}
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <MapViewer
              meshes={visibleMeshes}
              markers={markers}
              connections={nav.viewerConnections}
              patches={nav.viewerPatches}
              navMesh={nav.viewerNavMesh}
              clipY={clipY}
              pickPlaneY={tab === 'nav' ? nav.pickPlaneY : null}
              focus={focus}
              onPick={p => {
                if (tab === 'nav') nav.handlePick(p);
                else if (selected) setDraft(p);
              }}
              onMarkerClick={handleMarkerClick}
              onBounds={handleBounds}
              onProgress={handleProgress}
              onError={setError}
              onReady={api => { viewerApiRef.current = api; }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, py: 0.75 }}>
            Arrastra para rotar · clic derecho para desplazar · rueda para zoom · WASD o flechas para moverte (Q/E bajar/subir, Shift rápido) · usa el corte de altura para ver cada piso.
            {tab === 'nav'
              ? nav.drawingPatch
                ? ' Clic sobre el piso alrededor del hueco para agregar puntos · Retroceso deshace · Enter termina.'
                : ' Verde = zona caminable; naranja = escaleras; azul = parches de suelo.'
              : selected ? ' Clic sobre el modelo para ubicar el punto.' : ' Selecciona un salón para ubicar su punto.'}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
