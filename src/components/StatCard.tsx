import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/system';
import { brand } from '../theme/brand';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
  sx?: SxProps<Theme>;
}

export default function StatCard({ title, value, subtitle, icon, color = brand.green, sx }: StatCardProps) {
  return (
    <Box
      sx={{
        bgcolor: '#fff',
        border: `1px solid ${brand.border}`,
        borderRadius: '16px',
        boxShadow: '0 1px 3px rgba(30, 31, 28, 0.05)',
        p: '20px 24px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
        ...sx,
      }}
    >
      <Box>
        <Typography
          sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: '6px' }}
        >
          {title}
        </Typography>
        <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1, color: 'text.primary', mb: '4px' }}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: '12px',
          bgcolor: `${color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color,
        }}
      >
        {icon}
      </Box>
    </Box>
  );
}
