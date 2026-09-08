import { useQuery } from '@tanstack/react-query';
import { Box, Grid, Typography, Chip, Table, TableBody, TableCell, TableHead, TableRow, Paper, Skeleton } from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import AltRouteRoundedIcon from '@mui/icons-material/AltRouteRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import { graphService } from '../services/graphService';
import { buildingService } from '../services/buildingService';
import { roomService } from '../services/roomService';
import { deviceSessionService } from '../services/deviceSessionService';
import { useSessionStream } from '../hooks/useDeviceSessions';

const ACTIVE_MS = 10 * 60 * 1000; // 10 min

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  if (diff < 60_000) return 'ahora';
  if (m < 60) return `hace ${m}m`;
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

export default function DashboardPage() {
  useSessionStream();

  const { data: nodes, isLoading: loadingNodes } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => graphService.getNodes(),
    retry: false,
  });
  const { data: edges, isLoading: loadingEdges } = useQuery({
    queryKey: ['edges'],
    queryFn: () => graphService.getEdges(),
    retry: false,
  });
  const { data: buildings, isLoading: loadingBuildings } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => buildingService.getAll(),
    retry: false,
  });
  const { data: rooms, isLoading: loadingRooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomService.getAll(),
    retry: false,
  });
  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ['device-sessions'],
    queryFn: deviceSessionService.getAll,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const { data: sessionStats, isLoading: loadingStats } = useQuery({
    queryKey: ['session-stats'],
    queryFn: deviceSessionService.getStats,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const loading = loadingNodes || loadingEdges || loadingBuildings || loadingRooms;

  const now = Date.now();
  const activeNow = (sessions ?? []).filter(s => now - new Date(s.lastSeen).getTime() < ACTIVE_MS).length;
  const recentSessions = (sessions ?? [])
    .slice()
    .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
    .slice(0, 6);

  const stats = [
    {
      title: 'Total Nodos',
      value: loading ? '—' : (nodes?.length ?? 0),
      subtitle: 'BUILDING · ENTRANCE · WAYPOINT',
      icon: <PlaceRoundedIcon />,
      color: '#00d084',
    },
    {
      title: 'Total Rutas',
      value: loading ? '—' : (edges?.length ?? 0),
      subtitle: 'Conexiones activas del grafo',
      icon: <AltRouteRoundedIcon />,
      color: '#6366F1',
    },
    {
      title: 'Edificios',
      value: loading ? '—' : (buildings?.length ?? 0),
      subtitle: 'Bloques del campus',
      icon: <ApartmentRoundedIcon />,
      color: '#F59E0B',
    },
    {
      title: 'Salones',
      value: loading ? '—' : (rooms?.length ?? 0),
      subtitle: 'Espacios registrados',
      icon: <MeetingRoomRoundedIcon />,
      color: '#3B82F6',
    },
  ];

  // Top platforms
  const byPlatform = sessionStats?.byPlatform ?? {};
  const totalPings = Object.values(byPlatform).reduce((a, b) => a + b, 0);
  const topPlatforms = Object.entries(byPlatform)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle="Resumen general del sistema de navegación UCO"
      />

      {/* Map stats */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {stats.map(stat => (
          <Grid key={stat.title} size={{ xs: 12, sm: 6, lg: 3 }}>
            {loading ? (
              <Skeleton variant="rounded" height={110} sx={{ borderRadius: '18px' }} />
            ) : (
              <StatCard {...stat} />
            )}
          </Grid>
        ))}
      </Grid>

      {/* Session summary row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Devices stat */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          {loadingStats ? (
            <Skeleton variant="rounded" height={110} sx={{ borderRadius: '18px' }} />
          ) : (
            <StatCard
              title="Dispositivos únicos"
              value={sessionStats?.totalDevices ?? 0}
              subtitle="Registrados en el sistema"
              icon={<DevicesRoundedIcon />}
              color="#EC4899"
            />
          )}
        </Grid>

        {/* Active now */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          {loadingSessions ? (
            <Skeleton variant="rounded" height={110} sx={{ borderRadius: '18px' }} />
          ) : (
            <Paper
              sx={{
                borderRadius: '18px',
                border: '1px solid #F1F1F1',
                boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                p: 2.5,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 40, height: 40, borderRadius: '12px',
                  bgcolor: 'rgba(0,208,132,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FiberManualRecordRoundedIcon sx={{ color: '#00d084', fontSize: 20 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>
                  {activeNow}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Activos ahora (≤10 min)
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 8, height: 8, borderRadius: '50%', bgcolor: '#00d084',
                  ml: 'auto', animation: 'dashPulse 1.5s infinite',
                  '@keyframes dashPulse': {
                    '0%,100%': { opacity: 1 },
                    '50%': { opacity: 0.2 },
                  },
                }}
              />
            </Paper>
          )}
        </Grid>

        {/* Platform breakdown */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper
            sx={{
              borderRadius: '18px',
              border: '1px solid #F1F1F1',
              boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
              p: 2.5,
              height: '100%',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Plataformas</Typography>
              <Typography variant="caption" color="text.secondary">{totalPings} pings</Typography>
            </Box>
            {loadingStats ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={20} sx={{ mb: 1, borderRadius: 4 }} />
              ))
            ) : topPlatforms.length === 0 ? (
              <Typography variant="caption" color="text.secondary">Sin datos</Typography>
            ) : (
              topPlatforms.map(([name, count]) => {
                const pct = totalPings > 0 ? Math.round((count / totalPings) * 100) : 0;
                return (
                  <Box key={name} sx={{ mb: 1.2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: '3px' }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 500 }}>{name}</Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{count} · {pct}%</Typography>
                    </Box>
                    <Box sx={{ height: 6, bgcolor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: '#00d084', borderRadius: 3, transition: 'width 0.4s ease' }} />
                    </Box>
                  </Box>
                );
              })
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Tables row */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper
            sx={{
              borderRadius: '18px',
              border: '1px solid #F1F1F1',
              boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #F1F1F1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Últimos nodos registrados
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {nodes?.length ?? 0} total
              </Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Etiqueta</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 4 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton variant="text" width="80%" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : (nodes ?? []).slice(0, 8).map(node => (
                      <TableRow key={node.nodeId} hover>
                        <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {node.nodeId}
                        </TableCell>
                        <TableCell>{node.label ?? '—'}</TableCell>
                        <TableCell>
                          <NodeTypeChip type={node.nodeType} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={node.active ? 'Activo' : 'Inactivo'}
                            size="small"
                            sx={{
                              bgcolor: node.active ? '#D1FAE5' : '#FEE2E2',
                              color: node.active ? '#065F46' : '#991B1B',
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        {/* Recent sessions */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper
            sx={{
              borderRadius: '18px',
              border: '1px solid #F1F1F1',
              boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
              overflow: 'hidden',
              height: '100%',
            }}
          >
            <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #F1F1F1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Sesiones recientes</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#00d084', animation: 'dashPulse 1.5s infinite', '@keyframes dashPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } } }} />
                <Typography variant="caption" sx={{ color: '#00d084', fontWeight: 600 }}>En vivo</Typography>
              </Box>
            </Box>
            <Box sx={{ p: 1 }}>
              {loadingSessions
                ? Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} variant="rounded" height={44} sx={{ mb: 0.5, borderRadius: '10px' }} />
                  ))
                : recentSessions.map(s => {
                    const isActive = now - new Date(s.lastSeen).getTime() < ACTIVE_MS;
                    return (
                      <Box
                        key={s.id}
                        sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          px: 1.5, py: 1, borderRadius: '10px',
                          '&:hover': { bgcolor: '#F9FAFB' },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: isActive ? '#00d084' : '#D1D5DB' }} />
                          <Box>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 600 }}>
                              {s.deviceId.slice(0, 8)}…
                            </Typography>
                            <Typography variant="caption" color="text.secondary">{s.platform ?? '—'}</Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" color="text.secondary">{formatRelative(s.lastSeen)}</Typography>
                          <Typography variant="caption" sx={{ display: 'block', color: '#6366F1', fontWeight: 600 }}>
                            {s.sessionCount} pings
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
            </Box>
          </Paper>
        </Grid>

        {/* Buildings */}
        <Grid size={{ xs: 12, lg: 3 }}>
          <Paper
            sx={{
              borderRadius: '18px',
              border: '1px solid #F1F1F1',
              boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #F1F1F1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Edificios del campus
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {buildings?.length ?? 0} total
              </Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Nombre</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 2 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton variant="text" width="80%" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : (buildings ?? []).map(b => (
                      <TableRow key={b.buildingId} hover>
                        <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {b.buildingId}
                        </TableCell>
                        <TableCell>{b.label}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

function NodeTypeChip({ type }: { type: string }) {
  const config: Record<string, { label: string; bg: string; color: string }> = {
    BUILDING: { label: 'Edificio', bg: '#FEF3C7', color: '#92400E' },
    ENTRANCE: { label: 'Entrada', bg: '#DBEAFE', color: '#1E40AF' },
    WAYPOINT: { label: 'Waypoint', bg: '#F3F4F6', color: '#374151' },
  };
  const c = config[type] ?? { label: type, bg: '#F3F4F6', color: '#374151' };
  return (
    <Chip label={c.label} size="small" sx={{ bgcolor: c.bg, color: c.color }} />
  );
}

