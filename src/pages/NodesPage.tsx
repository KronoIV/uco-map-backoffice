import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, InputAdornment, OutlinedInput, Paper, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
  MenuItem, Skeleton, Alert,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AltRouteRoundedIcon from '@mui/icons-material/AltRouteRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import { useForm, Controller } from 'react-hook-form';
import PageHeader from '../components/PageHeader';
import { graphService } from '../services/graphService';
import { resolveApiError } from '../services/api';
import type { GraphNode, GraphEdge, NodeType } from '../types';

const NODE_TYPES: NodeType[] = ['BUILDING', 'ENTRANCE', 'WAYPOINT'];

const typeConfig: Record<NodeType, { label: string; bg: string; color: string }> = {
  BUILDING: { label: 'Edificio', bg: '#FEF3C7', color: '#92400E' },
  ENTRANCE: { label: 'Entrada', bg: '#DBEAFE', color: '#1E40AF' },
  WAYPOINT: { label: 'Waypoint', bg: '#F3F4F6', color: '#374151' },
};

interface NodeFormData {
  nodeId: string;
  label: string;
  nodeType: NodeType;
  lat: number;
  lng: number;
  pixelX: number;
  pixelY: number;
}

function NodeFormDialog({
  open,
  onClose,
  node,
}: {
  open: boolean;
  onClose: () => void;
  node?: GraphNode | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!node;
  const [mutError, setMutError] = useState<string | null>(null);

  const formValues = {
    nodeId: node?.nodeId ?? '',
    label: node?.label ?? '',
    nodeType: node?.nodeType ?? 'WAYPOINT',
    lat: node?.gps?.lat ?? 0,
    lng: node?.gps?.lng ?? 0,
    pixelX: node?.pixel?.x ?? 0,
    pixelY: node?.pixel?.y ?? 0,
  };

  const { control, handleSubmit, reset, formState: { errors } } = useForm<NodeFormData>({
    defaultValues: formValues,
    values: formValues,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<GraphNode>) => graphService.createNode(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nodes'] }); onClose(); reset(); },
    onError: (err) => setMutError(resolveApiError(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GraphNode> }) =>
      graphService.updateNode(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nodes'] }); onClose(); },
    onError: (err) => setMutError(resolveApiError(err)),
  });

  const onSubmit = (formData: NodeFormData) => {
    const payload: Partial<GraphNode> = {
      nodeId: formData.nodeId,
      label: formData.label || undefined,
      nodeType: formData.nodeType,
      gps: { lat: Number(formData.lat), lng: Number(formData.lng) },
      pixel: { x: Number(formData.pixelX), y: Number(formData.pixelY) },
      active: true,
    };
    if (isEdit) {
      updateMutation.mutate({ id: node!.nodeId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Editar nodo' : 'Nuevo nodo'}</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="nodeId"
              control={control}
              rules={{ required: 'Requerido' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="ID del nodo"
                  fullWidth
                  disabled={isEdit}
                  error={!!errors.nodeId}
                  helperText={errors.nodeId?.message}
                  placeholder="EDC, P1, E1..."
                />
              )}
            />
            <Controller
              name="nodeType"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Tipo" select fullWidth>
                  {NODE_TYPES.map(t => (
                    <MenuItem key={t} value={t}>
                      {typeConfig[t].label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Box>

          <Controller
            name="label"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Etiqueta (opcional)" fullWidth placeholder="Bloque EDC, Entrada principal..." />
            )}
          />

          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mt: 0.5 }}>
            COORDENADAS GPS
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="lat"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Latitud" type="number" fullWidth inputProps={{ step: 0.000001 }} />
              )}
            />
            <Controller
              name="lng"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Longitud" type="number" fullWidth inputProps={{ step: 0.000001 }} />
              )}
            />
          </Box>

          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mt: 0.5 }}>
            POSICIÓN PIXEL (render isométrico 500×800)
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="pixelX"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="X" type="number" fullWidth />
              )}
            />
            <Controller
              name="pixelY"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Y" type="number" fullWidth />
              )}
            />
          </Box>

          {mutError && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>{mutError}</Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={pending}>
          {pending ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear nodo'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Edge Form Dialog ────────────────────────────────────────────────────────

function EdgeFormDialog({ open, onClose, nodeIds }: { open: boolean; onClose: () => void; nodeIds: string[] }) {
  const qc = useQueryClient();
  const [createError, setCreateError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<{ nodeA: string; nodeB: string }>({
    defaultValues: { nodeA: '', nodeB: '' },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<GraphEdge>) => graphService.createEdge(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['edges'] }); onClose(); reset(); },
    onError: (err) => setCreateError(resolveApiError(err)),
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
          {createError && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>{createError}</Alert>
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

// ─── Nodes Tab ───────────────────────────────────────────────────────────────

function NodesTab() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editNode, setEditNode] = useState<GraphNode | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<GraphNode | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: nodes, isLoading } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => graphService.getNodes(),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => graphService.deleteNode(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nodes'] }); setDeleteConfirm(null); setDeleteError(null); },
    onError: (err) => setDeleteError(resolveApiError(err)),
  });

  const filtered = (nodes ?? []).filter(n => {
    const q = search.toLowerCase();
    const matchSearch = !q || n.nodeId.toLowerCase().includes(q) || (n.label ?? '').toLowerCase().includes(q);
    const matchType = !typeFilter || n.nodeType === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <Box>
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <OutlinedInput
            size="small"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ID o etiqueta..."
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
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            SelectProps={{ displayEmpty: true }}
            sx={{
              minWidth: 150,
              '& .MuiOutlinedInput-root': { borderRadius: '100px' },
            }}
          >
            <MenuItem value="">Todos los tipos</MenuItem>
            {NODE_TYPES.map(t => (
              <MenuItem key={t} value={t}>
                {typeConfig[t].label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => { setEditNode(null); setDialogOpen(true); }}
        >
          Nuevo nodo
        </Button>
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
              <TableCell>Etiqueta</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Latitud</TableCell>
              <TableCell>Longitud</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton variant="text" width="80%" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : filtered.map(node => {
                  const tc = typeConfig[node.nodeType] ?? { label: node.nodeType, bg: '#F3F4F6', color: '#374151' };
                  return (
                    <TableRow key={node.nodeId} hover>
                      <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {node.nodeId}
                      </TableCell>
                      <TableCell>{node.label ?? <Typography variant="caption" color="text.secondary">—</Typography>}</TableCell>
                      <TableCell>
                        <Chip label={tc.label} size="small" sx={{ bgcolor: tc.bg, color: tc.color }} />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {node.gps?.lat?.toFixed(6) ?? '—'}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {node.gps?.lng?.toFixed(6) ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={node.active ? 'Activo' : 'Inactivo'}
                          size="small"
                          sx={{
                            bgcolor: node.active ? '#D1FAE5' : '#FEE2E2',
                            color: node.active ? '#065F46' : '#991B1B',
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              onClick={() => { setEditNode(node); setDialogOpen(true); }}
                              sx={{ color: 'text.secondary' }}
                            >
                              <EditRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton
                              size="small"
                              onClick={() => setDeleteConfirm(node)}
                              sx={{ color: '#EF4444' }}
                            >
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

        {!isLoading && filtered.length === 0 && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary" variant="body2">
              No se encontraron nodos con los filtros aplicados.
            </Typography>
          </Box>
        )}
      </Paper>

      <NodeFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        node={editNode}
      />

      <Dialog open={!!deleteConfirm} onClose={() => { setDeleteConfirm(null); setDeleteError(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar nodo</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Estás seguro de que deseas desactivar el nodo{' '}
            <strong>{deleteConfirm?.nodeId}</strong>? Esta acción puede afectar las rutas.
          </Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 1.5, borderRadius: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteMutation.mutate(deleteConfirm!.nodeId)}
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

// ─── Routes Tab ──────────────────────────────────────────────────────────────

function RoutesTab() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<GraphEdge | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['edges'] }); setDeleteConfirm(null); setDeleteError(null); },
    onError: (err) => setDeleteError(resolveApiError(err)),
  });

  const filtered = (edges ?? []).filter(e => {
    const q = search.toLowerCase();
    return !q || e.nodeA.toLowerCase().includes(q) || e.nodeB.toLowerCase().includes(q);
  });

  const nodeIds = (nodes ?? []).map(n => n.nodeId);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
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
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Nueva ruta
        </Button>
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

      <Dialog open={!!deleteConfirm} onClose={() => { setDeleteConfirm(null); setDeleteError(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar ruta</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Deseas eliminar la ruta entre{' '}
            <strong>{deleteConfirm?.nodeA}</strong> y{' '}
            <strong>{deleteConfirm?.nodeB}</strong>?
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function NodesPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <PageHeader
        title="Grafo de navegación"
        subtitle="Gestión de nodos y rutas del campus"
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
          { label: 'Nodos', icon: <PlaceRoundedIcon sx={{ fontSize: 18 }} /> },
          { label: 'Rutas', icon: <AltRouteRoundedIcon sx={{ fontSize: 18 }} /> },
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

      {tab === 0 && <NodesTab />}
      {tab === 1 && <RoutesTab />}
    </Box>
  );
}
