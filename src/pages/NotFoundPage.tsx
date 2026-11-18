import { Link } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import ucoLogo from '../assets/uco-logo.svg';
import { useAuth } from '../context/AuthContext';
import { brand } from '../theme/brand';

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
        bgcolor: brand.bg,
        p: 3,
        textAlign: 'center',
      }}
    >
      {/* Logo oficial centrado sobre recuadro blanco (manual, p. 22) */}
      <Box className="uco-plate" sx={{ height: 72, px: '18px !important', py: '12px !important', mb: 5 }}>
        <img src={ucoLogo} alt="Universidad Católica de Oriente" />
      </Box>

      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '22px',
          bgcolor: brand.green50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
        }}
      >
        <SearchOffRoundedIcon sx={{ fontSize: 40, color: brand.green }} />
      </Box>

      <Typography
        variant="h1"
        sx={{ fontSize: '5rem', fontWeight: 700, color: brand.green, lineHeight: 1, mb: 1 }}
      >
        404
      </Typography>
      <Box sx={{ width: 48, height: 5, borderRadius: 2, bgcolor: brand.yellow, mb: 2 }} />

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
          }}
        >
          Ir a inicio de sesión
        </Button>
      )}
    </Box>
  );
}
