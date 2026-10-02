import {
  Box, Drawer, Typography, IconButton, Chip, Divider, Tooltip,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import type { DeviceSession } from '../../types';
import { PERMISSION_LABEL, fmtDuration } from '../../utils/analyticsFormat';

const ACTIVE_MS = 10 * 60 * 1000; // 10 min
const TODAY_MS = 24 * 60 * 60 * 1000;

const PERMISSION_STATE: Record<string, { label: string; color: string }> = {
  granted: { label: 'Concedido', color: '#047857' },
  'not-required': { label: 'No lo pide', color: '#6B7280' },
  prompt: { label: 'Sin responder', color: '#6B7280' },
  unknown: { label: 'Sin responder', color: '#6B7280' },
  error: { label: 'Sin responder', color: '#6B7280' },
  denied: { label: 'Rechazado', color: '#B45309' },
  blocked: { label: 'Bloqueado', color: '#B91C1C' },
  unavailable: { label: 'No disponible', color: '#6B7280' },
};

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function statusChip(lastSeen: string) {
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (diff < ACTIVE_MS) return { label: 'Activo ahora', bg: '#D1FAE5', color: '#065F46' };
  if (diff < TODAY_MS) return { label: 'Activo hoy', bg: '#DBEAFE', color: '#1E40AF' };
  return { label: 'Inactivo', bg: '#F3F4F6', color: '#6B7280' };
}

function InfoRow({ label, value, mono = false, copyable = false }: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
  copyable?: boolean;
}) {
  const display = value ?? '—';
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        py: '8px',
        borderBottom: '1px solid #F9FAFB',
        gap: 2,
      }}
    >
      <Typography
        sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.8rem',
            fontFamily: mono ? 'monospace' : 'inherit',
            textAlign: 'right',
            wordBreak: 'break-all',
          }}
        >
          {String(display)}
        </Typography>
        {copyable && value && (
          <Tooltip title="Copiar">
            <IconButton
              size="small"
              onClick={() => navigator.clipboard.writeText(String(value))}
              sx={{ p: '2px', color: 'text.secondary' }}
            >
              <ContentCopyRoundedIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

interface Props {
  session: DeviceSession | null;
  onClose: () => void;
}

export default function SessionDetailDrawer({ session, onClose }: Props) {
  if (!session) return null;

  const status = statusChip(session.lastSeen);

  return (
    <Drawer
      anchor="right"
      open={!!session}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 380,
          p: 0,
          borderLeft: '1px solid #F1F1F1',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.06)',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: '1px solid #F1F1F1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: '2px' }}>
            Detalle de sesión
          </Typography>
          <Typography
            sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'text.secondary' }}
          >
            {session.deviceId}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={status.label}
            size="small"
            sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600 }}
          />
          <IconButton size="small" onClick={onClose}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ overflowY: 'auto', px: 3, py: 2 }}>
        {/* Activity summary */}
        <Box
          sx={{
            bgcolor: '#F8F9FB',
            borderRadius: '12px',
            p: 2,
            mb: 2,
            display: 'flex',
            gap: 2,
          }}
        >
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#00d084', lineHeight: 1 }}>
              {session.visitCount ? session.visitCount : '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Visitas
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Tooltip title="Suma del tiempo con la app en pantalla y en uso en todas sus visitas" arrow>
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.2 }}>
                {session.visitCount ? fmtDuration(session.totalActiveMs ?? 0) : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Tiempo de uso
              </Typography>
            </Box>
          </Tooltip>
          <Divider orientation="vertical" flexItem />
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.2 }}>
              {session.sessionCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Pings
            </Typography>
          </Box>
        </Box>
        {!session.visitCount && (
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: -1, mb: 2 }}>
            Este dispositivo solo usó versiones anteriores a la 2.1: no hay visitas ni tiempo de uso medidos.
          </Typography>
        )}

        {session.permissions && (
          <>
            <Typography
              sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}
            >
              Permisos (último estado)
            </Typography>
            {(['camera', 'location', 'motion'] as const).map(k => {
              const state = session.permissions?.[k];
              const info = state ? PERMISSION_STATE[state] : undefined;
              return (
                <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', py: '6px', borderBottom: '1px solid #F9FAFB' }}>
                  <Typography sx={{ fontSize: '0.8rem' }}>{PERMISSION_LABEL[k]}</Typography>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: info?.color ?? 'text.secondary' }}>
                    {info?.label ?? 'Sin dato'}
                  </Typography>
                </Box>
              );
            })}
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* Device info */}
        <Typography
          sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}
        >
          Dispositivo
        </Typography>
        <InfoRow label="Plataforma" value={session.platform} />
        <InfoRow label="Modelo" value={session.deviceModel} />
        <InfoRow label="OS" value={session.osVersion} />
        <InfoRow label="App version" value={session.appVersion} />
        <InfoRow label="Resolución" value={session.screenResolution} />
        <InfoRow label="Red" value={session.networkType} />

        <Divider sx={{ my: 2 }} />

        {/* Connection info */}
        <Typography
          sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}
        >
          Conexión
        </Typography>
        <InfoRow label="IP" value={session.ipAddress} mono copyable />
        <InfoRow label="Idioma" value={session.language} />
        <InfoRow label="Timezone" value={session.timezone} />
        <InfoRow label="Device ID" value={session.deviceId} mono copyable />

        <Divider sx={{ my: 2 }} />

        {/* Timestamps */}
        <Typography
          sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}
        >
          Actividad
        </Typography>
        <InfoRow label="Primera vez" value={fmtDate(session.firstSeen)} />
        <InfoRow label="Último ping" value={fmtDate(session.lastSeen)} />

        <Divider sx={{ my: 2 }} />

        {/* User Agent */}
        <Typography
          sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}
        >
          User Agent
        </Typography>
        <Box
          sx={{
            bgcolor: '#F8F9FB',
            borderRadius: '10px',
            p: 1.5,
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            color: '#374151',
            wordBreak: 'break-all',
            lineHeight: 1.6,
          }}
        >
          {session.userAgent ?? '—'}
        </Box>
      </Box>
    </Drawer>
  );
}
