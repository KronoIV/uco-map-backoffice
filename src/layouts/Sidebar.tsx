import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ucoLogo from '../assets/uco-logo.svg';
import { brand } from '../theme/brand';
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
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { useAuth } from '../context/AuthContext';

const SIDEBAR_EXPANDED = 236;
const SIDEBAR_COLLAPSED = 64;

const navItems = [
  { label: 'Dashboard', icon: <DashboardRoundedIcon fontSize="small" />, path: '/' },
  { label: 'Mapa', icon: <MapRoundedIcon fontSize="small" />, path: '/map' },
  { label: 'Campus', icon: <ApartmentRoundedIcon fontSize="small" />, path: '/campus' },
  { label: 'Eventos', icon: <EventRoundedIcon fontSize="small" />, path: '/events' },
  { label: 'Actividad', icon: <InsightsRoundedIcon fontSize="small" />, path: '/sessions' },
  { label: 'Usuarios', icon: <PeopleRoundedIcon fontSize="small" />, path: '/users' },
];

const bottomItems = [
  { label: 'Ayuda', icon: <HelpOutlineRoundedIcon fontSize="small" />, path: '/help' },
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
          position: 'relative',
          bgcolor: active ? 'rgba(255,255,255,0.18)' : 'transparent',
          '&:hover': {
            bgcolor: active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)',
          },
          '&::before': active
            ? { content: '""', position: 'absolute', left: 0, top: 8, bottom: 8, width: 4, borderRadius: 2, bgcolor: brand.yellow }
            : undefined,
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 0,
            mr: expanded ? '10px' : 0,
            color: active ? '#fff' : 'rgba(255,255,255,0.8)',
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
                  fontWeight: active ? 700 : 400,
                  color: active ? '#fff' : 'rgba(255,255,255,0.92)',
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
        // Verde institucional; se oscurece apenas hacia abajo para que el texto blanco cumpla contraste AA
        background: `linear-gradient(180deg, ${brand.green} 0%, ${brand.greenStrong} 28%, ${brand.greenHover} 100%)`,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        overflow: 'hidden',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Motivo del manual: cuadrado redondeado a 45° */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute', width: 220, height: 220, bottom: -90, right: -110,
          borderRadius: '48px', transform: 'rotate(45deg)', bgcolor: 'rgba(255,255,255,0.06)', pointerEvents: 'none',
        }}
      />

      {/* Logo institucional sin modificar, sobre recuadro blanco (manual, p. 22), y nombre del producto */}
      {expanded ? (
        <Box sx={{ px: '14px', pt: '14px', pb: '14px', borderBottom: '1px solid rgba(255,255,255,0.16)' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box className="uco-plate" sx={{ height: 52, px: '10px !important', py: '7px !important' }}>
              <img src={ucoLogo} alt="Universidad Católica de Oriente" />
            </Box>
            <Tooltip title="Contraer menú" placement="right" arrow>
              <ListItemButton
                onClick={() => setExpanded(false)}
                aria-label="Contraer menú"
                sx={{
                  p: '4px',
                  m: 0,
                  minWidth: 0,
                  borderRadius: '8px',
                  color: 'rgba(255,255,255,0.85)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' },
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  flexShrink: 0,
                }}
              >
                <CloseRoundedIcon sx={{ fontSize: 18 }} />
              </ListItemButton>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: '12px' }}>
            <Box sx={{ width: 4, height: 28, borderRadius: 2, bgcolor: brand.yellow, flexShrink: 0 }} />
            <Box sx={{ lineHeight: 1.15 }}>
              <Box sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>UCO Map</Box>
              <Box sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.9)' }}>Panel de administración</Box>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 64,
            borderBottom: '1px solid rgba(255,255,255,0.16)',
          }}
        >
          <Tooltip title="Expandir menú" placement="right" arrow>
            <ListItemButton
              onClick={() => setExpanded(true)}
              aria-label="Expandir menú"
              sx={{
                p: '6px',
                m: 0,
                minWidth: 0,
                borderRadius: '8px',
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                justifyContent: 'center',
                width: 36,
                height: 36,
                flexGrow: 0,
              }}
            >
              <MenuRoundedIcon sx={{ fontSize: 20 }} />
            </ListItemButton>
          </Tooltip>
        </Box>
      )}

      {/* Nav items */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', pt: '10px', position: 'relative' }}>
        <List disablePadding>
          {navItems.map(item => (
            <NavItem key={item.path} item={item} />
          ))}
        </List>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.16)' }} />

      {/* Bottom items */}
      <Box sx={{ pb: '8px', pt: '4px', position: 'relative' }}>
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
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, mr: '10px', color: 'rgba(255,255,255,0.8)' }}>
                <LogoutRoundedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Cerrar sesión"
                slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: 400, color: 'rgba(255,255,255,0.92)' } } }}
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
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, color: 'rgba(255,255,255,0.8)' }}>
                <LogoutRoundedIcon fontSize="small" />
              </ListItemIcon>
            </ListItemButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}
