import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  Typography,
} from '@mui/material';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import logoFull from '../assets/logo-ucoMap.webp';
import logoShield from '../assets/logo-white.webp';
import mascota from '../assets/mascota.webp';
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

  const DecorativePanel = ({ subtitle }: { subtitle: string }) => (
    <Box
      sx={{
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '45%',
        bgcolor: '#004628',
        p: 5,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', border: '2px solid rgba(0,208,132,0.4)', top: -110, right: -110 }} />
      <Box sx={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', border: '1.5px solid rgba(0,208,132,0.28)', top: 30, right: -10 }} />
      <Box sx={{ position: 'absolute', width: 70, height: 70, borderRadius: '50%', bgcolor: 'rgba(0,208,132,0.22)', top: 100, right: 120 }} />
      <Box sx={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', border: '2px solid rgba(0,208,132,0.3)', bottom: -70, left: -100 }} />
      <Box sx={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', bgcolor: 'rgba(0,208,132,0.12)', bottom: 70, right: 20 }} />
      <Box sx={{ position: 'absolute', width: 45, height: 45, borderRadius: '50%', bgcolor: 'rgba(0,208,132,0.28)', bottom: 210, left: 35 }} />

      <Box
        component="img"
        src={mascota}
        alt="Mascota UCO"
        sx={{ position: 'absolute', bottom: 0, left: -10, width: 760, objectFit: 'contain', pointerEvents: 'none', userSelect: 'none', filter: 'saturate(1.12) contrast(1.06)' }}
      />
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(to bottom, #004628 25%, rgba(0,70,40,0.75) 55%, transparent 100%)', pointerEvents: 'none', zIndex: 1 }} />
      <Box sx={{ position: 'absolute', top: '28%', left: 0, bottom: 0, width: 140, background: 'linear-gradient(to right, #004628 0%, transparent 100%)', pointerEvents: 'none', zIndex: 1 }} />
      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 260, background: 'linear-gradient(to top, #004628 14%, rgba(0,70,40,0.72) 46%, transparent 100%)', pointerEvents: 'none', zIndex: 1 }} />

      <Box sx={{ textAlign: 'left', mt: 4, position: 'relative', zIndex: 3 }}>
        <br />
        <br />
        <Box component="img" src={logoShield} alt="UCO Map" sx={{ width: 300, height: 'auto', objectFit: 'contain', mb: 2, opacity: 0.95 }} />
        <Typography sx={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
          {subtitle}
        </Typography>
        <Box sx={{ width: 48, height: 3, bgcolor: '#00d084', borderRadius: 2, mt: 3 }} />
      </Box>

      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', position: 'relative', zIndex: 3 }}>
        Universidad Católica del Oriente
      </Typography>
    </Box>
  );

  if (!token) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <DecorativePanel
          subtitle="El enlace de restablecimiento es inválido o ha caducado."
        />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', bgcolor: '#fff', p: { xs: 3, sm: 6 }, position: 'relative', overflow: 'hidden' }}>
          <Box sx={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', bgcolor: 'rgba(0,175,200,0.07)', bottom: -160, right: -110, pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', border: '1.5px solid rgba(0,175,200,0.11)', bottom: -30, right: 70, pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', border: '2px solid rgba(0,208,132,0.09)', top: -100, left: -90, pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', width: 55, height: 55, borderRadius: '50%', bgcolor: 'rgba(0,208,132,0.1)', top: 36, left: 36, pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(0,175,200,0.12)', top: 50, right: 50, pointerEvents: 'none' }} />
          <Box component="img" src={logoFull} alt="UCO Map" sx={{ position: 'absolute', bottom: -14, right: -7, width: 310, objectFit: 'contain', opacity: 0.55, pointerEvents: 'none', userSelect: 'none' }} />

          <Box sx={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <ErrorOutlineRoundedIcon sx={{ fontSize: 56, color: '#DC2626', mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Enlace inválido</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                El enlace de restablecimiento es inválido o ha caducado.
              </Typography>
              <Link to="/forgot-password" style={{ fontSize: '0.875rem', color: '#004628', textDecoration: 'none', fontWeight: 600 }}>
                Solicitar un nuevo enlace →
              </Link>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <DecorativePanel
        subtitle="Elige una contraseña segura de al menos 8 caracteres."
      />

      {/* ── Right form panel ── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: '#fff',
          p: { xs: 3, sm: 6 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', bgcolor: 'rgba(0,175,200,0.07)', bottom: -160, right: -110, pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', border: '1.5px solid rgba(0,175,200,0.11)', bottom: -30, right: 70, pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', border: '2px solid rgba(0,208,132,0.09)', top: -100, left: -90, pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', width: 55, height: 55, borderRadius: '50%', bgcolor: 'rgba(0,208,132,0.1)', top: 36, left: 36, pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(0,175,200,0.12)', top: 50, right: 50, pointerEvents: 'none' }} />
        <Box component="img" src={logoFull} alt="UCO Map" sx={{ position: 'absolute', bottom: -14, right: -7, width: 310, objectFit: 'contain', opacity: 0.55, pointerEvents: 'none', userSelect: 'none' }} />

        <Box sx={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <LockResetRoundedIcon sx={{ fontSize: 22, color: '#00d084' }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Nueva contraseña
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
            Elige una contraseña segura de al menos 8 caracteres.
          </Typography>

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <FormControl fullWidth error={!!errors.newPassword} sx={{ mb: 2.5 }}>
              <InputLabel htmlFor="newPassword" shrink>Nueva contraseña</InputLabel>
              <OutlinedInput
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                autoFocus
                notched
                label="Nueva contraseña"
                sx={{ borderRadius: 2 }}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(v => !v)} edge="end" size="small" tabIndex={-1}>
                      {showPassword
                        ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} />
                        : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </InputAdornment>
                }
                inputProps={{
                  ...register('newPassword', {
                    required: 'La contraseña es obligatoria',
                    minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                  }),
                }}
              />
              {errors.newPassword && <FormHelperText>{errors.newPassword.message}</FormHelperText>}
            </FormControl>

            <FormControl fullWidth error={!!errors.confirmPassword} sx={{ mb: 1 }}>
              <InputLabel htmlFor="confirmPassword" shrink>Confirmar contraseña</InputLabel>
              <OutlinedInput
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                notched
                label="Confirmar contraseña"
                sx={{ borderRadius: 2 }}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirm(v => !v)} edge="end" size="small" tabIndex={-1}>
                      {showConfirm
                        ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} />
                        : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </InputAdornment>
                }
                inputProps={{
                  ...register('confirmPassword', {
                    required: 'Confirma tu contraseña',
                    validate: (v) => v === watch('newPassword') || 'Las contraseñas no coinciden',
                  }),
                }}
              />
              {errors.confirmPassword && <FormHelperText>{errors.confirmPassword.message}</FormHelperText>}
            </FormControl>

            {serverError && (
              <Box sx={{ mt: 1, mb: 1, p: '10px 14px', borderRadius: 2, bgcolor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <Typography variant="body2" sx={{ color: '#DC2626', fontWeight: 500 }}>
                  {serverError}
                </Typography>
              </Box>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isSubmitting}
              endIcon={isSubmitting
                ? <CircularProgress size={16} sx={{ color: 'inherit' }} />
                : <ArrowForwardRoundedIcon />}
              sx={{ mt: 2.5, height: 46, fontSize: '0.9rem', borderRadius: 2, bgcolor: '#00d084', '&:hover': { bgcolor: '#00b874' } }}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar contraseña'}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Link to="/login" style={{ fontSize: '0.85rem', color: '#004628', textDecoration: 'none', fontWeight: 500 }}>
              ← Volver al inicio de sesión
            </Link>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
