import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    sidebar: { bg: string; text: string; active: string };
  }
  interface PaletteOptions {
    sidebar?: { bg: string; text: string; active: string };
  }
}

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#00d084',
      dark: '#00b874',
      contrastText: '#fff',
    },
    secondary: {
      main: '#004628',
      contrastText: '#fff',
    },
    background: {
      default: '#F8F9FB',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#111827',
      secondary: '#6B7280',
    },
    divider: '#F1F1F1',
    sidebar: {
      bg: '#004628',
      text: 'rgba(255,255,255,0.75)',
      active: '#00d084',
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: "'Inter', 'Poppins', sans-serif",
    fontSize: 13,
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500, fontSize: '0.875rem' },
    subtitle2: { fontWeight: 500, fontSize: '0.75rem' },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.8125rem' },
    caption: { fontSize: '0.75rem', color: '#6B7280' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 100,
          height: 34,
          padding: '0 18px',
          fontWeight: 600,
          fontSize: '0.8125rem',
          textTransform: 'none',
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: {
          background: '#00d084',
          '&:hover': { background: '#00b874' },
        },
        outlined: {
          border: '1px solid #E5E7EB',
          background: '#fff',
          color: '#374151',
          '&:hover': { background: '#F9FAFB', border: '1px solid #D1D5DB' },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 100,
          height: 32,
          fontSize: '0.8125rem',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#E5E7EB',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#D1D5DB',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#00d084',
            borderWidth: 1.5,
          },
        },
        input: {
          padding: '6px 14px',
          height: '20px',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.8125rem',
          transform: 'translate(14px, 7px) scale(1)',
          '&.MuiInputLabel-shrink': {
            transform: 'translate(14px, -9px) scale(0.75)',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          padding: '4px 14px',
          fontSize: '0.8125rem',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          border: '1px solid #F1F1F1',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          height: 22,
          fontSize: '0.7rem',
          fontWeight: 600,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: '#F8F9FB',
            fontWeight: 600,
            fontSize: '0.75rem',
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            borderBottom: '1px solid #F1F1F1',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#FAFAFA',
          },
          '& .MuiTableCell-body': {
            fontSize: '0.8125rem',
            borderBottom: '1px solid #F9FAFB',
            padding: '10px 16px',
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          margin: '1px 8px',
          padding: '8px 12px',
          transition: 'all 0.15s ease',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          padding: 8,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
          fontWeight: 600,
          padding: '16px 20px 8px',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '8px 20px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '8px 20px 16px',
          gap: 8,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.75rem',
          borderRadius: 8,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#F1F1F1',
        },
      },
    },
  },
});

export default theme;
