import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Chip, Grid, IconButton, MenuItem, Paper, Skeleton, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded';
import StatCard from '../components/StatCard';
import { tripService } from '../services/tripService';
import type { NavigationTrip, TripFilters } from '../types';

const END_REASON_LABEL: Record<string, string> = {
  'ar-arrival': 'Llegó (AR)',
  'building-arrival': 'Llegó al edificio',
  closed: 'Cerró la navegación',
  'destination-changed': 'Cambió de destino',
  'page-closed': 'Cerró la app',
  timeout: 'Salió de la app sin cerrar',
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

function pct(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '—';
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

function toFilters(from: string, to: string, building: string): TripFilters {
  return {
    // Las fechas del selector son locales: el día completo en la zona horaria del navegador
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    building: building === 'all' ? undefined : building,
  };
}

export default function TripsPage() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [building, setBuilding] = useState('all');
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(() => toFilters(from, to, building), [from, to, building]);

  const { data: tripPage, isLoading: loadingPage, isFetching: fetchingPage } = useQuery({
    queryKey: ['navigation-trips', 'page', filters, pagination.page, pagination.pageSize],
    queryFn: () => tripService.getPage(filters, pagination.page, pagination.pageSize),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const { data: summary, isLoading: loadingSummary, isFetching: fetchingSummary } = useQuery({
    queryKey: ['navigation-trips', 'summary', filters],
    queryFn: () => tripService.getSummary(filters),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  // Al cambiar un filtro se vuelve a la primera página
  const withFirstPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPagination(p => ({ ...p, page: 0 }));
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['navigation-trips'] });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await tripService.exportCsv(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recorridos-ucomap.csv';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const buildings = summary?.buildings ?? [];
  const byDestination = summary?.byDestination ?? [];
  const abandonReasons = summary?.abandonReasons ?? [];

  const cards = [
    {
      title: 'Recorridos',
      value: summary?.total ?? 0,
      subtitle: `${summary?.finished ?? 0} terminados · ${summary?.inProgress ?? 0} en curso`,
      icon: <RouteRoundedIcon />,
      color: '#6366F1',
    },
    {
      title: 'Tasa de éxito',
      value: pct(summary?.arrived ?? 0, summary?.finished ?? 0),
      subtitle: `${summary?.arrived ?? 0} de ${summary?.finished ?? 0} llegaron al destino`,
      icon: <CheckCircleRoundedIcon />,
      color: '#00d084',
    },
    {
      title: 'Tiempo de llegada',
      value: fmtDuration(summary?.avgArrivalMs),
      subtitle: `Promedio · mediana ${fmtDuration(summary?.medianArrivalMs)}`,
      icon: <TimerRoundedIcon />,
      color: '#F59E0B',
    },
    {
      title: 'Ubicación VPS',
      value: fmtDuration(summary?.avgLocalizedMs),
      subtitle: summary?.avgVpsFailures == null
        ? 'Sin sesiones AR'
        : `Promedio · ${summary.avgVpsFailures.toFixed(1)} fallos por recorrido AR`,
      icon: <GpsFixedRoundedIcon />,
      color: '#3B82F6',
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <TextField
          label="Desde" type="date" size="small" value={from}
          onChange={e => withFirstPage(setFrom)(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Hasta" type="date" size="small" value={to}
          onChange={e => withFirstPage(setTo)(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          select label="Edificio" size="small" value={building}
          onChange={e => withFirstPage(setBuilding)(e.target.value)} sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">Todos</MenuItem>
          {buildings.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
        </TextField>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            size="small" variant="outlined" startIcon={<DownloadRoundedIcon />}
            onClick={exportCsv} disabled={exporting}
            sx={{ borderRadius: '8px', textTransform: 'none' }}
          >
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </Button>
          <Tooltip title="Refrescar">
            <Box component="span">
              <IconButton
                size="small"
                onClick={refresh}
                disabled={fetchingPage || fetchingSummary}
                sx={{ border: '1px solid #E5E7EB', borderRadius: '8px', color: 'text.secondary' }}
              >
                <RefreshRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {cards.map(card => (
          <Grid key={card.title} size={{ xs: 12, sm: 6, lg: 3 }}>
            {loadingSummary
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
                  {byDestination.map(d => (
                    <TableRow key={`${d.building}|${d.roomName}`}>
                      <TableCell>{`${d.building ?? '—'} · ${d.roomName}`}</TableCell>
                      <TableCell align="right">{d.total}</TableCell>
                      <TableCell align="right">{pct(d.arrived, d.finished)}</TableCell>
                      <TableCell align="right">{fmtDuration(d.avgArrivalMs)}</TableCell>
                      <TableCell align="right">{fmtDuration(d.medianArrivalMs)}</TableCell>
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
            ) : abandonReasons.map(({ reason, count }) => (
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
          rows={tripPage?.content ?? []}
          columns={columns}
          loading={loadingPage || fetchingPage}
          getRowId={row => row.id}
          paginationMode="server"
          rowCount={tripPage?.totalElements ?? 0}
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          pageSizeOptions={[25, 50, 100]}
          disableColumnSorting
          disableColumnFilter
          disableRowSelectionOnClick
          sx={{ border: 'none' }}
        />
      </Box>
    </Box>
  );
}
