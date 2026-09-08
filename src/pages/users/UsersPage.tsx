import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  Paper,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Alert,
  IconButton,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import PageHeader from '../../components/PageHeader';
import { useUsers, useCreateUser, useUpdateUser, useSetUserActive } from '../../hooks/useUsers';
import { resolveApiError } from '../../services/api';
import { authService } from '../../services/authService';
import type { AdminUser, CreateUserRequest } from '../../types';

// ── Create user dialog ────────────────────────────────────────
interface CreateFormValues {
  email: string;
  password: string;
}

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createUser = useCreateUser();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues>({ mode: 'onBlur' });

  const handleClose = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = async (values: CreateFormValues) => {
    setServerError(null);
    try {
      await createUser.mutateAsync(values as CreateUserRequest);
      handleClose();
    } catch (err: unknown) {
      setServerError(resolveApiError(err));
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Nuevo usuario</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth error={!!errors.email}>
              <InputLabel htmlFor="new-email" shrink>Correo electrónico</InputLabel>
              <OutlinedInput
                id="new-email"
                type="email"
                notched
                label="Correo electrónico"
                inputProps={{ ...register('email', {
                  required: 'El correo es obligatorio',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo inválido' },
                }) }}
              />
              {errors.email && <FormHelperText>{errors.email.message}</FormHelperText>}
            </FormControl>

            <FormControl fullWidth error={!!errors.password}>
              <InputLabel htmlFor="new-password" shrink>Contraseña</InputLabel>
              <OutlinedInput
                id="new-password"
                type="password"
                notched
                label="Contraseña"
                inputProps={{ ...register('password', {
                  required: 'La contraseña es obligatoria',
                  minLength: { value: 4, message: 'Mínimo 4 caracteres' },
                }) }}
              />
              {errors.password && <FormHelperText>{errors.password.message}</FormHelperText>}
            </FormControl>

            {serverError && <Alert severity="error" sx={{ borderRadius: 2 }}>{serverError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={handleClose} disabled={isSubmitting}>Cancelar</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : undefined}
          >
            {isSubmitting ? 'Creando...' : 'Crear usuario'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ── Edit user dialog ──────────────────────────────────────────
interface EditFormValues {
  email: string;
  password: string;
}

function EditUserDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: AdminUser | null;
}) {
  const updateUser = useUpdateUser();
  const [editError, setEditError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<EditFormValues>({
    values: { email: user?.email ?? '', password: '' },
  });

  const handleClose = () => {
    reset();
    setEditError(null);
    onClose();
  };

  const onSubmit = async (values: EditFormValues) => {
    if (!user) return;
    setEditError(null);
    try {
      await updateUser.mutateAsync({
        id: user.id,
        data: {
          email: values.email !== user.email ? values.email : undefined,
          password: values.password.trim() || undefined,
        },
      });
      handleClose();
    } catch (err: unknown) {
      setEditError(resolveApiError(err));
    }
  };

  const pending = updateUser.isPending;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Editar usuario — {user?.email}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Controller
            name="email"
            control={control}
            rules={{
              required: 'El correo es obligatorio',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo inválido' },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Correo electrónico"
                type="email"
                fullWidth
                error={!!errors.email}
                helperText={errors.email?.message}
              />
            )}
          />
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nueva contraseña"
                type="password"
                fullWidth
                placeholder="Dejar vacío para no cambiar"
                helperText="Mínimo 4 caracteres si se cambia"
              />
            )}
          />
          {editError && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>{editError}</Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose} disabled={pending}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={pending}>
          {pending ? 'Guardando...' : 'Actualizar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Confirm toggle dialog ─────────────────────────────────────
function ConfirmToggleDialog({
  user,
  onClose,
  onConfirm,
  loading,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  if (!user) return null;
  const deactivating = user.active;
  return (
    <Dialog open={!!user} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{deactivating ? 'Desactivar usuario' : 'Reactivar usuario'}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: '0.875rem' }}>
          {deactivating ? (
            <>¿Deseas desactivar a <strong>{user.email}</strong>? El usuario no podrá iniciar sesión.</>
          ) : (
            <>¿Deseas reactivar a <strong>{user.email}</strong>? El usuario podrá volver a iniciar sesión.</>
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
          sx={deactivating ? { bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' } } : {}}
          startIcon={loading ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : undefined}
        >
          {loading
            ? deactivating ? 'Desactivando...' : 'Reactivando...'
            : deactivating ? 'Desactivar' : 'Reactivar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function UsersPage() {
  const { data: users, isLoading } = useUsers();
  const setActive = useSetUserActive();

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [toggleTarget, setToggleTarget] = useState<AdminUser | null>(null);
  const [search, setSearch] = useState('');

  const [resetStatus, setResetStatus] = useState<Record<string, 'loading' | 'done' | 'error'>>({});

  const handleSendReset = async (user: AdminUser) => {
    setResetStatus(prev => ({ ...prev, [user.id]: 'loading' }));
    try {
      await authService.forgotPassword(user.email);
      setResetStatus(prev => ({ ...prev, [user.id]: 'done' }));
    } catch {
      setResetStatus(prev => ({ ...prev, [user.id]: 'error' }));
    } finally {
      setTimeout(() => setResetStatus(prev => { const n = { ...prev }; delete n[user.id]; return n; }), 3000);
    }
  };

  const filtered = (users ?? []).filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleConfirm = async () => {
    if (!toggleTarget) return;
    try {
      await setActive.mutateAsync({ id: toggleTarget.id, active: !toggleTarget.active });
    } finally {
      setToggleTarget(null);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Usuarios"
        subtitle="Administración de cuentas de acceso al panel"
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}>
            Nuevo usuario
          </Button>
        }
      />

      <Box sx={{ mb: 2 }}>
        <OutlinedInput
          size="small"
          placeholder="Buscar por correo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          startAdornment={
            <InputAdornment position="start">
              <SearchRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            </InputAdornment>
          }
          sx={{ width: 280 }}
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
              <TableCell>Correo electrónico</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Creado</TableCell>
              <TableCell>Últ. cambio clave</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="center" sx={{ width: 56 }}>Reset</TableCell>
              <TableCell align="center" sx={{ width: 56 }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" width="80%" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : filtered.map(u => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{u.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={u.role}
                        size="small"
                        sx={{ bgcolor: '#ECFDF5', color: '#065F46', fontWeight: 600, fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString('es-CO', { dateStyle: 'medium' })
                        : '—'}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>
                      {u.passwordChangedAt
                        ? new Date(u.passwordChangedAt).toLocaleDateString('es-CO', { dateStyle: 'medium' })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={u.active ? 'Desactivar usuario' : 'Reactivar usuario'}>
                        <Switch
                          checked={u.active}
                          size="small"
                          onChange={() => setToggleTarget(u)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: '#00d084' },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#00d084' },
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={
                        resetStatus[u.id] === 'done' ? 'Enlace enviado' :
                        resetStatus[u.id] === 'error' ? 'Error al enviar' :
                        'Enviar enlace de restablecimiento'
                      }>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleSendReset(u)}
                            disabled={!!resetStatus[u.id]}
                            sx={{
                              color: resetStatus[u.id] === 'done' ? '#00d084' :
                                     resetStatus[u.id] === 'error' ? '#DC2626' :
                                     'text.secondary',
                            }}
                          >
                            {resetStatus[u.id] === 'loading'
                              ? <CircularProgress size={14} />
                              : resetStatus[u.id] === 'done'
                              ? <CheckRoundedIcon sx={{ fontSize: 16 }} />
                              : <SendRoundedIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => setEditUser(u)}
                          sx={{ color: 'text.secondary' }}
                        >
                          <EditRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </Paper>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <EditUserDialog
        open={!!editUser}
        onClose={() => setEditUser(null)}
        user={editUser}
      />

      <ConfirmToggleDialog
        user={toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleConfirm}
        loading={setActive.isPending}
      />
    </Box>
  );
}
