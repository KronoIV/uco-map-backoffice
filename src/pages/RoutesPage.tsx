import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, InputAdornment, OutlinedInput, Paper, Table, TableBody,
  TableCell, TableHead, TableRow, Tooltip, Typography, Skeleton, Alert,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AltRouteRoundedIcon from '@mui/icons-material/AltRouteRounded';
import { useForm, Controller } from 'react-hook-form';
import { TextField, MenuItem } from '@mui/material';
import PageHeader from '../components/PageHeader';
import { graphService } from '../services/graphService';
import type { GraphEdge } from '../types';

function EdgeFormDialog({ open, onClose, nodeIds }: { open: boolean; onClose: () => void; nodeIds: string[] }) {
  const qc = useQueryClient();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<{ nodeA: string; nodeB: string }>({
    defaultValues: { nodeA: '', nodeB: '' },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<GraphEdge>) => graphService.createEdge(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['edges'] }); onClose(); reset(); },
  });

  const onSubmit = (data: { nodeA: string; nodeB: string }) => {
    if (data.nodeA === data.nodeB) return;
    createMutation.mutate({ nodeA: data.nodeA, nodeB: data.nodeB, active: true });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Nueva ruta</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Controller
            name="nodeA"
            control={control}
            rules={{ required: 'Requerido' }}
            render={({ field }) => (
              <TextField {...field} label="Nodo origen" select fullWidth error={!!errors.nodeA} helperText={errors.nodeA?.message}>
                {nodeIds.map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}
              </TextField>
            )}
          />
          <Controller
            name="nodeB"
            control={control}
            rules={{ required: 'Requerido' }}
            render={({ field }) => (
              <TextField {...field} label="Nodo destino" select fullWidth error={!!errors.nodeB} helperText={errors.nodeB?.message}>
                {nodeIds.map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}
              </TextField>
            )}
          />
          {createMutation.isError && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>Error al crear la ruta.</Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creando...' : 'Crear ruta'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function RoutesPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<GraphEdge | null>(null);
  const qc = useQueryClient();

  const { data: edges, isLoading: loadingEdges } = useQuery({
    queryKey: ['edges'],
    queryFn: () => graphService.getEdges(),
    retry: false,
  });

  const { data: nodes } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => graphService.getNodes(),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => graphService.deleteEdge(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['edges'] }); setDeleteConfirm(null); },
  });

  const filtered = (edges ?? []).filter(e => {
    const q = search.toLowerCase();
    return !q || e.nodeA.toLowerCase().includes(q) || e.nodeB.toLowerCase().includes(q);
  });

  const nodeIds = (nodes ?? []).map(n => n.nodeId);

  return (
    <Box>
      <PageHeader
        title="Rutas del grafo"
        subtitle="Conexiones entre nodos del campus (aristas del grafo de navegación)"
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setDialogOpen(true)}
          >
            Nueva ruta
          </Button>
        }
      />

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <OutlinedInput
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nodo..."
          startAdornment={
            <InputAdornment position="start">
              <SearchRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            </InputAdornment>
          }
          sx={{ width: 260 }}
        />
      </Box>

      {/* Summary chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Chip
          icon={<AltRouteRoundedIcon sx={{ fontSize: 14 }} />}
          label={`${edges?.length ?? 0} rutas activas`}
          size="small"
          sx={{ bgcolor: '#D1FAE5', color: '#065F46' }}
        />
        <Chip
          label={`${nodes?.length ?? 0} nodos`}
          size="small"
          sx={{ bgcolor: '#DBEAFE', color: '#1E40AF' }}
        />
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
              <TableCell>#</TableCell>
              <TableCell>Nodo A</TableCell>
              <TableCell>Nodo B</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loadingEdges
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" width="80%" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : filtered.map((edge, idx) => (
                  <TableRow key={edge.id} hover>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{idx + 1}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem' }}>
                      {edge.nodeA}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem' }}>
                      {edge.nodeB}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={edge.active ? 'Activo' : 'Inactivo'}
                        size="small"
                        sx={{
                          bgcolor: edge.active ? '#D1FAE5' : '#FEE2E2',
                          color: edge.active ? '#065F46' : '#991B1B',
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Eliminar ruta">
                        <IconButton
                          size="small"
                          onClick={() => setDeleteConfirm(edge)}
                          sx={{ color: '#EF4444' }}
                        >
                          <DeleteRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {!loadingEdges && filtered.length === 0 && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary" variant="body2">No se encontraron rutas.</Typography>
          </Box>
        )}
      </Paper>

      <EdgeFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} nodeIds={nodeIds} />

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar ruta</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Deseas eliminar la ruta entre{' '}
            <strong>{deleteConfirm?.nodeA}</strong> y{' '}
            <strong>{deleteConfirm?.nodeB}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
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
