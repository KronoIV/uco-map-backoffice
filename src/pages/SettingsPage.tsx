import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Paper, Typography, TextField, Alert, Skeleton, Divider, Chip,
  Switch, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Tooltip, IconButton, Snackbar,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { useForm, Controller } from 'react-hook-form';
import PageHeader from '../components/PageHeader';
import { buildingService } from '../services/buildingService';
import { useSettings, useUpdateSetting, useCreateSetting, useDeleteSetting } from '../hooks/useSettings';
import { resolveApiError } from '../services/api';
import type { MapConfig, AppSetting, SettingType } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SETTING_TYPE_LABELS: Record<SettingType, string> = {
  BOOLEAN: 'Booleano',
  STRING:  'Texto',
  NUMBER:  'Número',
  JSON:    'JSON',
};

const CATEGORY_COLORS: Record<string, string> = {
  navigation: '#E3F2FD',
  ui:         '#F3E5F5',
  features:   '#E8F5E9',
  timing:     '#FFF3E0',
};

function CategoryChip({ category }: { category?: string }) {
  if (!category) return null;
  return (
    <Chip
      label={category}
      size="small"
      sx={{
        bgcolor: CATEGORY_COLORS[category] ?? '#F5F5F5',
        color: '#374151',
        fontSize: '0.7rem',
        fontWeight: 600,
        height: 22,
        borderRadius: '8px',
      }}
    />
  );
}

interface SettingFormValues {
  key: string;
  value: string;
  type: SettingType;
  description: string;
  category: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient();

  // ── Feature Flags ─────────────────────────────────────────────────────────
  const { data: settings = [], isLoading: settingsLoading } = useSettings();
  const updateSetting = useUpdateSetting();
  const createSetting = useCreateSetting();
  const deleteSetting = useDeleteSetting();

  const [editSetting, setEditSetting] = useState<AppSetting | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const settingForm = useForm<SettingFormValues>({
    defaultValues: { key: '', value: '', type: 'BOOLEAN', description: '', category: 'navigation' },
  });

  function openEdit(s: AppSetting) {
    settingForm.reset({
      key: s.key,
      value: s.value,
      type: s.type,
      description: s.description ?? '',
      category: s.category ?? '',
    });
    setEditSetting(s);
  }

  function openCreate() {
    settingForm.reset({ key: '', value: '', type: 'BOOLEAN', description: '', category: 'navigation' });
    setCreateOpen(true);
  }

  function handleBooleanToggle(setting: AppSetting, checked: boolean) {
    updateSetting.mutate(
      { key: setting.key, data: { value: String(checked), type: setting.type, description: setting.description, category: setting.category } },
      {
        onSuccess: () => setSnackbar(`"${setting.key}" actualizado`),
        onError: (err) => setSnackbar(resolveApiError(err)),
      }
    );
  }

  function handleSaveEdit(values: SettingFormValues) {
    if (!editSetting) return;
    updateSetting.mutate(
      { key: editSetting.key, data: { value: values.value, type: values.type, description: values.description, category: values.category } },
      {
        onSuccess: () => { setEditSetting(null); setSnackbar('Parámetro actualizado'); },
        onError: (err) => setSnackbar(resolveApiError(err)),
      }
    );
  }

  function handleCreate(values: SettingFormValues) {
    createSetting.mutate(
      { key: values.key, value: values.value, type: values.type, description: values.description, category: values.category },
      {
        onSuccess: () => { setCreateOpen(false); setSnackbar('Parámetro creado'); },
        onError: (err) => setSnackbar(resolveApiError(err)),
      }
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteSetting.mutate(deleteTarget, {
      onSuccess: () => { setDeleteTarget(null); setSnackbar('Parámetro eliminado'); },
      onError: (err) => setSnackbar(resolveApiError(err)),
    });
  }

  // ── MapConfig ─────────────────────────────────────────────────────────────
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['mapConfig'],
    queryFn: () => buildingService.getMapConfig(),
    retry: false,
  });

  const { control, handleSubmit, formState: { errors } } = useForm<{ zoomThreshold: number }>({
    defaultValues: { zoomThreshold: config?.zoomThreshold ?? 18 },
    values: { zoomThreshold: config?.zoomThreshold ?? 18 },
  });

  const updateConfig = useMutation({
    mutationFn: (data: Partial<MapConfig>) => buildingService.updateMapConfig(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mapConfig'] }),
    onError: (err) => setSnackbar(resolveApiError(err)),
  });

  const onSubmitConfig = (data: { zoomThreshold: number }) => {
    updateConfig.mutate({ ...config, zoomThreshold: Number(data.zoomThreshold) });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      <PageHeader
        title="Configuración"
        subtitle="Parámetros de comportamiento de la aplicación y ajustes del sistema"
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={openCreate}
            sx={{ borderRadius: '100px', height: 34, fontSize: '0.8125rem' }}
          >
            Nuevo parámetro
          </Button>
        }
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 820 }}>

        {/* ── Feature Flags ──────────────────────────────────────────────── */}
        <Paper sx={{ borderRadius: '18px', border: '1px solid #F1F1F1', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', p: 3 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
            Parámetros de la aplicación
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Controla el comportamiento de UCO Map sin publicar una nueva versión.
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {settingsLoading ? (
            <Skeleton variant="rounded" height={120} />
          ) : settings.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
              No hay parámetros configurados. Crea el primero con "Nuevo parámetro".
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', bgcolor: '#F8F9FB', borderBottom: '1px solid #F1F1F1' } }}>
                    <TableCell>Clave</TableCell>
                    <TableCell>Valor</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Categoría</TableCell>
                    <TableCell>Descripción</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {settings.map((s) => (
                    <TableRow key={s.key} sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600, color: '#1a1a1a' }}>
                        {s.key}
                      </TableCell>
                      <TableCell>
                        {s.type === 'BOOLEAN' ? (
                          <Switch
                            checked={s.value === 'true'}
                            onChange={(_, checked) => handleBooleanToggle(s, checked)}
                            size="small"
                            color="primary"
                          />
                        ) : (
                          <Typography variant="body2" sx={{ fontFamily: s.type === 'JSON' ? 'monospace' : 'inherit', fontSize: '0.8rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.value}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={SETTING_TYPE_LABELS[s.type]} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                      </TableCell>
                      <TableCell>
                        <CategoryChip category={s.category} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>
                        <Tooltip title={s.description ?? ''} arrow>
                          <Typography variant="body2" sx={{ fontSize: '0.78rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                            {s.description ?? '—'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEdit(s)} sx={{ mr: 0.5 }}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(s.key)}>
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* ── Map Config ─────────────────────────────────────────────────── */}
        <Paper sx={{ borderRadius: '18px', border: '1px solid #F1F1F1', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', p: 3 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
            Configuración del mapa
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Ajusta los parámetros globales del mapa de navegación.
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {configLoading ? (
            <Skeleton variant="rounded" height={80} />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Controller
                name="zoomThreshold"
                control={control}
                rules={{ required: 'Requerido', min: { value: 1, message: 'Min 1' }, max: { value: 22, message: 'Max 22' } }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Umbral de zoom (zoomThreshold)"
                    type="number"
                    helperText={errors.zoomThreshold?.message ?? 'Nivel de zoom al que se cambia la vista del mapa'}
                    error={!!errors.zoomThreshold}
                    inputProps={{ min: 1, max: 22 }}
                  />
                )}
              />

              {config?.mapBounds && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Map Bounds
                  </Typography>
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {config.mapBounds.map((point, i) => (
                      <Chip
                        key={i}
                        label={`[${point[0]?.toFixed(5)}, ${point[1]?.toFixed(5)}]`}
                        size="small"
                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem', bgcolor: '#F3F4F6', color: '#374151' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {updateConfig.isSuccess && (
                <Alert severity="success" sx={{ borderRadius: 2 }}>Configuración guardada exitosamente.</Alert>
              )}

              <Box>
                <Button variant="contained" onClick={handleSubmit(onSubmitConfig)} disabled={updateConfig.isPending}>
                  {updateConfig.isPending ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </Box>
            </Box>
          )}
        </Paper>

        {/* ── System Info ────────────────────────────────────────────────── */}
        <Paper sx={{ borderRadius: '18px', border: '1px solid #F1F1F1', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', p: 3 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>
            Información del sistema
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {[
              { label: 'Backend URL', value: import.meta.env.VITE_BACKEND_URL },
              { label: 'Frontend', value: 'UCO Map Admin v1.0' },
              { label: 'Stack', value: 'React + Vite + MUI + Spring Boot + MongoDB' },
            ].map(item => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{item.label}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>

      {/* ── Edit Setting Dialog ────────────────────────────────────────── */}
      <Dialog open={!!editSetting} onClose={() => setEditSetting(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem' }}>Editar parámetro</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Clave"
            value={editSetting?.key ?? ''}
            disabled
            size="small"
            sx={{ '& .MuiInputBase-root': { fontFamily: 'monospace' } }}
          />
          <Controller
            name="value"
            control={settingForm.control}
            render={({ field }) => (
              <TextField {...field} label="Valor" size="small" />
            )}
          />
          <Controller
            name="type"
            control={settingForm.control}
            render={({ field }) => (
              <FormControl size="small">
                <InputLabel>Tipo</InputLabel>
                <Select {...field} label="Tipo">
                  {(Object.keys(SETTING_TYPE_LABELS) as SettingType[]).map(t => (
                    <MenuItem key={t} value={t}>{SETTING_TYPE_LABELS[t]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
          <Controller
            name="category"
            control={settingForm.control}
            render={({ field }) => (
              <TextField {...field} label="Categoría" size="small" placeholder="navigation, ui, features..." />
            )}
          />
          <Controller
            name="description"
            control={settingForm.control}
            render={({ field }) => (
              <TextField {...field} label="Descripción" size="small" multiline rows={2} />
            )}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditSetting(null)}>Cancelar</Button>
          <Button variant="contained" onClick={settingForm.handleSubmit(handleSaveEdit)} disabled={updateSetting.isPending}>
            {updateSetting.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Create Setting Dialog ──────────────────────────────────────── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem' }}>Nuevo parámetro</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Controller
            name="key"
            control={settingForm.control}
            rules={{
              required: 'La clave es obligatoria',
              pattern: { value: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: 'Solo letras, números y guión bajo' },
            }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Clave"
                size="small"
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? 'ej: enableIndoorARNavigation'}
                sx={{ '& .MuiInputBase-root': { fontFamily: 'monospace' } }}
              />
            )}
          />
          <Controller
            name="value"
            control={settingForm.control}
            rules={{ required: 'El valor es obligatorio' }}
            render={({ field, fieldState }) => (
              <TextField {...field} label="Valor" size="small" error={!!fieldState.error} helperText={fieldState.error?.message} />
            )}
          />
          <Controller
            name="type"
            control={settingForm.control}
            render={({ field }) => (
              <FormControl size="small">
                <InputLabel>Tipo</InputLabel>
                <Select {...field} label="Tipo">
                  {(Object.keys(SETTING_TYPE_LABELS) as SettingType[]).map(t => (
                    <MenuItem key={t} value={t}>{SETTING_TYPE_LABELS[t]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />
          <Controller
            name="category"
            control={settingForm.control}
            render={({ field }) => (
              <TextField {...field} label="Categoría" size="small" placeholder="navigation, ui, features..." />
            )}
          />
          <Controller
            name="description"
            control={settingForm.control}
            render={({ field }) => (
              <TextField {...field} label="Descripción" size="small" multiline rows={2} />
            )}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={settingForm.handleSubmit(handleCreate)} disabled={createSetting.isPending}>
            {createSetting.isPending ? 'Creando...' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation Dialog ─────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem' }}>¿Eliminar parámetro?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Se eliminará permanentemente el parámetro{' '}
            <strong style={{ fontFamily: 'monospace' }}>{deleteTarget}</strong>.
            Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteSetting.isPending}>
            {deleteSetting.isPending ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ──────────────────────────────────────────────────── */}
      <Snackbar
        open={!!snackbar}
        message={snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
