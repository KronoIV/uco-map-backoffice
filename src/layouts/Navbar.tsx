import { useLocation, matchPath } from 'react-router-dom';
import {
  Box,
  Typography,
  InputAdornment,
  OutlinedInput,
  Avatar,
  Breadcrumbs,
  Link,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useAuth } from '../context/AuthContext';

const routeMap: Record<string, string[]> = {
  '/': ['Dashboard'],
  '/map': ['Mapa'],
  '/nodes': ['Navegación'],
  '/nodes/new': ['Navegación', 'Nuevo'],
  '/campus': ['Campus'],
  '/settings': ['Configuración'],
  '/sessions': ['Sesiones'],
  '/users': ['Usuarios'],
};

function useBreadcrumbs() {
  const { pathname } = useLocation();
  for (const [pattern, crumbs] of Object.entries(routeMap)) {
    if (matchPath(pattern, pathname)) return crumbs;
  }
  return ['Admin'];
}

export default function Navbar() {
  const crumbs = useBreadcrumbs();
  const { user } = useAuth();

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'A';

  return (
    <Box
      component="header"
      sx={{
        height: 64,
        px: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: '#fff',
        borderBottom: '1px solid #F1F1F1',
        position: 'sticky',
        top: 0,
        zIndex: 99,
      }}
    >
      {/* Left: breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ fontSize: '0.8125rem' }}>
        <Link
          underline="hover"
          color="text.secondary"
          href="/"
          sx={{ fontSize: '0.8125rem', fontWeight: 500 }}
        >
          UCO Map
        </Link>
        {crumbs.map((crumb, i) =>
          i === crumbs.length - 1 ? (
            <Typography
              key={crumb}
              sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary' }}
            >
              {crumb}
            </Typography>
          ) : (
            <Link
              underline="hover"
              color="text.secondary"
              key={crumb}
              sx={{ fontSize: '0.8125rem' }}
            >
              {crumb}
            </Link>
          )
        )}
      </Breadcrumbs>

      {/* Right: search + avatar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <OutlinedInput
          size="small"
          placeholder="Buscar..."
          startAdornment={
            <InputAdornment position="start">
              <SearchRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            </InputAdornment>
          }
          sx={{ width: 200 }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: '#004628',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.2 }}>
              {user?.role ?? 'Admin'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1 }}>
              {user?.email ?? ''}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
