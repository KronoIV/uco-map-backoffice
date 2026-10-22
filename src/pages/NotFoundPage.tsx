import { Link } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import logoFull from '../assets/ucomap-logo.svg';
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
      <Box component="img" src={logoFull} alt="UCO Map" sx={{ width: 200, mb: 5 }} />

      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          bgcolor: 'rgba(47,133,90,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
        }}
      >
        <SearchOffRoundedIcon sx={{ fontSize: 40, color: '#2F855A' }} />
      </Box>

      <Typography
        variant="h1"
        sx={{ fontSize: '5rem', fontWeight: 800, color: '#276749', lineHeight: 1, mb: 1 }}
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
            bgcolor: '#2F855A',
            '&:hover': { bgcolor: '#276749' },
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
            bgcolor: '#2F855A',
            '&:hover': { bgcolor: '#276749' },
          }}
        >
          Ir a inicio de sesión
        </Button>
      )}
    </Box>
  );
}
