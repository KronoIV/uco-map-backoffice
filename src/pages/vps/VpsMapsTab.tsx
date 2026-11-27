import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, Paper,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { vpsService } from '../../services/vpsService';
import { fmtDateTime, fmtNumber } from '../../utils/analyticsFormat';
import type { VpsMap } from '../../types/vps';
import { fmtBytes, type VpsTabProps } from './vpsFormat';

const SCAN_SOURCES: Record<string, string> = { upload: 'subido desde el panel', import: 'importado' };

function NameDialog({ title, initial, busy, warning, onClose, onSave }: {
  title: string;
  initial: string;
  busy: boolean;
  warning?: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const valid = name.trim().length > 0 && name.trim().length <= 120;
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem' }}>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '16px !important' }}>
        <TextField
          autoFocus fullWidth size="small" label="Nombre" value={name} onChange={e => setName(e.target.value)}
          helperText="Ej.: Bloque K piso 2"
        />
        {warning && <Alert severity="warning">{warning}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!valid || busy} onClick={() => onSave(name.trim())}>Guardar</Button>
      </DialogActions>
    </Dialog>
  );
}

function UploadDialog({ map, onClose, onDone }: { map: VpsMap; onClose: () => void; onDone: (msg: string) => void }) {
  const qc = useQueryClient();
  const [textured, setTextured] = useState<File | null>(null);
  const [raw, setRaw] = useState<File | null>(null);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!textured) throw new Error('Elige la malla texturizada (.glb)');
      setError(null);
      const texturedId = await vpsService.uploadFile(textured, 'textured', pct => setProgress({ label: 'Malla texturizada', pct }));
      const rawId = raw ? await vpsService.uploadFile(raw, 'raw', pct => setProgress({ label: 'Malla sin textura', pct })) : undefined;
      setProgress({ label: 'Registrando el escaneo', pct: 100 });
      return vpsService.addScan(map.id, texturedId, rawId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vps'] });
      onDone(`Escaneo de «${map.name}» subido. Alinéalo y crea una revisión en «Alineación».`);
      onClose();
    },
    onError: err => { setError(err instanceof Error ? err.message : String(err)); setProgress(null); },
  });

  const pick = (accept: string, set: (f: File | null) => void, file: File | null, label: string) => (
    <Button component="label" variant="outlined" size="small" startIcon={<UploadFileRoundedIcon />} sx={{ justifyContent: 'flex-start' }}>
      {file ? `${file.name} (${fmtBytes(file.size)})` : label}
      <input hidden type="file" accept={accept} onChange={e => set(e.target.files?.[0] ?? null)} />
    </Button>
  );

  return (
    <Dialog open onClose={upload.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem' }}>Subir escaneo · {map.name}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '16px !important' }}>
        <Typography variant="body2" color="text.secondary">
          Malla .glb del espacio escaneado (texturizada, en metros, Y arriba). La malla sin textura es opcional y solo
          se guarda junto al escaneo. El escaneo no cambia nada en la app hasta que lo
          alinees, proceses y publiques. Al publicarlo, las limpiezas del modelo 3D hechas sobre la malla anterior
          dejan de aplicarse a este mapa.
        </Typography>
        {pick('.glb,model/gltf-binary', setTextured, textured, 'Malla texturizada (.glb)')}
        {pick('.glb,model/gltf-binary', setRaw, raw, 'Malla sin textura (.glb, opcional)')}
        {progress && (
          <Box>
            <Typography variant="caption" color="text.secondary">{progress.label} · {progress.pct} %</Typography>
            <LinearProgress variant="determinate" value={progress.pct} />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={upload.isPending}>Cancelar</Button>
        <Button variant="contained" disabled={!textured || upload.isPending} onClick={() => upload.mutate()}>
          {upload.isPending ? 'Subiendo…' : 'Subir'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function VpsMapsTab({ mapSetId, detail, notify }: VpsTabProps) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<VpsMap | null>(null);
  const [uploading, setUploading] = useState<VpsMap | null>(null);

  const done = (msg: string) => { qc.invalidateQueries({ queryKey: ['vps'] }); notify(msg); };
  const addMap = useMutation({
    mutationFn: (name: string) => vpsService.addMap(mapSetId, name),
    onSuccess: m => { setCreating(false); done(`Mapa «${m.name}» creado. Sube su escaneo.`); },
    onError: err => notify(err instanceof Error ? err.message : String(err)),
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => vpsService.renameMap(id, name),
    onSuccess: m => { setRenaming(null); done(`Mapa renombrado a «${m.name}»`); },
    onError: err => notify(err instanceof Error ? err.message : String(err)),
  });

  return (
    <Paper sx={{ p: 2.5, borderRadius: '16px' }}>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>Mapas ({detail.maps.length})</Typography>
          <Typography variant="body2" color="text.secondary">
            Cada mapa es un espacio escaneado. Su nombre es también el de su malla en el editor AR.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreating(true)} sx={{ borderRadius: '100px' }}>
          Nuevo mapa
        </Button>
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mapa</TableCell>
              <TableCell>En la revisión</TableCell>
              <TableCell>Escaneo</TableCell>
              <TableCell align="right">Triángulos</TableCell>
              <TableCell align="right">Tamaño</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detail.maps.map(m => {
              const file = m.scan?.files.textured;
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.name}</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{m.code}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={m.inHeadRevision ? 'success' : 'default'} label={m.inHeadRevision ? 'Sí' : 'No'} />
                  </TableCell>
                  <TableCell>
                    {m.scan ? (
                      <Typography variant="body2">
                        {fmtDateTime(m.scan.createdAt)} · {SCAN_SOURCES[m.scan.source ?? ''] ?? m.scan.source ?? '—'}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">Sin escaneo</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{fmtNumber(file?.triangles ?? null)}</TableCell>
                  <TableCell align="right">{fmtBytes(file?.size)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Subir escaneo nuevo">
                      <IconButton size="small" onClick={() => setUploading(m)}><UploadFileRoundedIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Renombrar">
                      <IconButton size="small" onClick={() => setRenaming(m)}><EditRoundedIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {creating && (
        <NameDialog title="Nuevo mapa" initial="" busy={addMap.isPending} onClose={() => setCreating(false)} onSave={n => addMap.mutate(n)} />
      )}
      {renaming && (
        <NameDialog
          title="Renombrar mapa" initial={renaming.name} busy={rename.isPending}
          warning="Las limpiezas del modelo 3D del editor AR se guardan con el nombre de la malla: si lo cambias, dejan de aplicarse a este mapa."
          onClose={() => setRenaming(null)} onSave={name => rename.mutate({ id: renaming.id, name })}
        />
      )}
      {uploading && <UploadDialog map={uploading} onClose={() => setUploading(null)} onDone={notify} />}
    </Paper>
  );
}
