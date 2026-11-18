import { Box, Typography } from '@mui/material';
import { brand } from '../theme/brand';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        mb: 3,
      }}
    >
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700, lineHeight: 1.2, color: 'text.primary' }}>
          {title}
        </Typography>
        {/* Filete amarillo bajo el título, como en las piezas del manual */}
        <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: brand.yellow, mt: '8px' }} />
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: '8px' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Box>
  );
}
