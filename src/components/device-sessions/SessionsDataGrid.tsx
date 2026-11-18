import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import { Box, Chip, Typography } from '@mui/material';
import type { DeviceSession } from '../../types';
import { PLATFORM_LABEL, fmtDuration } from '../../utils/analyticsFormat';
import { brand } from '../../theme/brand';

const ACTIVE_MS = 10 * 60 * 1000; // 10 min → "activo ahora"
const TODAY_MS = 24 * 60 * 60 * 1000;

function statusChip(lastSeen: string) {
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (diff < ACTIVE_MS)
    return <Chip label="Activo" size="small" color="success" />;
  if (diff < TODAY_MS)
    return <Chip label="Hoy" size="small" color="info" />;
  return <Chip label="Inactivo" size="small" sx={{ bgcolor: brand.bgMuted, color: brand.text3 }} />;
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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
        label={PLATFORM_LABEL[value as string] ?? value ?? '—'}
        size="small"
        sx={{ bgcolor: brand.bgMuted, color: brand.text2, fontWeight: 700 }}
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
    field: 'visitCount',
    headerName: 'Visitas',
    width: 80,
    type: 'number',
    description: 'Aperturas de la app (una visita termina tras 30 min sin uso). — = solo versíones anteriores a la 2.1',
    renderCell: ({ value }) => (
      <Chip
        label={value ? value : '—'}
        size="small"
        sx={{ bgcolor: brand.blue50, color: brand.blue, fontWeight: 700 }}
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
    field: 'totalActiveMs',
    headerName: 'Tiempo de uso',
    width: 130,
    sortable: false,
    description: 'Suma del tiempo con la app en pantalla y en uso de todas sus visitas',
    renderCell: ({ row }) => (
      <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
        {row.visitCount ? fmtDuration(row.totalActiveMs ?? 0) : '—'}
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

interface Props {
  rows: DeviceSession[];
  rowCount: number;
  paginationModel: GridPaginationModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  loading: boolean;
  onRowClick: (session: DeviceSession) => void;
  selectedId: string | null;
}

export default function SessionsDataGrid({
  rows, rowCount, paginationModel, onPaginationModelChange, loading, onRowClick, selectedId,
}: Props) {
  return (
    <Box
      sx={{
        bgcolor: '#fff',
        border: `1px solid ${brand.border}`,
        borderRadius: '16px',
        boxShadow: '0 1px 3px rgba(30, 31, 28, 0.05)',
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
        paginationMode="server"
        rowCount={rowCount}
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
        pageSizeOptions={[10, 25, 50]}
        disableColumnSorting
        disableColumnFilter
        sx={{
          border: 'none',
          fontSize: '0.8125rem',
          '& .MuiDataGrid-row': {
            cursor: 'pointer',
          },
          '& .MuiDataGrid-cell': {
            display: 'flex',
            alignItems: 'center',
          },
        }}
      />
    </Box>
  );
}
