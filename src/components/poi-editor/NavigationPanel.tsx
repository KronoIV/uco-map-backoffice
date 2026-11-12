import {
  Alert, Autocomplete, Box, Button, Divider, FormControlLabel, IconButton, LinearProgress, List, ListItemButton, ListItemText,
  Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AddLocationAltRoundedIcon from '@mui/icons-material/AddLocationAltRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ElevatorRoundedIcon from '@mui/icons-material/ElevatorRounded';
import StairsRoundedIcon from '@mui/icons-material/StairsRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import type { ArPoint } from '../../types';
import type { ConnectionCheck, PatchCheck } from '../../utils/navmesh';
import type { BuildReport } from '../../utils/navmesh-builder';
import { patchArea, rampInfo, type RampInfo } from '../../utils/navPatches';
import { MAX_BUTTON_LENGTH } from '../../utils/elevators';
import type { NavigationEditor } from './useNavigationEditor';

const fmt = (p: ArPoint | null) => (p ? `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}` : '—');
const dist = (a: ArPoint, b: ArPoint) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const m2 = (v: number) => `${v.toLocaleString('es', { maximumFractionDigits: 1 })} m²`;

const MIN_WALKABLE = 0.6;

/** Lo que el generador corrigió del escaneo, en una frase. */
function repairText(r: BuildReport): string {
  if (!r.repaired) return 'Sin reparaciones automáticas: el formato interno de recast no es el esperado.';
  const parts = [
    r.flipped && 'la malla venía con los suelos al revés',
    r.gapsClosedM2 > 0 && `${m2(r.gapsClosedM2)} de rendijas y huecos angostos cerrados`,
    r.holesFilled > 0 && `${r.holesFilled} hueco(s) rellenado(s) (${m2(r.holesFilledM2)})`,
    r.invertedFloorM2 > 0 && `${m2(r.invertedFloorM2)} de suelo con la normal invertida recuperado`,
    r.floaters.clusters > 0 && `${r.floaters.clusters} restos flotantes quitados`,
    r.spikes > 0 && `${r.spikes} picos o postes delgados recortados`,
    r.droppedTriangles > 0 && `${r.droppedTriangles} triángulos inválidos descartados`,
  ].filter(Boolean);
  return parts.length ? `Reparado: ${parts.join(', ')}.` : 'El escaneo no necesitó reparaciones.';
}

function connectionText(c: ConnectionCheck | undefined) {
  if (!c || (c.start && c.end)) return null;
  return !c.start && !c.end ? 'ningún extremo toca el navmesh' : `el ${c.start ? 'final' : 'inicio'} no toca el navmesh`;
}

/** Qué dice la última generación de este parche y qué hacer si falló. */
function checkText(c: PatchCheck | undefined, points: ArPoint[]): { ok: boolean; short: string; help?: string } | null {
  if (!c) return null;
  const pct = `${Math.round(c.walkable * 100)}% caminable`;
  if (c.walkable < MIN_WALKABLE) {
    return {
      ok: false,
      short: `${pct} · revisar`,
      help: 'Casi no quedó suelo: suele ser un parche muy angosto (menos de ~50 cm) o demasiado empinado (más de 60°). Hazlo más ancho o revisa la altura de los puntos.',
    };
  }
  const ramp = rampInfo(points);
  if (ramp && c.linkedSides?.length === points.length) {
    const down = c.linkedSides[ramp.bottom], up = c.linkedSides[ramp.top];
    if (down && up) return { ok: true, short: `${pct} · unida abajo y arriba` };
    return {
      ok: false,
      short: `${pct} · ${!down && !up ? 'sin unir' : `no llega ${down ? 'arriba' : 'abajo'}`}`,
      help: `El borde ${!down && !up ? 'de abajo ni el de arriba' : down ? 'de arriba' : 'de abajo'} (en rojo tras regenerar) no empalma con el piso: quedó lejos o a más de 30 cm de su altura. Redibújala con «Escalera» marcando el pie y el final sobre los pisos.`,
    };
  }
  if (c.links === 0) {
    return {
      ok: false,
      short: `${pct} · sin unir`,
      help: 'Es caminable pero está aislado: ningún lado llega al piso escaneado. Monta sus bordes unos 30 cm sobre el piso de alrededor y que la diferencia de altura en la unión sea menor a 30 cm.',
    };
  }
  return { ok: true, short: `${pct} · unido por ${c.links} de ${c.sides} lados` };
}

// Lo que pide cada clic de la escalera guiada
const STAIRS_STEPS = [
  'Clic en el piso de abajo, al pie del primer escalón, junto a un costado.',
  'Ahora junto al otro costado, también al pie.',
  'Clic en el piso de arriba, donde termina el último escalón, en un costado.',
  'Y el otro costado arriba: la rampa se arma sola y se mete 30 cm en cada piso.',
];

const rampText = (r: RampInfo) => `sube ${r.rise.toFixed(1)} m · ${Math.round(r.slopeDeg)}°`;

/** `buildings`: categorías de los salones, para asignar cada ascensor a su edificio. */
export default function NavigationPanel({ nav, buildings = [] }: { nav: NavigationEditor; buildings?: string[] }) {
  const { draft, patchDraft, elevatorDraft } = nav;
  const draftCheck = patchDraft?.id ? checkText(nav.patchChecks[patchDraft.id], patchDraft.points) : null;

  const status = nav.generated
    ? `Vista previa sin publicar · ${nav.generated.preview.offMeshConnections} conexiones${nav.generated.removed ? ` · ${nav.generated.removed} triángulos del escaneo ignorados sobre parches` : ''}`
    : nav.info && nav.currentPreview
      ? `Publicado ${new Date(nav.info.updatedAt).toLocaleString()} · ${(nav.info.sizeBytes / 1024).toFixed(0)} KB · ${nav.currentPreview.offMeshConnections} conexiones`
      : nav.currentLoaded
        ? 'Aún no hay navmesh publicado: regenera y publica.'
        : 'Cargando…';

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* ── Navmesh ─────────────────────────────────────────── */}
      <Box sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Navmesh (zonas caminables)</Typography>
        <Typography variant="caption" color="text.secondary">{status}</Typography>
        {nav.generated && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {repairText(nav.generated.report)}
          </Typography>
        )}
        {nav.generated && nav.generated.report.openHoles.length > 0 && (
          <Alert severity="info" sx={{ my: 1, py: 0 }}>
            Huecos sin escanear demasiado grandes para rellenarlos solos; si son piso, cúbrelos con un parche:
            {nav.generated.report.openHoles.slice(0, 5).map(h => (
              <Box key={`${h.x},${h.z}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{m2(h.areaM2)} · {h.widthM.toLocaleString('es')} m de ancho</span>
                <Button size="small" sx={{ minWidth: 0, py: 0 }} onClick={() => nav.focus({ x: h.x, y: h.y, z: h.z })}>Ver</Button>
              </Box>
            ))}
          </Alert>
        )}
        <FormControlLabel
          sx={{ display: 'flex', mt: 0.5 }}
          control={<Switch size="small" checked={nav.showNavMesh} onChange={e => nav.setShowNavMesh(e.target.checked)} />}
          label={<Typography variant="caption">Mostrar navmesh en verde</Typography>}
        />
        {nav.dirty && !nav.generated && (
          <Alert severity="warning" sx={{ my: 1, py: 0 }}>Las conexiones o los parches cambiaron: regenera y publica el navmesh.</Alert>
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
          <Tooltip title="Descarga la geometría que entra a recast (escaneo con parches y conexiones) sin generar ni publicar, para comparar ajustes del navmesh sin conexión (uco-map-app: npm run eval:experiment).">
            <span>
              <Button size="small" startIcon={<DownloadRoundedIcon />} disabled={nav.generating || nav.exporting} onClick={nav.exportInput}>
                Exportar geometría
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      <Divider />

      {/* ── Parches de suelo ───────────────────────────────── */}
      <Box sx={{ p: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Parches de suelo ({nav.patches.length})</Typography>
        <Stack direction="row">
          <Tooltip title="Rampa sobre una escalera mal escaneada: 2 clics al pie y 2 arriba">
            <span>
              <Button size="small" startIcon={<StairsRoundedIcon />} disabled={nav.drawingPatch} onClick={nav.startStairs}>Escalera</Button>
            </span>
          </Tooltip>
          <Button size="small" startIcon={<AddRoundedIcon />} disabled={nav.drawingPatch} onClick={nav.startPatch}>Nuevo</Button>
        </Stack>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ px: 1.5 }}>
        Rellenan tramos que el escaneo no capturó y que la regeneración no cierra sola (las rendijas y huecos de hasta
        ~1 m sí se rellenan solos). Para una escalera usa «Escalera»: con 4 clics arma una rampa que toma la altura de
        cada piso y entra 30 cm en ellos, así queda unida aunque el clic caiga en un peldaño. Para otro hueco, «Nuevo»:
        marca su contorno con clics sobre el piso escaneado de alrededor, montándolo unos 30 cm sobre él. Cada punto
        toma la altura del modelo; Shift+clic (o clic sobre el hueco) la del punto anterior. Lo que el escaneo tenga
        encima del parche (hasta 1,8 m) se ignora. Tras regenerar, los bordes unidos al piso se ven en verde y los que
        faltan de una escalera, en rojo.
      </Typography>

      {patchDraft && (
        <Box sx={{ m: 1.5, p: 1.5, border: 1, borderColor: 'warning.main', borderRadius: 2 }}>
          {nav.drawingPatch && (
            <Alert severity="info" sx={{ mb: 1, py: 0 }}>
              {nav.stairsMode
                ? `${patchDraft.points.length + 1}/4 · ${STAIRS_STEPS[patchDraft.points.length]}`
                : patchDraft.points.length === 0
                  ? 'Haz clic en el piso, en una esquina del hueco.'
                  : patchDraft.points.length < 3
                    ? `Sigue el contorno: faltan ${3 - patchDraft.points.length} punto(s).`
                    : 'Agrega más puntos o pulsa Terminar.'}
            </Alert>
          )}
          <TextField
            size="small" fullWidth label="Nombre" value={patchDraft.label}
            onChange={e => nav.setPatchDraft({ ...patchDraft, label: e.target.value })}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {patchDraft.points.length} puntos · {nav.patchDraftArea.toFixed(2)} m²
            {nav.patchDraftRamp
              ? ` · escalera o rampa: ${rampText(nav.patchDraftRamp)}`
              : patchDraft.points.length > 0 && ` · altura ${Math.min(...patchDraft.points.map(p => p.y)).toFixed(2)}–${Math.max(...patchDraft.points.map(p => p.y)).toFixed(2)} m`}
          </Typography>
          {nav.patchDraftRamp && nav.patchDraftRamp.slopeDeg > 45 && (
            <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
              Muy empinada para una escalera: revisa que los puntos de arriba estén sobre el piso de arriba y los de abajo
              sobre el de abajo.
            </Alert>
          )}
          {draftCheck && (
            <Alert severity={draftCheck.ok ? 'success' : 'warning'} sx={{ mt: 1, py: 0 }}>
              {draftCheck.short}{draftCheck.help && <><br />{draftCheck.help}</>}
            </Alert>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
            <Button size="small" startIcon={<UndoRoundedIcon />} disabled={!patchDraft.points.length} onClick={nav.undoPatchPoint}>
              Deshacer punto
            </Button>
            {nav.drawingPatch
              ? <Button size="small" onClick={nav.finishDrawing}>Terminar</Button>
              : <Button size="small" onClick={() => nav.setDrawingPatch(true)}>Agregar puntos</Button>}
            {patchDraft.points.length > 0 && (
              <Button size="small" onClick={nav.redrawPatch}>
                Redibujar
              </Button>
            )}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            <Button size="small" variant="contained" disabled={patchDraft.points.length < 3 || nav.savingPatch} onClick={nav.savePatch}>
              Guardar
            </Button>
            <Button size="small" onClick={nav.cancelPatch}>Cancelar</Button>
            {patchDraft.id && (
              <Button size="small" color="error" onClick={() => nav.removePatch(patchDraft.id!)}>Eliminar</Button>
            )}
          </Stack>
        </Box>
      )}

      <List dense sx={{ py: 0 }}>
        {nav.patches.map(p => {
          const check = checkText(nav.patchChecks[p.id!], p.points);
          const ramp = rampInfo(p.points);
          return (
            <ListItemButton key={p.id} selected={p.id === nav.selectedPatchId} onClick={() => nav.selectPatch(p.id!)}>
              <ListItemText
                primary={p.label}
                secondary={`${ramp ? `escalera o rampa · ${rampText(ramp)}` : `${p.points.length} puntos · ${patchArea(p.points).toFixed(1)} m²`}${check ? ` · ${check.short}` : ''}`}
                slotProps={{ secondary: { color: check && !check.ok ? 'warning.main' : 'text.secondary' } }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Divider />

      {/* ── Conexiones (escaleras) ──────────────────────────── */}
      <Box sx={{ p: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Escaleras y conexiones ({nav.connections.length})</Typography>
        <Button size="small" startIcon={<AddRoundedIcon />} onClick={nav.startNew}>Nueva</Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ px: 1.5 }}>
        Unen dos zonas sin suelo continuo (escaleras). Marca un punto en cada extremo, sobre el piso.
      </Typography>

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
        {nav.connections.map(c => {
          const warning = connectionText(nav.connectionChecks[c.id!]);
          return (
            <ListItemButton key={c.id} selected={c.id === nav.selectedId} onClick={() => nav.select(c.id!)}>
              <ListItemText
                primary={c.label}
                secondary={`${c.group ? `${c.group} · ` : ''}${dist(c.start, c.end).toFixed(1)} m · Δy ${(c.end.y - c.start.y).toFixed(1)} m${warning ? ` · ${warning}` : ''}`}
                slotProps={{ secondary: { color: warning ? 'warning.main' : 'text.secondary' } }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Divider />

      {/* ── Ascensores ──────────────────────────────────────── */}
      <Box sx={{ p: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Ascensores ({nav.elevators.length})</Typography>
        <Button size="small" startIcon={<ElevatorRoundedIcon />} disabled={nav.pickingStops} onClick={nav.startElevator}>Nuevo</Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ px: 1.5 }}>
        Su interior no está escaneado: la app guía hasta la puerta, dice qué botón presionar y vuelve a ubicar al usuario
        cuando sale. Marca con un clic el piso frente a la puerta del ascensor en cada piso (usa el corte de altura). El
        número de piso debe ser el mismo de los salones. No hace falta regenerar el navmesh.
      </Typography>

      {elevatorDraft && (
        <Box sx={{ m: 1.5, p: 1.5, border: 1, borderColor: 'secondary.main', borderRadius: 2 }}>
          {nav.pickingStops && (
            <Alert severity="info" sx={{ mb: 1, py: 0 }}>
              {elevatorDraft.stops.length === 0
                ? 'Clic en el piso, frente a la puerta del ascensor, en cualquiera de sus pisos.'
                : `Ahora frente a la puerta en otro piso (${elevatorDraft.stops.length} marcados). Un clic en un piso ya marcado mueve su punto · Enter termina.`}
            </Alert>
          )}
          <Stack direction="row" spacing={1}>
            <TextField
              size="small" label="Nombre" value={elevatorDraft.label} sx={{ flex: 1 }}
              onChange={e => nav.setElevatorDraft({ ...elevatorDraft, label: e.target.value })}
            />
            <Autocomplete
              freeSolo size="small" options={buildings} inputValue={elevatorDraft.building} sx={{ width: 120 }}
              onInputChange={(_, v) => nav.setElevatorDraft({ ...elevatorDraft, building: v })}
              renderInput={params => <TextField {...params} label="Edificio" />}
            />
          </Stack>
          <Stack spacing={0.75} sx={{ mt: 1.25 }}>
            {/* De arriba hacia abajo, como se ven los pisos */}
            {elevatorDraft.stops.map((s, i) => ({ s, i })).reverse().map(({ s, i }) => (
              <Stack key={`${i}:${s.point.y}`} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TextField
                  size="small" type="number" label="Piso" value={s.floor} sx={{ width: 76 }}
                  onChange={e => {
                    const v = Number(e.target.value);
                    if (Number.isInteger(v)) nav.updateStop(i, { floor: v });
                  }}
                  slotProps={{ htmlInput: { step: 1 } }}
                />
                <TextField
                  size="small" label="Botón" placeholder={String(s.floor)} value={s.button} sx={{ width: 76 }}
                  onChange={e => nav.updateStop(i, { button: e.target.value })}
                  slotProps={{ htmlInput: { maxLength: MAX_BUTTON_LENGTH } }}
                />
                <Tooltip title="Altura del punto: centra la vista en él">
                  <Button size="small" color="inherit" sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', fontWeight: 400 }} onClick={() => nav.focus(s.point)}>
                    {s.point.y.toFixed(2)} m
                  </Button>
                </Tooltip>
                <Tooltip title="Quitar este piso">
                  <IconButton size="small" onClick={() => nav.removeStop(i)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
          {nav.elevatorProblem && elevatorDraft.stops.length > 0 && (
            <Alert severity="warning" sx={{ mt: 1, py: 0 }}>{nav.elevatorProblem}</Alert>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {nav.pickingStops
              ? <Button size="small" onClick={() => nav.setPickingStops(false)}>Terminar</Button>
              : <Button size="small" startIcon={<AddLocationAltRoundedIcon />} onClick={() => nav.setPickingStops(true)}>Marcar pisos</Button>}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
            <Button size="small" variant="contained" disabled={!!nav.elevatorProblem || nav.savingElevator} onClick={nav.saveElevator}>
              Guardar
            </Button>
            <Button size="small" onClick={nav.cancelElevator}>Cancelar</Button>
            {elevatorDraft.id && (
              <Button size="small" color="error" onClick={() => nav.removeElevator(elevatorDraft.id!)}>Eliminar</Button>
            )}
          </Stack>
        </Box>
      )}

      <List dense sx={{ py: 0 }}>
        {nav.elevators.map(e => (
          <ListItemButton key={e.id} selected={e.id === nav.selectedElevatorId} onClick={() => nav.selectElevator(e.id!)}>
            <ListItemText
              primary={e.label}
              secondary={`${e.building ? `${e.building} · ` : ''}pisos ${e.stops.map(s => s.button || s.floor).join(', ')}`}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
