import type { ReactNode } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider,
  FormControlLabel, IconButton, LinearProgress, List, ListItem, ListItemText, Paper, Slider, Stack, Switch,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import DeselectRoundedIcon from '@mui/icons-material/DeselectRounded';
import HighlightAltRoundedIcon from '@mui/icons-material/HighlightAltRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import PentagonRoundedIcon from '@mui/icons-material/PentagonRounded';
import RedoRoundedIcon from '@mui/icons-material/RedoRounded';
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import StairsRoundedIcon from '@mui/icons-material/StairsRounded';
import TouchAppRoundedIcon from '@mui/icons-material/TouchAppRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { ArPoint } from '../../types';
import { lineLength, planArea } from '../../utils/mapEdits';
import { MODE_COLORS, type EditTool } from './sceneEditing';
import { MODEL_TOOLS, NAV_TOOLS, type ConfirmRequest, type MapEditor } from './useMapEditor';

const TOOL_INFO: Record<EditTool, { label: string; icon: ReactNode; help: string }> = {
  fragment: {
    label: 'Fragmento',
    icon: <TouchAppRoundedIcon fontSize="small" />,
    help: 'Clic sobre un objeto: selecciona el trozo conectado hasta el alcance indicado. Ideal para restos flotantes, personas o muebles. Alt+clic lo quita de la selección.',
  },
  brush: {
    label: 'Pincel',
    icon: <BrushRoundedIcon fontSize="small" />,
    help: 'Mantén el clic y pinta sobre lo que quieras quitar. Alt mientras pintas borra de la selección. Gira la cámara con el botón derecho.',
  },
  box: {
    label: 'Área',
    icon: <HighlightAltRoundedIcon fontSize="small" />,
    help: 'Arrastra un rectángulo para seleccionar muchos elementos a la vez (Alt para quitar). Gira la cámara con el botón derecho.',
  },
  poly: {
    label: 'Polígono',
    icon: <PentagonRoundedIcon fontSize="small" />,
    help: 'Clic sobre la malla verde para seleccionar sus polígonos, o sobre una escalera/conexión o un bloqueo existente. Alt+clic quita.',
  },
  barrier: {
    label: 'Corte',
    icon: <ContentCutRoundedIcon fontSize="small" />,
    help: 'Clics sobre el piso para trazar una línea que las rutas no podrán cruzar (cierra un pasillo, una puerta o separa dos zonas). Enter termina · Retroceso deshace el último punto · Esc cancela.',
  },
};

const m2 = (v: number) => `${v.toLocaleString('es', { maximumFractionDigits: 1 })} m²`;
const n = (v: number) => v.toLocaleString('es');

/** Barra flotante dentro del visor: modo, herramientas, deshacer/rehacer y la acción sobre la selección. */
export function EditToolbar({ edit }: { edit: MapEditor }) {
  const color = MODE_COLORS[edit.mode];
  const tools = edit.mode === 'model' ? MODEL_TOOLS : NAV_TOOLS;
  const sel = edit.selection;
  const hasSelection = edit.mode === 'model' ? sel.model.triangles > 0 : edit.canBlock || edit.canUnblock;
  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute', top: 12, left: 12, zIndex: 3, display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5,
        borderRadius: 2.5, border: 2, borderColor: color, bgcolor: 'rgba(255,255,255,0.96)',
      }}
    >
      <Chip
        size="small"
        icon={edit.mode === 'model' ? <ViewInArRoundedIcon /> : <RouteRoundedIcon />}
        label={edit.mode === 'model' ? 'Modelo 3D' : 'Malla de navegación'}
        sx={{ bgcolor: color, color: '#fff', fontWeight: 700, '& .MuiChip-icon': { color: '#fff' } }}
      />
      <ToggleButtonGroup size="small" exclusive value={edit.tool} onChange={(_, t) => t && edit.setTool(t)}>
        {tools.map((t, i) => (
          <Tooltip key={t} title={`${TOOL_INFO[t].label} (${i + 1})`}>
            <ToggleButton value={t} sx={{ px: 1, '&.Mui-selected': { color, bgcolor: `${color}22` } }}>{TOOL_INFO[t].icon}</ToggleButton>
          </Tooltip>
        ))}
      </ToggleButtonGroup>
      <Divider orientation="vertical" flexItem />
      <Tooltip title="Deshacer (Ctrl/⌘+Z)">
        <span><IconButton size="small" disabled={!edit.canUndo} onClick={edit.undo}><UndoRoundedIcon fontSize="small" /></IconButton></span>
      </Tooltip>
      <Tooltip title="Rehacer (Ctrl/⌘+Shift+Z)">
        <span><IconButton size="small" disabled={!edit.canRedo} onClick={edit.redo}><RedoRoundedIcon fontSize="small" /></IconButton></span>
      </Tooltip>
      {hasSelection && (
        <>
          <Divider orientation="vertical" flexItem />
          <Tooltip title="Quitar la selección (Esc)">
            <IconButton size="small" onClick={edit.clearSelection}><DeselectRoundedIcon fontSize="small" /></IconButton>
          </Tooltip>
          {edit.mode === 'model' ? (
            <Button size="small" color="error" variant="contained" startIcon={<DeleteForeverRoundedIcon />} onClick={edit.deleteModelSelection}>
              Eliminar ({n(sel.model.triangles)})
            </Button>
          ) : edit.canBlock ? (
            <Button size="small" color="error" variant="contained" startIcon={<BlockRoundedIcon />} onClick={edit.blockNavSelection}>
              Bloquear
            </Button>
          ) : (
            <Button size="small" variant="contained" startIcon={<LockOpenRoundedIcon />} onClick={edit.unblockNavSelection}>
              Quitar bloqueo
            </Button>
          )}
        </>
      )}
    </Paper>
  );
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  return (
    <Dialog open={!!request} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {request?.danger && <WarningAmberRoundedIcon color="warning" />}
        {request?.title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>{request?.message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          autoFocus variant="contained" color={request?.danger ? 'error' : 'primary'}
          onClick={() => { request?.onConfirm(); onClose(); }}
        >
          {request?.confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function blockDetail(b: MapEditor['blocks'][number], connectionLabel: (id: string) => string | null) {
  if (b.kind === 'AREA') {
    const polys = b.polygons ?? [];
    return `Zona · ${polys.length} polígono(s) · ${m2(polys.reduce((s, p) => s + planArea(p), 0))}`;
  }
  if (b.kind === 'BARRIER') return `Corte · ${lineLength(b.line ?? []).toFixed(1)} m`;
  return `Conexión · ${connectionLabel(b.connectionId ?? '') ?? 'ya no existe'}`;
}

interface PanelProps {
  edit: MapEditor;
  focus: (p: ArPoint) => void;
  connectionLabel: (id: string) => string | null;
  connectionCenter: (id: string) => ArPoint | null;
  onGoToNavigation: () => void;
}

/** Panel de la pestaña «Corregir»: modo, opciones de la herramienta, selección, cambios y lo ya corregido. */
export default function MapEditPanel({ edit, focus, connectionLabel, connectionCenter, onGoToNavigation }: PanelProps) {
  const color = MODE_COLORS[edit.mode];
  const sel = edit.selection;
  const info = TOOL_INFO[edit.tool];
  const mismatched = new Set(edit.mismatched);

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1.5 }}>
        <ToggleButtonGroup
          fullWidth exclusive size="small" value={edit.mode}
          onChange={(_, m) => m && edit.setMode(m)}
        >
          <ToggleButton value="model" sx={{ gap: 0.75, '&.Mui-selected': { bgcolor: MODE_COLORS.model, color: '#fff', '&:hover': { bgcolor: MODE_COLORS.model } } }}>
            <ViewInArRoundedIcon fontSize="small" /> Modelo 3D
          </ToggleButton>
          <ToggleButton value="nav" sx={{ gap: 0.75, '&.Mui-selected': { bgcolor: MODE_COLORS.nav, color: '#fff', '&:hover': { bgcolor: MODE_COLORS.nav } } }}>
            <RouteRoundedIcon fontSize="small" /> Malla
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {edit.mode === 'model'
            ? 'Quita del escaneo lo que no es parte del edificio (personas, muebles, restos flotantes, escaleras o paredes deformadas). Lo quitado deja de verse y de contar al generar la malla.'
            : 'Bloquea zonas, corta pasos o desactiva escaleras para que las rutas no pasen por ahí. Se conserva en cada regeneración.'}
        </Typography>
      </Box>

      {edit.loadError && <Alert severity="error" sx={{ mx: 1.5, mb: 1 }}>No se pudieron cargar las correcciones guardadas.</Alert>}
      {edit.error && <Alert severity="error" onClose={() => edit.setError(null)} sx={{ mx: 1.5, mb: 1 }}>{edit.error}</Alert>}
      {edit.loading && <LinearProgress />}

      {/* ── Herramienta ─────────────────────────────── */}
      <Box sx={{ mx: 1.5, p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', borderLeft: 4, borderLeftColor: color }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box sx={{ color, display: 'flex' }}>{info.icon}</Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{info.label}</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{info.help}</Typography>
        {edit.tool === 'brush' && (
          <SizeSlider label="Radio del pincel" value={edit.brushSize} min={0.05} max={2} step={0.05} onChange={edit.setBrushSize} color={color} />
        )}
        {edit.tool === 'fragment' && (
          <SizeSlider label="Alcance desde el clic" value={edit.reach} min={0.25} max={15} step={0.25} onChange={edit.setReach} color={color} />
        )}
        {edit.tool === 'box' && (
          <FormControlLabel
            sx={{ mt: 0.5 }}
            control={<Switch size="small" checked={edit.visibleOnly} onChange={e => edit.setVisibleOnly(e.target.checked)} />}
            label={<Typography variant="caption">Solo lo visible (no lo que está detrás de paredes o pisos)</Typography>}
          />
        )}
        {edit.mode === 'nav' && edit.tool !== 'barrier' && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            La malla mostrada es la publicada o la última vista previa. Usa el corte de altura para trabajar piso por piso.
          </Typography>
        )}
      </Box>

      {/* ── Corte en curso ──────────────────────────── */}
      {edit.barrier && (
        <Alert severity="info" sx={{ mx: 1.5, mt: 1 }}>
          {edit.barrier.length === 1 ? 'Ahora marca el otro extremo del corte.' : `${edit.barrier.length} puntos · ${lineLength(edit.barrier).toFixed(1)} m`}
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            <Button size="small" variant="contained" disabled={edit.barrier.length < 2} onClick={edit.finishBarrier}>Terminar</Button>
            <Button size="small" onClick={edit.undoBarrierPoint}>Deshacer punto</Button>
            <Button size="small" onClick={edit.cancelBarrier}>Cancelar</Button>
          </Stack>
        </Alert>
      )}

      {/* ── Selección ───────────────────────────────── */}
      <Box sx={{ mx: 1.5, mt: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
        <Typography variant="overline" sx={{ lineHeight: 1.5, display: 'block' }}>Selección</Typography>
        {edit.mode === 'model' ? (
          sel.model.triangles ? (
            <>
              <Typography variant="body2">
                <b>{n(sel.model.triangles)}</b> triángulos · {m2(sel.model.areaM2)}
              </Typography>
              {sel.model.truncated && (
                <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                  El fragmento sigue más allá del alcance: auméntalo o usa el pincel si quieres más.
                </Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
                <Button size="small" color="error" variant="contained" startIcon={<DeleteForeverRoundedIcon />} onClick={edit.deleteModelSelection}>
                  Eliminar
                </Button>
                <Button size="small" onClick={edit.clearSelection}>Limpiar</Button>
                {sel.model.center && <Button size="small" onClick={() => focus(sel.model.center!)}>Ver</Button>}
              </Stack>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">Nada seleccionado. Lo seleccionado se resalta en naranja.</Typography>
          )
        ) : sel.nav.polys || sel.nav.connections.length || sel.nav.blocks.length ? (
          <>
            <Typography variant="body2">
              {[
                sel.nav.polys && `${n(sel.nav.polys)} polígono(s) · ${m2(sel.nav.areaM2)}`,
                sel.nav.connections.length && `${sel.nav.connections.length} conexión(es)`,
                sel.nav.blocks.length && `${sel.nav.blocks.length} bloqueo(s)`,
              ].filter(Boolean).join(' · ')}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
              {edit.canBlock && (
                <Button size="small" color="error" variant="contained" startIcon={<BlockRoundedIcon />} onClick={edit.blockNavSelection}>
                  Bloquear
                </Button>
              )}
              {edit.canUnblock && (
                <Button size="small" variant="outlined" startIcon={<LockOpenRoundedIcon />} onClick={edit.unblockNavSelection}>
                  Quitar bloqueo
                </Button>
              )}
              <Button size="small" onClick={edit.clearSelection}>Limpiar</Button>
              {sel.nav.center && <Button size="small" onClick={() => focus(sel.nav.center!)}>Ver</Button>}
            </Stack>
          </>
        ) : (
          <Typography variant="caption" color="text.secondary">Nada seleccionado. Lo seleccionado se resalta en amarillo; lo bloqueado, en rojo.</Typography>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Supr = {edit.mode === 'model' ? 'eliminar' : 'bloquear'} · Esc = limpiar · 1/2/3 = herramienta
        </Typography>
      </Box>

      {/* ── Cambios ─────────────────────────────────── */}
      <Box sx={{ mx: 1.5, mt: 1, p: 1.5, borderRadius: 2, border: 1, borderColor: edit.unsaved ? 'warning.main' : 'divider' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {edit.saving ? 'Guardando…' : edit.unsaved ? `${edit.changeCount} cambio(s) sin guardar` : 'Todo guardado'}
          </Typography>
          <Stack direction="row">
            <Tooltip title="Deshacer (Ctrl/⌘+Z)">
              <span><IconButton size="small" disabled={!edit.canUndo} onClick={edit.undo}><UndoRoundedIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title="Rehacer (Ctrl/⌘+Shift+Z)">
              <span><IconButton size="small" disabled={!edit.canRedo} onClick={edit.redo}><RedoRoundedIcon fontSize="small" /></IconButton></span>
            </Tooltip>
          </Stack>
        </Stack>
        {edit.saving && <LinearProgress sx={{ my: 0.5 }} />}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" variant="contained" startIcon={<SaveRoundedIcon />} disabled={!edit.unsaved || edit.saving} onClick={edit.save}>
            Guardar
          </Button>
          <Button size="small" disabled={!edit.unsaved || edit.saving} onClick={edit.discard}>Descartar</Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Las rutas de la app cambian cuando regeneras y publicas el navmesh. La vista previa ya usa los cambios sin guardar.
        </Typography>
        <Button size="small" sx={{ mt: 0.5, px: 0 }} onClick={onGoToNavigation}>Ir a regenerar y publicar →</Button>
      </Box>

      {/* ── Limpiezas del modelo ────────────────────── */}
      <Box sx={{ p: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Limpiezas del modelo ({edit.scanEdits.length})</Typography>
        <FormControlLabel
          sx={{ mr: 0 }}
          control={<Switch size="small" checked={edit.showRemoved} onChange={e => edit.setShowRemoved(e.target.checked)} />}
          label={<Typography variant="caption">Ver lo quitado</Typography>}
        />
      </Box>
      <List dense sx={{ py: 0 }}>
        {edit.scanEdits.map(e => (
          <ListItem
            key={e.localId}
            secondaryAction={(
              <Stack direction="row">
                <Tooltip title="Ver"><IconButton size="small" onClick={() => focus(e.center)}><CenterFocusStrongRoundedIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Restaurar (vuelve al modelo)"><IconButton size="small" onClick={() => edit.restoreScanEdit(e.localId)}><RestoreRoundedIcon fontSize="small" /></IconButton></Tooltip>
              </Stack>
            )}
          >
            <ListItemText
              primary={e.label}
              secondary={mismatched.has(e.localId)
                ? 'No se aplica: el mapa cambió desde que se hizo. Restáurala y vuelve a limpiar.'
                : `${n(e.triangleCount)} triángulos${e.id ? '' : ' · sin guardar'}`}
              slotProps={{ secondary: { color: mismatched.has(e.localId) ? 'warning.main' : e.id ? 'text.secondary' : 'warning.dark' } }}
            />
          </ListItem>
        ))}
      </List>

      <Divider sx={{ mt: 1 }} />

      {/* ── Bloqueos de la malla ────────────────────── */}
      <Box sx={{ p: 1.5, pb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Bloqueos de la malla ({edit.blocks.length})</Typography>
      </Box>
      <List dense sx={{ py: 0 }}>
        {edit.blocks.map(b => {
          const center = b.kind === 'CONNECTION' ? connectionCenter(b.connectionId ?? '') : edit.focusOf(b);
          return (
            <ListItem
              key={b.localId}
              secondaryAction={(
                <Stack direction="row">
                  {center && <Tooltip title="Ver"><IconButton size="small" onClick={() => focus(center)}><CenterFocusStrongRoundedIcon fontSize="small" /></IconButton></Tooltip>}
                  <Tooltip title="Quitar bloqueo"><IconButton size="small" onClick={() => edit.removeBlock(b.localId)}><LockOpenRoundedIcon fontSize="small" /></IconButton></Tooltip>
                </Stack>
              )}
            >
              <Box sx={{ mr: 1, display: 'flex', color: 'error.main' }}>
                {b.kind === 'AREA' ? <BlockRoundedIcon fontSize="small" /> : b.kind === 'BARRIER' ? <ContentCutRoundedIcon fontSize="small" /> : <StairsRoundedIcon fontSize="small" />}
              </Box>
              <ListItemText
                primary={b.label}
                secondary={`${blockDetail(b, connectionLabel)}${b.id ? '' : ' · sin guardar'}`}
                slotProps={{ secondary: { color: b.id ? 'text.secondary' : 'warning.dark' } }}
              />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}

function SizeSlider({ label, value, min, max, step, onChange, color }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; color: string;
}) {
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption">{label}: <b>{value.toLocaleString('es')} m</b></Typography>
      <Slider
        size="small" min={min} max={max} step={step} value={value} sx={{ color }}
        onChange={(_, v) => onChange(v as number)}
      />
    </Box>
  );
}
