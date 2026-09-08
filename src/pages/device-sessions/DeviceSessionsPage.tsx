import { useState } from 'react';
import {
  Box, Grid, Paper, Typography, Chip, InputAdornment,
  OutlinedInput, ToggleButton, ToggleButtonGroup, Skeleton,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import PageHeader from '../../components/PageHeader';
import SessionStatCards, { PlatformDistribution } from '../../components/device-sessions/SessionStatCards';
import SessionsDataGrid from '../../components/device-sessions/SessionsDataGrid';
import SessionDetailDrawer from '../../components/device-sessions/SessionDetailDrawer';
import { useDeviceSessions, useSessionStats, useSessionStream } from '../../hooks/useDeviceSessions';
import type { DeviceSession } from '../../types';

const ACTIVE_MS = 10 * 60 * 1000; // 10 min
const TODAY_MS = 24 * 60 * 60 * 1000;

type StatusFilter = 'all' | 'active' | 'today' | 'inactive';

function filterByStatus(sessions: DeviceSession[], status: StatusFilter): DeviceSession[] {
  const now = Date.now();
  return sessions.filter(s => {
    const diff = now - new Date(s.lastSeen).getTime();
    if (status === 'active') return diff < ACTIVE_MS;
    if (status === 'today') return diff < TODAY_MS && diff >= ACTIVE_MS;
    if (status === 'inactive') return diff >= TODAY_MS;
    return true;
  });
}

export default function DeviceSessionsPage() {
  const { data: sessions, isLoading: loadingSessions, refetch } = useDeviceSessions();
  const { data: stats, isLoading: loadingStats } = useSessionStats();
  useSessionStream();

  const [selectedSession, setSelectedSession] = useState<DeviceSession | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loading = loadingSessions || loadingStats;

  const filtered = filterByStatus(
    (sessions ?? []).filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        s.deviceId.toLowerCase().includes(q) ||
        (s.platform ?? '').toLowerCase().includes(q) ||
        (s.ipAddress ?? '').toLowerCase().includes(q) ||
        (s.language ?? '').toLowerCase().includes(q)
      );
    }),
    statusFilter,
  );

  const now = Date.now();
  const activeCount = (sessions ?? []).filter(s => now - new Date(s.lastSeen).getTime() < ACTIVE_MS).length;
  const todayCount = (sessions ?? []).filter(s => {
    const d = now - new Date(s.lastSeen).getTime();
    return d >= ACTIVE_MS && d < TODAY_MS;
  }).length;
  const inactiveCount = (sessions ?? []).filter(s => now - new Date(s.lastSeen).getTime() >= TODAY_MS).length;

  return (
    <Box>
      <PageHeader
        title="Device Sessions"
        subtitle="Monitoreo de dispositivos y comportamiento de navegación"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label="En vivo"
              size="small"
              icon={<Box component="span" sx={{ display:'inline-block', width:6, height:6, borderRadius:'50%', bgcolor:'#065F46', ml:'6px !important', animation:'pulse 1.5s infinite' }} />}
              sx={{
                bgcolor: '#D1FAE5', color: '#065F46', fontSize: '0.7rem',
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
                onClick={() => refetch()}
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
        }
      />

      {/* Stat cards */}
      <SessionStatCards stats={stats} sessions={sessions} loading={loading} />

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
              onChange={(_, v) => v && setStatusFilter(v)}
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
                Todos · {loadingSessions ? '…' : (sessions?.length ?? 0)}
              </ToggleButton>
              <ToggleButton value="active">
                Activos · {loadingSessions ? '…' : activeCount}
              </ToggleButton>
              <ToggleButton value="today">
                Hoy · {loadingSessions ? '…' : todayCount}
              </ToggleButton>
              <ToggleButton value="inactive">
                Inactivos · {loadingSessions ? '…' : inactiveCount}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Grid>

        {/* DataGrid */}
        <Grid size={{ xs: 12, lg: 8 }}>
          {loadingSessions ? (
            <Skeleton variant="rounded" height={480} sx={{ borderRadius: '18px' }} />
          ) : (
            <SessionsDataGrid
              rows={filtered}
              loading={loadingSessions}
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
              {loadingSessions ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={36} sx={{ mb: 1, borderRadius: '8px' }} />
                ))
              ) : (
                (sessions ?? [])
                  .slice()
                  .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
                  .slice(0, 6)
                  .map(s => {
                    const diff = now - new Date(s.lastSeen).getTime();
                    const isActive = diff < ACTIVE_MS;
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
