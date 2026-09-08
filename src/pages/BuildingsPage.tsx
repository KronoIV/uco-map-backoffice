import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Typography, Skeleton, Alert,
} from '@mui/material';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import PageHeader from '../components/PageHeader';
import { buildingService } from '../services/buildingService';
import { resolveApiError } from '../services/api';
import type { Building } from '../types';

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['buildings'] });
      onClose();
      reset();
    },
    onError: (err) => setErrorMsg(resolveApiError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Building>) => buildingService.update(building!.buildingId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['buildings'] }); onClose(); },
    onError: (err) => setErrorMsg(resolveApiError(err)),
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

    if (isEdit) {
      updateMutation.mutate(payload);
      return;
    }
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
              <TextField
                {...field}
                label="ID del edificio"
                fullWidth
                disabled={isEdit}
                error={!!errors.buildingId}
                helperText={errors.buildingId?.message}
                placeholder="BIBLIOTECA, BLOQUE_A..."
              />
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
          {errorMsg && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>{errorMsg}</Alert>
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

export default function BuildingsPage() {
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
      <PageHeader
        title="Edificios"
        subtitle="Bloques y edificios del campus UCO"
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => {
              setEditBuilding(null);
              setDialogOpen(true);
            }}
          >
            Nuevo edificio
          </Button>
        }
      />

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
                    <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {b.buildingId}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{b.label}</TableCell>
                    <TableCell>
                      {b.category && (
                        <Chip label={b.category} size="small" sx={{ bgcolor: '#F3F4F6', color: '#374151' }} />
                      )}
                    </TableCell>
                    <TableCell>
                      {b.color && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              bgcolor: b.color,
                              border: '1px solid rgba(0,0,0,0.1)',
                            }}
                          />
                          <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                            {b.color}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                      {b.gps ? `${b.gps.lat.toFixed(5)}, ${b.gps.lng.toFixed(5)}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={b.active ? 'Activo' : 'Inactivo'}
                        size="small"
                        sx={{
                          bgcolor: b.active ? '#D1FAE5' : '#FEE2E2',
                          color: b.active ? '#065F46' : '#991B1B',
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                              onClick={() => {
                                setEditBuilding(b);
                                setDialogOpen(true);
                              }}
                            sx={{ color: 'text.secondary' }}
                          >
                            <EditRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton
                            size="small"
                            onClick={() => setDeleteConfirm(b)}
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
      </Paper>

      <BuildingFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditBuilding(null);
        }}
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
