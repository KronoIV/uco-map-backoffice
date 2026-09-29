import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logoFull from '../assets/logo-ucoMap.webp';
import logoShield from '../assets/logo-ucoshield.webp';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Divider,
} from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import { useAuth } from '../context/AuthContext';

const SIDEBAR_EXPANDED = 230;
const SIDEBAR_COLLAPSED = 64;

const navItems = [
  { label: 'Dashboard', icon: <DashboardRoundedIcon fontSize="small" />, path: '/' },
  { label: 'Mapa', icon: <MapRoundedIcon fontSize="small" />, path: '/map' },
  { label: 'Navegación', icon: <PlaceRoundedIcon fontSize="small" />, path: '/nodes' },
  { label: 'Campus', icon: <ApartmentRoundedIcon fontSize="small" />, path: '/campus' },
  { label: 'Puntos AR', icon: <ViewInArRoundedIcon fontSize="small" />, path: '/ar-points' },
  { label: 'Sesiones', icon: <InsightsRoundedIcon fontSize="small" />, path: '/sessions' },
  { label: 'Recorridos', icon: <RouteRoundedIcon fontSize="small" />, path: '/trips' },
  { label: 'Usuarios', icon: <PeopleRoundedIcon fontSize="small" />, path: '/users' },
];

const bottomItems = [
  { label: 'Configuración', icon: <SettingsRoundedIcon fontSize="small" />, path: '/settings' },
];

export default function Sidebar() {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const width = expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED;

  const NavItem = ({
    item,
  }: {
    item: { label: string; icon: React.ReactNode; path: string };
  }) => {
    const active = location.pathname === item.path;
    const button = (
      <ListItemButton
        onClick={() => navigate(item.path)}
        sx={{
          mx: '8px',
          borderRadius: '10px',
          mb: '2px',
          py: '8px',
          px: expanded ? '12px' : '10px',
          justifyContent: expanded ? 'flex-start' : 'center',
          bgcolor: active ? 'rgba(0,208,132,0.15)' : 'transparent',
          '&:hover': {
            bgcolor: active ? 'rgba(0,208,132,0.2)' : 'rgba(255,255,255,0.06)',
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 0,
            mr: expanded ? '10px' : 0,
            color: active ? '#00d084' : 'rgba(255,255,255,0.6)',
          }}
        >
          {item.icon}
        </ListItemIcon>
        {expanded && (
          <ListItemText
            primary={item.label}
            slotProps={{
              primary: {
                sx: {
                  fontSize: '0.8125rem',
                  fontWeight: active ? 600 : 400,
                  color: active ? '#00d084' : 'rgba(255,255,255,0.75)',
                },
              },
            }}
          />
        )}
      </ListItemButton>
    );

    return expanded ? (
      button
    ) : (
      <Tooltip title={item.label} placement="right" arrow>
        {button}
      </Tooltip>
    );
  };

  return (
    <Box
      component="aside"
      sx={{
        width,
        minWidth: width,
        height: '100vh',
        bgcolor: '#004628',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        overflow: 'hidden',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Logo area */}
      <Box
        sx={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          px: expanded ? '16px' : 0,
          justifyContent: expanded ? 'space-between' : 'center',
          borderBottom: expanded ? '1px solid rgba(255,255,255,0.07)' : 'none',
        }}
      >
        {expanded ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Box
                component="img"
                src={logoFull}
                alt="UCO Map"
                sx={{ height: 'auto', width: '150px', objectFit: 'contain' }}
              />
            </Box>
            <ListItemButton
              onClick={() => setExpanded(false)}
              sx={{
                p: '4px',
                minWidth: 0,
                borderRadius: '8px',
                color: 'rgba(255,255,255,0.5)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: '#fff' },
                justifyContent: 'center',
                width: 32,
                height: 32,
                flexShrink: 0,
              }}
            >
              <CloseRoundedIcon sx={{ fontSize: 20 }} />
            </ListItemButton>
          </>
        ) : (
          <Box
            component="img"
            src={logoShield}
            alt="UCO Map"
            sx={{ height: 36, width: 36, objectFit: 'contain' }}
          />
        )}
      </Box>

      {/* Toggle button when collapsed */}
      {!expanded && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: '10px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <ListItemButton
            onClick={() => setExpanded(true)}
            sx={{
              p: '6px',
              minWidth: 0,
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.5)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: '#fff' },
              justifyContent: 'center',
              width: 36,
              height: 36,
            }}
          >
            <MenuRoundedIcon sx={{ fontSize: 20 }} />
          </ListItemButton>
        </Box>
      )}

      {/* Nav items */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', pt: '8px' }}>
        <List disablePadding>
          {navItems.map(item => (
            <NavItem key={item.path} item={item} />
          ))}
        </List>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />

      {/* Bottom items */}
      <Box sx={{ pb: '8px', pt: '4px' }}>
        <List disablePadding>
          {bottomItems.map(item => (
            <NavItem key={item.path} item={item} />
          ))}
        </List>

        {/* Logout */}
        {expanded ? (
          <Tooltip title="" placement="right" arrow>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                mx: '8px',
                borderRadius: '10px',
                mb: '2px',
                py: '8px',
                px: '12px',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, mr: '10px', color: 'rgba(255,255,255,0.6)' }}>
                <LogoutRoundedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Cerrar sesión"
                slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: 400, color: 'rgba(255,255,255,0.75)' } } }}
              />
            </ListItemButton>
          </Tooltip>
        ) : (
          <Tooltip title="Cerrar sesión" placement="right" arrow>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                mx: '8px',
                borderRadius: '10px',
                mb: '2px',
                py: '8px',
                px: '10px',
                justifyContent: 'center',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, color: 'rgba(255,255,255,0.6)' }}>
                <LogoutRoundedIcon fontSize="small" />
              </ListItemIcon>
            </ListItemButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}
