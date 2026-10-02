import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Button, Chip, Grid, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EastRoundedIcon from '@mui/icons-material/EastRounded';
import PeriodFilter from '../components/analytics/PeriodFilter';
import KpiCard from '../components/analytics/KpiCard';
import ChartCard, { cardSx } from '../components/analytics/ChartCard';
import TrendChart from '../components/analytics/charts/TrendChart';
import BarList from '../components/analytics/charts/BarList';
import ColumnChart from '../components/analytics/charts/ColumnChart';
import WeekHourHeatmap from '../components/analytics/charts/WeekHourHeatmap';
import TripsMap from '../components/analytics/TripsMap';
import { usePeriod } from '../hooks/usePeriod';
import { tripService } from '../services/tripService';
import { analyticsService } from '../services/analyticsService';
import type { NavigationTrip, TripFilters } from '../types';
import type { TripAnalytics } from '../types/analytics';
import {
  ABANDON_STAGE_LABEL, END_REASON_LABEL, START_MODE_LABEL, fmtDay, fmtDuration as fmtDurationLong, fmtMeters as fmtMetersLong,
  fmtNumber, fmtPercent,
} from '../utils/analyticsFormat';

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

type Destination = TripAnalytics['destinations'][number];

/** Destinos con al menos 3 recorridos terminados y menor tasa de llegada (los que más cuestan encontrar). */
function hardestDestinations(destinations: Destination[]): Destination[] {
  return destinations
    .filter(d => d.arrived + d.abandoned >= 3 && d.completionRate != null)
    .sort((a, b) => (a.completionRate ?? 0) - (b.completionRate ?? 0))
    .slice(0, 5);
}

export default function TripsPage() {
  const period = usePeriod();
  const [params, setParams] = useSearchParams();
  const building = params.get('edificio') ?? '';
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [exporting, setExporting] = useState(false);

  const query = useMemo(() => ({ ...period.query, building: building || undefined }), [period.query, building]);
  const filters: TripFilters = useMemo(() => ({ from: query.from, to: query.to, building: query.building }), [query]);

  const analytics = useQuery({
    queryKey: ['analytics', 'trips', query],
    queryFn: () => analyticsService.getTrips(query),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: tripPage, isLoading: loadingPage, isFetching: fetchingPage } = useQuery({
    queryKey: ['navigation-trips', 'page', filters, pagination.page, pagination.pageSize],
    queryFn: () => tripService.getPage(filters, pagination.page, pagination.pageSize),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const setBuilding = (b: string) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (b) next.set('edificio', b); else next.delete('edificio');
      return next;
    }, { replace: true });
    setPagination(p => ({ ...p, page: 0 }));
  };

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

  const t = analytics.data;
  const s = t?.summary;
  const loading = analytics.isLoading;
  const err = analytics.error;
  const pl = period.previousLabel;
  const noTrips = !t || (s?.total.value ?? 0) === 0;
  const finished = (s?.arrived.value ?? 0) + (s?.abandoned.value ?? 0);
  const hardest = t ? hardestDestinations(t.destinations) : [];

  return (
    <Box>
      <PeriodFilter period={period} fetching={analytics.isFetching || fetchingPage}>
        <TextField select size="small" label="Edificio" value={building} onChange={e => setBuilding(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">Todos</MenuItem>
          {(t?.buildings ?? []).map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
        </TextField>
      </PeriodFilter>

      {/* ── Resumen de recorridos ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
          <KpiCard loading={loading} label="Recorridos" value={fmtNumber(s?.total.value)} metric={s?.total} previousLabel={pl}
            sub={s ? `${fmtNumber(s.inProgress)} en curso ahora` : undefined}
            info="Recorridos iniciados (el usuario confirmó un destino)." />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
          <KpiCard loading={loading} label="Llegaron al destino" value={fmtPercent(s?.completionRate.value)} metric={s?.completionRate}
            isRate previousLabel={pl} sub={s ? `${fmtNumber(s.arrived.value)} de ${fmtNumber(finished)} terminados` : undefined}
            info="Llegados sobre terminados (llegados + abandonados)." />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
          <KpiCard loading={loading} label="Tiempo típico hasta llegar" value={fmtDurationLong(s?.medianDurationMs)}
            sub={s ? `75 %: ${fmtDurationLong(s.p75DurationMs)} · 90 %: ${fmtDurationLong(s.p90DurationMs)}` : undefined}
            info="Mediana de la duración de los recorridos que llegaron. 75 % / 90 %: tiempo dentro del que llega ese porcentaje." />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
          <KpiCard loading={loading} label="Abandonados" value={fmtNumber(s?.abandoned.value)} metric={s?.abandoned}
            higherIsBetter={false} previousLabel={pl}
            sub={s?.medianAbandonMs != null ? `Abandonan a los ${fmtDurationLong(s.medianAbandonMs)} (mediana)` : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
          <KpiCard loading={loading} label="Usaron la cámara" value={fmtPercent(s?.arUsageRate)}
            sub={s?.medianLocalizedMs != null
              ? `Se ubican en ${fmtDurationLong(s.medianLocalizedMs)} · ${fmtNumber(s.avgVpsFailures, 1)} fallos de media`
              : 'Ningún recorrido llegó a ubicarse con la cámara'}
            info="Recorridos terminados que abrieron la guía con cámara. Ubicarse = primera ubicación lograda por la cámara (VPS)." />
        </Grid>
      </Grid>

      {/* ── Cuándo ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <ChartCard title="Recorridos por día" subtitle={period.label} loading={loading} error={err} empty={noTrips}>
            {t && (
              <TrendChart ariaLabel="Recorridos por día" labels={t.daily.map(x => fmtDay(x.date))}
                series={[
                  { name: 'Iniciados', color: '#3B82F6', values: t.daily.map(x => x.total) },
                  { name: 'Llegaron', color: '#00b874', values: t.daily.map(x => x.arrived) },
                  { name: 'Abandonados', color: '#EF4444', values: t.daily.map(x => x.abandoned), dashed: true },
                ]} />
            )}
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <ChartCard title="Horas de más tráfico" subtitle="Recorridos iniciados por día de la semana y hora" loading={loading}
            error={err} empty={noTrips} info="Hora local de Colombia.">
            {t && <WeekHourHeatmap grid={t.byWeekdayHour} unit="recorridos" color={[59, 130, 246]} />}
          </ChartCard>
        </Grid>
      </Grid>

      {/* ── Dónde ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <ChartCard title="Mapa de actividad" subtitle="Dónde empiezan los recorridos y a qué edificio van" loading={loading} error={err}
            empty={!t || (t.originPoints.length === 0 && t.destinationPoints.length === 0)}
            emptyText="Sin puntos para mostrar: los edificios necesitan coordenadas GPS y el punto de partida se registra desde la versión 2.1"
            info="El punto de partida se guarda redondeado (~11 m) y se agrupa en celdas de ~22 m: el mapa no muestra recorridos individuales.">
            {t && <TripsMap origins={t.originPoints} destinations={t.destinationPoints} />}
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <ChartCard title="Desde dónde salen" subtitle={s ? `Con punto de partida: ${fmtNumber(s.withOrigin)} de ${fmtNumber(s.total.value)} recorridos` : undefined}
            info="Edificio a menos de 80 m del punto de partida, otra zona del campus (a menos de 600 m) o fuera de él. «Sin ubicación»: sin permiso de ubicación o versión anterior de la app."
            loading={loading} error={err} empty={noTrips}>
            {t && (
              <>
                <BarList color="#F59E0B" items={t.origins.slice(0, 7).map(o => ({
                  key: o.label, label: o.label, value: o.total,
                  hint: `${fmtPercent(o.total ? o.arrived / o.total : null)} llegaron a su destino`,
                }))} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mt: 2.5, mb: 1 }}>Distancia al edificio al empezar</Typography>
                <ColumnChart color="#F59E0B" height={70}
                  items={t.startDistances.map(b => ({ label: b.label, value: b.count }))} />
              </>
            )}
          </ChartCard>
        </Grid>
      </Grid>

      {/* ── Rutas ── */}
      <Box sx={{ mb: 2 }}>
        <ChartCard title="Rutas más frecuentes" subtitle="Origen → destino, de la más a la menos usada" loading={loading} error={err} empty={noTrips} minHeight={120}>
          {t && <RoutesTable routes={t.routes} />}
        </ChartCard>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <ChartCard title="Destinos más buscados" loading={loading} error={err} empty={noTrips}>
            {t && <BarList items={t.destinations.slice(0, 8).map(d => destinationItem(d))} />}
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <ChartCard title="Destinos menos usados" subtitle="Lugares con pocos recorridos en el periodo" loading={loading} error={err}
            empty={!t || t.destinations.length <= 8} emptyText="Hay pocos destinos: todos aparecen en «más buscados»">
            {t && <BarList color="#9CA3AF" items={t.destinations.slice(-5).reverse().map(d => destinationItem(d))} />}
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 12, lg: 4 }}>
          <ChartCard title="Donde menos llegan" subtitle="Menor tasa de llegada (mín. 3 recorridos terminados)" loading={loading} error={err}
            empty={hardest.length === 0} emptyText="Aún no hay destinos con suficientes recorridos">
            <BarList color="#EF4444" max={1}
              items={hardest.map(d => ({
                key: `${d.building}|${d.roomName}`, label: d.roomName, value: d.completionRate ?? 0,
                display: `${fmtPercent(d.completionRate)} llegan · ${fmtNumber(d.arrived + d.abandoned)} terminados`,
              }))} />
          </ChartCard>
        </Grid>
      </Grid>

      {/* ── Abandonos ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="¿En qué etapa abandonan?" loading={loading} error={err}
            empty={!t || t.abandonStages.length === 0} emptyText="Ningún recorrido abandonado">
            {t && <BarList color="#EF4444" items={t.abandonStages.map(c => ({
              key: c.key, label: ABANDON_STAGE_LABEL[c.key]?.label ?? c.key, value: c.count, hint: ABANDON_STAGE_LABEL[c.key]?.hint,
            }))} />}
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="¿Cómo terminaron?" subtitle="Motivo de cierre de los abandonados" loading={loading} error={err}
            empty={!t || t.abandonReasons.length === 0} emptyText="Ningún recorrido abandonado">
            {t && <BarList color="#F59E0B" items={t.abandonReasons.map(c => ({
              key: c.key, label: END_REASON_LABEL[c.key] ?? c.key, value: c.count,
            }))} />}
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="¿Dónde estaban al empezar?" subtitle="Según el GPS al elegir el destino" loading={loading} error={err} empty={noTrips}>
            {t && <BarList color="#6366F1" items={t.startModes.map(c => ({
              key: c.key, label: START_MODE_LABEL[c.key] ?? c.key, value: c.count,
            }))} />}
          </ChartCard>
        </Grid>
      </Grid>

      {/* ── Detalle ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography component="h2" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>Todos los recorridos</Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Detalle de cada recorrido del periodo, del más reciente al más antiguo.</Typography>
        </Box>
        <Button size="small" variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={exportCsv} disabled={exporting}
          sx={{ borderRadius: '8px', textTransform: 'none' }}>
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </Button>
      </Box>
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
          localeText={{ noRowsLabel: 'Sin recorridos en este periodo' }}
          sx={{ border: 'none' }}
        />
      </Box>
    </Box>
  );
}

function destinationItem(d: Destination) {
  return {
    key: `${d.building}|${d.roomName}`,
    label: `${d.roomName}${d.buildingLabel ? ` · ${d.buildingLabel}` : ''}`,
    value: d.total,
    display: `${fmtNumber(d.total)} · ${fmtPercent(d.completionRate)} llegan`,
    hint: `Tiempo típico: ${fmtDurationLong(d.medianDurationMs)} · distancia media ${fmtMetersLong(d.avgRouteM)}`,
  };
}

function RoutesTable({ routes }: { routes: TripAnalytics['routes'] }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? routes : routes.slice(0, 8);
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label="Rutas más frecuentes">
        <TableHead>
          <TableRow>
            <TableCell>Ruta</TableCell>
            <TableCell align="right">Recorridos</TableCell>
            <TableCell align="right">Llegaron</TableCell>
            <TableCell align="right">Tiempo típico</TableCell>
            <TableCell align="right">Distancia media</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(r => (
            <TableRow key={`${r.origin}|${r.building}|${r.destination}`} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip size="small" label={r.origin} sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 600 }} />
                  <EastRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} aria-label="hacia" />
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{r.destination}</Typography>
                  {r.building && <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{r.building}</Typography>}
                </Box>
              </TableCell>
              <TableCell align="right">{fmtNumber(r.total)}</TableCell>
              <TableCell align="right">{fmtPercent(r.total ? r.arrived / r.total : null)}</TableCell>
              <TableCell align="right">{fmtDurationLong(r.medianDurationMs)}</TableCell>
              <TableCell align="right">{fmtMetersLong(r.avgRouteM)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {routes.length > 8 && (
        <Button size="small" onClick={() => setShowAll(v => !v)} sx={{ mt: 1 }}>
          {showAll ? 'Ver menos' : `Ver las ${routes.length} rutas`}
        </Button>
      )}
    </Box>
  );
}

