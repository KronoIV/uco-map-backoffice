import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Chip, Paper, Skeleton, Snackbar, Stack, Typography } from '@mui/material';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import ThreeSixtyRoundedIcon from '@mui/icons-material/ThreeSixtyRounded';
import BuildCircleRoundedIcon from '@mui/icons-material/BuildCircleRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import PageHeader from '../../components/PageHeader';
import SectionTabs, { type SectionTab } from '../../components/SectionTabs';
import { vpsService } from '../../services/vpsService';
import { brand } from '../../theme/brand';
import { mainEval, shortId } from './vpsFormat';
import { fmtPercent } from '../../utils/analyticsFormat';
import VpsMapsTab from './VpsMapsTab';
import VpsAlignmentTab from './VpsAlignmentTab';
import VpsBuildsTab from './VpsBuildsTab';
import VpsPublishTab from './VpsPublishTab';
import VpsTestTab from './VpsTestTab';

type VpsTab = 'maps' | 'alignment' | 'builds' | 'publish' | 'test';

const TABS: SectionTab<VpsTab>[] = [
  { value: 'maps', label: 'Mapas', icon: <LayersRoundedIcon sx={{ fontSize: 16 }} /> },
  { value: 'alignment', label: 'Alineación', icon: <ThreeSixtyRoundedIcon sx={{ fontSize: 16 }} /> },
  { value: 'builds', label: 'Procesamiento', icon: <BuildCircleRoundedIcon sx={{ fontSize: 16 }} /> },
  { value: 'publish', label: 'Publicación', icon: <RocketLaunchRoundedIcon sx={{ fontSize: 16 }} /> },
  { value: 'test', label: 'Probar', icon: <CameraAltRoundedIcon sx={{ fontSize: 16 }} /> },
];

const SUBTITLES: Record<VpsTab, string> = {
  maps: 'Escaneos del campus: sube uno nuevo cuando un espacio cambie',
  alignment: 'Ubica cada escaneo en el espacio del campus sin mover los puntos AR ya creados',
  builds: 'Procesa una revisión para localizar con ella y mide su precisión',
  publish: 'Elige el build que usa la app y vuelve al anterior si algo falla',
  test: 'Localiza una foto contra el build publicado',
};

export default function VpsPage() {
  const [params, setParams] = useSearchParams();
  const tab: VpsTab = TABS.find(t => t.value === params.get('tab'))?.value ?? 'maps';
  const [message, setMessage] = useState<string | null>(null);

  const tokenQ = useQuery({ queryKey: ['vps', 'token'], queryFn: vpsService.token, retry: false, staleTime: 60_000 });
  const mapSetId = tokenQ.data?.mapSetId;
  const detailQ = useQuery({
    queryKey: ['vps', 'map-set', mapSetId],
    queryFn: () => vpsService.getMapSet(mapSetId!),
    enabled: !!mapSetId,
    retry: false,
  });

  const detail = detailQ.data;
  const active = detail?.activeBuild;
  const activeEval = mainEval(active?.evaluation);
  const error = tokenQ.error ?? detailQ.error;

  return (
    <Box>
      <PageHeader
        title="VPS propio"
        subtitle={SUBTITLES[tab]}
        action={
          <SectionTabs
            value={tab}
            tabs={TABS}
            onChange={v => setParams(v === 'maps' ? {} : { tab: v }, { replace: true })}
          />
        }
      />

      {error ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : 'No se pudo consultar el VPS propio.'}{' '}
          Revisa VPS_BASE_URL, VPS_TOKEN_KID y VPS_TOKEN_SECRET en el backend y que el servidor del VPS esté encendido
          (vps-server/README.md).
        </Alert>
      ) : !detail ? (
        <Skeleton variant="rounded" height={88} sx={{ mb: 2 }} />
      ) : (
        <Paper sx={{ p: 2, mb: 2, borderRadius: '16px', border: `1px solid ${brand.border}`, boxShadow: 'none' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
            <Typography sx={{ fontWeight: 700 }}>{detail.name}</Typography>
            <Chip
              size="small"
              color={active ? 'success' : 'default'}
              label={active ? `Publicado: ${active.spaceId ?? '—'} (build ${shortId(active.id)})` : 'Sin build publicado'}
            />
            {activeEval && (
              <Chip size="small" variant="outlined" label={`Precisión ≤ 0,5 m: ${fmtPercent(activeEval['recall@0.5m5deg'] ?? null, 1)}`} />
            )}
            <Chip
              size="small"
              variant="outlined"
              label={detail.headRevision ? `Revisión cabeza r${detail.headRevision.number} · ${detail.headRevision.maps} mapas` : 'Sin revisión'}
            />
            {detail.previousBuild && <Chip size="small" variant="outlined" label={`Anterior: ${detail.previousBuild.spaceId ?? shortId(detail.previousBuild.id)}`} />}
          </Stack>
        </Paper>
      )}

      {detail && mapSetId && (
        <>
          {tab === 'maps' && <VpsMapsTab mapSetId={mapSetId} detail={detail} notify={setMessage} />}
          {tab === 'alignment' && <VpsAlignmentTab mapSetId={mapSetId} detail={detail} notify={setMessage} />}
          {tab === 'builds' && <VpsBuildsTab mapSetId={mapSetId} detail={detail} notify={setMessage} />}
          {tab === 'publish' && <VpsPublishTab mapSetId={mapSetId} detail={detail} notify={setMessage} />}
          {tab === 'test' && <VpsTestTab mapSetId={mapSetId} detail={detail} notify={setMessage} />}
        </>
      )}

      <Snackbar
        open={!!message}
        autoHideDuration={5000}
        onClose={() => setMessage(null)}
        message={message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
