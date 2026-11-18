import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
} from '@mui/material';
import AuthShell from '../components/AuthShell';
import AuthField from '../components/AuthField';
import { brand } from '../theme/brand';
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
    <AuthShell panelText={<>Recupera tu contraseña.<br />Te enviaremos instrucciones a tu correo.</>}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.01em' }}>
            Recuperar contraseña
          </Typography>
          <Box sx={{ width: 40, height: 4, bgcolor: brand.yellow, borderRadius: 1, mt: 1.5, mb: 2 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, fontSize: '0.875rem' }}>
            Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva.
          </Typography>

          {submitted ? (
            <Box role="status" sx={{ p: '14px 16px', borderRadius: '8px', bgcolor: brand.green50, borderLeft: `3px solid ${brand.green}`, mb: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: brand.greenDark, mb: 0.5 }}>Revisa tu correo</Typography>
              <Typography variant="body2" sx={{ color: brand.text2 }}>
                Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.
                Revisa también tu carpeta de spam.
              </Typography>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <AuthField
                id="email"
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="nombre@ejemplo.com"
                error={errors.email?.message}
                inputProps={{
                  ...register('email', {
                    required: 'El correo es obligatorio',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Ingresa un correo válido' },
                  }),
                }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : undefined}
                sx={{ mt: 1, height: 48, fontSize: '0.9375rem', borderRadius: '8px' }}
              >
                {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
              </Button>
            </Box>
          )}

          <Box sx={{ mt: 3 }}>
            <Link to="/login" style={{ fontSize: '0.8125rem', color: brand.greenStrong, textDecoration: 'none', fontWeight: 700 }}>
              ← Volver al inicio de sesión
            </Link>
          </Box>
    </AuthShell>
  );
}
