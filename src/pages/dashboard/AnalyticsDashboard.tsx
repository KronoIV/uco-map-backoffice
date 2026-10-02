import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Chip, Grid, LinearProgress, Paper, Tooltip, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import PageHeader from '../../components/PageHeader';
import PeriodFilter from '../../components/analytics/PeriodFilter';
import KpiCard from '../../components/analytics/KpiCard';
import ChartCard, { EmptyState, cardSx } from '../../components/analytics/ChartCard';
import TrendChart from '../../components/analytics/charts/TrendChart';
import BarList from '../../components/analytics/charts/BarList';
import ColumnChart from '../../components/analytics/charts/ColumnChart';
import Donut from '../../components/analytics/charts/Donut';
import StackedBar from '../../components/analytics/charts/StackedBar';
import WeekHourHeatmap, { busiestSlot } from '../../components/analytics/charts/WeekHourHeatmap';
import { usePeriod } from '../../hooks/usePeriod';
import { useSessionStats, useSessionStream } from '../../hooks/useDeviceSessions';
import { analyticsService } from '../../services/analyticsService';
import type { AnalyticsOverview, Count, Metric, PermissionStat } from '../../types/analytics';
import {
  ABANDON_STAGE_LABEL, FEATURE_LABEL, PERMISSION_LABEL, PLATFORM_COLOR, PLATFORM_LABEL, PROBLEM_INFO,
  fmtDay, fmtDuration, fmtNumber, fmtPercent,
} from '../../utils/analyticsFormat';

const SECTIONS = [
  ['resumen', 'Resumen'], ['tendencias', 'Tendencias'], ['usuarios', 'Usuarios'], ['recorridos', 'Recorridos'],
  ['dispositivos', 'Dispositivos'], ['funciones', 'Funciones'], ['permisos', 'Permisos'], ['problemas', 'Problemas'],
] as const;

const v = (m?: Metric) => m?.value ?? null;

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <Box component="section" id={id} aria-labelledby={`${id}-title`} sx={{ mb: 4, scrollMarginTop: 80 }}>
      <Typography id={`${id}-title`} component="h2" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{title}</Typography>
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1.5 }}>{description}</Typography>
      {children}
    </Box>
  );
}

export default function AnalyticsDashboard() {
  useSessionStream();
  const period = usePeriod();
  const { data: live } = useSessionStats();

  const overview = useQuery({
    queryKey: ['analytics', 'overview', period.query],
    queryFn: () => analyticsService.getOverview(period.query),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const trips = useQuery({
    queryKey: ['analytics', 'trips', period.query],
    queryFn: () => analyticsService.getTrips(period.query),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const d = overview.data;
  const t = trips.data;
  const loading = overview.isLoading;
  const s = d?.summary;
  const pl = period.previousLabel;
  const sessionsTracked = !!d && d.sessionDurations.count > 0;

  const dayLabels = useMemo(() => (d?.daily ?? []).map(p => fmtDay(p.date)), [d]);
  const insights = useMemo(() => (d ? buildInsights(d, t?.destinations[0]?.roomName) : []), [d, t]);
  const activityParams = new URLSearchParams(window.location.search);
  activityParams.set('tab', 'trips');

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle="Cómo se está usando UCO MAP: personas, visitas, recorridos, dispositivos y permisos"
        action={
          <Tooltip title="Dispositivos con la app abierta en los últimos 10 minutos (en vivo)">
            <Chip
              icon={<Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#00d084', ml: 1 }} />}
              label={`${fmtNumber(live?.activeNow ?? 0)} usando la app ahora`}
              sx={{ bgcolor: '#E6FBF3', color: '#047857', fontWeight: 600 }}
            />
          </Tooltip>
        }
      />

      <PeriodFilter period={period} fetching={overview.isFetching || trips.isFetching} />

      <Box component="nav" aria-label="Secciones del dashboard" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2.5 }}>
        {SECTIONS.map(([id, label]) => (
          <Chip key={id} label={label} component="a" href={`#${id}`} clickable size="small"
                sx={{ bgcolor: '#fff', border: '1px solid #E5E7EB', fontWeight: 500 }} />
        ))}
      </Box>

      {overview.isFetching && !loading && <LinearProgress sx={{ mb: 2, borderRadius: 2 }} aria-label="Actualizando" />}
      {overview.error && <Alert severity="error" sx={{ mb: 2 }}>No se pudo cargar la analítica. Revisa la conexión con el servidor e inténtalo de nuevo.</Alert>}

      {/* ── Resumen ─────────────────────────────── */}
      <Section id="resumen" title="Resumen" description={`${period.label}. Cada cifra se compara con ${pl}.`}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <KpiCard loading={loading} label="Usuarios activos" value={fmtNumber(v(s?.activeUsers))} metric={s?.activeUsers}
              previousLabel={pl} info="Dispositivos distintos que abrieron la app o hicieron un recorrido en el periodo. Un usuario = un navegador."
              sub={s ? `${fmtNumber(v(s.newUsers))} nuevos · ${fmtNumber(v(s.returningUsers))} recurrentes` : undefined} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <KpiCard loading={loading} label="Visitas" value={fmtNumber(v(s?.sessions))} metric={s?.sessions} previousLabel={pl}
              info="Una visita empieza al abrir la app y termina tras 30 minutos sin usarla."
              sub={s?.sessionsPerUser.value != null ? `${fmtNumber(s.sessionsPerUser.value, 1)} visitas por usuario` : 'Se miden desde la versión 2.1'} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <KpiCard loading={loading} label="Tiempo típico por visita" value={fmtDuration(v(s?.medianSessionMs))}
              metric={s?.medianSessionMs} previousLabel={pl}
              info="Mediana del tiempo de uso real (pantalla visible y en uso). La mitad de las visitas duran menos que esto; no la distorsionan unas pocas visitas muy largas."
              sub={s ? `Promedio ${fmtDuration(v(s.avgSessionMs))} · total ${fmtDuration(v(s.totalActiveMs))}` : undefined} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <KpiCard loading={loading} label="Recorridos que llegaron" value={fmtPercent(v(s?.completionRate))}
              metric={s?.completionRate} isRate previousLabel={pl}
              info="De los recorridos terminados, qué parte llegó al destino. Los que siguen en curso no cuentan."
              sub={s ? `${fmtNumber(v(s.arrivedTrips))} de ${fmtNumber((v(s.arrivedTrips) ?? 0) + (v(s.abandonedTrips) ?? 0))} · ${fmtNumber(v(s.trips))} iniciados` : undefined} />
          </Grid>
        </Grid>
        {insights.length > 0 && (
          <Paper sx={{ ...cardSx, mt: 2, p: 2, bgcolor: '#F7FDFB' }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857', mb: 0.5 }}>Lectura rápida</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {insights.map(text => <Typography component="li" key={text} sx={{ fontSize: '0.85rem', mb: 0.25 }}>{text}</Typography>)}
            </Box>
          </Paper>
        )}
      </Section>

      {/* ── Tendencias ──────────────────────────── */}
      <Section id="tendencias" title="Tendencias" description="Cómo evoluciona el uso día a día y en qué momentos de la semana se concentra.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <ChartCard title="Usuarios y visitas por día" subtitle={period.label} loading={loading} error={overview.error}
              info="Usuarios activos: dispositivos distintos ese día. Visitas: aperturas de la app."
              empty={!d || d.daily.every(p => p.activeUsers === 0)}>
              {d && (
                <TrendChart
                  ariaLabel="Usuarios activos y visitas por día"
                  labels={dayLabels}
                  series={[
                    { name: 'Usuarios activos', color: '#00b874', values: d.daily.map(p => p.activeUsers) },
                    { name: 'Visitas', color: '#6366F1', values: d.daily.map(p => p.sessions), dashed: !sessionsTracked },
                    { name: 'Usuarios nuevos', color: '#F59E0B', values: d.daily.map(p => p.newUsers) },
                  ]}
                />
              )}
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 5 }}>
            <ChartCard title="¿Cuándo se usa la app?" subtitle="Visitas por día de la semana y hora" loading={loading} error={overview.error}
              info="Hora local de Colombia. Más oscuro = más visitas iniciadas en esa franja."
              empty={!sessionsTracked} emptyText="Aún no hay visitas medidas en este periodo">
              {d && <WeekHourHeatmap grid={d.sessionsByWeekdayHour} unit="visitas" />}
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <ChartCard title="Recorridos por día" subtitle={`Iniciados y los que llegaron al destino · ${period.label}`}
              loading={loading} error={overview.error} empty={!d || d.daily.every(p => p.trips === 0)} minHeight={160}>
              {d && (
                <TrendChart
                  height={180}
                  ariaLabel="Recorridos iniciados y llegados por día"
                  labels={dayLabels}
                  series={[
                    { name: 'Iniciados', color: '#3B82F6', values: d.daily.map(p => p.trips) },
                    { name: 'Llegaron', color: '#00b874', values: d.daily.map(p => p.arrived) },
                  ]}
                />
              )}
            </ChartCard>
          </Grid>
        </Grid>
      </Section>

      {/* ── Usuarios ────────────────────────────── */}
      <Section id="usuarios" title="Usuarios" description="Quiénes vuelven y cuánto tiempo usan realmente la app.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <ChartCard title="Nuevos y recurrentes" subtitle="Usuarios activos del periodo" loading={loading} error={overview.error}
              info="Nuevo: su primera visita fue en este periodo. Recurrente: ya había usado la app antes."
              empty={!d || d.users.active === 0}>
              {d && (
                <Donut
                  centerValue={fmtNumber(d.users.active)} centerLabel="usuarios activos"
                  segments={[
                    { label: 'Nuevos', value: d.users.newUsers, color: '#F59E0B' },
                    { label: 'Recurrentes', value: d.users.returning, color: '#00b874' },
                  ]}
                />
              )}
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6, lg: 8 }}>
            <ChartCard title="¿Cuánto dura una visita?" subtitle="Tiempo de uso real por visita"
              info="Solo cuenta el tiempo con la app en pantalla y en uso (o navegando). No cuenta el tiempo en segundo plano ni con la pestaña olvidada."
              loading={loading} error={overview.error} empty={!sessionsTracked} emptyText="Aún no hay visitas medidas en este periodo"
              action={d && sessionsTracked ? (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {([['Mediana', d.sessionDurations.medianMs], ['75 %', d.sessionDurations.p75Ms], ['90 %', d.sessionDurations.p90Ms]] as const).map(([l, ms]) => (
                    <Tooltip key={l} arrow title={l === 'Mediana' ? 'La mitad de las visitas duran menos' : `El ${l} de las visitas duran menos`}>
                      <Chip size="small" label={`${l}: ${fmtDuration(ms)}`} sx={{ bgcolor: '#F3F4F6', fontWeight: 600 }} />
                    </Tooltip>
                  ))}
                </Box>
              ) : undefined}>
              {d && (
                <ColumnChart
                  items={d.sessionDurations.histogram.map(b => ({ label: b.label, value: b.count }))}
                  describe={(i, share) => `${i.value.toLocaleString('es-CO')} visitas de ${i.label} (${Math.round(share * 100)} %)`}
                />
              )}
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartCard title="¿Con qué frecuencia vuelven?" subtitle="Visitas de cada usuario en el periodo" loading={loading}
              error={overview.error} empty={!sessionsTracked} emptyText="Aún no hay visitas medidas en este periodo" minHeight={150}>
              {d && (
                <ColumnChart color="#00b874" height={120}
                  items={d.users.sessionsPerUser.map(b => ({ label: b.label, value: b.count }))}
                  describe={(i, share) => `${i.value.toLocaleString('es-CO')} usuarios con ${i.label} (${Math.round(share * 100)} %)`} />
              )}
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartCard title="Tiempo de uso por día" subtitle={`Suma del tiempo real de todas las visitas · ${period.label}`}
              loading={loading} error={overview.error} empty={!sessionsTracked} emptyText="Aún no hay visitas medidas en este periodo" minHeight={150}>
              {d && (
                <TrendChart height={170} ariaLabel="Tiempo de uso por día" labels={dayLabels} format={fmtDuration}
                  series={[{ name: 'Tiempo de uso', color: '#6366F1', values: d.daily.map(p => p.activeMs) }]} />
              )}
            </ChartCard>
          </Grid>
        </Grid>
      </Section>

      {/* ── Recorridos ──────────────────────────── */}
      <Section id="recorridos" title="Recorridos" description="A dónde quieren llegar y en qué punto se rinden.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartCard title="Destinos más buscados" subtitle="Recorridos iniciados por destino" loading={trips.isLoading} error={trips.error}
              empty={!t || t.destinations.length === 0}
              action={<Button component={RouterLink} to={`/sessions?${activityParams}`} size="small" endIcon={<ArrowForwardRoundedIcon />}>Ver análisis</Button>}>
              {t && (
                <BarList
                  items={t.destinations.slice(0, 6).map(dst => ({
                    key: `${dst.building}|${dst.roomName}`,
                    label: `${dst.roomName}${dst.buildingLabel ? ` · ${dst.buildingLabel}` : ''}`,
                    value: dst.total,
                    display: `${fmtNumber(dst.total)} · ${fmtPercent(dst.completionRate)} llegan`,
                    hint: `Tiempo típico hasta llegar: ${fmtDuration(dst.medianDurationMs)}`,
                  }))}
                />
              )}
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartCard title="¿Dónde abandonan?" subtitle="Etapa del recorrido en la que lo dejaron" loading={trips.isLoading} error={trips.error}
              info="Se deduce de lo que alcanzó a hacer el recorrido: si llegó al edificio, si abrió la cámara y si la cámara lo ubicó."
              empty={!t || t.abandonStages.length === 0} emptyText="Ningún recorrido abandonado en este periodo">
              {t && (
                <BarList color="#EF4444"
                  items={t.abandonStages.map(c => ({
                    key: c.key, label: ABANDON_STAGE_LABEL[c.key]?.label ?? c.key, value: c.count,
                    hint: ABANDON_STAGE_LABEL[c.key]?.hint,
                  }))} />
              )}
            </ChartCard>
          </Grid>
        </Grid>
      </Section>

      {/* ── Dispositivos ────────────────────────── */}
      <Section id="dispositivos" title="Dispositivos" description="Con qué teléfonos y navegadores entran (usuarios activos del periodo).">
        <Grid container spacing={2}>
          {deviceBreakdowns(d).map(({ title, counts, label, color }) => (
            <Grid key={title} size={{ xs: 12, sm: 6, lg: 3 }}>
              <ChartCard title={title} loading={loading} error={overview.error} empty={!counts || counts.length === 0} minHeight={140}>
                {counts && (
                  <BarList items={counts.slice(0, 6).map(c => ({ key: c.key, label: label(c.key), value: c.count, color: color?.(c.key) }))} />
                )}
              </ChartCard>
            </Grid>
          ))}
        </Grid>
      </Section>

      {/* ── Funciones ───────────────────────────── */}
      <Section id="funciones" title="Funciones" description="Qué partes de la app usan las visitas.">
        <ChartCard title="Funciones más usadas" subtitle="Porcentaje de visitas que usaron cada función" loading={loading}
          error={overview.error} empty={!d || d.features.length === 0}
          emptyText="Aún no hay uso de funciones medido (se registra desde la versión 2.1)" minHeight={140}>
          {d && (
            <Grid container spacing={3}>
              {[d.features.slice(0, Math.ceil(d.features.length / 2)), d.features.slice(Math.ceil(d.features.length / 2))].map((half, i) => (
                <Grid key={i} size={{ xs: 12, md: 6 }}>
                  <BarList max={d.sessionDurations.count} color="#6366F1"
                    items={half.map(f => ({
                      key: f.key, label: FEATURE_LABEL[f.key]?.label ?? f.key, value: f.sessions,
                      display: `${fmtPercent(d.sessionDurations.count ? f.sessions / d.sessionDurations.count : null)} de las visitas · ${fmtNumber(f.users)} usuarios`,
                      hint: FEATURE_LABEL[f.key]?.hint,
                    }))} />
                </Grid>
              ))}
            </Grid>
          )}
        </ChartCard>
      </Section>

      {/* ── Permisos ────────────────────────────── */}
      <Section id="permisos" title="Permisos" description="Si la gente concede lo que la app necesita: cámara, ubicación y movimiento (solo iPhone).">
        <PermissionsBlock overview={d} loading={loading} error={overview.error} dayLabels={dayLabels} periodLabel={period.label} />
      </Section>

      {/* ── Problemas ───────────────────────────── */}
      <Section id="problemas" title="Problemas frecuentes" description="Situaciones que afectan la experiencia, ordenadas por qué tanto ocurren.">
        <ProblemsBlock overview={d} loading={loading} error={overview.error} />
      </Section>
    </Box>
  );
}

// ── Dispositivos ─────────────────────────────────────

function deviceBreakdowns(d?: AnalyticsOverview): {
  title: string; counts?: Count[]; label: (k: string) => string; color?: (k: string) => string | undefined;
}[] {
  return [
    { title: 'Sistema', counts: d?.devices.platforms, label: k => PLATFORM_LABEL[k] ?? k, color: k => PLATFORM_COLOR[k] },
    { title: 'Navegador', counts: d?.devices.browsers, label: k => k },
    { title: 'Versión del sistema', counts: d?.devices.os, label: k => k },
    { title: 'Versión de UCO MAP', counts: d?.devices.appVersions, label: k => (k === 'Sin dato' ? 'Anterior a 2.1 (sin dato)' : `v${k}`) },
  ];
}

// ── Permisos ─────────────────────────────────────────

const PERMISSION_SEGMENTS: { key: keyof PermissionStat; label: string; color: string }[] = [
  { key: 'granted', label: 'Concedido', color: '#00b874' },
  { key: 'notRequired', label: 'No lo pide (Android)', color: '#A7F3D0' },
  { key: 'pending', label: 'Sin responder', color: '#D1D5DB' },
  { key: 'denied', label: 'Rechazado', color: '#F59E0B' },
  { key: 'blocked', label: 'Bloqueado', color: '#EF4444' },
  { key: 'unavailable', label: 'No disponible', color: '#9CA3AF' },
];

function PermissionsBlock({ overview: d, loading, error, dayLabels, periodLabel }: {
  overview?: AnalyticsOverview; loading: boolean; error: unknown; dayLabels: string[]; periodLabel: string;
}) {
  const p = d?.permissions;
  const empty = !p || p.usersWithData === 0;
  const emptyText = 'Aún no hay datos de permisos en este periodo (se registran desde la versión 2.1)';
  const ofThree = Object.fromEntries((p?.grantedOfThree ?? []).map(c => [c.key, c.count]));
  const evolution = (p?.daily ?? []).map(x => ({
    all: x.users ? x.allGranted / x.users : 0,
    camera: x.users ? x.cameraGranted / x.users : 0,
    location: x.users ? x.locationGranted / x.users : 0,
  }));

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 5 }}>
        <ChartCard title="Usuarios con todo lo necesario" subtitle="Cuántos de los 3 permisos concedió cada usuario"
          info="Último estado de cada usuario en el periodo. En Android el movimiento no requiere permiso y cuenta como concedido."
          loading={loading} error={error} empty={empty} emptyText={emptyText}>
          {p && (
            <Donut
              centerValue={fmtPercent(p.usersWithData ? (ofThree['3'] ?? 0) / p.usersWithData : null)}
              centerLabel="con los 3 permisos"
              segments={[
                { label: 'Los 3 permisos', value: ofThree['3'] ?? 0, color: '#00b874' },
                { label: '2 permisos', value: ofThree['2'] ?? 0, color: '#FCD34D' },
                { label: '1 permiso', value: ofThree['1'] ?? 0, color: '#F59E0B' },
                { label: 'Ninguno', value: ofThree['0'] ?? 0, color: '#EF4444' },
              ]}
            />
          )}
        </ChartCard>
      </Grid>
      <Grid size={{ xs: 12, md: 7 }}>
        <ChartCard title="Estado de cada permiso" subtitle={`${fmtNumber(p?.usersWithData ?? 0)} usuarios con datos`}
          loading={loading} error={error} empty={empty} emptyText={emptyText}>
          {p && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
              {p.byPermission.map(stat => {
                const required = stat.granted + stat.denied + stat.blocked + stat.pending + stat.unavailable;
                return (
                  <StackedBar
                    key={stat.permission}
                    title={PERMISSION_LABEL[stat.permission]}
                    headline={required ? `${fmtPercent(stat.granted / required)} lo concede` : 'No aplica'}
                    segments={PERMISSION_SEGMENTS.map(s => ({ label: s.label, value: stat[s.key] as number, color: s.color }))}
                  />
                );
              })}
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {PERMISSION_SEGMENTS.map(s => (
                  <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: s.color }} />
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{s.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </ChartCard>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <ChartCard title="Evolución de la aceptación" subtitle={`Porcentaje de usuarios de cada día · ${periodLabel}`}
          info="Usuarios que usaron la app ese día y su estado de permisos en esa visita."
          loading={loading} error={error} empty={empty || (p?.daily ?? []).every(x => x.users === 0)} emptyText={emptyText} minHeight={150}>
          {p && (
            <TrendChart height={180} ariaLabel="Porcentaje de usuarios que conceden los permisos por día" labels={dayLabels}
              format={n => fmtPercent(n)}
              series={[
                { name: 'Con los 3 permisos', color: '#00b874', values: evolution.map(e => e.all) },
                { name: 'Cámara', color: '#6366F1', values: evolution.map(e => e.camera), dashed: true },
                { name: 'Ubicación', color: '#F59E0B', values: evolution.map(e => e.location), dashed: true },
              ]} />
          )}
        </ChartCard>
      </Grid>
    </Grid>
  );
}

// ── Problemas ────────────────────────────────────────

function ProblemsBlock({ overview: d, loading, error }: { overview?: AnalyticsOverview; loading: boolean; error: unknown }) {
  const problems = (d?.problems ?? []).filter(p => p.count > 0);
  return (
    <ChartCard title="Lo que más afecta a los usuarios" subtitle="Ocurrencias sobre el total donde puede pasar"
      loading={loading} error={error} empty={false} minHeight={120}>
      {problems.length === 0 ? (
        <EmptyState icon={<CheckCircleRoundedIcon />} text="No se detectaron problemas en este periodo." />
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {problems.map(p => {
            const info = PROBLEM_INFO[p.code];
            const rate = p.count / p.base;
            const severe = rate >= 0.3;
            const warn = rate >= 0.1;
            return (
              <Box component="li" key={p.code}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: '12px', bgcolor: '#FAFAFA' }}>
                <ReportProblemRoundedIcon sx={{ color: severe ? '#DC2626' : warn ? '#F59E0B' : '#9CA3AF', fontSize: 20 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{info?.label ?? p.code}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{info?.hint}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: severe ? '#DC2626' : warn ? '#B45309' : 'text.primary' }}>
                    {fmtPercent(rate)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                    {fmtNumber(p.count)} de {fmtNumber(p.base)} {info?.baseLabel ?? ''}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </ChartCard>
  );
}



function buildInsights(d: AnalyticsOverview, topDestination?: string): string[] {
  const out: string[] = [];
  const s = d.summary;
  if (s.activeUsers.value) {
    out.push(`${fmtNumber(s.activeUsers.value)} personas usaron UCO MAP; ${fmtPercent(s.returningUsers.value != null ? s.returningUsers.value / s.activeUsers.value : null)} ya la habían usado antes.`);
  }
  const slot = busiestSlot(d.sessionsByWeekdayHour);
  if (slot) out.push(`El momento de más uso es el ${slot.day} entre las ${slot.hour}:00 y las ${slot.hour + 1}:00.`);
  if (s.medianSessionMs.value != null) out.push(`Una visita típica dura ${fmtDuration(s.medianSessionMs.value)} de uso real.`);
  if (s.completionRate.value != null) {
    out.push(`${fmtPercent(s.completionRate.value)} de los recorridos terminados llegan al destino${topDestination ? `; el destino más buscado es ${topDestination}` : ''}.`);
  }
  const worst = d.problems.find(p => p.count > 0 && p.count / p.base >= 0.1);
  if (worst) out.push(`A revisar: ${PROBLEM_INFO[worst.code]?.label.toLowerCase() ?? worst.code} (${fmtPercent(worst.count / worst.base)}).`);
  return out;
}
