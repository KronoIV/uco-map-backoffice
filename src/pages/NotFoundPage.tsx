import { Link } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import logoFull from '../assets/logo-ucoMap.webp';
import { useAuth } from '../context/AuthContext';

export default function NotFoundPage() {
  const { user } = useAuth();
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#f8f9fb',
        p: 3,
        textAlign: 'center',
      }}
    >
      <Box component="img" src={logoFull} alt="UCO Map" sx={{ width: 220, mb: 5, opacity: 0.9 }} />

      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          bgcolor: 'rgba(0,208,132,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
        }}
      >
        <SearchOffRoundedIcon sx={{ fontSize: 40, color: '#00d084' }} />
      </Box>

      <Typography
        variant="h1"
        sx={{ fontSize: '5rem', fontWeight: 800, color: '#004628', lineHeight: 1, mb: 1 }}
      >
        404
      </Typography>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Página no encontrada
      </Typography>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, maxWidth: 360 }}>
        La dirección que ingresaste no existe o fue movida.
        Verifica el enlace o regresa al panel principal.
      </Typography>

      {user ? (
        <Button
          component={Link}
          to="/"
          variant="contained"
          sx={{
            height: 44,
            px: 4,
            fontSize: '0.875rem',
            borderRadius: 2,
            bgcolor: '#004628',
            '&:hover': { bgcolor: '#003320' },
          }}
        >
          Ir al panel principal
        </Button>
      ) : (
        <Button
          component={Link}
          to="/login"
          variant="contained"
          sx={{
            height: 44,
            px: 4,
            fontSize: '0.875rem',
            borderRadius: 2,
            bgcolor: '#004628',
            '&:hover': { bgcolor: '#003320' },
          }}
        >
          Ir a inicio de sesión
        </Button>
      )}
    </Box>
  );
}
