import { useEffect, useState } from 'react';
import {
  Box, Grid, Paper, Typography, Chip, InputAdornment,
  OutlinedInput, ToggleButton, ToggleButtonGroup, Skeleton,
} from '@mui/material';
import type { GridPaginationModel } from '@mui/x-data-grid';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import SessionStatCards, { PlatformDistribution } from '../../components/device-sessions/SessionStatCards';
import SessionsDataGrid from '../../components/device-sessions/SessionsDataGrid';
import SessionDetailDrawer from '../../components/device-sessions/SessionDetailDrawer';
import {
  useDeviceSessions, useRecentSessions, useSessionStats, useSessionStream,
} from '../../hooks/useDeviceSessions';
import type { DeviceSession, SessionStatusFilter } from '../../types';

const ACTIVE_MS = 10 * 60 * 1000; // 10 min

function isActiveNow(lastSeen: string) {
  return Date.now() - new Date(lastSeen).getTime() < ACTIVE_MS;
}

export default function DeviceSessionsPage() {
  const [selectedSession, setSelectedSession] = useState<DeviceSession | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatusFilter>('all');
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 10 });

  // Buscar al dejar de escribir, no en cada tecla
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPagination(p => ({ ...p, page: 0 }));
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data: sessionPage, isLoading: loadingSessions, isFetching: fetchingSessions, refetch,
  } = useDeviceSessions({ q: query, status: statusFilter, page: pagination.page, size: pagination.pageSize });
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useSessionStats();
  const { data: recentSessions, isLoading: loadingRecent, refetch: refetchRecent } = useRecentSessions();
  const { connected: liveConnected } = useSessionStream();

  const loading = loadingStats;

  const total = stats?.totalDevices ?? 0;
  const activeCount = stats?.activeNow ?? 0;
  const todayCount = Math.max(0, (stats?.activeToday ?? 0) - activeCount);
  const inactiveCount = Math.max(0, total - (stats?.activeToday ?? 0));

  const changeStatus = (value: SessionStatusFilter) => {
    setStatusFilter(value);
    setPagination(p => ({ ...p, page: 0 }));
  };

  const refreshAll = () => {
    refetch();
    refetchStats();
    refetchRecent();
  };

  return (
    <Box>
      {/* Stat cards */}
      <SessionStatCards stats={stats} loading={loading} />

      {/* Middle row: table + platform chart */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* Filters */}
        <Grid size={12}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <OutlinedInput
              size="small"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por device ID, plataforma, IP..."
              startAdornment={
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </InputAdornment>
              }
              sx={{ width: 300 }}
            />

            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              onChange={(_, v) => v && changeStatus(v)}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  border: '1px solid #E5E7EB',
                  borderRadius: '100px !important',
                  px: 1.5,
                  py: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  color: 'text.secondary',
                  mx: '2px',
                  '&.Mui-selected': {
                    bgcolor: '#00d084',
                    color: '#fff',
                    borderColor: '#00d084',
                    '&:hover': { bgcolor: '#00b874' },
                  },
                },
              }}
            >
              <ToggleButton value="all">
                Todos · {loadingStats ? '…' : total}
              </ToggleButton>
              <ToggleButton value="active">
                Activos · {loadingStats ? '…' : activeCount}
              </ToggleButton>
              <ToggleButton value="today">
                Hoy · {loadingStats ? '…' : todayCount}
              </ToggleButton>
              <ToggleButton value="inactive">
                Inactivos · {loadingStats ? '…' : inactiveCount}
              </ToggleButton>
            </ToggleButtonGroup>

            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={liveConnected ? 'En vivo' : 'Reconectando…'}
                size="small"
                icon={<Box component="span" sx={{ display:'inline-block', width:6, height:6, borderRadius:'50%', bgcolor: liveConnected ? '#065F46' : '#92400E', ml:'6px !important', animation:'pulse 1.5s infinite' }} />}
                sx={{
                  bgcolor: liveConnected ? '#D1FAE5' : '#FEF3C7',
                  color: liveConnected ? '#065F46' : '#92400E',
                  fontSize: '0.7rem',
                  '& .MuiChip-icon': { ml: 0 },
                  '@keyframes pulse': {
                    '0%,100%': { opacity: 1 },
                    '50%': { opacity: 0.3 },
                  },
                }}
              />
              <Tooltip title="Refrescar ahora">
                <IconButton
                  size="small"
                  onClick={refreshAll}
                  sx={{
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    color: 'text.secondary',
                    '&:hover': { bgcolor: '#F9FAFB' },
                  }}
                >
                  <RefreshRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Grid>

        {/* DataGrid */}
        <Grid size={{ xs: 12, lg: 8 }}>
          {loadingSessions ? (
            <Skeleton variant="rounded" height={480} sx={{ borderRadius: '18px' }} />
          ) : (
            <SessionsDataGrid
              rows={sessionPage?.content ?? []}
              rowCount={sessionPage?.totalElements ?? 0}
              paginationModel={pagination}
              onPaginationModelChange={setPagination}
              loading={fetchingSessions}
              onRowClick={setSelectedSession}
              selectedId={selectedSession?.id ?? null}
            />
          )}
        </Grid>

        {/* Platform chart */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
            <PlatformDistribution stats={stats} loading={loadingStats} />

            {/* Recent activity timeline */}
            <Paper
              sx={{
                borderRadius: '18px',
                border: '1px solid #F1F1F1',
                boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                p: 3,
                flex: 1,
              }}
            >
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>
                Actividad reciente
              </Typography>
              {loadingRecent ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={36} sx={{ mb: 1, borderRadius: '8px' }} />
                ))
              ) : (
                (recentSessions ?? [])
                  .map(s => {
                    const isActive = isActiveNow(s.lastSeen);
                    return (
                      <Box
                        key={s.id}
                        onClick={() => setSelectedSession(s)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          py: '8px',
                          px: 1,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#F9FAFB' },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: isActive ? '#00d084' : '#D1D5DB',
                              flexShrink: 0,
                            }}
                          />
                          <Box>
                            <Typography
                              sx={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 600 }}
                            >
                              {s.deviceId.slice(0, 8)}…
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {s.platform}
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {formatRelative(s.lastSeen)}
                        </Typography>
                      </Box>
                    );
                  })
              )}
            </Paper>
          </Box>
        </Grid>
      </Grid>

      {/* Session detail drawer */}
      <SessionDetailDrawer
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </Box>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (diff < 60_000) return 'ahora';
  if (m < 60) return `hace ${m}m`;
  if (h < 24) return `hace ${h}h`;
  return `hace ${d}d`;
}
