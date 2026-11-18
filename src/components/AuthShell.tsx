import { Box, Typography } from '@mui/material';
import ucoLogo from '../assets/uco-logo.svg';
import mascota from '../assets/mascota.webp';
import { brand } from '../theme/brand';

// Cuadrados redondeados a 45°: el motivo de las portadas del Manual de Identidad UCO
const motif = [
  { size: 340, top: -150, right: -120, bg: 'rgba(255,255,255,0.07)' },
  { size: 190, top: 120, right: -60, border: '2px solid rgba(255,202,0,0.35)' },
  { size: 260, bottom: 140, left: -150, bg: 'rgba(255,255,255,0.05)' },
];

interface AuthShellProps {
  /** Texto bajo el nombre del producto en el panel institucional. */
  panelText: React.ReactNode;
  children: React.ReactNode;
}

/** Marco de las pantallas públicas (ingreso y recuperación): panel institucional + formulario con el logo oficial. */
export default function AuthShell({ panelText, children }: AuthShellProps) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: brand.bg }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '55%',
          maxWidth: 960,
          p: 5,
          position: 'relative',
          overflow: 'hidden',
          color: '#fff',
          background: `linear-gradient(160deg, ${brand.green} 0%, #006b3d 55%, ${brand.greenDark} 100%)`,
        }}
      >
        {motif.map((m, i) => (
          <Box
            key={i}
            aria-hidden
            sx={{
              position: 'absolute',
              width: m.size,
              height: m.size,
              top: m.top,
              right: m.right,
              bottom: m.bottom,
              left: m.left,
              borderRadius: '22%',
              transform: 'rotate(45deg)',
              bgcolor: m.bg,
              border: m.border,
              pointerEvents: 'none',
            }}
          />
        ))}

        <Box sx={{ position: 'relative', zIndex: 1, mt: 6, maxWidth: 420 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.88)' }}>
            Panel de administración
          </Typography>
          <Typography component="p" sx={{ fontSize: '2.75rem', fontWeight: 700, lineHeight: 1.05, mt: 1 }}>
            UCO Map
          </Typography>
          <Box sx={{ width: 56, height: 5, bgcolor: brand.yellow, borderRadius: 2, my: 2.5 }} />
          <Typography sx={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.92)', lineHeight: 1.6 }}>
            {panelText}
          </Typography>
        </Box>

        {/* Mascota grande, anclada abajo a la izquierda y sin recortes arriba: es la protagonista del panel */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            width: '70%',
            aspectRatio: '1',
            left: '18%',
            bottom: '-8%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 45%, transparent 68%)',
            pointerEvents: 'none',
          }}
        />
        <Box
          component="img"
          src={mascota}
          alt=""
          aria-hidden
          sx={{
            position: 'absolute',
            left: '-3%',
            bottom: 0,
            width: '106%',
            maxWidth: 'none',
            maxHeight: '68%',
            objectFit: 'contain',
            objectPosition: 'left bottom',
            pointerEvents: 'none',
            userSelect: 'none',
            filter: 'drop-shadow(0 18px 28px rgba(0, 0, 0, 0.28))',
            animation: 'ucoMascotIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both',
            '@keyframes ucoMascotIn': {
              from: { opacity: 0, transform: 'translateY(16px)' },
              to: { opacity: 1, transform: 'none' },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        />

        <Typography sx={{ position: 'relative', zIndex: 1, fontSize: '0.75rem', fontWeight: 700, color: '#fff', letterSpacing: '0.04em', textShadow: '0 1px 6px rgba(0,0,0,0.45)' }}>
          Universidad Católica de Oriente
        </Typography>
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          bgcolor: brand.bg,
          px: { xs: 2, sm: 6 },
          py: { xs: 3, sm: 4 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Motivo del manual: un solo cuadrado redondeado a 45°, casi imperceptible */}
        <Box aria-hidden sx={{ position: 'absolute', width: 520, height: 520, right: -260, bottom: -260, borderRadius: '22%', transform: 'rotate(45deg)', bgcolor: 'rgba(0,139,80,0.05)', pointerEvents: 'none' }} />

        <Box sx={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3, position: 'relative' }}>
          <Box
            sx={{
              width: '100%',
              maxWidth: 440,
              bgcolor: '#fff',
              borderRadius: '16px',
              border: `1px solid ${brand.border}`,
              boxShadow: '0 1px 2px rgba(30, 31, 28, 0.04), 0 12px 32px rgba(30, 31, 28, 0.06)',
              overflow: 'hidden',
            }}
          >
            {/* Logo oficial centrado sobre blanco (manual, p. 22) */}
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3.5, borderBottom: `1px solid ${brand.border}` }}>
              <Box component="img" src={ucoLogo} alt="Universidad Católica de Oriente" sx={{ height: 56, width: 'auto', display: 'block' }} />
            </Box>
            <Box sx={{ px: { xs: 3, sm: 5 }, pt: 4, pb: { xs: 3, sm: 4.5 } }}>
              {children}
            </Box>
          </Box>
        </Box>

        <Typography sx={{ position: 'relative', fontSize: '0.75rem', color: brand.text3, textAlign: 'center' }}>
          © {new Date().getFullYear()} Universidad Católica de Oriente · UCO Map
        </Typography>
      </Box>
    </Box>
  );
}
