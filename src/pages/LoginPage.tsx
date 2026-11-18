import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Navigate, Link } from 'react-router-dom';
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
import { useAuth } from '../context/AuthContext';
import { resolveApiError } from '../services/api';

interface FormValues {
    email: string;
    password: string;
}

export default function LoginPage() {
    const { login, user } = useAuth();
    const navigate = useNavigate();

    const [showPassword, setShowPassword] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({ mode: 'onBlur' });

    if (user) return <Navigate to="/" replace />;

    const onSubmit = async ({ email, password }: FormValues) => {
        setServerError(null);
        try {
            await login(email, password);
            navigate('/', { replace: true });
        } catch (err: unknown) {
            setServerError(resolveApiError(err));
        }
    };

    return (
        <AuthShell panelText={<>Gestión centralizada del mapa del campus, sus lugares, eventos y actividad.<br />Accede con tus credenciales de administrador.</>}>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.01em' }}>
                        Iniciar sesión
                    </Typography>
                    <Box sx={{ width: 40, height: 4, bgcolor: brand.yellow, borderRadius: 1, mt: 1.5, mb: 2 }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, fontSize: '0.875rem' }}>
                        Ingresa con tu correo y contraseña de administrador.
                    </Typography>

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
                                })
                            }}
                        />

                        <AuthField
                            id="password"
                            label="Contraseña"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            error={errors.password?.message}
                            labelAction={
                                <Link to="/forgot-password" style={{ fontSize: '0.8125rem', color: brand.greenStrong, fontWeight: 700, textDecoration: 'none' }}>
                                    ¿La olvidaste?
                                </Link>
                            }
                            endAdornment={
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() => setShowPassword(v => !v)}
                                        edge="end"
                                        size="small"
                                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    >
                                        {showPassword
                                            ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} />
                                            : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
                                    </IconButton>
                                </InputAdornment>
                            }
                            inputProps={{
                                ...register('password', {
                                    required: 'La contraseña es obligatoria',
                                    minLength: { value: 4, message: 'Mínimo 4 caracteres' },
                                })
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
                            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
                        </Button>
                    </Box>
        </AuthShell>
    );
}

