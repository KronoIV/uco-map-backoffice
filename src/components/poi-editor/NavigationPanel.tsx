import {
  Alert, Box, Button, Divider, FormControlLabel, LinearProgress, List, ListItemButton, ListItemText,
  Stack, Switch, TextField, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import type { ArPoint } from '../../types';
import type { NavigationEditor } from './useNavigationEditor';

const fmt = (p: ArPoint | null) => (p ? `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}` : '—');
const dist = (a: ArPoint, b: ArPoint) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export default function NavigationPanel({ nav }: { nav: NavigationEditor }) {
  const { draft } = nav;

  const status = nav.generated
    ? `Vista previa sin publicar · ${nav.generated.preview.offMeshConnections} conexiones`
    : nav.currentSource === 'backend' && nav.info
      ? `Publicado ${new Date(nav.info.updatedAt).toLocaleString()} · ${(nav.info.sizeBytes / 1024).toFixed(0)} KB · ${nav.currentPreview?.offMeshConnections ?? '?'} conexiones`
      : nav.currentSource === 'scene'
        ? `Usando el de Mattercraft · ${nav.currentPreview?.offMeshConnections ?? '?'} conexiones`
        : 'Cargando…';

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* ── Navmesh ─────────────────────────────────────────── */}
      <Box sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Navmesh (zonas caminables)</Typography>
        <Typography variant="caption" color="text.secondary">{status}</Typography>
        <FormControlLabel
          sx={{ display: 'flex', mt: 0.5 }}
          control={<Switch size="small" checked={nav.showNavMesh} onChange={e => nav.setShowNavMesh(e.target.checked)} />}
          label={<Typography variant="caption">Mostrar navmesh en verde</Typography>}
        />
        {nav.dirty && !nav.generated && (
          <Alert severity="warning" sx={{ my: 1, py: 0 }}>Las conexiones cambiaron: regenera y publica el navmesh.</Alert>
        )}
        {nav.error && <Alert severity="error" onClose={() => nav.setError(null)} sx={{ my: 1, py: 0 }}>{nav.error}</Alert>}
        {nav.generating && (
          <Box sx={{ my: 1 }}>
            <Typography variant="caption" color="text.secondary">Generando… puede tardar hasta un minuto.</Typography>
            <LinearProgress />
          </Box>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<AutoFixHighRoundedIcon />} disabled={nav.generating} onClick={nav.generate}>
            Regenerar
          </Button>
          {nav.generated && (
            <>
              <Button size="small" variant="contained" startIcon={<CloudUploadRoundedIcon />} disabled={nav.publishing} onClick={nav.publish}>
                Publicar
              </Button>
              <Button size="small" onClick={nav.discardGenerated}>Descartar</Button>
            </>
          )}
          {!nav.generated && nav.currentSource === 'backend' && (
            <Button size="small" color="warning" onClick={nav.restoreScene}>Volver al de Mattercraft</Button>
          )}
        </Stack>
      </Box>

      <Divider />

      {/* ── Conexiones (escaleras) ──────────────────────────── */}
      <Box sx={{ p: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Escaleras y conexiones ({nav.connections.length})</Typography>
        <Button size="small" startIcon={<AddRoundedIcon />} onClick={nav.startNew}>Nueva</Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ px: 1.5 }}>
        Unen dos zonas sin suelo continuo (escaleras). Marca un punto en cada extremo, sobre el piso.
      </Typography>
      {nav.connections.length === 0 && !nav.connectionsLoading && (
        <Box sx={{ px: 1.5, pt: 1 }}>
          <Button size="small" variant="outlined" startIcon={<HistoryRoundedIcon />} disabled={nav.importing} onClick={nav.importFromScene}>
            Importar de Mattercraft ({nav.sceneConnectionCount})
          </Button>
        </Box>
      )}

      {draft && (
        <Box sx={{ m: 1.5, p: 1.5, border: 1, borderColor: 'primary.main', borderRadius: 2 }}>
          {nav.pickTarget && (
            <Alert severity="info" sx={{ mb: 1, py: 0 }}>
              Haz clic en el modelo para marcar el {nav.pickTarget === 'start' ? 'inicio' : 'final'}.
            </Alert>
          )}
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Nombre" value={draft.label} onChange={e => nav.setDraft({ ...draft, label: e.target.value })} />
            <TextField
              size="small" label="Radio (m)" type="number" value={draft.radius} sx={{ width: 110 }}
              onChange={e => nav.setDraft({ ...draft, radius: Number(e.target.value) || 1 })}
              slotProps={{ htmlInput: { step: 0.1, min: 0.1 } }}
            />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
            <Button size="small" variant={nav.pickTarget === 'start' ? 'contained' : 'text'} onClick={() => nav.setPickTarget('start')}>Inicio</Button>
            <Typography variant="caption">{fmt(draft.start)}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Button size="small" variant={nav.pickTarget === 'end' ? 'contained' : 'text'} onClick={() => nav.setPickTarget('end')}>Final</Button>
            <Typography variant="caption">{fmt(draft.end)}</Typography>
          </Stack>
          <FormControlLabel
            control={<Switch size="small" checked={draft.bidirectional} onChange={e => nav.setDraft({ ...draft, bidirectional: e.target.checked })} />}
            label={<Typography variant="caption">En ambos sentidos</Typography>}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            <Button size="small" variant="contained" disabled={!draft.start || !draft.end || nav.saving} onClick={nav.save}>Guardar</Button>
            <Button size="small" onClick={nav.cancel}>Cancelar</Button>
            {draft.id && (
              <Button size="small" color="error" onClick={() => nav.remove(draft.id!)}>Eliminar</Button>
            )}
          </Stack>
        </Box>
      )}

      <List dense sx={{ py: 0 }}>
        {nav.connections.map(c => (
          <ListItemButton key={c.id} selected={c.id === nav.selectedId} onClick={() => nav.select(c.id!)}>
            <ListItemText
              primary={c.label}
              secondary={`${c.group ? `${c.group} · ` : ''}${dist(c.start, c.end).toFixed(1)} m · Δy ${(c.end.y - c.start.y).toFixed(1)} m`}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
