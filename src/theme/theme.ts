import { createTheme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';
import { brand } from './brand';

declare module '@mui/material/styles' {
  interface Palette {
    sidebar: { bg: string; text: string; active: string };
  }
  interface PaletteOptions {
    sidebar?: { bg: string; text: string; active: string };
  }
}

// Verde institucional #008b50 para superficies e indicadores; en botones y texto pequeño el tono #007d48 (contraste AA)
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: brand.greenStrong,
      light: brand.green,
      dark: brand.greenHover,
      contrastText: '#fff',
    },
    secondary: {
      main: brand.yellow,
      dark: '#e0b100',
      contrastText: brand.ink,
    },
    success: {
      main: brand.greenStrong,
      light: brand.green50,
      contrastText: '#fff',
    },
    warning: {
      main: brand.orange,
      dark: brand.orangeInk,
      light: brand.orange50,
      contrastText: brand.ink,
    },
    info: {
      main: brand.blue,
      light: brand.blue50,
      contrastText: '#fff',
    },
    error: {
      main: brand.danger,
      light: brand.dangerBg,
      contrastText: '#fff',
    },
    background: {
      default: brand.bg,
      paper: brand.surface,
    },
    text: {
      primary: brand.text,
      secondary: brand.text3,
    },
    divider: brand.border,
    sidebar: {
      bg: brand.surface,
      text: brand.text2,
      active: brand.greenStrong,
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: brand.font,
    fontSize: 13,
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 700, fontSize: '0.875rem' },
    subtitle2: { fontWeight: 700, fontSize: '0.75rem' },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.8125rem' },
    button: { fontWeight: 700 },
    caption: { fontSize: '0.75rem', color: brand.text3 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: brand.bg },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          height: 34,
          padding: '0 16px',
          fontWeight: 700,
          fontSize: '0.8125rem',
          textTransform: 'none',
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
          '&.Mui-focusVisible': { boxShadow: `0 0 0 3px rgba(0, 139, 80, 0.28)` },
        },
        containedPrimary: {
          background: brand.greenStrong,
          '&:hover': { background: brand.greenHover },
        },
        containedSecondary: {
          '&:hover': { background: '#f0be00' },
        },
        outlined: {
          border: `1px solid ${brand.borderStrong}`,
          background: '#fff',
          color: brand.text2,
          '&:hover': { background: brand.bg, border: `1px solid ${brand.text4}` },
        },
        outlinedPrimary: {
          color: brand.greenStrong,
          borderColor: brand.green200,
          '&:hover': { background: brand.green50, borderColor: brand.green },
        },
        outlinedError: {
          color: brand.danger,
          borderColor: 'rgba(198, 40, 40, 0.4)',
          '&:hover': { background: brand.dangerBg, borderColor: brand.danger },
        },
        textPrimary: {
          color: brand.greenStrong,
          '&:hover': { background: brand.green50 },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': { boxShadow: `0 0 0 3px rgba(0, 139, 80, 0.28)` },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          height: 34,
          fontSize: '0.8125rem',
          backgroundColor: '#fff',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: brand.border,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: brand.borderStrong,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: brand.green,
            borderWidth: 1.5,
          },
          '&.Mui-focused': {
            boxShadow: '0 0 0 3px rgba(0, 139, 80, 0.12)',
          },
          // The fixed height clips textareas: their text spilled over the label and the next field
          '&.MuiInputBase-multiline': {
            height: 'auto',
            borderRadius: 10,
            padding: 0,
          },
        },
        input: {
          padding: '7px 12px',
          height: '20px',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.8125rem',
          transform: 'translate(12px, 8px) scale(1)',
          '&.MuiInputLabel-shrink': {
            transform: 'translate(12px, -9px) scale(0.75)',
          },
          '&.Mui-focused': { color: brand.greenStrong },
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
          padding: '4px 12px',
          fontSize: '0.8125rem',
        },
      },
    },
    MuiCheckbox: {
      defaultProps: { color: 'primary' },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': { color: brand.green },
          '&.Mui-checked + .MuiSwitch-track': { backgroundColor: brand.green, opacity: 0.5 },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(30, 31, 28, 0.05)',
          border: `1px solid ${brand.border}`,
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
          fontWeight: 700,
          // Estados en tono suave: el color conserva su significado sin saturar las tablas
          variants: [
            { props: { variant: 'filled', color: 'success' }, style: { backgroundColor: brand.green50, color: brand.greenStrong } },
            { props: { variant: 'filled', color: 'primary' }, style: { backgroundColor: brand.green50, color: brand.greenStrong } },
            { props: { variant: 'filled', color: 'warning' }, style: { backgroundColor: brand.orange50, color: brand.orangeInk } },
            { props: { variant: 'filled', color: 'error' }, style: { backgroundColor: brand.dangerBg, color: brand.danger } },
            { props: { variant: 'filled', color: 'info' }, style: { backgroundColor: brand.blue50, color: brand.blue } },
            { props: { variant: 'filled', color: 'secondary' }, style: { backgroundColor: brand.yellow50, color: brand.yellowInk } },
          ],
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, fontSize: '0.8125rem' },
        standardSuccess: { backgroundColor: brand.green50, color: brand.greenDark },
        standardWarning: { backgroundColor: brand.orange50, color: '#6b3a00' },
        standardInfo: { backgroundColor: brand.blue50, color: brand.blue },
        standardError: { backgroundColor: brand.dangerBg, color: '#8e1c1c' },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: brand.green50,
            fontWeight: 700,
            fontSize: '0.72rem',
            color: brand.greenDark,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: `2px solid ${brand.green100}`,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(0, 139, 80, 0.04)',
          },
          '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: brand.green50,
          },
          '& .MuiTableCell-body': {
            fontSize: '0.8125rem',
            borderBottom: `1px solid ${brand.bgMuted}`,
            padding: '10px 16px',
          },
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: { borderTop: `1px solid ${brand.border}`, color: brand.text2 },
        selectLabel: { fontSize: '0.75rem' },
        displayedRows: { fontSize: '0.75rem' },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          '&.Mui-selected': { backgroundColor: brand.greenStrong, color: '#fff' },
          '&.Mui-selected:hover': { backgroundColor: brand.greenHover },
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: `1px solid ${brand.border}`,
          borderRadius: 16,
          backgroundColor: '#fff',
          fontSize: '0.8125rem',
          '--DataGrid-containerBackground': brand.green50,
          '--DataGrid-rowBorderColor': brand.bgMuted,
        },
        columnHeaders: {
          borderBottom: `2px solid ${brand.green100}`,
        },
        columnHeaderTitle: {
          fontWeight: 700,
          fontSize: '0.72rem',
          color: brand.greenDark,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
        row: {
          '&:hover': { backgroundColor: 'rgba(0, 139, 80, 0.04)' },
          '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: brand.green50 },
        },
        cell: {
          '&:focus, &:focus-within': { outline: `2px solid rgba(0, 139, 80, 0.35)`, outlineOffset: -2 },
        },
        footerContainer: {
          borderTop: `1px solid ${brand.border}`,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { backgroundColor: brand.green, height: 3, borderRadius: 3 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
          '&.Mui-selected': { color: brand.greenStrong },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, backgroundColor: brand.green50 },
        bar: { borderRadius: 4 },
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
          borderRadius: 18,
          padding: 8,
          boxShadow: `inset 0 4px 0 ${brand.green}, 0 24px 48px rgba(30, 31, 28, 0.18)`,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
          fontWeight: 700,
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
          backgroundColor: brand.ink,
        },
        arrow: { color: brand.ink },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: brand.border,
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: { color: brand.greenStrong },
      },
    },
  },
});

export default theme;
