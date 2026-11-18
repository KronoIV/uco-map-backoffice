import { Box, Grid, Skeleton, Typography } from '@mui/material';
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import PhoneAndroidRoundedIcon from '@mui/icons-material/PhoneAndroidRounded';
import LaptopRoundedIcon from '@mui/icons-material/LaptopRounded';
import StatCard from '../../components/StatCard';
import type { SessionStats } from '../../types';
import { PLATFORM_LABEL, fmtDuration } from '../../utils/analyticsFormat';
import { brand } from '../../theme/brand';

interface Props {
  stats?: SessionStats;
  loading: boolean;
}

export default function SessionStatCards({ stats, loading }: Props) {
  const byPlatform = stats?.byPlatform ?? {};
  const activeToday = stats?.activeToday ?? 0;

  const mobileCount = (byPlatform.Android ?? 0) + (byPlatform.iOS ?? 0);

  const desktopCount = Object.entries(byPlatform)
    .filter(([platform]) => platform.startsWith('Desktop'))
    .reduce((sum, [, count]) => sum + count, 0);

  const cards = [
    {
      title: 'Total dispositivos',
      value: loading ? '—' : (stats?.totalDevices ?? 0),
      subtitle: 'Únicos registrados',
      icon: <DevicesRoundedIcon />,
      color: brand.green,
    },
    {
      title: 'Visitas',
      value: loading ? '—' : (stats?.totalVisits ?? 0),
      subtitle: stats?.totalActiveMs
        ? `${fmtDuration(stats.totalActiveMs)} de uso real en total`
        : 'Se miden desde la versión 2.1',
      icon: <RepeatRoundedIcon />,
      color: brand.blue,
    },
    {
      title: 'Activos (24 h)',
      value: loading ? '—' : activeToday,
      subtitle: 'Con ping en las últimas 24 h',
      icon: <PhoneAndroidRoundedIcon />,
      color: brand.orange,
    },
    {
      title: 'Dispositivos móviles',
      value: loading ? '—' : mobileCount,
      subtitle: `${desktopCount} de escritorio`,
      icon: <LaptopRoundedIcon />,
      color: brand.teal,
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

  // Paleta institucional (theme/brand.ts)
  const COLORS: Record<string, string> = {
    Android: brand.green,
    iOS: brand.text2,
    'Desktop-Windows': brand.blue,
    'Desktop-Mac': brand.text4,
    'Desktop-Linux': brand.orange,
    Web: brand.teal,
    Postman: brand.olive,
    'App-Native': brand.greenDark,
    Unknown: brand.borderStrong,
  };

  return (
    <Box
      sx={{
        bgcolor: '#fff',
        border: `1px solid ${brand.border}`,
        borderRadius: '16px',
        boxShadow: '0 1px 3px rgba(30, 31, 28, 0.05)',
        p: 3,
        height: '100%',
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 2 }}>
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
            const color = COLORS[platform] ?? brand.text4;
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
                      {PLATFORM_LABEL[platform] ?? platform}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                    {count} · {pct}%
                  </Typography>
                </Box>
                <Box
                  sx={{
                    height: 6,
                    bgcolor: brand.bgMuted,
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
