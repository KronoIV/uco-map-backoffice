import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import {
    Box,
    Button,
    CircularProgress,
    IconButton,
    InputAdornment,
    OutlinedInput,
    Typography,
    FormHelperText,
    FormControl,
    InputLabel,
} from '@mui/material';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import logoFull from '../assets/logo-ucoMap.webp';
import logoShield from '../assets/logo-white.webp';
import mascota from '../assets/mascota.webp';
import { useAuth } from '../context/AuthContext';
import { resolveApiError } from '../services/api';

interface FormValues {
    email: string;
    password: string;
}

export default function LoginPage() {
    const { login, user } = useAuth();
    const navigate = useNavigate();

    if (user) return <Navigate to="/" replace />;

    const [showPassword, setShowPassword] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({ mode: 'onBlur' });

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
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <Box
                sx={{
                    display: { xs: 'none', md: 'flex' },
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    width: '55%',
                    bgcolor: '#004628',
                    p: 5,
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <Box sx={{
                    position: 'absolute', width: 440, height: 440, borderRadius: '50%',
                    border: '2px solid rgba(0,208,132,0.42)', top: -120, right: -120,
                }} />
                <Box sx={{
                    position: 'absolute', width: 270, height: 270, borderRadius: '50%',
                    border: '1.5px solid rgba(0,208,132,0.3)', top: 20, right: -20,
                }} />
                <Box sx={{
                    position: 'absolute', width: 80, height: 80, borderRadius: '50%',
                    bgcolor: 'rgba(0,208,132,0.25)', top: 90, right: 110,
                }} />
                <Box sx={{
                    position: 'absolute', width: 320, height: 320, borderRadius: '50%',
                    border: '2px solid rgba(0,208,132,0.35)', bottom: -80, left: -110,
                }} />
                <Box sx={{
                    position: 'absolute', width: 170, height: 170, borderRadius: '50%',
                    bgcolor: 'rgba(0,208,132,0.14)', bottom: 60, right: 10,
                }} />
                <Box sx={{
                    position: 'absolute', width: 50, height: 50, borderRadius: '50%',
                    bgcolor: 'rgba(0,208,132,0.3)', bottom: 200, left: 30,
                }} />

                <Box
                    component="img"
                    src={mascota}
                    alt="Mascota UCO"
                    sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: -10,
                        width: 940,
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        filter: 'saturate(1.12) contrast(1.06)',
                    }}
                />
                <Box sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
                    background: 'linear-gradient(to bottom, #004628 25%, rgba(0,70,40,0.75) 55%, transparent 100%)',
                    pointerEvents: 'none', zIndex: 1,
                }} />

                <Box sx={{
                    position: 'absolute', top: '28%', left: 0, bottom: 0, width: 140,
                    background: 'linear-gradient(to right, #004628 0%, transparent 100%)',
                    pointerEvents: 'none', zIndex: 1,
                }} />
                <Box sx={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 260,
                    background: 'linear-gradient(to top, #004628 14%, rgba(0,70,40,0.72) 46%, transparent 100%)',
                    pointerEvents: 'none', zIndex: 1,
                }} />

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
                        Gestión centralizada del campus UCO Map.<br />
                        Accede con tus credenciales de administrador.
                    </Typography>

                    <Box sx={{ width: 48, height: 3, bgcolor: '#00d084', borderRadius: 2, mt: 3 }} />
                </Box>

                <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', position: 'relative', zIndex: 3 }}>
                    Universidad Católica del Oriente
                </Typography>
            </Box>

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

                <Box
                    component="img"
                    src={logoFull}
                    alt="UCO Map"
                    sx={{
                        position: 'absolute',
                        bottom: -14,
                        right: -7,
                        width: 310,
                        objectFit: 'contain',
                        opacity: 0.55,
                        pointerEvents: 'none',
                        userSelect: 'none',
                    }}
                />
                <br />
                <br />
                <br />
                <br />
                <Box sx={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>

                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                        Panel de Administración
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
                        Ingresa tus credenciales para continuar
                    </Typography>

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
                                inputProps={{
                                    ...register('email', {
                                        required: 'El correo es obligatorio',
                                        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Ingresa un correo válido' },
                                    })
                                }}
                                sx={{ borderRadius: 2 }}
                            />
                            {errors.email && <FormHelperText>{errors.email.message}</FormHelperText>}
                        </FormControl>

                        {/* Password */}
                        <FormControl fullWidth error={!!errors.password} sx={{ mb: 1 }}>
                            <InputLabel htmlFor="password" shrink>Contraseña</InputLabel>
                            <OutlinedInput
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                notched
                                label="Contraseña"
                                sx={{ borderRadius: 2 }}
                                endAdornment={
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowPassword(v => !v)}
                                            edge="end"
                                            size="small"
                                            tabIndex={-1}
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
                            {errors.password && <FormHelperText>{errors.password.message}</FormHelperText>}
                        </FormControl>

                        {/* Server error */}
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
                            endIcon={
                                isSubmitting
                                    ? <CircularProgress size={16} sx={{ color: 'inherit' }} />
                                    : <ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />
                            }
                            sx={{ mt: 2.5, height: 46, fontSize: '0.9rem', borderRadius: 2 }}
                        >
                            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
                        </Button>
                        <Box sx={{ textAlign: 'center', mt: 2 }}>
                            <Link
                                to="/forgot-password"
                                style={{ fontSize: '0.8rem', color: '#004628', textDecoration: 'none' }}
                            >
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

