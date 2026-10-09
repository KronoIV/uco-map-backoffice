import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, Paper, Skeleton, Switch, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import { useForm, useWatch, Controller } from 'react-hook-form';
import PageHeader from '../components/PageHeader';
import { eventService, type CampusEventInput } from '../services/eventService';
import { roomService } from '../services/roomService';
import { graphService } from '../services/graphService';
import { buildingService } from '../services/buildingService';
import { resolveApiError } from '../services/api';
import { poiTypeOf } from '../utils/poi-catalog';
import type { CampusEvent, EventPlaceType } from '../types';

const MAX_DAYS = 90;
const DURATIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 h', minutes: 60 },
  { label: '2 h', minutes: 120 },
];
const switchSx = {
  '& .MuiSwitch-switchBase.Mui-checked': { color: '#00d084' },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#00d084' },
};

// ─── Lugares a los que la app sabe llegar ────────────────────────────────────

interface PlaceOption {
  key: string;
  type: EventPlaceType;
  id: string;
  label: string;
  detail: string;
  group: string;
}

const placeKey = (type: EventPlaceType, id: string) => `${type}:${id}`;

function usePlaces() {
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: () => roomService.getAll() });
  const nodes = useQuery({ queryKey: ['nodes'], queryFn: () => graphService.getNodes() });
  const buildings = useQuery({ queryKey: ['buildings'], queryFn: () => buildingService.getAll() });

  const places = useMemo<PlaceOption[]>(() => {
    const all = buildings.data ?? [];
    const byCategory = (c: string) => all.find(b => b.category === c || b.buildingId === c)?.label ?? c;
    const roomPlaces: PlaceOption[] = (rooms.data ?? []).filter(r => r.active).map(r => ({
      key: placeKey('ROOM', r.roomId), type: 'ROOM', id: r.roomId, label: r.name,
      detail: r.floor != null ? `Piso ${r.floor}` : r.roomId, group: byCategory(r.category),
    }));
    const poiPlaces: PlaceOption[] = (nodes.data ?? [])
      .filter(n => n.nodeType === 'POI' && n.active !== false)
      .map(n => {
        const type = poiTypeOf(n.poiType);
        const building = n.buildingId ? all.find(b => b.buildingId === n.buildingId)?.label : null;
        return {
          key: placeKey('POI', n.nodeId), type: 'POI', id: n.nodeId, label: n.label?.trim() || type.label,
          detail: building ? `${type.label} · ${building}` : `${type.label} · al aire libre`, group: 'Puntos de interés',
        };
      });
    const byText = (a: PlaceOption, b: PlaceOption) =>
      a.group.localeCompare(b.group, 'es') || a.label.localeCompare(b.label, 'es', { numeric: true });
    // Edificios sin salones (coliseo, cancha) también pueden ser el lugar de un evento
    const buildingPlaces: PlaceOption[] = all.filter(b => b.active).map(b => {
      const count = (rooms.data ?? []).filter(r => r.active && (r.category === b.category || r.category === b.buildingId)).length;
      return {
        key: placeKey('BUILDING', b.buildingId), type: 'BUILDING', id: b.buildingId, label: b.label,
        detail: count ? `Todo el edificio · ${count} lugar${count === 1 ? '' : 'es'}` : 'Todo el edificio',
        group: 'Edificios',
      };
    });
    return [...buildingPlaces.sort(byText), ...roomPlaces.sort(byText), ...poiPlaces.sort(byText)];
  }, [rooms.data, nodes.data, buildings.data]);

  return { places, loading: rooms.isLoading || nodes.isLoading || buildings.isLoading };
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
/** Valor de un <input type="datetime-local"> en la hora local del navegador. */
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const dayFmt = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });

function formatSchedule(e: CampusEvent): string {
  const start = new Date(e.startsAt);
  const end = new Date(e.endsAt);
  if (start.toDateString() === end.toDateString()) {
    return `${dayFmt.format(start)} · ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
  }
  return `${dayFmt.format(start)} ${timeFmt.format(start)} → ${dayFmt.format(end)} ${timeFmt.format(end)}`;
}

function statusOf(e: CampusEvent, now: number, placeOk: boolean) {
  if (!e.active) return { label: 'Pausado', bg: '#F3F4F6', color: '#4B5563' };
  if (Date.parse(e.endsAt) <= now) return { label: 'Finalizado', bg: '#F3F4F6', color: '#6B7280' };
  if (!placeOk) return { label: 'Lugar no disponible', bg: '#FEF3C7', color: '#92400E' };
  if (Date.parse(e.startsAt) > now) return { label: 'Programado', bg: '#DBEAFE', color: '#1E40AF' };
  return { label: 'En la app ahora', bg: '#D1FAE5', color: '#065F46' };
}

// ─── Formulario ──────────────────────────────────────────────────────────────

interface EventFormData {
  title: string;
  description: string;
  placeKey: string;
  placeNote: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
}

function initialForm(event: CampusEvent | null): EventFormData {
  if (event) {
    return {
      title: event.title,
      description: event.description ?? '',
      placeKey: placeKey(event.placeType, event.placeId),
      placeNote: event.placeNote ?? '',
      startsAt: toLocalInput(new Date(event.startsAt)),
      endsAt: toLocalInput(new Date(event.endsAt)),
      active: event.active,
    };
  }
  // Por defecto empieza ya y dura dos horas
  const start = new Date();
  start.setSeconds(0, 0);
  return {
    title: '', description: '', placeKey: '', placeNote: '',
    startsAt: toLocalInput(start),
    endsAt: toLocalInput(new Date(start.getTime() + 2 * 3600_000)),
    active: true,
  };
}

function EventFormDialog({ event, initial, onClose }: { event: CampusEvent | null; initial: EventFormData; onClose: () => void }) {
  const qc = useQueryClient();
  const { places, loading } = usePlaces();
  const [mutError, setMutError] = useState<string | null>(null);
  const { control, handleSubmit, setValue, formState: { errors } } = useForm<EventFormData>({ defaultValues: initial });
  const [startsAt, endsAt] = useWatch({ control, name: ['startsAt', 'endsAt'] });
  const durationMin = (Date.parse(endsAt) - Date.parse(startsAt)) / 60_000;
  const setDuration = (minutes: number) => {
    let start = Date.parse(startsAt);
    if (Number.isNaN(start)) {
      start = new Date().setSeconds(0, 0);
      setValue('startsAt', toLocalInput(new Date(start)));
    }
    setValue('endsAt', toLocalInput(new Date(start + minutes * 60_000)), { shouldValidate: true, shouldDirty: true });
  };

  const mutation = useMutation({
    mutationFn: (data: CampusEventInput) => (event ? eventService.update(event.id, data) : eventService.create(data)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); onClose(); },
    onError: err => setMutError(resolveApiError(err)),
  });

  const onSubmit = (form: EventFormData) => {
    const place = places.find(p => p.key === form.placeKey);
    if (!place) return;
    setMutError(null);
    mutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || null,
      placeType: place.type,
      placeId: place.id,
      placeNote: form.placeNote.trim() || null,
      // datetime-local sin zona = hora local del navegador
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      active: form.active,
    });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{event ? 'Editar evento' : 'Nuevo evento'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Controller
            name="title"
            control={control}
            rules={{ required: 'Requerido', validate: v => v.trim().length <= 80 || 'Máximo 80 caracteres' }}
            render={({ field }) => (
              <TextField {...field} label="Nombre del evento" fullWidth autoFocus
                placeholder="Feria de proyectos de grado"
                error={!!errors.title} helperText={errors.title?.message ?? `${field.value.trim().length}/80`} />
            )}
          />
          <Controller
            name="description"
            control={control}
            rules={{ validate: v => v.trim().length <= 280 || 'Máximo 280 caracteres' }}
            render={({ field }) => (
              <TextField {...field} label="Descripción (opcional)" fullWidth multiline minRows={2}
                placeholder="Los estudiantes de último semestre presentan sus proyectos."
                error={!!errors.description}
                helperText={errors.description?.message ?? `${field.value.trim().length}/280 · Se ve en la tarjeta de la app`} />
            )}
          />
          <Controller
            name="placeKey"
            control={control}
            rules={{ validate: v => places.some(p => p.key === v) || (v ? 'Ese lugar ya no existe: elige otro' : 'Elige el lugar') }}
            render={({ field }) => (
              <Autocomplete
                options={places}
                loading={loading}
                groupBy={p => p.group}
                getOptionLabel={p => p.label}
                isOptionEqualToValue={(a, b) => a.key === b.key}
                value={places.find(p => p.key === field.value) ?? null}
                onChange={(_, p) => field.onChange(p?.key ?? '')}
                renderOption={({ key, ...props }, p) => (
                  <Box component="li" key={key} {...props} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start !important' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{p.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{p.detail}</Typography>
                  </Box>
                )}
                renderInput={params => (
                  <TextField {...params} label="Lugar" placeholder="Busca un edificio, salón, oficina o punto de interés"
                    error={!!errors.placeKey}
                    helperText={errors.placeKey?.message ?? 'La app guía hasta aquí con «Cómo llegar». Para un lugar al aire libre, crea un punto de interés en Mapa.'} />
                )}
              />
            )}
          />
          <Controller
            name="placeNote"
            control={control}
            rules={{ validate: v => v.trim().length <= 120 || 'Máximo 120 caracteres' }}
            render={({ field }) => (
              <TextField {...field} label="Indicación extra (opcional)" fullWidth
                placeholder="Segundo piso, junto a la biblioteca"
                error={!!errors.placeNote} helperText={errors.placeNote?.message} />
            )}
          />

          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Horario visible en la app
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: -0.5 }}>
            <Typography variant="body2" color="text.secondary">Duración:</Typography>
            {DURATIONS.map(d => {
              const selected = durationMin === d.minutes;
              return (
                <Chip key={d.minutes} label={d.label} size="small" clickable onClick={() => setDuration(d.minutes)}
                  variant={selected ? 'filled' : 'outlined'}
                  sx={selected ? { bgcolor: '#00d084', color: '#fff', fontWeight: 600, '&:hover': { bgcolor: '#00b574' } } : { fontWeight: 500 }} />
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="startsAt"
              control={control}
              rules={{ required: 'Requerido' }}
              render={({ field }) => (
                <TextField {...field} label="Desde" type="datetime-local" fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={!!errors.startsAt} helperText={errors.startsAt?.message} />
              )}
            />
            <Controller
              name="endsAt"
              control={control}
              rules={{
                required: 'Requerido',
                validate: (v, all) => {
                  const ms = Date.parse(v) - Date.parse(all.startsAt);
                  if (!(ms > 0)) return 'Debe ser después del inicio';
                  return ms <= MAX_DAYS * 86400_000 || `Máximo ${MAX_DAYS} días`;
                },
              }}
              render={({ field }) => (
                <TextField {...field} label="Hasta" type="datetime-local" fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={!!errors.endsAt} helperText={errors.endsAt?.message} />
              )}
            />
          </Box>
          <Controller
            name="active"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={e => field.onChange(e.target.checked)} sx={switchSx} />}
                label={<Typography variant="body2">Publicado (si lo apagas, no se muestra aunque esté en su horario)</Typography>}
              />
            )}
          />
          {mutError && <Alert severity="error" sx={{ borderRadius: 2 }}>{mutError}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : event ? 'Actualizar' : 'Crear evento'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ event: CampusEvent | null; initial: EventFormData } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CampusEvent | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { places } = usePlaces();

  // El estado (programado / en la app / finalizado) avanza con cada recarga
  const { data: events, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventService.getAll(),
    refetchInterval: 60_000,
    retry: false,
  });

  const toggleMutation = useMutation({
    mutationFn: (e: CampusEvent) => eventService.update(e.id, { ...e, active: !e.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => eventService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); setDeleteConfirm(null); setDeleteError(null); },
    onError: err => setDeleteError(resolveApiError(err)),
  });

  const placeOf = (e: CampusEvent) => places.find(p => p.key === placeKey(e.placeType, e.placeId));
  const openForm = (event: CampusEvent | null) => setEditing({ event, initial: initialForm(event) });

  return (
    <Box>
      <PageHeader
        title="Eventos"
        subtitle="Avisos en el inicio de la app con un botón para llegar al lugar"
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openForm(null)}>
            Nuevo evento
          </Button>
        }
      />

      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
        Cada evento aparece en la pantalla de inicio de la app solo dentro de su horario, con «Cómo llegar» hasta su lugar.
        Quien lo cierre no lo vuelve a ver.
      </Alert>

      <Paper sx={{ borderRadius: '18px', border: '1px solid #F1F1F1', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Evento</TableCell>
              <TableCell>Lugar</TableCell>
              <TableCell>Horario</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Publicado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" width="80%" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : (events ?? []).map(e => {
                  const place = placeOf(e);
                  const status = statusOf(e, dataUpdatedAt, !!place || places.length === 0);
                  return (
                    <TableRow key={e.id} hover>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{e.title}</Typography>
                        {e.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                            {e.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <PlaceRoundedIcon sx={{ fontSize: 16, color: place ? '#00b574' : 'text.disabled' }} />
                          <Box>
                            <Typography variant="body2">{place?.label ?? e.placeId}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {[place?.group, e.placeNote].filter(Boolean).join(' · ')}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>{formatSchedule(e)}</TableCell>
                      <TableCell>
                        <Chip label={status.label} size="small" sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600 }} />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={e.active ? 'Pausar' : 'Publicar'}>
                          <Switch size="small" checked={e.active} disabled={toggleMutation.isPending}
                            onChange={() => toggleMutation.mutate(e)} sx={switchSx} />
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => openForm(e)} sx={{ color: 'text.secondary' }}>
                              <EditRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton size="small" onClick={() => setDeleteConfirm(e)} sx={{ color: '#EF4444' }}>
                              <DeleteRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
        {!isLoading && (events ?? []).length === 0 && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary" variant="body2">Aún no hay eventos. Crea el primero con «Nuevo evento».</Typography>
          </Box>
        )}
      </Paper>

      {editing && (
        <EventFormDialog
          key={editing.event?.id ?? 'new'}
          event={editing.event}
          initial={editing.initial}
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog open={!!deleteConfirm} onClose={() => { setDeleteConfirm(null); setDeleteError(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar evento</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Eliminar <strong>{deleteConfirm?.title}</strong>? Desaparece de la app de inmediato.
          </Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 1.5, borderRadius: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => deleteMutation.mutate(deleteConfirm!.id)}
            disabled={deleteMutation.isPending}
            sx={{ background: '#EF4444', '&:hover': { background: '#DC2626' } }}
          >
            {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
