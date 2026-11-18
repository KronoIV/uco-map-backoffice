import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Typography,
} from '@mui/material';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import AuthShell from '../components/AuthShell';
import AuthField from '../components/AuthField';
import { brand } from '../theme/brand';
import { authService } from '../services/authService';
import { resolveApiError } from '../services/api';

interface FormValues {
  newPassword: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: 'onBlur' });

  const onSubmit = async ({ newPassword }: FormValues) => {
    if (!token) return;
    setServerError(null);
    try {
      await authService.resetPassword(token, newPassword);
      navigate('/login', { state: { passwordReset: true }, replace: true });
    } catch (err: unknown) {
      setServerError(resolveApiError(err));
    }
  };

  if (!token) {
    return (
      <AuthShell panelText="El enlace de restablecimiento es inválido o ha caducado.">
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.01em' }}>
              Enlace no válido
            </Typography>
            <Box sx={{ width: 40, height: 4, bgcolor: brand.yellow, borderRadius: 1, mt: 1.5, mb: 2 }} />
            <Box role="alert" sx={{ p: '12px 14px', borderRadius: '8px', bgcolor: brand.dangerBg, borderLeft: `3px solid ${brand.danger}`, mb: 3 }}>
              <Typography variant="body2" sx={{ color: brand.text2 }}>
                El enlace de restablecimiento es inválido o ha caducado.
              </Typography>
            </Box>
            <Link to="/forgot-password" style={{ fontSize: '0.875rem', color: brand.greenStrong, textDecoration: 'none', fontWeight: 700 }}>
              Solicitar un nuevo enlace →
            </Link>
      </AuthShell>
    );
  }

  const toggle = (shown: boolean, onClick: () => void) => (
    <InputAdornment position="end">
      <IconButton onClick={onClick} edge="end" size="small" aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        {shown ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <AuthShell panelText="Elige una contraseña segura de al menos 8 caracteres.">
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.01em' }}>
            Nueva contraseña
          </Typography>
          <Box sx={{ width: 40, height: 4, bgcolor: brand.yellow, borderRadius: 1, mt: 1.5, mb: 2 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, fontSize: '0.875rem' }}>
            Elige una contraseña segura de al menos 8 caracteres.
          </Typography>

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <AuthField
              id="newPassword"
              label="Nueva contraseña"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              error={errors.newPassword?.message}
              endAdornment={toggle(showPassword, () => setShowPassword(v => !v))}
              inputProps={{
                ...register('newPassword', {
                  required: 'La contraseña es obligatoria',
                  minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                }),
              }}
            />

            <AuthField
              id="confirmPassword"
              label="Confirmar contraseña"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              endAdornment={toggle(showConfirm, () => setShowConfirm(v => !v))}
              inputProps={{
                ...register('confirmPassword', {
                  required: 'Confirma tu contraseña',
                  validate: (v) => v === watch('newPassword') || 'Las contraseñas no coinciden',
                }),
              }}
            />

            {serverError && (
              <Box role="alert" sx={{ mb: 2, p: '10px 14px', borderRadius: '8px', bgcolor: brand.dangerBg, borderLeft: `3px solid ${brand.danger}` }}>
                <Typography variant="body2" sx={{ color: brand.danger }}>
                  {serverError}
                </Typography>
              </Box>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : undefined}
              sx={{ mt: 1, height: 48, fontSize: '0.9375rem', borderRadius: '8px' }}
            >
              {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
            </Button>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Link to="/login" style={{ fontSize: '0.8125rem', color: brand.greenStrong, textDecoration: 'none', fontWeight: 700 }}>
              ← Volver al inicio de sesión
            </Link>
          </Box>
    </AuthShell>
  );
}
