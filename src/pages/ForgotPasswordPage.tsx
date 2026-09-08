import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  Typography,
} from '@mui/material';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import logoFull from '../assets/logo-ucoMap.webp';
import logoShield from '../assets/logo-white.webp';
import mascota from '../assets/mascota.webp';
import { authService } from '../services/authService';

interface FormValues {
  email: string;
}

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ mode: 'onBlur' });

  const onSubmit = async ({ email }: FormValues) => {
    try {
      await authService.forgotPassword(email);
    } catch {
      // Intentionally swallowed — always show the same success message
    } finally {
      setSubmitted(true);
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Left decorative panel ── */}
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
          <Box
            component="img"
            src={logoShield}
            alt="UCO Map"
            sx={{ width: 300, height: 'auto', objectFit: 'contain', mb: 2, opacity: 0.95 }}
          />
          <Typography sx={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
            Recupera tu contraseña.<br />
            Te enviaremos instrucciones a tu correo.
          </Typography>
          <Box sx={{ width: 48, height: 3, bgcolor: '#00d084', borderRadius: 2, mt: 3 }} />
        </Box>

        <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', position: 'relative', zIndex: 3 }}>
          Universidad Católica del Oriente
        </Typography>
      </Box>

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

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Recuperar contraseña
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
            Ingresa tu correo y te enviaremos instrucciones para restablecerla.
          </Typography>

          {submitted ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CheckCircleOutlineRoundedIcon sx={{ fontSize: 56, color: '#00d084', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>¡Correo enviado!</Typography>
              <Box sx={{ p: '14px 16px', borderRadius: 2, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0', mb: 3, textAlign: 'left' }}>
                <Typography variant="body2" sx={{ color: '#166534', fontWeight: 500 }}>
                  Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.
                  Revisa también tu carpeta de spam.
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <FormControl fullWidth error={!!errors.email} sx={{ mb: 2.5 }}>
                <InputLabel htmlFor="email" shrink>Correo electrónico</InputLabel>
                <OutlinedInput
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  notched
                  label="Correo electrónico"
                  sx={{ borderRadius: 2 }}
                  startAdornment={
                    <InputAdornment position="start">
                      <MailOutlineRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </InputAdornment>
                  }
                  inputProps={{
                    ...register('email', {
                      required: 'El correo es obligatorio',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Ingresa un correo válido' },
                    }),
                  }}
                />
                {errors.email && <FormHelperText>{errors.email.message}</FormHelperText>}
              </FormControl>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isSubmitting}
                endIcon={isSubmitting
                  ? <CircularProgress size={16} sx={{ color: 'inherit' }} />
                  : <ArrowForwardRoundedIcon />}
                sx={{ height: 46, fontSize: '0.9rem', borderRadius: 2, bgcolor: '#00d084', '&:hover': { bgcolor: '#00b874' } }}
              >
                {isSubmitting ? 'Enviando...' : 'Enviar instrucciones'}
              </Button>
            </Box>
          )}

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
