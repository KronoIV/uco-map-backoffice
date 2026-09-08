import { Box, Grid, Skeleton, Typography } from '@mui/material';
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import PhoneAndroidRoundedIcon from '@mui/icons-material/PhoneAndroidRounded';
import LaptopRoundedIcon from '@mui/icons-material/LaptopRounded';
import StatCard from '../../components/StatCard';
import type { DeviceSession, SessionStats } from '../../types';

const ACTIVE_MS = 24 * 60 * 60 * 1000; // 24 h

interface Props {
  stats?: SessionStats;
  sessions?: DeviceSession[];
  loading: boolean;
}

export default function SessionStatCards({ stats, sessions, loading }: Props) {
  const now = Date.now();

  const activeToday = sessions?.filter(
    s => now - new Date(s.lastSeen).getTime() < ACTIVE_MS
  ).length ?? 0;

  const mobileCount =
    sessions?.filter(s => s.platform === 'Android' || s.platform === 'iOS').length ?? 0;

  const desktopCount =
    sessions?.filter(s => s.platform?.startsWith('Desktop')).length ?? 0;

  const cards = [
    {
      title: 'Total dispositivos',
      value: loading ? '—' : (stats?.totalDevices ?? 0),
      subtitle: 'Únicos registrados',
      icon: <DevicesRoundedIcon />,
      color: '#00d084',
    },
    {
      title: 'Total sesiones',
      value: loading ? '—' : (stats?.totalSessions ?? 0),
      subtitle: 'Pings acumulados',
      icon: <RepeatRoundedIcon />,
      color: '#6366F1',
    },
    {
      title: 'Activos (24 h)',
      value: loading ? '—' : activeToday,
      subtitle: 'Con ping en las últimas 24 h',
      icon: <PhoneAndroidRoundedIcon />,
      color: '#F59E0B',
    },
    {
      title: 'Dispositivos móviles',
      value: loading ? '—' : mobileCount,
      subtitle: `${desktopCount} de escritorio`,
      icon: <LaptopRoundedIcon />,
      color: '#3B82F6',
    },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {cards.map(card => (
        <Grid key={card.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          {loading ? (
            <Skeleton variant="rounded" height={110} sx={{ borderRadius: '18px' }} />
          ) : (
            <StatCard {...card} />
          )}
        </Grid>
      ))}
    </Grid>
  );
}

export function PlatformDistribution({
  stats,
  loading,
}: {
  stats?: SessionStats;
  loading: boolean;
}) {
  const entries = Object.entries(stats?.byPlatform ?? {}).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  const COLORS: Record<string, string> = {
    Android: '#3DDC84',
    iOS: '#555555',
    'Desktop-Windows': '#0078D4',
    'Desktop-Mac': '#999999',
    'Desktop-Linux': '#FCC624',
    Web: '#6366F1',
    Postman: '#FF6C37',
    'App-Native': '#00d084',
    Unknown: '#D1D5DB',
  };

  return (
    <Box
      sx={{
        bgcolor: '#fff',
        border: '1px solid #F1F1F1',
        borderRadius: '18px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
        p: 3,
        height: '100%',
      }}
    >
      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>
        Distribución por plataforma
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={28} />
          ))}
        </Box>
      ) : entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Sin datos
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {entries.map(([platform, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const color = COLORS[platform] ?? '#9CA3AF';
            return (
              <Box key={platform}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: '4px',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: color,
                        flexShrink: 0,
                      }}
                    />
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                      {platform}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                    {count} · {pct}%
                  </Typography>
                </Box>
                <Box
                  sx={{
                    height: 6,
                    bgcolor: '#F3F4F6',
                    borderRadius: 100,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: `${pct}%`,
                      bgcolor: color,
                      borderRadius: 100,
                      transition: 'width 0.6s ease',
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
