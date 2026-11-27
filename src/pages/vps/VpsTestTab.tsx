import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, LinearProgress, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import MapViewer, { type ViewerMarker } from '../../components/poi-editor/MapViewer';
import { loadEditorMeshes, vpsService } from '../../services/vpsService';
import { fmtNumber, fmtPercent } from '../../utils/analyticsFormat';
import { REASONS, poseAngles, type VpsTabProps } from './vpsFormat';

const MAX_SIDE = 1280;
const NO_LIST: never[] = [];
const noop = () => {};
const INTRINSIC_KEYS = ['fx', 'fy', 'px', 'py'] as const;
type IntrinsicKey = (typeof INTRINSIC_KEYS)[number];

/** Reduce la foto (el servidor trabaja a 1024 px) y la pasa a JPEG; respeta la orientación EXIF. */
async function downscale(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error('No se pudo leer la imagen: usa una foto JPEG, PNG o WebP');
  }
  const { width, height } = bmp;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo convertir la imagen'))), 'image/jpeg', 0.85));
  return { blob, width, height };
}

export default function VpsTestTab({ detail, notify }: VpsTabProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<'fast' | 'deep'>('fast');
  const [intrinsics, setIntrinsics] = useState<Record<IntrinsicKey, string>>({ fx: '', fy: '', px: '', py: '' });
  const [show3d, setShow3d] = useState(false);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const localize = useMutation({
    mutationFn: async (f: File) => {
      const { blob, width, height } = await downscale(f);
      const meta: Record<string, unknown> = { mode, client: { app: 'ucomap-admin', source: 'prueba' } };
      const values = INTRINSIC_KEYS.map(k => Number(intrinsics[k]));
      if (INTRINSIC_KEYS.every(k => intrinsics[k].trim() !== '') && values.every(v => Number.isFinite(v) && v > 0)) {
        const [fx, fy, px, py] = values;
        meta.intrinsics = { fx, fy, px, py, width, height };
      }
      return vpsService.localize(blob, meta);
    },
    onError: err => notify(err instanceof Error ? err.message : String(err)),
  });

  const meshesQ = useQuery({
    queryKey: ['editor-meshes'],
    queryFn: loadEditorMeshes,
    staleTime: 30 * 60 * 1000,
    retry: false,
    enabled: show3d,
  });

  const r = localize.data;
  const position = r?.pose?.position ?? null;
  const markers = useMemo<ViewerMarker[]>(
    () => (position ? [{ id: 'photo', label: 'Foto', position, kind: 'selected' }] : NO_LIST),
    [position],
  );
  const angles = r?.pose ? poseAngles(r.pose.rotation) : null;
  const mapNames = r ? detail.maps.filter(m => r.mapCodes.includes(m.code)).map(m => m.name) : [];

  const pick = (f: File | null) => {
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
    setShow3d(false);
    localize.reset();
  };

  return (
    <Stack spacing={2}>
      {!detail.activeBuildId && (
        <Alert severity="info">No hay un build publicado: publica uno en «Publicación» para poder probar.</Alert>
      )}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '360px 1fr' } }}>
        <Paper sx={{ p: 2.5, borderRadius: '16px' }}>
          <Stack spacing={1.5}>
            <Typography sx={{ fontWeight: 700 }}>Foto de prueba</Typography>
            <Typography variant="body2" color="text.secondary">
              Toma una foto dentro del campus con el teléfono en vertical, mirando paredes, puertas o muebles (no solo
              el piso o el techo). Se reduce a {MAX_SIDE} px antes de enviarla.
            </Typography>
            <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />}>
              {file ? file.name : 'Elegir foto'}
              <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e => pick(e.target.files?.[0] ?? null)} />
            </Button>
            {previewUrl && (
              <Box component="img" src={previewUrl} alt="Foto de prueba" sx={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: '8px' }} />
            )}
            <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v: 'fast' | 'deep' | null) => v && setMode(v)}>
              <ToggleButton value="fast">Rápido (como la app)</ToggleButton>
              <ToggleButton value="deep">Profundo</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary">
              Intrínsecos de la cámara (opcional, en píxeles de la foto): sin ellos el servidor estima la distancia focal.
            </Typography>
            <Stack direction="row" spacing={1}>
              {INTRINSIC_KEYS.map(k => (
                <TextField
                  key={k} size="small" type="number" label={k} value={intrinsics[k]}
                  onChange={e => setIntrinsics(prev => ({ ...prev, [k]: e.target.value }))}
                  sx={{ flex: 1, minWidth: 0 }}
                />
              ))}
            </Stack>
            <Button
              variant="contained" startIcon={<MyLocationRoundedIcon />} sx={{ borderRadius: '100px' }}
              disabled={!file || !detail.activeBuildId || localize.isPending}
              onClick={() => file && localize.mutate(file)}
            >
              {localize.isPending ? 'Localizando…' : 'Localizar'}
            </Button>
            {localize.isPending && <LinearProgress />}
          </Stack>
        </Paper>

        <Paper sx={{ p: 2.5, borderRadius: '16px', minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Resultado</Typography>
          {!r ? (
            <Typography variant="body2" color="text.secondary">Elige una foto y pulsa «Localizar».</Typography>
          ) : (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                <Chip color={r.poseFound ? 'success' : 'default'} label={r.poseFound ? 'Ubicada' : 'No ubicada'} />
                <Chip variant="outlined" label={`Confianza ${fmtPercent(r.confidence, 1)}`} />
                {r.serverTimeMs != null && <Chip variant="outlined" label={`${fmtNumber(r.serverTimeMs)} ms${r.cached ? ' (caché)' : ''}`} />}
                {r.spaceId && <Chip variant="outlined" label={r.spaceId} />}
              </Stack>
              {!r.poseFound && (
                <Alert severity="warning">
                  {r.message ?? REASONS[r.reason ?? 'unknown'] ?? r.reason}
                  <br />
                  Prueba con otra foto con más detalles a la vista, o en modo profundo.
                </Alert>
              )}
              {r.pose && angles && (
                <Box sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  <div>Posición (m): x {r.pose.position.x.toFixed(2)} · y {r.pose.position.y.toFixed(2)} · z {r.pose.position.z.toFixed(2)}</div>
                  <div>Giro {angles.yaw.toFixed(1)}° · inclinación {angles.pitch.toFixed(1)}°</div>
                </Box>
              )}
              {mapNames.length > 0 && (
                <Typography variant="body2">Mapa: {mapNames.join(', ')}</Typography>
              )}
              {r.intrinsics && (
                <Typography variant="caption" color="text.secondary">
                  Focal usada: {fmtNumber(r.intrinsics.fx)} px para {r.intrinsics.width}×{r.intrinsics.height}
                </Typography>
              )}
              {r.requestId && (
                <Typography variant="caption" color="text.secondary">Petición {r.requestId}</Typography>
              )}
              {r.poseFound && !show3d && (
                <Button size="small" variant="outlined" onClick={() => setShow3d(true)} sx={{ alignSelf: 'flex-start' }}>
                  Ver en el modelo 3D
                </Button>
              )}
            </Stack>
          )}
          {show3d && r?.poseFound && (
            <Box sx={{ mt: 2 }}>
              {meshesQ.isLoading && <LinearProgress />}
              {meshesQ.isError && <Alert severity="error">{meshesQ.error instanceof Error ? meshesQ.error.message : 'Sin modelos'}</Alert>}
              <Box sx={{ height: 420, position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
                <MapViewer
                  meshes={meshesQ.data?.meshes ?? NO_LIST}
                  markers={markers}
                  connections={NO_LIST}
                  patches={NO_LIST}
                  elevators={NO_LIST}
                  navMesh={null}
                  clipY={null}
                  pickPlaneY={null}
                  focus={position}
                  onPick={noop}
                  onMarkerClick={noop}
                  onBounds={noop}
                  onProgress={noop}
                  onError={notify}
                />
              </Box>
            </Box>
          )}
        </Paper>
      </Box>
    </Stack>
  );
}
