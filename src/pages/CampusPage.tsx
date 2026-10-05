import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, InputAdornment, OutlinedInput, Paper, Switch, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
  MenuItem, Skeleton, Alert,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import { useForm, Controller } from 'react-hook-form';
import PageHeader from '../components/PageHeader';
import { buildingService } from '../services/buildingService';
import { roomService } from '../services/roomService';
import { resolveApiError } from '../services/api';
import type { Building, Room } from '../types';

// ─── Building Form Dialog ────────────────────────────────────────────────────

interface BuildingFormData {
  buildingId: string;
  label: string;
  color: string;
  category: string;
  lat: number;
  lng: number;
}

function BuildingFormDialog({ open, onClose, building }: { open: boolean; onClose: () => void; building?: Building | null }) {
  const qc = useQueryClient();
  const isEdit = !!building;
  const [mutError, setMutError] = useState<string | null>(null);

  const formValues = {
    buildingId: building?.buildingId ?? '',
    label: building?.label ?? '',
    color: building?.color ?? '#00d084',
    category: building?.category ?? '',
    lat: building?.gps?.lat ?? 0,
    lng: building?.gps?.lng ?? 0,
  };

  const { control, handleSubmit, reset, formState: { errors } } = useForm<BuildingFormData>({
    defaultValues: formValues,
    values: formValues,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Building>) => buildingService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['buildings'] }); onClose(); reset(); },
    onError: (err) => setMutError(resolveApiError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Building>) => buildingService.update(building!.buildingId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['buildings'] }); onClose(); },
    onError: (err) => setMutError(resolveApiError(err)),
  });

  const onSubmit = (data: BuildingFormData) => {
    const payload: Partial<Building> = {
      buildingId: data.buildingId.trim(),
      label: data.label,
      color: data.color,
      category: data.category,
      gps: { lat: Number(data.lat), lng: Number(data.lng) },
      active: building?.active ?? true,
    };
    if (isEdit) { updateMutation.mutate(payload); return; }
    createMutation.mutate(payload);
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? `Editar edificio — ${building?.buildingId}` : 'Nuevo edificio'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Controller
            name="buildingId"
            control={control}
            rules={{ required: 'Requerido' }}
            render={({ field }) => (
              <TextField {...field} label="ID del edificio" fullWidth disabled={isEdit}
                error={!!errors.buildingId} helperText={errors.buildingId?.message}
                placeholder="BIBLIOTECA, BLOQUE_A..." />
            )}
          />
          <Controller
            name="label"
            control={control}
            rules={{ required: 'Requerido' }}
            render={({ field }) => (
              <TextField {...field} label="Nombre" fullWidth error={!!errors.label} helperText={errors.label?.message} />
            )}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Categoría" fullWidth placeholder="CO, EDC, Otros..." />
              )}
            />
            <Controller
              name="color"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Color (hex)" fullWidth placeholder="#D84315" />
              )}
            />
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Coordenadas GPS
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller name="lat" control={control} render={({ field }) => (
              <TextField {...field} label="Latitud" type="number" fullWidth inputProps={{ step: 0.000001 }} />
            )} />
            <Controller name="lng" control={control} render={({ field }) => (
              <TextField {...field} label="Longitud" type="number" fullWidth inputProps={{ step: 0.000001 }} />
            )} />
          </Box>
          {mutError && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>{mutError}</Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={pending}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={pending}>
          {pending ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear edificio'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Room Form Dialog ────────────────────────────────────────────────────────

interface RoomFormData {
  roomId: string;
  name: string;
  category: string;
  stateId: string;
  modelUrl: string;
}

function RoomFormDialog({ open, onClose, room }: { open: boolean; onClose: () => void; room?: Room | null }) {
  const qc = useQueryClient();
  const isEdit = !!room;
  const [mutError, setMutError] = useState<string | null>(null);

  const { data: buildings = [], isLoading: loadingBuildings } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => buildingService.getAll(),
    enabled: open,
  });

  const formValues = {
    roomId: room?.roomId ?? '',
    name: room?.name ?? '',
    category: room?.category ?? (buildings[0]?.category ?? ''),
    stateId: room?.stateId ?? '',
    modelUrl: room?.modelUrl ?? '',
  };

  const { control, handleSubmit, reset, formState: { errors } } = useForm<RoomFormData>({
    defaultValues: formValues,
    values: formValues,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Room>) => roomService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); onClose(); reset(); },
    onError: (err) => setMutError(resolveApiError(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Room> }) => roomService.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); onClose(); },
    onError: (err) => setMutError(resolveApiError(err)),
  });

  const onSubmit = (formData: RoomFormData) => {
    const payload: Partial<Room> = {
      roomId: formData.roomId,
      name: formData.name,
      category: formData.category,
      stateId: formData.stateId,
      modelUrl: formData.modelUrl || undefined,
      arPosition: room?.arPosition ?? null,
      active: true,
    };
    if (isEdit) { updateMutation.mutate({ id: room!.roomId, data: payload }); }
    else { createMutation.mutate(payload); }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Editar lugar' : 'Nuevo lugar'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="roomId"
              control={control}
              rules={{ required: 'Requerido' }}
              render={({ field }) => (
                <TextField {...field} label="ID del salón" fullWidth disabled={isEdit}
                  error={!!errors.roomId} helperText={errors.roomId?.message}
                  placeholder="205, L2, EDC..." />
              )}
            />
            <Controller
              name="category"
              control={control}
              rules={{ required: 'Requerido' }}
              render={({ field }) => (
                <TextField {...field} label="Edificio" select fullWidth
                  disabled={loadingBuildings} error={!!errors.category} helperText={errors.category?.message}>
                  {buildings.map(b => (
                    <MenuItem key={b.buildingId} value={b.category}>{b.label}</MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Box>
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Requerido' }}
            render={({ field }) => (
              <TextField {...field} label="Nombre del salón" fullWidth
                error={!!errors.name} helperText={errors.name?.message}
                placeholder="Sala de sistemas, Biblioteca..." />
            )}
          />
          <Controller
            name="stateId"
            control={control}
            rules={{ required: 'Requerido' }}
            render={({ field }) => (
              <TextField {...field} label="State ID (clip AR)" fullWidth
                error={!!errors.stateId}
                placeholder="room_205, library..." />
            )}
          />
          {mutError && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>{mutError}</Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={pending}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={pending}>
          {pending ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear salón'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Buildings Tab ───────────────────────────────────────────────────────────

function BuildingsTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBuilding, setEditBuilding] = useState<Building | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Building | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: buildings, isLoading } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => buildingService.getAll(),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => buildingService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['buildings'] }); setDeleteConfirm(null); setDeleteError(null); },
    onError: (err) => setDeleteError(resolveApiError(err)),
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => { setEditBuilding(null); setDialogOpen(true); }}
        >
          Nuevo edificio
        </Button>
      </Box>

      <Paper sx={{ borderRadius: '18px', border: '1px solid #F1F1F1', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Categoría</TableCell>
              <TableCell>Color</TableCell>
              <TableCell>GPS</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" width="80%" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : (buildings ?? []).map(b => (
                  <TableRow key={b.buildingId} hover>
                    <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.75rem' }}>{b.buildingId}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{b.label}</TableCell>
                    <TableCell>
                      {b.category && <Chip label={b.category} size="small" sx={{ bgcolor: '#F3F4F6', color: '#374151' }} />}
                    </TableCell>
                    <TableCell>
                      {b.color && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: b.color, border: '1px solid rgba(0,0,0,0.1)' }} />
                          <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>{b.color}</Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                      {b.gps ? `${b.gps.lat.toFixed(5)}, ${b.gps.lng.toFixed(5)}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={b.active ? 'Activo' : 'Inactivo'} size="small"
                        sx={{ bgcolor: b.active ? '#D1FAE5' : '#FEE2E2', color: b.active ? '#065F46' : '#991B1B' }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => { setEditBuilding(b); setDialogOpen(true); }} sx={{ color: 'text.secondary' }}>
                            <EditRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton size="small" onClick={() => setDeleteConfirm(b)} sx={{ color: '#EF4444' }}>
                            <DeleteRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </Paper>

      <BuildingFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditBuilding(null); }}
        building={editBuilding}
      />

      <Dialog open={!!deleteConfirm} onClose={() => { setDeleteConfirm(null); setDeleteError(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar edificio</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Estás seguro de que deseas eliminar permanentemente{' '}
            <strong>{deleteConfirm?.label}</strong> ({deleteConfirm?.buildingId})?
          </Typography>
          <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 1 }}>
            Esta acción no se puede deshacer.
          </Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 1.5, borderRadius: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => deleteMutation.mutate(deleteConfirm!.buildingId)}
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

// ─── Rooms Tab ───────────────────────────────────────────────────────────────

function RoomsTab() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Room | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomService.getAll(),
    retry: false,
  });

  const { data: buildings = [] } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => buildingService.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => roomService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); setDeleteConfirm(null); setDeleteError(null); },
    onError: (err) => setDeleteError(resolveApiError(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: (room: Room) => roomService.update(room.roomId, { ...room, active: !room.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
  });

  const filtered = (rooms ?? []).filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.roomId.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    const matchCategory = !categoryFilter || r.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <OutlinedInput
            size="small"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ID o nombre..."
            startAdornment={
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </InputAdornment>
            }
            sx={{ width: 260 }}
          />
          <TextField
            select
            size="small"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: '100px' } }}
            slotProps={{ select: { displayEmpty: true } }}
          >
            <MenuItem value="">Todos los edificios</MenuItem>
            {buildings.map(b => (
              <MenuItem key={b.buildingId} value={b.category}>{b.label}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => { setEditRoom(null); setDialogOpen(true); }}
        >
          Nuevo lugar
        </Button>
      </Box>

      <Paper sx={{ borderRadius: '18px', border: '1px solid #F1F1F1', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Edificio</TableCell>
              <TableCell>State ID</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" width="80%" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : filtered.map(room => (
                  <TableRow key={room.roomId} hover>
                    <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.75rem' }}>{room.roomId}</TableCell>
                    <TableCell>{room.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={buildings.find(b => b.category === room.category)?.label ?? room.category}
                        size="small"
                        sx={{ bgcolor: '#F3F4F6', color: '#374151' }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                      {room.stateId}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={room.active ? 'Desactivar' : 'Activar'}>
                        <Switch
                          size="small"
                          checked={room.active}
                          disabled={toggleMutation.isPending}
                          onChange={() => toggleMutation.mutate(room)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: '#00d084' },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#00d084' },
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => { setEditRoom(room); setDialogOpen(true); }} sx={{ color: 'text.secondary' }}>
                            <EditRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton size="small" onClick={() => setDeleteConfirm(room)} sx={{ color: '#EF4444' }}>
                            <DeleteRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {!isLoading && filtered.length === 0 && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary" variant="body2">No se encontraron salones con los filtros aplicados.</Typography>
          </Box>
        )}
      </Paper>

      <RoomFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRoom(null); }}
        room={editRoom}
      />

      <Dialog open={!!deleteConfirm} onClose={() => { setDeleteConfirm(null); setDeleteError(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar salón</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Estás seguro de que deseas eliminar permanentemente{' '}
            <strong>{deleteConfirm?.name}</strong> ({deleteConfirm?.roomId})?
          </Typography>
          <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 1 }}>
            Esta acción no se puede deshacer. El salón será eliminado de la base de datos
            y dejará de estar disponible en la aplicación.
          </Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 1.5, borderRadius: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => deleteMutation.mutate(deleteConfirm!.roomId)}
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CampusPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <PageHeader
        title="Campus"
        subtitle="Gestión de edificios y lugares del campus UCO"
      />

      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          mb: 3,
          p: 0.75,
          bgcolor: '#F3F4F6',
          borderRadius: '14px',
          width: 'fit-content',
        }}
      >
        {[
          { label: 'Edificios', icon: <ApartmentRoundedIcon sx={{ fontSize: 18 }} /> },
          { label: 'Lugares', icon: <MeetingRoomRoundedIcon sx={{ fontSize: 18 }} /> },
        ].map((item, i) => (
          <Box
            key={item.label}
            onClick={() => setTab(i)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2.5,
              py: 1,
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              transition: 'all 0.18s ease',
              bgcolor: tab === i ? '#fff' : 'transparent',
              color: tab === i ? 'text.primary' : 'text.secondary',
              boxShadow: tab === i ? '0 1px 6px rgba(0,0,0,0.10)' : 'none',
              userSelect: 'none',
              '&:hover': {
                color: 'text.primary',
                bgcolor: tab === i ? '#fff' : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            <Box sx={{ color: tab === i ? '#00d084' : 'inherit', display: 'flex' }}>
              {item.icon}
            </Box>
            {item.label}
          </Box>
        ))}
      </Box>

      {tab === 0 && <BuildingsTab />}
      {tab === 1 && <RoomsTab />}
    </Box>
  );
}
