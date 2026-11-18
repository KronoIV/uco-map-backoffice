import { Box, FormHelperText, OutlinedInput } from '@mui/material';
import type { OutlinedInputProps } from '@mui/material';
import { brand } from '../theme/brand';

interface AuthFieldProps extends Omit<OutlinedInputProps, 'error' | 'sx'> {
  id: string;
  label: string;
  error?: string;
  /** Enlace o acción a la derecha de la etiqueta (p. ej. «¿La olvidaste?»). */
  labelAction?: React.ReactNode;
}

/** Campo de las pantallas de acceso: etiqueta fija encima, sin etiqueta flotante. */
export default function AuthField({ id, label, error, labelAction, ...input }: AuthFieldProps) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: '6px' }}>
        <Box component="label" htmlFor={id} sx={{ fontSize: '0.8125rem', fontWeight: 700, color: brand.text }}>
          {label}
        </Box>
        {labelAction}
      </Box>
      <OutlinedInput
        id={id}
        fullWidth
        error={!!error}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        sx={{
          height: 46,
          borderRadius: '8px',
          fontSize: '0.9rem',
          bgcolor: '#fff',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: brand.borderStrong },
          '& input': { px: '14px' },
        }}
        {...input}
      />
      {error && <FormHelperText id={`${id}-error`} error sx={{ mx: 0, mt: '6px' }}>{error}</FormHelperText>}
    </Box>
  );
}
