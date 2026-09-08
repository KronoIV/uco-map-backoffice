import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarFilterButton,
  GridToolbarExport,
  GridToolbarQuickFilter,
} from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import { Box, Chip, Typography } from '@mui/material';
import type { DeviceSession } from '../../types';

const ACTIVE_MS = 10 * 60 * 1000; // 10 min → "activo ahora"
const TODAY_MS = 24 * 60 * 60 * 1000;

function statusChip(lastSeen: string) {
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (diff < ACTIVE_MS)
    return <Chip label="Activo" size="small" sx={{ bgcolor: '#D1FAE5', color: '#065F46', fontWeight: 600 }} />;
  if (diff < TODAY_MS)
    return <Chip label="Hoy" size="small" sx={{ bgcolor: '#DBEAFE', color: '#1E40AF', fontWeight: 600 }} />;
  return <Chip label="Inactivo" size="small" sx={{ bgcolor: '#F3F4F6', color: '#6B7280', fontWeight: 600 }} />;
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDuration(firstSeen: string, lastSeen: string) {
  const ms = new Date(lastSeen).getTime() - new Date(firstSeen).getTime();
  if (ms < 0) return '—';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const columns: GridColDef<DeviceSession>[] = [
  {
    field: 'deviceId',
    headerName: 'Device ID',
    width: 220,
    renderCell: ({ value }) => (
      <Typography
        sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'text.secondary' }}
        title={value}
      >
        {String(value).slice(0, 8)}…{String(value).slice(-4)}
      </Typography>
    ),
  },
  {
    field: 'platform',
    headerName: 'Plataforma',
    width: 150,
    renderCell: ({ value }) => (
      <Chip
        label={value ?? '—'}
        size="small"
        sx={{ bgcolor: '#F3F4F6', color: '#374151', fontWeight: 500 }}
      />
    ),
  },
  {
    field: 'ipAddress',
    headerName: 'IP',
    width: 130,
    renderCell: ({ value }) => (
      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
        {value ?? '—'}
      </Typography>
    ),
  },
  {
    field: 'language',
    headerName: 'Idioma',
    width: 100,
    renderCell: ({ value }) => (
      <Typography sx={{ fontSize: '0.8rem' }}>{value ?? '—'}</Typography>
    ),
  },
  {
    field: 'sessionCount',
    headerName: 'Pings',
    width: 80,
    type: 'number',
    renderCell: ({ value }) => (
      <Chip
        label={value}
        size="small"
        sx={{ bgcolor: '#EDE9FE', color: '#5B21B6', fontWeight: 700 }}
      />
    ),
  },
  {
    field: 'firstSeen',
    headerName: 'Primera vez',
    width: 180,
    renderCell: ({ value }) => (
      <Typography sx={{ fontSize: '0.8rem' }}>{fmtDate(value)}</Typography>
    ),
  },
  {
    field: 'lastSeen',
    headerName: 'Último ping',
    width: 180,
    renderCell: ({ value }) => (
      <Typography sx={{ fontSize: '0.8rem' }}>{fmtDate(value)}</Typography>
    ),
  },
  {
    field: '_duration',
    headerName: 'Tiempo activo',
    width: 130,
    sortable: false,
    valueGetter: (_value, row) => {
      const ms = new Date(row.lastSeen).getTime() - new Date(row.firstSeen).getTime();
      return ms;
    },
    renderCell: ({ row }) => (
      <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
        {fmtDuration(row.firstSeen, row.lastSeen)}
      </Typography>
    ),
  },
  {
    field: '_status',
    headerName: 'Estado',
    width: 100,
    sortable: false,
    renderCell: ({ row }) => statusChip(row.lastSeen),
  },
];

function CustomToolbar() {
  return (
    <GridToolbarContainer
      sx={{
        px: 2,
        py: 1,
        gap: 1,
        borderBottom: '1px solid #F1F1F1',
        justifyContent: 'space-between',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1 }}>
        <GridToolbarFilterButton />
        <GridToolbarExport />
      </Box>
      <Box
        sx={{
          '& .MuiInputBase-root': {
            borderRadius: '100px',
            height: 32,
            fontSize: '0.8125rem',
          },
        }}
      >
        <GridToolbarQuickFilter />
      </Box>
    </GridToolbarContainer>
  );
}

interface Props {
  rows: DeviceSession[];
  loading: boolean;
  onRowClick: (session: DeviceSession) => void;
  selectedId: string | null;
}

export default function SessionsDataGrid({ rows, loading, onRowClick, selectedId }: Props) {
  return (
    <Box
      sx={{
        bgcolor: '#fff',
        border: '1px solid #F1F1F1',
        borderRadius: '18px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        height: 480,
      }}
    >
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={row => row.id}
        onRowClick={({ row }) => onRowClick(row as DeviceSession)}
        rowSelectionModel={selectedId
          ? { type: 'include', ids: new Set([selectedId]) }
          : { type: 'include', ids: new Set() }
        }
        slots={{ toolbar: CustomToolbar }}
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        sx={{
          border: 'none',
          fontSize: '0.8125rem',
          '& .MuiDataGrid-columnHeader': {
            bgcolor: '#F8F9FB',
            fontWeight: 600,
            fontSize: '0.75rem',
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          },
          '& .MuiDataGrid-row': {
            cursor: 'pointer',
            '&:hover': { bgcolor: '#FAFAFA' },
            '&.Mui-selected': { bgcolor: '#F0FFF9 !important' },
          },
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid #F9FAFB',
            display: 'flex',
            alignItems: 'center',
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: '1px solid #F1F1F1',
          },
        }}
      />
    </Box>
  );
}
