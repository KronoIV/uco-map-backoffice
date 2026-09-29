import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Chip, Grid, IconButton, MenuItem, Paper, Skeleton, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarExport,
  GridToolbarFilterButton,
  GridToolbarQuickFilter,
} from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { tripService } from '../services/tripService';
import type { NavigationTrip } from '../types';

const END_REASON_LABEL: Record<string, string> = {
  'ar-arrival': 'Llegó (AR)',
  'building-arrival': 'Llegó al edificio',
  closed: 'Cerró la navegación',
  'destination-changed': 'Cambió de destino',
  'page-closed': 'Cerró la app',
  timeout: 'Sin cierre (expirado)',
};

const cardSx = {
  bgcolor: '#fff',
  border: '1px solid #F1F1F1',
  borderRadius: '18px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
};

function fmtDuration(ms?: number | null) {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

function fmtMeters(m?: number | null) {
  return m == null ? '—' : `${Math.round(m)} m`;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pct(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '—';
}

interface Summary {
  total: number;
  finished: number;
  arrived: number;
  inProgress: number;
  arrivedDurations: number[];
  localized: number[];
  vpsFailures: number[];
}

function summarize(trips: NavigationTrip[]): Summary {
  const finished = trips.filter(t => t.status !== 'IN_PROGRESS');
  const arrived = finished.filter(t => t.status === 'ARRIVED');
  return {
    total: trips.length,
    finished: finished.length,
    arrived: arrived.length,
    inProgress: trips.length - finished.length,
    arrivedDurations: arrived.map(t => t.durationMs).filter((v): v is number => v != null),
    localized: finished.map(t => t.localizedMs).filter((v): v is number => v != null),
    vpsFailures: finished.filter(t => t.usedAR).map(t => t.vpsFailures ?? 0),
  };
}

function statusChip(trip: NavigationTrip) {
  if (trip.status === 'ARRIVED')
    return <Chip label="Llegó" size="small" sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 600 }} />;
  if (trip.status === 'ABANDONED')
    return <Chip label="Abandonó" size="small" sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 600 }} />;
  return <Chip label="En curso" size="small" sx={{ bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 600 }} />;
}

const columns: GridColDef<NavigationTrip>[] = [
  {
    field: 'startedAt', headerName: 'Inicio', width: 150,
    valueGetter: v => (v ? new Date(v as string) : null), type: 'dateTime',
    renderCell: ({ row }) => fmtDate(row.startedAt),
  },
  { field: 'roomName', headerName: 'Destino', width: 150 },
  { field: 'building', headerName: 'Edificio', width: 100 },
  { field: 'status', headerName: 'Resultado', width: 110, renderCell: ({ row }) => statusChip(row) },
  {
    field: 'endReason', headerName: 'Motivo', width: 170,
    valueGetter: v => (v ? END_REASON_LABEL[v as string] ?? v : ''),
  },
  {
    field: 'durationMs', headerName: 'Duración', width: 100, type: 'number',
    renderCell: ({ value }) => fmtDuration(value as number | undefined),
  },
  { field: 'startMode', headerName: 'Inicio en', width: 90 },
  {
    field: 'startDistanceM', headerName: 'Dist. inicial', width: 105, type: 'number',
    renderCell: ({ value }) => fmtMeters(value as number | undefined),
  },
  {
    field: 'outdoorRouteM', headerName: 'Ruta ext.', width: 95, type: 'number',
    renderCell: ({ value }) => fmtMeters(value as number | undefined),
  },
  {
    field: 'indoorRouteM', headerName: 'Ruta int.', width: 95, type: 'number',
    renderCell: ({ value }) => fmtMeters(value as number | undefined),
  },
  {
    field: 'buildingReachedMs', headerName: 'Llegó al edificio', width: 130, type: 'number',
    renderCell: ({ value }) => fmtDuration(value as number | undefined),
  },
  {
    field: 'localizedMs', headerName: 'Ubicación VPS', width: 115, type: 'number',
    renderCell: ({ value }) => fmtDuration(value as number | undefined),
  },
  { field: 'vpsFailures', headerName: 'Fallos VPS', width: 95, type: 'number' },
  { field: 'modeSwitches', headerName: 'Cambios modo', width: 110, type: 'number' },
  { field: 'usedAR', headerName: 'AR', width: 70, type: 'boolean' },
  { field: 'platform', headerName: 'Plataforma', width: 110 },
  { field: 'deviceId', headerName: 'Dispositivo', width: 120 },
];

function Toolbar() {
  return (
    <GridToolbarContainer sx={{ px: 2, py: 1, borderBottom: '1px solid #F1F1F1', justifyContent: 'space-between' }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <GridToolbarFilterButton />
        <GridToolbarExport csvOptions={{ fileName: 'recorridos-ucomap', utf8WithBom: true }} />
      </Box>
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );
}

export default function TripsPage() {
  const { data: trips, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['navigation-trips'],
    queryFn: tripService.getAll,
    refetchOnWindowFocus: false,
  });

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [building, setBuilding] = useState('all');

  const buildings = useMemo(
    () => [...new Set((trips ?? []).map(t => t.building).filter((b): b is string => !!b))].sort(),
    [trips],
  );

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
    const toTs = to ? new Date(`${to}T23:59:59.999`).getTime() : Infinity;
    return (trips ?? []).filter(t => {
      const ts = new Date(t.startedAt).getTime();
      return ts >= fromTs && ts <= toTs && (building === 'all' || t.building === building);
    });
  }, [trips, from, to, building]);

  const summary = useMemo(() => summarize(filtered), [filtered]);

  const byDestination = useMemo(() => {
    const groups = new Map<string, NavigationTrip[]>();
    for (const t of filtered) {
      const key = `${t.building ?? '—'} · ${t.roomName}`;
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    return [...groups.entries()]
      .map(([key, list]) => ({ key, s: summarize(list) }))
      .sort((a, b) => b.s.total - a.s.total);
  }, [filtered]);

  const abandonReasons = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of filtered) {
      if (t.status !== 'ABANDONED') continue;
      const r = t.endReason ?? 'closed';
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const avgArrival = mean(summary.arrivedDurations);
  const medArrival = median(summary.arrivedDurations);
  const avgLocalized = mean(summary.localized);
  const avgFailures = mean(summary.vpsFailures);

  const cards = [
    {
      title: 'Recorridos',
      value: summary.total,
      subtitle: `${summary.finished} terminados · ${summary.inProgress} en curso`,
      icon: <RouteRoundedIcon />,
      color: '#6366F1',
    },
    {
      title: 'Tasa de éxito',
      value: pct(summary.arrived, summary.finished),
      subtitle: `${summary.arrived} de ${summary.finished} llegaron al destino`,
      icon: <CheckCircleRoundedIcon />,
      color: '#00d084',
    },
    {
      title: 'Tiempo de llegada',
      value: fmtDuration(avgArrival),
      subtitle: `Promedio · mediana ${fmtDuration(medArrival)}`,
      icon: <TimerRoundedIcon />,
      color: '#F59E0B',
    },
    {
      title: 'Ubicación VPS',
      value: fmtDuration(avgLocalized),
      subtitle: avgFailures == null ? 'Sin sesiones AR' : `Promedio · ${avgFailures.toFixed(1)} fallos por recorrido AR`,
      icon: <GpsFixedRoundedIcon />,
      color: '#3B82F6',
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Recorridos"
        subtitle="Tiempo de orientación y tasa de llegada al destino"
        action={
          <Tooltip title="Refrescar">
            <IconButton
              size="small"
              onClick={() => refetch()}
              disabled={isFetching}
              sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', color: 'text.secondary' }}
            >
              <RefreshRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        }
      />

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <TextField
          label="Desde" type="date" size="small" value={from}
          onChange={e => setFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Hasta" type="date" size="small" value={to}
          onChange={e => setTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          select label="Edificio" size="small" value={building}
          onChange={e => setBuilding(e.target.value)} sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">Todos</MenuItem>
          {buildings.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
        </TextField>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {cards.map(card => (
          <Grid key={card.title} size={{ xs: 12, sm: 6, lg: 3 }}>
            {isLoading
              ? <Skeleton variant="rounded" height={110} sx={{ borderRadius: '18px' }} />
              : <StatCard {...card} />}
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ ...cardSx, p: 3, height: '100%' }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1 }}>Por destino</Typography>
            {byDestination.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Sin recorridos en el rango seleccionado</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Destino</TableCell>
                    <TableCell align="right">Recorridos</TableCell>
                    <TableCell align="right">Éxito</TableCell>
                    <TableCell align="right">Tiempo promedio</TableCell>
                    <TableCell align="right">Mediana</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {byDestination.map(({ key, s }) => (
                    <TableRow key={key}>
                      <TableCell>{key}</TableCell>
                      <TableCell align="right">{s.total}</TableCell>
                      <TableCell align="right">{pct(s.arrived, s.finished)}</TableCell>
                      <TableCell align="right">{fmtDuration(mean(s.arrivedDurations))}</TableCell>
                      <TableCell align="right">{fmtDuration(median(s.arrivedDurations))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper sx={{ ...cardSx, p: 3, height: '100%' }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>Motivos de abandono</Typography>
            {abandonReasons.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Sin abandonos</Typography>
            ) : abandonReasons.map(([reason, count]) => (
              <Box key={reason} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: '0.85rem' }}>{END_REASON_LABEL[reason] ?? reason}</Typography>
                <Chip label={count} size="small" sx={{ fontWeight: 700 }} />
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ ...cardSx, overflow: 'hidden', height: 520 }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          loading={isLoading}
          getRowId={row => row.id}
          slots={{ toolbar: Toolbar }}
          showToolbar
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: { sortModel: [{ field: 'startedAt', sort: 'desc' }] },
          }}
          disableRowSelectionOnClick
          sx={{ border: 'none' }}
        />
      </Box>
    </Box>
  );
}
