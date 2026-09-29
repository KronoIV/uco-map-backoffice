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
import { useForm, Controller } from 'react-hook-form';
import PageHeader from '../components/PageHeader';
import { roomService } from '../services/roomService';
import { buildingService } from '../services/buildingService';
import { resolveApiError } from '../services/api';
import type { Room } from '../types';

interface RoomFormData {
  roomId: string;
  name: string;
  category: string;
  stateId: string;
  modelUrl: string;
}

function RoomFormDialog({ open, onClose, room }: {
  open: boolean;
  onClose: () => void;
  room?: Room | null;
}) {
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
    if (isEdit) {
      updateMutation.mutate({ id: room!.roomId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Editar salón' : 'Nuevo salón'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="roomId"
              control={control}
              rules={{ required: 'Requerido' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="ID del salón"
                  fullWidth
                  disabled={isEdit}
                  error={!!errors.roomId}
                  helperText={errors.roomId?.message}
                  placeholder="205, L2, EDC..."
                />
              )}
            />
            <Controller
              name="category"
              control={control}
              rules={{ required: 'Requerido' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Edificio"
                  select
                  fullWidth
                  disabled={loadingBuildings}
                  error={!!errors.category}
                  helperText={errors.category?.message}
                >
                  {buildings.map(b => (
                    <MenuItem key={b.buildingId} value={b.category}>
                      {b.label}
                    </MenuItem>
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
              <TextField
                {...field}
                label="Nombre del salón"
                fullWidth
                error={!!errors.name}
                helperText={errors.name?.message}
                placeholder="Sala de sistemas, Biblioteca..."
              />
            )}
          />

          <Controller
            name="stateId"
            control={control}
            rules={{ required: 'Requerido' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="State ID (clip AR)"
                fullWidth
                error={!!errors.stateId}
                helperText={errors.stateId?.message ?? 'Corresponde al nombre del clip en Zappar'}
                placeholder="room_205, library..."
              />
            )}
          />

          <Controller
            name="modelUrl"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="URL del modelo 3D (opcional)"
                fullWidth
                placeholder="https://..."
              />
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

export default function RoomsPage() {
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
      <PageHeader
        title="Salones"
        subtitle="Gestión de espacios y salones del campus UCO"
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => { setEditRoom(null); setDialogOpen(true); }}
          >
            Nuevo salón
          </Button>
        }
      />

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
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

      <Paper
        sx={{
          borderRadius: '18px',
          border: '1px solid #F1F1F1',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
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
                    <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {room.roomId}
                    </TableCell>
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
                          <IconButton
                            size="small"
                            onClick={() => { setEditRoom(room); setDialogOpen(true); }}
                            sx={{ color: 'text.secondary' }}
                          >
                            <EditRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton
                            size="small"
                            onClick={() => setDeleteConfirm(room)}
                            sx={{ color: '#EF4444' }}
                          >
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
            <Typography color="text.secondary" variant="body2">
              No se encontraron salones con los filtros aplicados.
            </Typography>
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
