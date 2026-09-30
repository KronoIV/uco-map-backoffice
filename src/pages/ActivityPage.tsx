import { Box } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import PageHeader from '../components/PageHeader';
import SectionTabs, { type SectionTab } from '../components/SectionTabs';
import DeviceSessionsPage from './device-sessions/DeviceSessionsPage';
import TripsPage from './TripsPage';

type ActivityTab = 'devices' | 'trips';

const TABS: SectionTab<ActivityTab>[] = [
  { value: 'devices', label: 'Dispositivos', icon: <DevicesRoundedIcon sx={{ fontSize: 16 }} /> },
  { value: 'trips', label: 'Recorridos', icon: <RouteRoundedIcon sx={{ fontSize: 16 }} /> },
];

const SUBTITLES: Record<ActivityTab, string> = {
  devices: 'Quién usa la app: dispositivos, plataformas y actividad en vivo',
  trips: 'Cada navegación de principio a fin: tiempo de llegada y tasa de éxito',
};

export default function ActivityPage() {
  const [params, setParams] = useSearchParams();
  const tab: ActivityTab = params.get('tab') === 'trips' ? 'trips' : 'devices';

  return (
    <Box>
      <PageHeader
        title="Actividad"
        subtitle={SUBTITLES[tab]}
        action={
          <SectionTabs
            value={tab}
            tabs={TABS}
            onChange={v => setParams(v === 'devices' ? {} : { tab: v }, { replace: true })}
          />
        }
      />
      {tab === 'trips' ? <TripsPage /> : <DeviceSessionsPage />}
    </Box>
  );
}
