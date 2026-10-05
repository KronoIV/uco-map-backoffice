import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Box, Paper, Typography, Button, Chip, ToggleButton, ToggleButtonGroup,
  List, ListItem, ListItemText, Tooltip, IconButton, Alert,
  TextField, MenuItem, Divider,
} from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import AltRouteRoundedIcon from '@mui/icons-material/AltRouteRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import OpenWithRoundedIcon from '@mui/icons-material/OpenWithRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import NavigationRoundedIcon from '@mui/icons-material/NavigationRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DirectionsWalkRoundedIcon from '@mui/icons-material/DirectionsWalkRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import GridOnRoundedIcon from '@mui/icons-material/GridOnRounded';
import SatelliteAltRoundedIcon from '@mui/icons-material/SatelliteAltRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import DoorFrontRoundedIcon from '@mui/icons-material/DoorFrontRounded';
import { useSearchParams } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { graphService } from '../services/graphService';
import { roomService } from '../services/roomService';
import type { GraphNode, GraphEdge, NodeType } from '../types';
import PageHeader from '../components/PageHeader';
import SectionTabs, { type SectionTab } from '../components/SectionTabs';
import PoiEditorPage from './PoiEditorPage';
import { dijkstra, findStartNode, haversineDistance, formatDistance, formatETA } from '../utils/dijkstra';
import campusRender from '../assets/campus-render.webp';

// Fix default leaflet icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeIcon(color: string, borderColor: string, size: number, ring = false) {
  const s = size;
  const ringStyle = ring
    ? `box-shadow:0 0 0 3px ${color}55, 0 0 0 5px ${color}22;`
    : '';
  return L.divIcon({
    html: `<div style="background:${color};border:2px solid ${borderColor};border-radius:50%;width:${s}px;height:${s}px;${ringStyle}transition:transform 0.1s;"></div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    className: '',
  });
}

const NODE_TYPE_META: Record<NodeType, { label: string; color: string; border: string; size: number }> = {
  BUILDING: { label: 'Edificio', color: '#00d084', border: '#004628', size: 18 },
  DOOR: { label: 'Puerta de edificio', color: '#8B5CF6', border: '#5B21B6', size: 14 },
  ENTRANCE: { label: 'Entrada al campus', color: '#3B82F6', border: '#1E40AF', size: 14 },
  WAYPOINT: { label: 'Waypoint', color: '#9CA3AF', border: '#6B7280', size: 11 },
};
const NODE_TYPES = Object.keys(NODE_TYPE_META) as NodeType[];

const icons = Object.fromEntries(
  NODE_TYPES.map(t => [t, makeIcon(NODE_TYPE_META[t].color, NODE_TYPE_META[t].border, NODE_TYPE_META[t].size)]),
) as Record<NodeType, L.DivIcon>;

const selectedIcon = makeIcon('#F59E0B', '#D97706', 18, true);
const highlightIcon = makeIcon('#EC4899', '#BE185D', 16, true);

type Mode = 'view' | 'add-node' | 'add-edge' | 'door' | 'move';

const neighborsOf = (nodeId: string, nodes: GraphNode[], edges: GraphEdge[]) =>
  edges
    .map(e => (e.nodeA === nodeId ? e.nodeB : e.nodeB === nodeId ? e.nodeA : null))
    .map(id => nodes.find(n => n.nodeId === id))
    .filter((n): n is GraphNode => !!n);

/** Lo que la app necesita de una puerta: un edificio y al menos un camino conectados. */
function doorStatus(node: GraphNode, nodes: GraphNode[], edges: GraphEdge[]) {
  const near = neighborsOf(node.nodeId, nodes, edges);
  const building = near.find(n => n.nodeType === 'BUILDING');
  const paths = near.filter(n => n.nodeType !== 'BUILDING').length;
  if (!building) return { ok: false, text: 'Conéctala al nodo del edificio (modo Ruta)' };
  if (paths === 0) return { ok: false, text: `Puerta de ${building.label ?? building.nodeId}: conéctala también a un camino` };
  return { ok: true, text: `Puerta de ${building.label ?? building.nodeId}` };
}

function NodePopup({
  node,
  nodes,
  edges,
  onChangeType,
  onRename,
  onDelete,
}: {
  node: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onChangeType: (nodeId: string, type: NodeType) => void;
  onRename: (nodeId: string, label: string) => void;
  onDelete: (nodeId: string) => void;
}) {
  const doors = node.nodeType === 'BUILDING'
    ? neighborsOf(node.nodeId, nodes, edges).filter(n => n.nodeType === 'DOOR').length
    : 0;
  const status = node.nodeType === 'DOOR' ? doorStatus(node, nodes, edges) : null;
  const save = (value: string) => {
    const label = value.trim();
    if (label !== (node.label ?? '')) onRename(node.nodeId, label);
  };

  return (
    <Box sx={{ minWidth: 220 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 1, fontFamily: 'monospace' }}>
        {node.nodeId}
      </Typography>
      <TextField
        key={`${node.nodeId}-${node.label ?? ''}`}
        size="small"
        fullWidth
        label="Nombre"
        defaultValue={node.label ?? ''}
        placeholder={node.nodeType === 'DOOR' ? 'Puerta principal COLEGIO' : ''}
        onBlur={e => save(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        sx={{ mb: 1, '& input': { fontSize: '0.78rem' } }}
      />
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>Tipo</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
        {NODE_TYPES.map(t => (
          <Chip
            key={t}
            label={NODE_TYPE_META[t].label}
            size="small"
            onClick={() => t !== node.nodeType && onChangeType(node.nodeId, t)}
            sx={{
              fontSize: '0.65rem',
              bgcolor: t === node.nodeType ? NODE_TYPE_META[t].color : '#F3F4F6',
              color: t === node.nodeType ? '#fff' : '#374151',
              fontWeight: t === node.nodeType ? 700 : 500,
            }}
          />
        ))}
      </Box>
      {status && (
        <Alert severity={status.ok ? 'success' : 'warning'} sx={{ py: 0, mb: 1, fontSize: '0.7rem', '& .MuiAlert-icon': { fontSize: 16 } }}>
          {status.text}
        </Alert>
      )}
      {node.nodeType === 'BUILDING' && (
        <Alert severity={doors > 0 ? 'success' : 'info'} sx={{ py: 0, mb: 1, fontSize: '0.7rem', '& .MuiAlert-icon': { fontSize: 16 } }}>
          {doors > 0
            ? `${doors} puerta${doors > 1 ? 's' : ''}: la ruta termina en la más conveniente`
            : 'Sin puertas: la ruta termina en este punto. Usa el modo Puertas.'}
        </Alert>
      )}
      <Box sx={{ fontSize: '0.7rem', color: '#6B7280', mb: 1, fontFamily: 'monospace' }}>
        {node.gps.lat.toFixed(6)}, {node.gps.lng.toFixed(6)}
      </Box>
      <Button
        size="small"
        variant="outlined"
        color="error"
        onClick={() => onDelete(node.nodeId)}
        sx={{ fontSize: '0.65rem', height: 24, px: 1, minWidth: 0 }}
      >
        Eliminar
      </Button>
    </Box>
  );
}

// ── Inner component that lives inside MapContainer ──────────────
function MapInteraction({
  mode,
  nodes,
  edges,
  edgeNodeA,
  chainNodeId,
  onMapClick,
  onMarkerClick,
  onMarkerDragEnd,
  onEdgeClick,
  onDeleteNode,
  onChangeType,
  onRename,
}: {
  mode: Mode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  edgeNodeA: string | null;
  chainNodeId: string | null;
  onMapClick: (lat: number, lng: number) => void;
  onMarkerClick: (nodeId: string) => void;
  onMarkerDragEnd: (nodeId: string, lat: number, lng: number) => void;
  onEdgeClick: (edge: GraphEdge, lat: number, lng: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onChangeType: (nodeId: string, type: NodeType) => void;
  onRename: (nodeId: string, label: string) => void;
}) {
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(null);

  useMapEvents({
    click(e) {
      if (mode === 'add-node') onMapClick(e.latlng.lat, e.latlng.lng);
    },
    mousemove(e) {
      const needsPreview =
        (mode === 'add-edge' && edgeNodeA) ||
        (mode === 'add-node' && chainNodeId);
      if (needsPreview) {
        setCursorPos([e.latlng.lat, e.latlng.lng]);
      } else {
        setCursorPos(null);
      }
    },
  });

  // Anchor point for the live preview line
  const previewAnchorId = mode === 'add-edge' ? edgeNodeA : chainNodeId;
  const nodeAPos = previewAnchorId
    ? nodes.find(n => n.nodeId === previewAnchorId)?.gps
    : null;

  // Build permanent polylines
  const polylines = edges
    .map(edge => {
      const a = nodes.find(n => n.nodeId === edge.nodeA);
      const b = nodes.find(n => n.nodeId === edge.nodeB);
      if (!a?.gps || !b?.gps) return null;
      return { edge, positions: [[a.gps.lat, a.gps.lng], [b.gps.lat, b.gps.lng]] as [number, number][] };
    })
    .filter(Boolean) as { edge: GraphEdge; positions: [number, number][] }[];

  return (
    <>
      {/* Permanent edges */}
      {polylines.map(({ edge, positions }) => {
        // En modo Puertas se resaltan los caminos que llegan a un edificio: ahí se marca la puerta
        const toBuilding = mode === 'door' && [edge.nodeA, edge.nodeB]
          .some(id => nodes.find(n => n.nodeId === id)?.nodeType === 'BUILDING');
        return (
          <Polyline
            key={edge.id}
            positions={positions}
            pathOptions={{
              color: toBuilding ? '#8B5CF6' : '#00d084',
              weight: toBuilding ? 6 : 3,
              opacity: mode === 'door' && !toBuilding ? 0.35 : 0.85,
            }}
            eventHandlers={{ click: e => onEdgeClick(edge, e.latlng.lat, e.latlng.lng) }}
          />
        );
      })}

      {/* Live preview line: anchor → cursor (works in add-edge AND add-node modes) */}
      {nodeAPos && cursorPos && (
        <Polyline
          positions={[[nodeAPos.lat, nodeAPos.lng], cursorPos]}
          pathOptions={{ color: '#F59E0B', weight: 2.5, opacity: 0.9, dashArray: '6 5' }}
        />
      )}

      {/* Nodes */}
      {nodes.map(node => {
        if (!node.gps) return null;
        const isSelected = edgeNodeA === node.nodeId || chainNodeId === node.nodeId;
        // highlight nodes already connected to selected node
        const anchorId = edgeNodeA ?? chainNodeId;
        const isConnected =
          anchorId != null &&
          !isSelected &&
          edges.some(
            e =>
              (e.nodeA === anchorId && e.nodeB === node.nodeId) ||
              (e.nodeB === anchorId && e.nodeA === node.nodeId)
          );

        const icon = isSelected
          ? selectedIcon
          : isConnected
          ? highlightIcon
          : icons[node.nodeType] ?? icons.WAYPOINT;

        return (
          <Marker
            key={node.nodeId}
            position={[node.gps.lat, node.gps.lng]}
            icon={icon}
            draggable={mode === 'move'}
            eventHandlers={{
              click: () => onMarkerClick(node.nodeId),
              dragend(e) {
                const { lat, lng } = (e.target as L.Marker).getLatLng();
                onMarkerDragEnd(node.nodeId, lat, lng);
              },
            }}
          >
            <Popup>
              <NodePopup
                node={node}
                nodes={nodes}
                edges={edges}
                onChangeType={onChangeType}
                onRename={onRename}
                onDelete={onDeleteNode}
              />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

// ── Preview: auto-fit bounds ──────────────────────────────────
function FitRouteBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 19 });
    }
  }, [map, positions]);
  return null;
}

const TILE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    maxNativeZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxNativeZoom: 19,
  },
} as const;

type TileLayerType = keyof typeof TILE_LAYERS;

// ── User Navigation Preview Panel ────────────────────────────
function UserNavPreview({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: roomService.getAll,
    retry: false,
  });

  // Rooms that have a stateId matching a real graph node
  const roomOptions = rooms
    .filter(r => r.active && nodes.some(n => n.nodeId === r.stateId))
    .map(r => ({ nodeId: r.stateId, label: r.name, group: 'Salones / Lugares' }));

  // BUILDING nodes as top-level destinations (e.g. "El Colegio")
  const buildingOptions = nodes
    .filter(n => n.nodeType === 'BUILDING')
    .map(n => ({ nodeId: n.nodeId, label: n.label ?? n.nodeId, group: 'Edificios' }));



  const [destNodeId, setDestNodeId] = useState('');
  const [route, setRoute] = useState<import('../utils/dijkstra').RouteResult | null>(null);
  const [simPos, setSimPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [mapLayer, setMapLayer] = useState<TileLayerType>('street');

  const calculateRoute = useCallback(() => {
    if (!destNodeId || !simPos) return;
    // If outside campus → start at nearest ENTRANCE; if inside → start at nearest node
    const startId = findStartNode(nodes, simPos.lat, simPos.lng);
    const result = dijkstra(nodes, edges, startId, destNodeId);
    // Add last-mile: user GPS → first node of the route
    const firstNode = nodes.find(n => n.nodeId === startId);
    const lastMile = firstNode?.gps
      ? haversineDistance(simPos.lat, simPos.lng, firstNode.gps.lat, firstNode.gps.lng)
      : 0;
    setRoute({ ...result, lastMileMeters: lastMile, totalDistMeters: result.totalDistMeters + lastMile });
  }, [destNodeId, simPos, nodes, edges]);

  useEffect(() => {
    if (destNodeId && simPos) calculateRoute();
  }, [destNodeId, simPos, calculateRoute]);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setSimPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Simulate position by clicking on the map
  const handleSimClick = (lat: number, lng: number) => {
    setSimPos({ lat, lng });
  };

  // Route polyline positions
  const routePositions: [number, number][] = (route?.nodeIds ?? [])
    .map(id => nodes.find(n => n.nodeId === id))
    .filter((n): n is GraphNode => !!n?.gps)
    .map(n => [n.gps!.lat, n.gps!.lng]);

  // Add simulated user position as first point
  if (simPos && routePositions.length > 0) {
    routePositions.unshift([simPos.lat, simPos.lng]);
  }

  // destNode available for popup use

  const center: [number, number] =
    nodes.length > 0
      ? [
          nodes.reduce((s, n) => s + (n.gps?.lat ?? 0), 0) / nodes.length,
          nodes.reduce((s, n) => s + (n.gps?.lng ?? 0), 0) / nodes.length,
        ]
      : [6.149703, -75.366407];

  return (
    <Box sx={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden' }}>
      {/* Map */}
      <Box sx={{ flex: 1, borderRadius: '18px', overflow: 'hidden', border: '1px solid #F1F1F1', position: 'relative' }}>
        {/* Hint */}
        <Box
          sx={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
        >
          <Alert severity="info" sx={{ borderRadius: '12px', fontSize: '0.75rem', py: 0.5, whiteSpace: 'nowrap' }}>
            Haz clic en el mapa para simular la posición del usuario
          </Alert>
        </Box>

        {/* Layer toggle */}
        <Box sx={{ position: 'absolute', bottom: 16, right: 16, zIndex: 1000 }}>
          <Tooltip title={mapLayer === 'street' ? 'Vista satelital' : 'Vista mapa'} placement="left">
            <IconButton
              onClick={() => setMapLayer(l => l === 'street' ? 'satellite' : 'street')}
              sx={{
                bgcolor: '#fff',
                border: '1px solid #E5E7EB',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                '&:hover': { bgcolor: '#F8F9FB' },
              }}
            >
              {mapLayer === 'street' ? <SatelliteAltRoundedIcon sx={{ fontSize: 20 }} /> : <MapRoundedIcon sx={{ fontSize: 20 }} />}
            </IconButton>
          </Tooltip>
        </Box>

        <MapContainer center={center} zoom={18} maxZoom={22} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            key={mapLayer}
            attribution={TILE_LAYERS[mapLayer].attribution}
            url={TILE_LAYERS[mapLayer].url}
            maxNativeZoom={TILE_LAYERS[mapLayer].maxNativeZoom}
            maxZoom={22}
          />

          {/* Click handler */}
          <SimClickHandler onSimClick={handleSimClick} />

          {/* Auto-fit when route changes */}
          {routePositions.length >= 2 && <FitRouteBounds positions={routePositions} />}

          {/* All edges (faded) */}
          {edges.map(edge => {
            const a = nodes.find(n => n.nodeId === edge.nodeA);
            const b = nodes.find(n => n.nodeId === edge.nodeB);
            if (!a?.gps || !b?.gps) return null;
            return (
              <Polyline
                key={edge.id}
                positions={[[a.gps.lat, a.gps.lng], [b.gps.lat, b.gps.lng]]}
                pathOptions={{ color: '#D1D5DB', weight: 2, opacity: 0.6 }}
              />
            );
          })}

          {/* Route highlight */}
          {routePositions.length >= 2 && (
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#00d084', weight: 5, opacity: 0.95, dashArray: '10 6' }}
            />
          )}

          {/* All nodes (faded) */}
          {nodes.map(node => {
            if (!node.gps) return null;
            const isOnRoute = route?.nodeIds.includes(node.nodeId);
            const isDest = node.nodeId === destNodeId;
            const icon = isDest
              ? makeIcon('#EF4444', '#B91C1C', 20, true)
              : isOnRoute
              ? makeIcon('#00d084', '#004628', 14, true)
              : icons[node.nodeType] ?? icons.WAYPOINT;
            return (
              <Marker key={node.nodeId} position={[node.gps.lat, node.gps.lng]} icon={icon}>
                <Popup>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{node.nodeId}</Typography>
                  {node.label && <Typography sx={{ fontSize: '0.75rem' }}>{node.label}</Typography>}
                  <Chip label={node.nodeType} size="small" sx={{ mt: 0.5, fontSize: '0.65rem' }} />
                </Popup>
              </Marker>
            );
          })}

          {/* Simulated user position */}
          {simPos && (
            <Marker
              position={[simPos.lat, simPos.lng]}
              icon={L.divIcon({
                html: `<div style="background:#4285F4;border:3px solid #fff;border-radius:50%;width:16px;height:16px;box-shadow:0 0 0 4px rgba(66,133,244,0.3)"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
                className: '',
              })}
            >
              <Popup>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>📍 Posición simulada</Typography>
                <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'text.secondary' }}>
                  {simPos.lat.toFixed(6)}, {simPos.lng.toFixed(6)}
                </Typography>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </Box>

      {/* Right panel */}
      <Paper
        sx={{
          width: 300,
          borderRadius: '18px',
          border: '1px solid #F1F1F1',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2.5, borderBottom: '1px solid #F1F1F1' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 0.5 }}>
            Vista de usuario
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Simula la experiencia de navegación del campus
          </Typography>
        </Box>

        <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
          {/* Destination selector */}
          <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', mb: 1 }}>
            Destino
          </Typography>
          <TextField
            select
            fullWidth
            size="small"
            value={destNodeId}
            onChange={e => setDestNodeId(e.target.value)}
            label="¿A dónde quieres ir?"
            sx={{ mb: 2 }}
          >
            <MenuItem value="">— Selecciona un destino —</MenuItem>
            {buildingOptions.length > 0 && (
              <MenuItem disabled sx={{ fontWeight: 700, fontSize: '0.7rem', opacity: 0.5, pointerEvents: 'none' }}>
                EDIFICIOS
              </MenuItem>
            )}
            {buildingOptions.map(opt => (
              <MenuItem key={opt.nodeId} value={opt.nodeId}>{opt.label}</MenuItem>
            ))}
            {roomOptions.length > 0 && (
              <MenuItem disabled sx={{ fontWeight: 700, fontSize: '0.7rem', opacity: 0.5, pointerEvents: 'none' }}>
                SALONES / LUGARES
              </MenuItem>
            )}
            {roomOptions.map(opt => (
              <MenuItem key={opt.nodeId} value={opt.nodeId}>{opt.label}</MenuItem>
            ))}
          </TextField>

          {/* Location */}
          <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', mb: 1 }}>
            Posición de inicio
          </Typography>
          <Button
            fullWidth
            variant="outlined"
            size="small"
            startIcon={<MyLocationRoundedIcon />}
            onClick={handleLocate}
            disabled={locating}
            sx={{ mb: 1, borderRadius: '100px', textTransform: 'none' }}
          >
            {locating ? 'Obteniendo GPS…' : 'Usar mi ubicación real'}
          </Button>
          {simPos ? (
            <Box
              sx={{
                bgcolor: '#F0FFF9',
                border: '1px solid #A7F3D0',
                borderRadius: '10px',
                px: 1.5, py: 1,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#4285F4', flexShrink: 0 }} />
              <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#374151' }}>
                {simPos.lat.toFixed(5)}, {simPos.lng.toFixed(5)}
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                bgcolor: '#F8F9FB',
                borderRadius: '10px',
                px: 1.5, py: 1,
                mb: 2,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                O haz clic en el mapa para simular posición
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 1.5 }} />

          {/* Route result */}
          {route && route.nodeIds.length > 0 ? (
            <>
              <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', mb: 1.5 }}>
                Ruta calculada
              </Typography>

              {/* Summary cards */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Box
                  sx={{
                    flex: 1, bgcolor: '#F0FFF9', borderRadius: '12px', p: 1.5, textAlign: 'center',
                    border: '1px solid #A7F3D0',
                  }}
                >
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#00d084', lineHeight: 1 }}>
                    {formatDistance(route.totalDistMeters)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Distancia</Typography>
                </Box>
                <Box
                  sx={{
                    flex: 1, bgcolor: '#EFF6FF', borderRadius: '12px', p: 1.5, textAlign: 'center',
                    border: '1px solid #BFDBFE',
                  }}
                >
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#3B82F6', lineHeight: 1 }}>
                    {formatETA(route.totalDistMeters)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">A pie</Typography>
                </Box>
              </Box>

              {/* Step-by-step */}
              <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', mb: 1 }}>
                Paso a paso ({route.nodeIds.length} nodos)
              </Typography>
              <Box
                sx={{
                  maxHeight: 200,
                  overflowY: 'auto',
                  bgcolor: '#F8F9FB',
                  borderRadius: '12px',
                  p: 1,
                }}
              >
                {route.nodeIds.map((id, idx) => {
                  const node = nodes.find(n => n.nodeId === id);
                  const isFirst = idx === 0;
                  const isLast = idx === route.nodeIds.length - 1;
                  return (
                    <Box
                      key={id}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: '5px', px: 1 }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <Box
                          sx={{
                            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                            bgcolor: isLast ? '#EF4444' : isFirst ? '#4285F4' : '#00d084',
                            border: '2px solid #fff',
                            boxShadow: '0 0 0 1.5px currentColor',
                          }}
                        />
                        {!isLast && (
                          <Box sx={{ width: 1.5, height: 14, bgcolor: '#D1D5DB' }} />
                        )}
                      </Box>
                      <Box>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 700 }}>
                          {id}
                        </Typography>
                        {node?.label && (
                          <Typography variant="caption" color="text.secondary">{node.label}</Typography>
                        )}
                        <Chip
                          label={node?.nodeType ?? '?'}
                          size="small"
                          sx={{ fontSize: '0.6rem', height: 16, mt: '1px' }}
                        />
                      </Box>
                      {isLast && (
                        <Chip
                          label="Destino"
                          size="small"
                          sx={{ ml: 'auto', bgcolor: '#FEE2E2', color: '#B91C1C', fontSize: '0.65rem' }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Box>
            </>
          ) : destNodeId && simPos ? (
            <Alert severity="warning" sx={{ borderRadius: '10px', fontSize: '0.75rem' }}>
              No se encontró ruta entre los nodos seleccionados. Verifica que el grafo esté conectado.
            </Alert>
          ) : (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <DirectionsWalkRoundedIcon sx={{ fontSize: 36, color: '#D1D5DB', mb: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Selecciona un destino y una posición de inicio para calcular la ruta óptima con Dijkstra
              </Typography>
            </Box>
          )}
        </Box>

        {/* Reset */}
        {(simPos || route) && (
          <Box sx={{ p: 2, borderTop: '1px solid #F1F1F1' }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              sx={{ borderRadius: '100px', textTransform: 'none', color: 'text.secondary', borderColor: '#E5E7EB' }}
              onClick={() => { setSimPos(null); setRoute(null); setDestNodeId(''); }}
            >
              Reiniciar simulación
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

function SimClickHandler({ onSimClick }: { onSimClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onSimClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

// ── 2D Pixel Map Editor ───────────────────────────────────────
const RENDER_W = 500;
const RENDER_H = 800;

const NODE_COLORS: Record<string, { bg: string; border: string; size: number }> = {
  BUILDING: { bg: '#00d084', border: '#004628', size: 14 },
  DOOR: { bg: '#8B5CF6', border: '#5B21B6', size: 11 },
  ENTRANCE: { bg: '#3B82F6', border: '#1E40AF', size: 12 },
  WAYPOINT: { bg: '#9CA3AF', border: '#6B7280', size: 9 },
};

function PixelMapEditor({
  nodes,
  edges,
  onUpdatePixel,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onUpdatePixel: (nodeId: string, x: number, y: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [localPixels, setLocalPixels] = useState<Record<string, { x: number; y: number }>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const draggingRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [, forceRender] = useState(0);

  const getPixel = (node: GraphNode) =>
    localPixels[node.nodeId] ?? node.pixel ?? { x: 0, y: 0 };

  const getScale = () => {
    if (!containerRef.current) return 1;
    return containerRef.current.getBoundingClientRect().width / RENDER_W;
  };

  const handlePointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const node = nodes.find(n => n.nodeId === nodeId)!;
    const px = getPixel(node);
    draggingRef.current = {
      nodeId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: px.x,
      origY: px.y,
    };
    setSelected(nodeId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = draggingRef.current;
    if (!drag) return;
    const scale = getScale();
    const dx = (e.clientX - drag.startClientX) / scale;
    const dy = (e.clientY - drag.startClientY) / scale;
    const newX = Math.round(Math.max(0, Math.min(RENDER_W, drag.origX + dx)));
    const newY = Math.round(Math.max(0, Math.min(RENDER_H, drag.origY + dy)));
    setLocalPixels(prev => ({ ...prev, [drag.nodeId]: { x: newX, y: newY } }));
    forceRender(v => v + 1);
  };

  const handlePointerUp = () => {
    const drag = draggingRef.current;
    if (!drag) return;
    const px = localPixels[drag.nodeId];
    if (px) onUpdatePixel(drag.nodeId, px.x, px.y);
    draggingRef.current = null;
  };

  const selectedNode = selected ? nodes.find(n => n.nodeId === selected) : null;
  const selectedPx = selectedNode ? getPixel(selectedNode) : null;

  return (
    <Box sx={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden' }}>
      {/* Canvas */}
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', p: 1 }}>
        <Box
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          sx={{
            position: 'relative',
            width: RENDER_W,
            height: RENDER_H,
            flexShrink: 0,
            backgroundImage: `url(${campusRender})`,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            borderRadius: '18px',
            border: '1px solid #E5E7EB',
            cursor: draggingRef.current ? 'grabbing' : 'default',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            userSelect: 'none',
          }}
        >
          {/* SVG edges */}
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
            viewBox={`0 0 ${RENDER_W} ${RENDER_H}`}
            preserveAspectRatio="none"
          >
            {edges.map(edge => {
              const a = nodes.find(n => n.nodeId === edge.nodeA);
              const b = nodes.find(n => n.nodeId === edge.nodeB);
              if (!a || !b) return null;
              const pa = getPixel(a);
              const pb = getPixel(b);
              return (
                <line
                  key={edge.id}
                  x1={pa.x} y1={pa.y}
                  x2={pb.x} y2={pb.y}
                  stroke="rgba(0,208,132,0.75)"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map(node => {
            const px = getPixel(node);
            const isSelected = selected === node.nodeId;
            const isDragging = draggingRef.current?.nodeId === node.nodeId;
            const { bg, border, size } = NODE_COLORS[node.nodeType] ?? NODE_COLORS.WAYPOINT;
            return (
              <Tooltip
                key={node.nodeId}
                title={
                  <Box>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{node.nodeId}</Typography>
                    {node.label && <Typography sx={{ fontSize: '0.7rem' }}>{node.label}</Typography>}
                    <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#A7F3D0' }}>
                      x: {px.x}, y: {px.y}
                    </Typography>
                  </Box>
                }
                placement="top"
                arrow
              >
                <Box
                  onPointerDown={e => handlePointerDown(e, node.nodeId)}
                  sx={{
                    position: 'absolute',
                    left: px.x,
                    top: px.y,
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    bgcolor: bg,
                    border: `2px solid ${border}`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'grab',
                    zIndex: isDragging ? 10 : isSelected ? 5 : 1,
                    boxShadow: isSelected
                      ? `0 0 0 3px ${bg}66, 0 0 0 5px ${bg}33`
                      : '0 1px 4px rgba(0,0,0,0.35)',
                    transition: isDragging ? 'none' : 'box-shadow 0.15s',
                    '&:hover': { boxShadow: `0 0 0 3px ${bg}55` },
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      {/* Right panel */}
      <Paper
        sx={{
          width: 280,
          borderRadius: '18px',
          border: '1px solid #F1F1F1',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 2.5, borderBottom: '1px solid #F1F1F1' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 0.25 }}>
            Editor de píxeles
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Arrastra los nodos para ajustar su posición en el mapa 2D (espacio {RENDER_W}×{RENDER_H})
          </Typography>
        </Box>

        {/* Selected node info */}
        <Box sx={{ p: 2, borderBottom: '1px solid #F1F1F1' }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', mb: 1 }}>
            Nodo seleccionado
          </Typography>
          {selectedNode && selectedPx ? (
            <Box
              sx={{
                bgcolor: '#F0FFF9',
                border: '1px solid #A7F3D0',
                borderRadius: '12px',
                p: 1.5,
              }}
            >
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>
                {selectedNode.nodeId}
              </Typography>
              {selectedNode.label && (
                <Typography variant="caption" color="text.secondary">{selectedNode.label}</Typography>
              )}
              <Chip
                label={selectedNode.nodeType}
                size="small"
                sx={{ mt: 0.5, display: 'block', width: 'fit-content', fontSize: '0.65rem' }}
              />
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box sx={{ flex: 1, textAlign: 'center', bgcolor: '#fff', borderRadius: '8px', p: 1, border: '1px solid #D1FAE5' }}>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#00d084', lineHeight: 1 }}>
                    {selectedPx.x}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">x</Typography>
                </Box>
                <Box sx={{ flex: 1, textAlign: 'center', bgcolor: '#fff', borderRadius: '8px', p: 1, border: '1px solid #D1FAE5' }}>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#00d084', lineHeight: 1 }}>
                    {selectedPx.y}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">y</Typography>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box sx={{ bgcolor: '#F8F9FB', borderRadius: '12px', p: 2, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Haz clic en un nodo para seleccionarlo
              </Typography>
            </Box>
          )}
        </Box>

        {/* Legend */}
        <Box sx={{ p: 2, borderBottom: '1px solid #F1F1F1' }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', mb: 1 }}>
            Leyenda
          </Typography>
          {Object.entries(NODE_COLORS).map(([type, { bg, border }]) => (
            <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: bg, border: `2px solid ${border}`, flexShrink: 0 }} />
              <Typography variant="body2" color="text.secondary">
                {NODE_TYPE_META[type as NodeType]?.label ?? type}
              </Typography>
            </Box>
          ))}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
            <Box sx={{ width: 24, height: 2, borderTop: '2px dashed #00d084', flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary">Ruta</Typography>
          </Box>
        </Box>

        {/* Node list */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, pb: 1 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
              Nodos ({nodes.length})
            </Typography>
          </Box>
          <List dense sx={{ flex: 1, overflow: 'auto', px: 1 }}>
            {nodes.map(node => {
              const px = getPixel(node);
              const { bg, border } = NODE_COLORS[node.nodeType] ?? NODE_COLORS.WAYPOINT;
              return (
                <ListItem
                  key={node.nodeId}
                  onClick={() => setSelected(node.nodeId)}
                  sx={{
                    borderRadius: '8px',
                    cursor: 'pointer',
                    bgcolor: selected === node.nodeId ? '#F0FFF9' : 'transparent',
                    '&:hover': { bgcolor: '#F8F9FB' },
                    mb: '1px',
                  }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: bg, border: `1.5px solid ${border}`, mr: 1.5, flexShrink: 0 }} />
                  <ListItemText
                    primary={
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700 }}>
                        {node.nodeId}
                      </Typography>
                    }
                    secondary={
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'text.secondary' }}>
                        ({px.x}, {px.y})
                      </Typography>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Paper>
    </Box>
  );
}

// ── Main page ──────────────────────────────────────────────────
type MapTab = 'editor' | 'preview' | 'pixel' | 'ar';

const MAP_TABS: SectionTab<MapTab>[] = [
  { value: 'editor', label: 'Caminos', icon: <EditRoundedIcon sx={{ fontSize: 16 }} /> },
  { value: 'preview', label: 'Vista usuario', icon: <NavigationRoundedIcon sx={{ fontSize: 16 }} /> },
  { value: 'pixel', label: 'Mapa 2D', icon: <GridOnRoundedIcon sx={{ fontSize: 16 }} /> },
  { value: 'ar', label: 'Interior AR', icon: <ViewInArRoundedIcon sx={{ fontSize: 16 }} /> },
];

const MAP_SUBTITLES: Record<MapTab, string> = {
  editor: 'Nodos y caminos exteriores que usa la navegación GPS',
  preview: 'Simula la ruta que verá un estudiante en el mapa exterior',
  pixel: 'Ubica los nodos sobre la imagen 2D del campus',
  ar: 'Destinos de cada salón y escaleras sobre el escaneo 3D de MultiSet',
};

export default function MapPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab: MapTab = MAP_TABS.some(t => t.value === params.get('tab')) ? params.get('tab') as MapTab : 'editor';
  const setTab = (v: MapTab) => setParams(v === 'editor' ? {} : { tab: v }, { replace: true });
  const [mapLayer, setMapLayer] = useState<TileLayerType>('street');
  const [mode, setMode] = useState<Mode>('view');
  const [edgeNodeA, setEdgeNodeA] = useState<string | null>(null);
  // Last placed node in add-node mode — used for auto-chaining
  const [chainNodeId, setChainNodeId] = useState<string | null>(null);
  const [deleteEdgeConfirm, setDeleteEdgeConfirm] = useState<GraphEdge | null>(null);
  const [doorNotice, setDoorNotice] = useState<string | null>(null);
  const [splitting, setSplitting] = useState(false);
  // Local node positions override (for real-time drag feedback before save)
  const localPositions = useRef<Record<string, { lat: number; lng: number }>>({});
  const [, forceRender] = useState(0);

  const { data: rawNodes = [] } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => graphService.getNodes(),
    retry: false,
  });

  const { data: edges = [] } = useQuery({
    queryKey: ['edges'],
    queryFn: () => graphService.getEdges(),
    retry: false,
  });

  // Merge server nodes with any local position overrides
  const nodes: GraphNode[] = rawNodes.map(n => {
    const local = localPositions.current[n.nodeId];
    return local ? { ...n, gps: local } : n;
  });

  const createNodeMutation = useMutation({
    mutationFn: (data: Partial<GraphNode>) => graphService.createNode(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['nodes'] });
      // Auto-chain: connect to previous node
      if (chainNodeId) {
        createEdgeMutation.mutate({ nodeA: chainNodeId, nodeB: created.nodeId, active: true });
      }
      setChainNodeId(created.nodeId);
    },
  });

  const updateNodeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GraphNode> }) =>
      graphService.updateNode(id, data),
    onSuccess: (_, vars) => {
      delete localPositions.current[vars.id];
      qc.invalidateQueries({ queryKey: ['nodes'] });
    },
  });

  const createEdgeMutation = useMutation({
    mutationFn: (data: Partial<GraphEdge>) => graphService.createEdge(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['edges'] });
      setEdgeNodeA(null);
    },
    onError: () => {
      // ignore duplicate edge errors silently
    },
  });

  const deleteEdgeMutation = useMutation({
    mutationFn: (id: string) => graphService.deleteEdge(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['edges'] });
      setDeleteEdgeConfirm(null);
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: (id: string) => graphService.deleteNode(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nodes'] }),
  });

  const handleMapClick = (lat: number, lng: number) => {
    const nodeId = `W${Date.now().toString().slice(-5)}`;
    createNodeMutation.mutate({
      nodeId,
      gps: { lat, lng },
      pixel: { x: 0, y: 0 },
      nodeType: 'WAYPOINT',
      active: true,
    });
  };

  const handleMarkerClick = (nodeId: string) => {
    if (mode === 'add-node') {
      // Re-anchor the chain to this existing node
      setChainNodeId(nodeId);
      return;
    }
    if (mode === 'door') {
      const node = rawNodes.find(n => n.nodeId === nodeId);
      if (node?.nodeType === 'WAYPOINT') handleChangeType(nodeId, 'DOOR');
      else if (node?.nodeType === 'DOOR') handleChangeType(nodeId, 'WAYPOINT');
      else setDoorNotice('Solo los waypoints se convierten en puerta (y una puerta vuelve a waypoint)');
      return;
    }
    if (mode !== 'add-edge') return;
    if (!edgeNodeA) {
      setEdgeNodeA(nodeId);
    } else if (edgeNodeA !== nodeId) {
      createEdgeMutation.mutate({ nodeA: edgeNodeA, nodeB: nodeId, active: true });
    }
  };

  const handleChangeType = (nodeId: string, nodeType: NodeType) => {
    const node = rawNodes.find(n => n.nodeId === nodeId);
    if (!node) return;
    const building = neighborsOf(nodeId, rawNodes, edges).find(n => n.nodeType === 'BUILDING');
    // Una puerta sin nombre toma el de su edificio para reconocerla en la lista
    const label = nodeType === 'DOOR' && !node.label && building ? `Puerta ${building.label ?? building.nodeId}` : node.label;
    updateNodeMutation.mutate({ id: nodeId, data: { ...node, nodeType, label } });
  };

  const handleRename = (nodeId: string, label: string) => {
    const node = rawNodes.find(n => n.nodeId === nodeId);
    if (node) updateNodeMutation.mutate({ id: nodeId, data: { ...node, label: label || undefined } });
  };

  /** Clic sobre el camino que llega a un edificio, donde cruza la fachada: inserta ahí una puerta. */
  const splitEdgeWithDoor = async (edge: GraphEdge, lat: number, lng: number) => {
    const a = rawNodes.find(n => n.nodeId === edge.nodeA);
    const b = rawNodes.find(n => n.nodeId === edge.nodeB);
    if (!a?.gps || !b?.gps) return;
    const building = [a, b].find(n => n.nodeType === 'BUILDING');
    if (!building) {
      setDoorNotice('Haz clic en un camino que llegue a un edificio (resaltados en morado)');
      return;
    }
    // Proyección del clic sobre la arista (plano local, preciso a escala de campus)
    const kx = Math.cos((a.gps.lat * Math.PI) / 180);
    const bx = (b.gps.lng - a.gps.lng) * kx;
    const by = b.gps.lat - a.gps.lat;
    const len2 = bx * bx + by * by;
    const t = len2 > 0 ? Math.max(0.05, Math.min(0.95, (((lng - a.gps.lng) * kx) * bx + (lat - a.gps.lat) * by) / len2)) : 0.5;
    const lerp = (p: number, q: number) => p + (q - p) * t;
    const nodeId = `D${Date.now().toString().slice(-5)}`;
    setSplitting(true);
    try {
      await graphService.createNode({
        nodeId,
        gps: { lat: lerp(a.gps.lat, b.gps.lat), lng: lerp(a.gps.lng, b.gps.lng) },
        pixel: { x: Math.round(lerp(a.pixel?.x ?? 0, b.pixel?.x ?? 0)), y: Math.round(lerp(a.pixel?.y ?? 0, b.pixel?.y ?? 0)) },
        label: `Puerta ${building.label ?? building.nodeId}`,
        nodeType: 'DOOR',
        active: true,
      });
      await graphService.createEdge({ nodeA: edge.nodeA, nodeB: nodeId, active: true });
      await graphService.createEdge({ nodeA: nodeId, nodeB: edge.nodeB, active: true });
      await graphService.deleteEdge(edge.id);
      setDoorNotice(`Puerta ${nodeId} creada. Arrástrala en modo Mover si no quedó justo en la fachada.`);
    } catch {
      setDoorNotice('No se pudo crear la puerta. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setSplitting(false);
      qc.invalidateQueries({ queryKey: ['nodes'] });
      qc.invalidateQueries({ queryKey: ['edges'] });
    }
  };

  const handleEdgeClick = (edge: GraphEdge, lat: number, lng: number) => {
    if (mode === 'door') {
      if (!splitting) void splitEdgeWithDoor(edge, lat, lng);
      return;
    }
    setDeleteEdgeConfirm(edge);
  };

  const handleMarkerDragEnd = (nodeId: string, lat: number, lng: number) => {
    // Update local state immediately for real-time feedback
    localPositions.current[nodeId] = { lat, lng };
    forceRender(v => v + 1);
    // Persist to backend
    const node = rawNodes.find(n => n.nodeId === nodeId);
    if (node) {
      updateNodeMutation.mutate({ id: nodeId, data: { ...node, gps: { lat, lng } } });
    }
  };

  const handleModeChange = (_: unknown, val: Mode | null) => {
    if (!val) return;
    setMode(val);
    setEdgeNodeA(null);
    setChainNodeId(null);
    setDoorNotice(null);
  };

  const handleBreakChain = () => setChainNodeId(null);

  const handlePixelUpdate = (nodeId: string, x: number, y: number) => {
    const node = rawNodes.find(n => n.nodeId === nodeId);
    if (node) {
      updateNodeMutation.mutate({ id: nodeId, data: { ...node, pixel: { x, y } } });
    }
  };

  const center: [number, number] =
    nodes.length > 0
      ? [
          nodes.reduce((s, n) => s + (n.gps?.lat ?? 0), 0) / nodes.length,
          nodes.reduce((s, n) => s + (n.gps?.lng ?? 0), 0) / nodes.length,
        ]
      : [6.149703, -75.366407];

  const modeHint: Record<Mode, string> = {
    view: '',
    'add-node': chainNodeId
      ? `Ancla: ${chainNodeId} — click en mapa para crear y conectar, click en nodo existente para cambiar ancla`
      : 'Haz click en el mapa para el primer nodo, o en un nodo existente para usarlo como ancla',
    'add-edge': edgeNodeA
      ? `Nodo origen: ${edgeNodeA} — ahora haz click en el destino`
      : 'Haz click en el nodo origen de la ruta',
    door: splitting
      ? 'Creando la puerta…'
      : doorNotice ?? 'Clic en un camino morado justo donde cruza la fachada para crear la puerta · clic en un waypoint lo convierte en puerta',
    move: 'Arrastra cualquier marcador para reposicionarlo',
  };

  const modeColor: Record<Mode, 'info' | 'success' | 'warning' | 'error'> = {
    view: 'info',
    'add-node': 'info',
    'add-edge': edgeNodeA ? 'warning' : 'info',
    door: doorNotice && !doorNotice.startsWith('Puerta ') ? 'warning' : doorNotice ? 'success' : 'info',
    move: 'success',
  };

  // Lo que la app necesita para detectar la entrada con precisión: cada edificio con sus puertas bien conectadas
  const doorChecklist = nodes
    .filter(n => n.nodeType === 'BUILDING')
    .map(b => {
      const doors = neighborsOf(b.nodeId, nodes, edges).filter(n => n.nodeType === 'DOOR');
      const broken = doors.filter(d => !doorStatus(d, nodes, edges).ok).length;
      return { id: b.nodeId, label: b.label ?? b.nodeId, doors: doors.length, broken };
    });
  const orphanDoors = nodes.filter(n => n.nodeType === 'DOOR' && !doorStatus(n, nodes, edges).ok);

  return (
    <Box sx={{ height: 'calc(100vh - 64px - 48px)', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Mapa del campus"
        subtitle={MAP_SUBTITLES[tab]}
        action={<SectionTabs value={tab} tabs={MAP_TABS} onChange={setTab} />}
      />

      {tab === 'ar' ? (
        <PoiEditorPage />
      ) : tab === 'preview' ? (
        <UserNavPreview nodes={nodes} edges={edges} />
      ) : tab === 'pixel' ? (
        <PixelMapEditor nodes={nodes} edges={edges} onUpdatePixel={handlePixelUpdate} />
      ) : (
      <>
      <Box sx={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden' }}>
        {/* ── Map ─────────────────────────────────────────────── */}
        <Box
          sx={{
            flex: 1,
            borderRadius: '18px',
            overflow: 'hidden',
            border: '1px solid #F1F1F1',
            position: 'relative',
          }}
        >
          {/* Toolbar */}
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 1000,
              bgcolor: '#fff',
              borderRadius: '12px',
              border: '1px solid #F1F1F1',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              p: '6px',
            }}
          >
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={handleModeChange}
              size="small"
              sx={{
                gap: '2px',
                '& .MuiToggleButton-root': {
                  border: 'none',
                  borderRadius: '8px !important',
                  px: 1.5,
                  py: 0.75,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: '#00d084',
                    color: '#fff',
                    '&:hover': { bgcolor: '#00b874' },
                  },
                },
              }}
            >
              <ToggleButton value="view">
                <VisibilityRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />
                Ver
              </ToggleButton>
              <ToggleButton value="add-node">
                <PlaceRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />
                Nodo
              </ToggleButton>
              <ToggleButton value="add-edge">
                <AltRouteRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />
                Ruta
              </ToggleButton>
              <ToggleButton value="door">
                <DoorFrontRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />
                Puertas
              </ToggleButton>
              <ToggleButton value="move">
                <OpenWithRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />
                Mover
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Hint banner */}
          {mode !== 'view' && (
            <Box
              sx={{
                position: 'absolute',
                top: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Alert
                severity={modeColor[mode]}
                sx={{ borderRadius: '12px', fontSize: '0.75rem', py: 0.5, whiteSpace: 'nowrap' }}
              >
                {modeHint[mode]}
              </Alert>
              {mode === 'add-node' && chainNodeId && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleBreakChain}
                  sx={{
                    borderRadius: '12px',
                    height: 34,
                    fontSize: '0.75rem',
                    bgcolor: '#fff',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Romper cadena
                </Button>
              )}
            </Box>
          )}

          {/* Layer toggle */}
          <Box sx={{ position: 'absolute', bottom: 16, right: 16, zIndex: 1000 }}>
            <Tooltip title={mapLayer === 'street' ? 'Vista satelital (ESRI)' : 'Vista mapa'} placement="left">
              <IconButton
                onClick={() => setMapLayer(l => l === 'street' ? 'satellite' : 'street')}
                sx={{
                  bgcolor: '#fff',
                  border: '1px solid #E5E7EB',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  '&:hover': { bgcolor: '#F8F9FB' },
                }}
              >
                {mapLayer === 'street' ? <SatelliteAltRoundedIcon sx={{ fontSize: 20 }} /> : <MapRoundedIcon sx={{ fontSize: 20 }} />}
              </IconButton>
            </Tooltip>
          </Box>

          <MapContainer
            center={center}
            zoom={18}
            maxZoom={22}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              key={mapLayer}
              attribution={TILE_LAYERS[mapLayer].attribution}
              url={TILE_LAYERS[mapLayer].url}
              maxNativeZoom={TILE_LAYERS[mapLayer].maxNativeZoom}
              maxZoom={22}
            />
            <MapInteraction
              mode={mode}
              nodes={nodes}
              edges={edges}
              edgeNodeA={edgeNodeA}
              chainNodeId={chainNodeId}
              onMapClick={handleMapClick}
              onMarkerClick={handleMarkerClick}
              onMarkerDragEnd={handleMarkerDragEnd}
              onEdgeClick={handleEdgeClick}
              onDeleteNode={id => deleteNodeMutation.mutate(id)}
              onChangeType={handleChangeType}
              onRename={handleRename}
            />
          </MapContainer>
        </Box>

        {/* ── Right panel ──────────────────────────────────────── */}
        <Paper
          sx={{
            width: 280,
            borderRadius: '18px',
            border: '1px solid #F1F1F1',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Stats */}
          <Box sx={{ p: 2, borderBottom: '1px solid #F1F1F1' }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1.5 }}>
              Resumen del grafo
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ flex: 1, bgcolor: '#F8F9FB', borderRadius: '10px', p: 1.5, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#00d084', lineHeight: 1 }}>
                  {nodes.length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Nodos
                </Typography>
              </Box>
              <Box sx={{ flex: 1, bgcolor: '#F8F9FB', borderRadius: '10px', p: 1.5, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#6366F1', lineHeight: 1 }}>
                  {edges.length}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Rutas
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Legend */}
          <Box sx={{ p: 2, borderBottom: '1px solid #F1F1F1' }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Leyenda
            </Typography>
            {[
              ...NODE_TYPES.map(t => ({ color: NODE_TYPE_META[t].color, border: NODE_TYPE_META[t].border, label: NODE_TYPE_META[t].label })),
              { color: '#F59E0B', border: '#D97706', label: 'Seleccionado' },
              { color: '#EC4899', border: '#BE185D', label: 'Ya conectado' },
            ].map(item => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
                <Box
                  sx={{
                    width: 12, height: 12, borderRadius: '50%',
                    bgcolor: item.color, border: `2px solid ${item.border}`,
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {item.label}
                </Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
              <Box sx={{ width: 24, height: 2, bgcolor: '#00d084', flexShrink: 0, borderRadius: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Ruta activa</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
              <Box sx={{ width: 24, height: 2, borderTop: '2px dashed #F59E0B', flexShrink: 0 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Vista previa</Typography>
            </Box>
          </Box>

          {/* Door checklist */}
          <Box sx={{ p: 2, borderBottom: '1px solid #F1F1F1', maxHeight: 220, overflowY: 'auto' }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', mb: 0.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Puertas por edificio
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              La app detecta la entrada y termina la ruta en estas puertas
            </Typography>
            {doorChecklist.map(b => (
              <Box key={b.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>{b.label}</Typography>
                <Chip
                  size="small"
                  label={b.doors === 0 ? 'Sin puertas' : b.broken > 0 ? `${b.broken} sin conectar` : `${b.doors} puerta${b.doors > 1 ? 's' : ''}`}
                  sx={{
                    fontSize: '0.65rem', height: 20,
                    bgcolor: b.doors === 0 || b.broken > 0 ? '#FEF3C7' : '#EDE9FE',
                    color: b.doors === 0 || b.broken > 0 ? '#92400E' : '#5B21B6',
                  }}
                />
              </Box>
            ))}
            {orphanDoors.length > 0 && (
              <Alert severity="warning" sx={{ mt: 1, py: 0, fontSize: '0.7rem' }}>
                Puertas sin edificio o sin camino: {orphanDoors.map(d => d.nodeId).join(', ')}
              </Alert>
            )}
          </Box>

          {/* Edge list */}
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, pb: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                Rutas activas
              </Typography>
            </Box>
            <List dense sx={{ flex: 1, overflow: 'auto', px: 1 }}>
              {edges.slice(0, 50).map(edge => (
                <ListItem
                  key={edge.id}
                  sx={{ borderRadius: '8px', '&:hover': { bgcolor: '#F9FAFB' } }}
                  secondaryAction={
                    <Tooltip title="Eliminar">
                      <IconButton
                        size="small"
                        onClick={() => setDeleteEdgeConfirm(edge)}
                        sx={{ color: '#EF4444' }}
                      >
                        <DeleteRoundedIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  <ListItemText
                    primary={
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600 }}>
                        {edge.nodeA} ↔ {edge.nodeB}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
              {edges.length === 0 && (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Sin rutas. Usa el modo "Ruta" para agregar.
                  </Typography>
                </Box>
              )}
            </List>
          </Box>
        </Paper>
      </Box>

      {/* Delete edge confirm */}
      {deleteEdgeConfirm && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: '#fff',
            border: '1px solid #F1F1F1',
            borderRadius: '14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            p: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            zIndex: 2000,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            ¿Eliminar ruta{' '}
            <strong>
              {deleteEdgeConfirm.nodeA} ↔ {deleteEdgeConfirm.nodeB}
            </strong>
            ?
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" size="small" onClick={() => setDeleteEdgeConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => deleteEdgeMutation.mutate(deleteEdgeConfirm.id)}
              sx={{ background: '#EF4444', '&:hover': { background: '#DC2626' } }}
            >
              Eliminar
            </Button>
          </Box>
        </Box>
      )}
      </> /* closes editor fragment */
      )}
    </Box>
  );
}
