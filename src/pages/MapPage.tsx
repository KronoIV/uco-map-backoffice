import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Popup, useMap, Tooltip as MapTooltip } from 'react-leaflet';
import L from 'leaflet';
import {
  Box, Paper, Typography, Button, Chip,
  List, ListItem, ListItemText, Tooltip, IconButton, Alert,
  TextField, MenuItem, Divider, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import AltRouteRoundedIcon from '@mui/icons-material/AltRouteRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import NavigationRoundedIcon from '@mui/icons-material/NavigationRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DirectionsWalkRoundedIcon from '@mui/icons-material/DirectionsWalkRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import GridOnRoundedIcon from '@mui/icons-material/GridOnRounded';
import SatelliteAltRoundedIcon from '@mui/icons-material/SatelliteAltRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import DoorFrontRoundedIcon from '@mui/icons-material/DoorFrontRounded';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { graphService } from '../services/graphService';
import { roomService } from '../services/roomService';
import { buildingService } from '../services/buildingService';
import type { Building, GraphNode, GraphEdge, NodeType } from '../types';
import PageHeader from '../components/PageHeader';
import SectionTabs, { type SectionTab } from '../components/SectionTabs';
import PoiEditorPage from './PoiEditorPage';
import CampusMap3D, { type EdgeLook, type NodeLook } from '../components/map3d/CampusMap3D';
import { DOOR_EXTRA_PX, doorIconHtml, nodeBadgeHtml, poiIconHtml } from '../components/map3d/doorIcon';
import { POI_TYPES, poiTypeOf } from '../utils/poi-catalog';
import {
  buildRoutingGraph, routeToBuilding, routeToNode, routeLabel, nodeTypeOf, haversineDistance, formatDistance, walkingMinutes,
} from '../utils/campus-routing';
import { buildingsCrossed, footprintAt, type Footprint } from '../utils/campus-osm';
import { useCampusOsm } from '../hooks/useCampusOsm';
import campusRender from '../assets/campus-render.webp';

// Fix default leaflet icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeIcon(color: string, borderColor: string, size: number, ring = false, badge: string | null = null) {
  const s = badge ? size + DOOR_EXTRA_PX : size;
  const ringStyle = ring
    ? `box-shadow:0 0 0 3px ${color}55, 0 0 0 5px ${color}22;`
    : '';
  return L.divIcon({
    html: badge
      ?? `<div style="background:${color};border:2px solid ${borderColor};border-radius:50%;width:${s}px;height:${s}px;${ringStyle}transition:transform 0.1s;"></div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    className: '',
  });
}

const NODE_TYPE_META: Record<NodeType, { label: string; help: string; color: string; border: string; size: number }> = {
  WAYPOINT: { label: 'Punto de camino', help: 'Curva o cruce de un sendero', color: '#9CA3AF', border: '#6B7280', size: 11 },
  DOOR: { label: 'Entrada de edificio', help: 'Por donde se entra; va sobre la fachada', color: '#8B5CF6', border: '#5B21B6', size: 14 },
  BUILDING: { label: 'Edificio', help: 'Destino de la ruta', color: '#00d084', border: '#004628', size: 18 },
  ENTRANCE: { label: 'Entrada al campus', help: 'Portería o acceso desde la calle', color: '#3B82F6', border: '#1E40AF', size: 14 },
  POI: { label: 'Punto de interés', help: 'Cafetería u otro lugar que la app lista aparte', color: '#B45309', border: '#78350F', size: 14 },
};
const NODE_TYPES = Object.keys(NODE_TYPE_META) as NodeType[];

type NodeKind = Pick<GraphNode, 'nodeType' | 'poiType'>;

const iconCache = new Map<string, L.DivIcon>();
/** Icono Leaflet de un punto (puerta, emoji de su clase o círculo), uno por apariencia. */
function nodeIcon(node: NodeKind, look: NodeLook): L.DivIcon {
  const badge = nodeBadgeHtml(node, look.color, look.border, look.size, look.ring);
  const key = `${look.color}|${look.border}|${look.size}|${look.ring}|${badge}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = makeIcon(look.color, look.border, look.size, look.ring, badge);
    iconCache.set(key, icon);
  }
  return icon;
}

/** Muestra de un tipo de punto con el mismo dibujo del mapa (puerta, emoji del POI o círculo). */
function TypeSwatch({ type, size, poiType }: { type: NodeType; size: number; poiType?: string | null }) {
  const m = NODE_TYPE_META[type] ?? NODE_TYPE_META.WAYPOINT;
  const html = type === 'DOOR' ? doorIconHtml(m.color, m.border, size + 4)
    : type === 'POI' ? poiIconHtml(poiTypeOf(poiType ?? POI_TYPES[0]?.key).emoji, poiTypeOf(poiType ?? POI_TYPES[0]?.key).color, size + 6)
    : null;
  if (html) return <Box sx={{ flexShrink: 0, display: 'flex' }} dangerouslySetInnerHTML={{ __html: html }} />;
  return <Box sx={{ width: size, height: size, borderRadius: '50%', bgcolor: m.color, border: `2px solid ${m.border}`, flexShrink: 0 }} />;
}

// Mismos colores en el mapa 3D que en el 2D; cada clase de POI con su color del catálogo
const typeLook = (n: NodeKind): NodeLook => {
  const m = NODE_TYPE_META[n.nodeType] ?? NODE_TYPE_META.WAYPOINT;
  return { color: n.nodeType === 'POI' ? poiTypeOf(n.poiType).color : m.color, border: m.border, size: m.size };
};

const nodeTypeLabel = (n: NodeKind) =>
  n.nodeType === 'POI' ? poiTypeOf(n.poiType).label : NODE_TYPE_META[n.nodeType]?.label ?? n.nodeType;

/** Clase y ubicación de un punto de interés: lo que la app usa para listarlo y trazar la ruta. */
function PoiFields({
  node, neighbors, buildings, disabled, onChange,
}: {
  node: GraphNode;
  neighbors: number;
  buildings: Building[];
  disabled: boolean;
  onChange: (patch: Pick<GraphNode, 'poiType' | 'buildingId'>) => void;
}) {
  const known = POI_TYPES.some(t => t.key === node.poiType);
  const building = buildings.find(b => b.buildingId === node.buildingId);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField select size="small" label="Clase" value={node.poiType ?? ''} disabled={disabled}
        onChange={e => onChange({ poiType: e.target.value, buildingId: node.buildingId ?? null })}>
        {POI_TYPES.map(t => <MenuItem key={t.key} value={t.key}>{t.emoji} {t.label}</MenuItem>)}
        {!known && node.poiType && <MenuItem value={node.poiType}>{poiTypeOf(node.poiType).emoji} {node.poiType}</MenuItem>}
      </TextField>
      <TextField select size="small" label="Ubicación" value={node.buildingId ?? ''} disabled={disabled}
        onChange={e => onChange({ poiType: node.poiType ?? null, buildingId: e.target.value || null })}>
        <MenuItem value="">Al aire libre</MenuItem>
        {buildings.map(b => <MenuItem key={b.buildingId} value={b.buildingId}>Dentro de {b.label}</MenuItem>)}
      </TextField>
      <Alert severity={building || neighbors > 0 ? 'success' : 'warning'} sx={alertSx}>
        {building
          ? `La app guía hasta ${building.label} y allí indica buscar «${nodeName(node)}».`
          : neighbors > 0
            ? 'La ruta llega hasta este punto por los senderos.'
            : 'Sin camino: únelo a un sendero con «Dibujar camino desde aquí» o la app trazará una línea recta.'}
      </Alert>
    </Box>
  );
}
const SELECTED_LOOK: NodeLook = { color: '#F59E0B', border: '#D97706', size: 18, ring: true };

const MIN_FLOOR = -5;
const MAX_FLOOR = 60;

/** Texto del campo → piso; undefined si no es un piso válido. */
function parseFloor(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= MIN_FLOOR && n <= MAX_FLOOR ? n : undefined;
}

function FloorField({ node, disabled, onChange }: { node: GraphNode; disabled: boolean; onChange: (floor: number | null) => void }) {
  const [error, setError] = useState(false);
  const door = node.nodeType === 'DOOR';
  const save = (text: string) => {
    const floor = parseFloor(text);
    setError(floor === undefined);
    if (floor !== undefined && floor !== (node.floor ?? null)) onChange(floor);
  };
  return (
    <TextField
      key={`${node.nodeId}-${node.floor ?? ''}`}
      size="small"
      type="number"
      label={door ? 'Piso de esta salida' : 'Piso'}
      defaultValue={node.floor ?? ''}
      disabled={disabled}
      error={error}
      helperText={error
        ? `Un número entero entre ${MIN_FLOOR} y ${MAX_FLOOR}`
        : door ? 'Por qué piso se sale a la calle. Negativo = sótano.' : 'Dónde buscarlo dentro del edificio. Negativo = sótano.'}
      slotProps={{ htmlInput: { min: MIN_FLOOR, max: MAX_FLOOR, step: 1 } }}
      onBlur={e => save(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

/** Igual que la app: «N min» a 1.2 m/s. */
const formatEta = (meters: number) => {
  const min = walkingMinutes(meters);
  return min <= 1 ? '1 min' : `${min} min`;
};

const VIEW_3D_KEY = 'ucomap.admin.map3d';

/** 2D (Leaflet, para editar con precisión) o 3D (como lo ve el estudiante en la app). */
function useView3d() {
  const [view3d, setView3d] = useState(() => {
    try { return localStorage.getItem(VIEW_3D_KEY) === '1'; } catch { return false; }
  });
  const change = (v: boolean) => {
    setView3d(v);
    try { localStorage.setItem(VIEW_3D_KEY, v ? '1' : '0'); } catch { /* modo privado */ }
  };
  return [view3d, change] as const;
}

function MapViewControls({
  view3d, onView3d, layer, onLayer,
}: { view3d: boolean; onView3d: (v: boolean) => void; layer: TileLayerType; onLayer: () => void }) {
  return (
    <Box sx={{ position: 'absolute', bottom: 16, right: 16, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 1 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={view3d ? '3d' : '2d'}
        onChange={(_, v) => v && onView3d(v === '3d')}
        sx={{ bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', borderRadius: '10px', '& .MuiToggleButton-root': { px: 1.5, fontWeight: 700, textTransform: 'none' } }}
      >
        <ToggleButton value="2d">2D</ToggleButton>
        <ToggleButton value="3d">3D</ToggleButton>
      </ToggleButtonGroup>
      <Tooltip title={layer === 'street' ? 'Vista satelital (ESRI)' : 'Vista mapa'} placement="left">
        <IconButton
          onClick={onLayer}
          sx={{ bgcolor: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', '&:hover': { bgcolor: '#F8F9FB' } }}
        >
          {layer === 'street' ? <SatelliteAltRoundedIcon sx={{ fontSize: 20 }} /> : <MapRoundedIcon sx={{ fontSize: 20 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}

type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string; lat: number; lng: number }
  | null;
/** Dibujando un camino: `from` es el último punto (null hasta el primer clic). */
type Drawing = { from: string | null } | null;
type Notice = { text: string; severity: 'success' | 'info' | 'warning' };

const nodeName = (n: GraphNode | undefined) => n?.label || n?.nodeId || '?';

const neighborsOf = (nodeId: string, nodes: GraphNode[], edges: GraphEdge[]) => {
  const found = new Map<string, GraphNode>();
  for (const e of edges) {
    const other = e.nodeA === nodeId ? e.nodeB : e.nodeB === nodeId ? e.nodeA : null;
    const n = other ? nodes.find(x => x.nodeId === other) : undefined;
    if (n) found.set(n.nodeId, n);
  }
  return [...found.values()];
};

/** Posición (0–1) del clic a lo largo de la arista, sin pegarse a los extremos. */
function projectOnEdge(a: { lat: number; lng: number }, b: { lat: number; lng: number }, lat: number, lng: number) {
  const kx = Math.cos((a.lat * Math.PI) / 180);
  const bx = (b.lng - a.lng) * kx;
  const by = b.lat - a.lat;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return 0.5;
  return Math.max(0.05, Math.min(0.95, (((lng - a.lng) * kx) * bx + (lat - a.lat) * by) / len2));
}

/** Lo que la app necesita de una entrada: un edificio y al menos un camino conectados. */
function doorStatus(node: GraphNode, nodes: GraphNode[], edges: GraphEdge[]) {
  const near = neighborsOf(node.nodeId, nodes, edges);
  const building = near.find(n => n.nodeType === 'BUILDING');
  const paths = near.filter(n => n.nodeType !== 'BUILDING').length;
  if (!building) return { ok: false, text: 'Esta entrada no está unida a ningún edificio. Dibuja un camino desde ella hasta el edificio.' };
  if (paths === 0) return { ok: false, text: `Entrada de ${nodeName(building)}: dibuja un camino desde ella hasta el sendero.` };
  return { ok: true, text: `Entrada de ${nodeName(building)}` };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 0.75 }}>
      {children}
    </Typography>
  );
}

function TypePicker({ value, onChange }: { value: NodeType; onChange: (t: NodeType) => void }) {
  return (
    <Box role="radiogroup" sx={{ display: 'grid', gap: 0.75 }}>
      {NODE_TYPES.map(t => {
        const m = NODE_TYPE_META[t];
        const active = t === value;
        return (
          <Box
            key={t}
            role="radio"
            aria-checked={active}
            tabIndex={0}
            onClick={() => !active && onChange(t)}
            onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !active) onChange(t); }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.25, p: 1, borderRadius: '10px',
              cursor: active ? 'default' : 'pointer',
              border: `1.5px solid ${active ? m.color : '#E5E7EB'}`,
              bgcolor: active ? `${m.color}1A` : '#fff',
              '&:hover': { borderColor: m.color },
            }}
          >
            <TypeSwatch type={t} size={14} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: active ? 700 : 600, lineHeight: 1.3 }}>{m.label}</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1.3 }}>{m.help}</Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function ConfirmDelete({ label, onConfirm, disabled }: { label: string; onConfirm: () => void; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button size="small" color="error" startIcon={<DeleteRoundedIcon />} disabled={disabled} onClick={() => setAsking(true)} sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
        {label}
      </Button>
    );
  }
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button size="small" variant="outlined" onClick={() => setAsking(false)} sx={{ flex: 1, textTransform: 'none' }}>Cancelar</Button>
      <Button size="small" variant="contained" color="error" disabled={disabled} onClick={onConfirm} sx={{ flex: 1, textTransform: 'none' }}>Sí, eliminar</Button>
    </Box>
  );
}

const alertSx = { py: 0, fontSize: '0.75rem', borderRadius: '10px' };
const pillSx = { textTransform: 'none', borderRadius: '100px', fontWeight: 600 } as const;

function NodeDetails({
  node, nodes, edges, buildings, busy, onRename, onChangeType, onPoiChange, onFloorChange, onDrawFrom, onDelete, onSelect,
}: {
  node: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  buildings: Building[];
  busy: boolean;
  onRename: (nodeId: string, label: string) => void;
  onChangeType: (nodeId: string, type: NodeType) => void;
  onPoiChange: (nodeId: string, patch: Pick<GraphNode, 'poiType' | 'buildingId'>) => void;
  onFloorChange: (nodeId: string, floor: number | null) => void;
  onDrawFrom: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
}) {
  const near = neighborsOf(node.nodeId, nodes, edges);
  const doors = near.filter(n => n.nodeType === 'DOOR').length;
  const status = node.nodeType === 'DOOR' ? doorStatus(node, nodes, edges) : null;
  const save = (value: string) => {
    const label = value.trim();
    if (label !== (node.label ?? '')) onRename(node.nodeId, label);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        key={`${node.nodeId}-${node.label ?? ''}`}
        size="small"
        label="Nombre"
        defaultValue={node.label ?? ''}
        placeholder={node.nodeType === 'DOOR' ? 'Entrada principal' : node.nodeType === 'POI' ? `${poiTypeOf(node.poiType).label} central` : 'Opcional'}
        helperText={`Identificador: ${node.nodeId}`}
        onBlur={e => save(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
      <Box>
        <SectionLabel>¿Qué es este punto?</SectionLabel>
        <TypePicker value={node.nodeType} onChange={t => onChangeType(node.nodeId, t)} />
      </Box>
      {node.nodeType === 'POI' && (
        <PoiFields node={node} neighbors={near.length} buildings={buildings} disabled={busy}
          onChange={patch => onPoiChange(node.nodeId, patch)} />
      )}
      {(node.nodeType === 'DOOR' || (node.nodeType === 'POI' && node.buildingId)) && (
        <FloorField node={node} disabled={busy} onChange={floor => onFloorChange(node.nodeId, floor)} />
      )}
      {status && <Alert severity={status.ok ? 'success' : 'warning'} sx={alertSx}>{status.text}</Alert>}
      {node.nodeType === 'BUILDING' && (
        <Alert severity={doors > 0 ? 'success' : 'info'} sx={alertSx}>
          {doors > 0
            ? `${doors} entrada${doors > 1 ? 's' : ''}: la ruta termina en la más conveniente para el usuario.`
            : 'Aún no tiene entradas. Toca el camino morado que llega al edificio, justo donde cruza la fachada, y elige «Poner entrada aquí».'}
        </Alert>
      )}
      {node.nodeType === 'BUILDING' && (
        <Typography variant="caption" color="text.secondary">
          También aparece en{' '}
          <RouterLink to="/campus" style={{ color: 'inherit', fontWeight: 600 }}>Campus → Edificios</RouterLink>
          , donde se elige su color y la categoría de sus salones.
        </Typography>
      )}
      {near.length > 0 && (
        <Box>
          <SectionLabel>Unido a</SectionLabel>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {near.map(n => (
              <Chip
                key={n.nodeId}
                size="small"
                label={nodeName(n)}
                onClick={() => onSelect(n.nodeId)}
                sx={{ fontSize: '0.7rem', bgcolor: `${NODE_TYPE_META[n.nodeType]?.color ?? '#9CA3AF'}26` }}
              />
            ))}
          </Box>
        </Box>
      )}
      <Button variant="outlined" startIcon={<AltRouteRoundedIcon />} disabled={busy} onClick={() => onDrawFrom(node.nodeId)} sx={pillSx}>
        Dibujar camino desde aquí
      </Button>
      <ConfirmDelete key={node.nodeId} label="Eliminar punto" disabled={busy} onConfirm={() => onDelete(node.nodeId)} />
    </Box>
  );
}

function EdgeDetails({
  edge, nodes, busy, onDoor, onSplit, onDelete, onSelect,
}: {
  edge: GraphEdge;
  nodes: GraphNode[];
  busy: boolean;
  onDoor: () => void;
  onSplit: () => void;
  onDelete: () => void;
  onSelect: (nodeId: string) => void;
}) {
  const a = nodes.find(n => n.nodeId === edge.nodeA);
  const b = nodes.find(n => n.nodeId === edge.nodeB);
  const meters = a?.gps && b?.gps ? haversineDistance(a.gps.lat, a.gps.lng, b.gps.lat, b.gps.lng) : null;
  const building = [a, b].find(n => n?.nodeType === 'BUILDING');
  const hasDoor = [a, b].some(n => n?.nodeType === 'DOOR');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <SectionLabel>Camino entre</SectionLabel>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {[a, b].map((n, i) => n && (
            <Chip key={n.nodeId} size="small" label={nodeName(n)} onClick={() => onSelect(n.nodeId)}
              sx={{ fontSize: '0.72rem', bgcolor: `${NODE_TYPE_META[n.nodeType]?.color ?? '#9CA3AF'}26`, order: i * 2 }} />
          ))}
          <Typography sx={{ order: 1, color: 'text.secondary' }}>↔</Typography>
        </Box>
        {meters !== null && (
          <Typography variant="caption" color="text.secondary">{Math.round(meters)} m de largo</Typography>
        )}
      </Box>
      {building && !hasDoor && (
        <>
          <Alert severity="info" sx={alertSx}>
            ¿Por aquí se entra a {nodeName(building)}? Toca el camino justo donde cruza la fachada y pon la entrada.
          </Alert>
          <Button variant="contained" startIcon={<DoorFrontRoundedIcon />} disabled={busy} onClick={onDoor}
            sx={{ ...pillSx, bgcolor: '#8B5CF6', '&:hover': { bgcolor: '#7C3AED' } }}>
            Poner entrada aquí
          </Button>
        </>
      )}
      <Box>
        <Button variant="outlined" startIcon={<PlaceRoundedIcon />} disabled={busy} onClick={onSplit} sx={{ ...pillSx, width: '100%' }}>
          Agregar punto aquí
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Para que el camino siga una curva: agrega un punto y arrástralo.
        </Typography>
      </Box>
      <ConfirmDelete key={edge.id} label="Eliminar camino" disabled={busy} onConfirm={onDelete} />
    </Box>
  );
}

// ── Inner component that lives inside MapContainer ──────────────
/** Edificio elegido: sus caminos se resaltan porque ahí se marca la entrada. */
function selectedBuildingOf(selection: Selection, nodes: GraphNode[]): string | null {
  const id = selection?.kind === 'node' ? selection.id : null;
  return id && nodes.find(n => n.nodeId === id)?.nodeType === 'BUILDING' ? id : null;
}

function editorEdgeLook(edge: GraphEdge, selection: Selection, selectedBuilding: string | null, crossing = false): EdgeLook {
  const selected = selection?.kind === 'edge' && selection.id === edge.id;
  const ofBuilding = !!selectedBuilding && (edge.nodeA === selectedBuilding || edge.nodeB === selectedBuilding);
  const color = selected ? '#F59E0B' : crossing ? '#EF4444' : ofBuilding ? '#8B5CF6' : '#00d084';
  return { color, width: selected || ofBuilding || crossing ? 7 : 5, opacity: 0.9 };
}

// Márgenes por el error de las plantas de OSM y de la ubicación de los puntos
const CROSSING_MIN_M = 2;
const DOOR_MAX_DEPTH_M = 3;

/**
 * Lo que haría ver la ruta atravesando un edificio: caminos que cruzan su planta en OSM y entradas metidas
 * dentro. El tramo de una entrada (o un punto) al centro de su propio edificio es interno y no cuenta.
 */
function buildingIssues(nodes: GraphNode[], edges: GraphEdge[], footprints: Footprint[]) {
  const byId = new Map(nodes.map(n => [n.nodeId, n]));
  const crossings: { edge: GraphEdge; building: string; meters: number; at: { lat: number; lng: number } }[] = [];
  for (const edge of edges) {
    const a = byId.get(edge.nodeA);
    const b = byId.get(edge.nodeB);
    if (!a?.gps || !b?.gps) continue;
    const own = [a, b].filter(n => n.nodeType === 'BUILDING').map(n => footprintAt(n.gps, footprints)?.footprint.id);
    for (const c of buildingsCrossed(a.gps, b.gps, footprints, CROSSING_MIN_M)) {
      if (own.includes(c.footprint.id)) continue;
      const at = { lat: (a.gps.lat + b.gps.lat) / 2, lng: (a.gps.lng + b.gps.lng) / 2 };
      crossings.push({ edge, building: c.footprint.name || 'un edificio', meters: c.meters, at });
    }
  }
  const deepDoors = nodes.flatMap(n => {
    const inside = n.nodeType === 'DOOR' && n.gps ? footprintAt(n.gps, footprints) : null;
    return inside && inside.depth > DOOR_MAX_DEPTH_M
      ? [{ node: n, building: inside.footprint.name || 'el edificio', depth: inside.depth }]
      : [];
  });
  return { crossings, deepDoors, crossingIds: new Set(crossings.map(c => c.edge.id)) };
}

function MapInteraction({
  nodes,
  edges,
  selection,
  drawing,
  crossingIds,
  onMapClick,
  onNodeClick,
  onEdgeClick,
  onNodeDragEnd,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selection: Selection;
  drawing: Drawing;
  crossingIds: Set<string>;
  onMapClick: (lat: number, lng: number) => void;
  onNodeClick: (nodeId: string) => void;
  onEdgeClick: (edge: GraphEdge, lat: number, lng: number) => void;
  onNodeDragEnd: (nodeId: string, lat: number, lng: number) => void;
}) {
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(null);

  useMapEvents({
    click(e) { onMapClick(e.latlng.lat, e.latlng.lng); },
    mousemove(e) { setCursorPos(drawing?.from ? [e.latlng.lat, e.latlng.lng] : null); },
  });

  const fromPos = drawing?.from ? nodes.find(n => n.nodeId === drawing.from)?.gps : null;
  const selectedNodeId = selection?.kind === 'node' ? selection.id : null;
  const selectedBuilding = selectedBuildingOf(selection, nodes);

  return (
    <>
      {edges.map(edge => {
        const a = nodes.find(n => n.nodeId === edge.nodeA);
        const b = nodes.find(n => n.nodeId === edge.nodeB);
        if (!a?.gps || !b?.gps) return null;
        const look = editorEdgeLook(edge, selection, selectedBuilding, crossingIds.has(edge.id));
        return (
          <Polyline
            key={edge.id}
            positions={[[a.gps.lat, a.gps.lng], [b.gps.lat, b.gps.lng]]}
            pathOptions={{
              color: look.color,
              weight: look.width,
              opacity: look.opacity,
              bubblingMouseEvents: false,
            }}
            eventHandlers={{ click: e => onEdgeClick(edge, e.latlng.lat, e.latlng.lng) }}
          />
        );
      })}

      {/* Dónde quedaría la entrada o el punto nuevo */}
      {selection?.kind === 'edge' && (
        <Marker
          position={[selection.lat, selection.lng]}
          interactive={false}
          icon={makeIcon('#F59E0B', '#fff', 12, true)}
        />
      )}

      {fromPos && cursorPos && (
        <Polyline
          positions={[[fromPos.lat, fromPos.lng], cursorPos]}
          pathOptions={{ color: '#F59E0B', weight: 3, opacity: 0.9, dashArray: '6 5', interactive: false }}
        />
      )}

      {nodes.map(node => {
        if (!node.gps) return null;
        const highlighted = node.nodeId === selectedNodeId || node.nodeId === drawing?.from;
        return (
          <Marker
            key={node.nodeId}
            position={[node.gps.lat, node.gps.lng]}
            icon={nodeIcon(node, highlighted ? SELECTED_LOOK : typeLook(node))}
            draggable={!drawing}
            eventHandlers={{
              click: () => onNodeClick(node.nodeId),
              dragend(e) {
                const { lat, lng } = (e.target as L.Marker).getLatLng();
                onNodeDragEnd(node.nodeId, lat, lng);
              },
            }}
          >
            <MapTooltip direction="top" offset={[0, -8]}>
              {nodeName(node)} · {nodeTypeLabel(node)}
            </MapTooltip>
          </Marker>
        );
      })}
    </>
  );
}

function FocusOn({ target }: { target: { lat: number; lng: number; n: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 19), { duration: 0.6 });
  }, [map, target]);
  return null;
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
function UserNavPreview({
  nodes, edges, view3d, onView3d,
}: { nodes: GraphNode[]; edges: GraphEdge[]; view3d: boolean; onView3d: (v: boolean) => void }) {
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

  const poiOptions = nodes
    .filter(n => n.nodeType === 'POI')
    .map(n => ({ nodeId: n.nodeId, label: `${poiTypeOf(n.poiType).emoji} ${nodeName(n)}` }));

  const { data: buildings = [] } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => buildingService.getAll(),
    retry: false,
  });



  const [destNodeId, setDestNodeId] = useState('');
  const [simPos, setSimPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [mapLayer, setMapLayer] = useState<TileLayerType>('street');
  const osm = useCampusOsm(nodes);

  // Mismo grafo que carga la app (solo activos con GPS) y mismo algoritmo (utils/campus-routing.ts)
  const graph = useMemo(() => buildRoutingGraph(
    nodes.filter(n => n.active !== false && n.gps).map(n => ({ id: n.nodeId, gps: n.gps, label: n.label, nodeType: n.nodeType })),
    edges.filter(e => e.active !== false).map(e => [e.nodeA, e.nodeB] as [string, string]),
  ), [nodes, edges]);

  // A un edificio la app llega por su puerta más conveniente; a un POI dentro de un edificio, a ese edificio
  const route = useMemo(() => {
    if (!destNodeId || !simPos) return null;
    const dest = nodes.find(n => n.nodeId === destNodeId);
    const parent = dest?.nodeType === 'POI' && dest.buildingId
      ? buildings.find(b => b.buildingId === dest.buildingId) : undefined;
    const target = parent ? (parent.nodeId || parent.buildingId) : destNodeId;
    return nodeTypeOf(graph, target) === 'BUILDING'
      ? routeToBuilding(graph, simPos.lat, simPos.lng, target)
      : routeToNode(graph, simPos.lat, simPos.lng, target);
  }, [graph, destNodeId, simPos, nodes, buildings]);

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

  // Polilínea como en la app: usuario → punto donde entra al sendero → nodos
  const routePath = useMemo(() => {
    if (!route || !simPos) return [];
    const pts = [simPos, ...(route.startVia ? [route.startVia] : [])];
    for (const id of route.nodeIds) {
      const gps = graph.nodes.get(id)?.gps;
      if (gps) pts.push(gps);
    }
    return pts;
  }, [route, simPos, graph]);
  const routePositions = useMemo(() => routePath.map(p => [p.lat, p.lng] as [number, number]), [routePath]);
  const routeEnd = route?.nodeIds[route.nodeIds.length - 1];

  const previewNodeLook = (node: GraphNode): NodeLook =>
    node.nodeId === destNodeId || node.nodeId === routeEnd
      ? { color: '#EF4444', border: '#B91C1C', size: 20, ring: true }
      : route?.nodeIds.includes(node.nodeId)
        ? { color: '#00d084', border: '#004628', size: 14, ring: true }
        : typeLook(node);

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

        <MapViewControls
          view3d={view3d}
          onView3d={onView3d}
          layer={mapLayer}
          onLayer={() => setMapLayer(l => l === 'street' ? 'satellite' : 'street')}
        />

        {view3d ? (
          <CampusMap3D
            nodes={nodes}
            edges={edges}
            satellite={mapLayer === 'satellite'}
            osm={osm}
            nodeLook={previewNodeLook}
            nodeTitle={n => `${nodeName(n)} · ${nodeTypeLabel(n)}`}
            edgeLook={() => ({ color: '#64748B', width: 4, opacity: 0.6 })}
            route={routePath}
            userPos={simPos}
            onMapClick={handleSimClick}
          />
        ) : (
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
            const look = previewNodeLook(node);
            return (
              <Marker key={node.nodeId} position={[node.gps.lat, node.gps.lng]} icon={nodeIcon(node, look)}>
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
        )}
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
            {poiOptions.length > 0 && (
              <MenuItem disabled sx={{ fontWeight: 700, fontSize: '0.7rem', opacity: 0.5, pointerEvents: 'none' }}>
                PUNTOS DE INTERÉS
              </MenuItem>
            )}
            {poiOptions.map(opt => (
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
          {route && !route.direct ? (
            <>
              <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', mb: 0.5 }}>
                Ruta calculada
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                {routeLabel(graph, route)}
                {routeEnd && nodeTypeOf(graph, routeEnd) === 'DOOR' && ` · termina en ${graph.nodes.get(routeEnd)?.label || routeEnd}`}
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
                    {formatDistance(route.totalDist)}
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
                    {formatEta(route.totalDist)}
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
              No hay camino en el grafo hasta ese destino: la app mostraría una línea recta. Verifica que el grafo esté conectado.
            </Alert>
          ) : (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <DirectionsWalkRoundedIcon sx={{ fontSize: 36, color: '#D1D5DB', mb: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Selecciona un destino y una posición de inicio para calcular la ruta con el mismo algoritmo de la app
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
              onClick={() => { setSimPos(null); setDestNodeId(''); }}
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
  const [view3d, setView3d] = useView3d();
  const [selection, setSelection] = useState<Selection>(null);
  const [drawing, setDrawing] = useState<Drawing>(null);
  // Esperando el toque que ubica un punto de interés nuevo
  const [placingPoi, setPlacingPoi] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number; n: number } | null>(null);
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

  const { data: buildings = [] } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => buildingService.getAll(),
    retry: false,
  });

  // Merge server nodes with any local position overrides
  const nodes: GraphNode[] = rawNodes.map(n => {
    const local = localPositions.current[n.nodeId];
    return local ? { ...n, gps: local } : n;
  });
  const osm = useCampusOsm(rawNodes);

  // Enlace desde Campus → Edificios: abre ese punto en el mapa (una vez por enlace)
  const linkedNodeId = params.get('node');
  const [openedLink, setOpenedLink] = useState<string | null>(null);
  if (linkedNodeId && linkedNodeId !== openedLink && rawNodes.length > 0) {
    setOpenedLink(linkedNodeId);
    const gps = rawNodes.find(n => n.nodeId === linkedNodeId)?.gps;
    if (gps) {
      setSelection({ kind: 'node', id: linkedNodeId });
      setFocus(f => ({ ...gps, n: (f?.n ?? 0) + 1 }));
    }
  }

  const updateNodeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GraphNode> }) =>
      graphService.updateNode(id, data),
    onSuccess: (_, vars) => {
      delete localPositions.current[vars.id];
      qc.invalidateQueries({ queryKey: ['nodes'] });
    },
    onError: () => setNotice({ text: 'No se pudo guardar el cambio. Revisa la conexión.', severity: 'warning' }),
  });

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setDrawing(null);
      setPlacingPoi(false);
      setSelection(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const findNode = (id: string) => rawNodes.find(n => n.nodeId === id);
  const newId = (prefix: string) => `${prefix}${Date.now().toString().slice(-6)}`;

  /** Ejecuta varias llamadas seguidas (crear punto + unirlo…) y refresca el mapa al final. */
  const run = async (task: () => Promise<void>, failText: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch {
      setNotice({ text: failText, severity: 'warning' });
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ['nodes'] });
      qc.invalidateQueries({ queryKey: ['edges'] });
    }
  };

  const connect = (a: string, b: string) => {
    const exists = edges.some(e => (e.nodeA === a && e.nodeB === b) || (e.nodeA === b && e.nodeB === a));
    return exists ? Promise.resolve() : graphService.createEdge({ nodeA: a, nodeB: b, active: true }).then(() => undefined);
  };

  /** Parte un camino en dos con un punto nuevo donde se hizo clic. */
  const insertOnEdge = async (edge: GraphEdge, lat: number, lng: number, nodeType: NodeType, label?: string, extra: Partial<GraphNode> = {}) => {
    const a = findNode(edge.nodeA);
    const b = findNode(edge.nodeB);
    if (!a?.gps || !b?.gps) throw new Error('Camino sin extremos');
    const t = projectOnEdge(a.gps, b.gps, lat, lng);
    const lerp = (p: number, q: number) => p + (q - p) * t;
    const nodeId = newId(nodeType === 'DOOR' ? 'D' : 'W');
    await graphService.createNode({
      nodeId,
      gps: { lat: lerp(a.gps.lat, b.gps.lat), lng: lerp(a.gps.lng, b.gps.lng) },
      pixel: { x: Math.round(lerp(a.pixel?.x ?? 0, b.pixel?.x ?? 0)), y: Math.round(lerp(a.pixel?.y ?? 0, b.pixel?.y ?? 0)) },
      label,
      nodeType,
      active: true,
      ...extra,
    });
    await graphService.createEdge({ nodeA: edge.nodeA, nodeB: nodeId, active: true });
    await graphService.createEdge({ nodeA: nodeId, nodeB: edge.nodeB, active: true });
    await graphService.deleteEdge(edge.id);
    return nodeId;
  };

  const startDrawing = (from: string | null) => {
    setSelection(null);
    setPlacingPoi(false);
    setDrawing({ from });
  };

  const defaultPoiType = POI_TYPES[0]?.key ?? 'POI';

  /** Punto de interés nuevo: sobre un camino queda unido a los senderos; en el mapa, suelto (p. ej. dentro de un edificio). */
  const placePoi = (lat: number, lng: number, edge?: GraphEdge) => {
    setPlacingPoi(false);
    const label = poiTypeOf(defaultPoiType).label;
    void run(async () => {
      let nodeId: string;
      if (edge) {
        nodeId = await insertOnEdge(edge, lat, lng, 'POI', label, { poiType: defaultPoiType });
      } else {
        nodeId = newId('W');
        await graphService.createNode({
          nodeId, gps: { lat, lng }, pixel: { x: 0, y: 0 }, label, nodeType: 'POI', poiType: defaultPoiType, active: true,
        });
      }
      setSelection({ kind: 'node', id: nodeId });
      setNotice({ text: 'Punto de interés creado: ponle nombre y elige su clase y ubicación.', severity: 'success' });
    }, 'No se pudo crear el punto de interés. Revisa la conexión.');
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (placingPoi) { placePoi(lat, lng); return; }
    if (!drawing) { setSelection(null); return; }
    void run(async () => {
      const nodeId = newId('W');
      await graphService.createNode({ nodeId, gps: { lat, lng }, pixel: { x: 0, y: 0 }, nodeType: 'WAYPOINT', active: true });
      if (drawing.from) await connect(drawing.from, nodeId);
      setDrawing({ from: nodeId });
    }, 'No se pudo agregar el punto. Revisa la conexión.');
  };

  const handleNodeClick = (nodeId: string) => {
    if (placingPoi) setPlacingPoi(false);
    if (!drawing) { setSelection({ kind: 'node', id: nodeId }); return; }
    if (!drawing.from) { setDrawing({ from: nodeId }); return; }
    if (drawing.from === nodeId) return;
    const from = drawing.from;
    void run(async () => {
      await connect(from, nodeId);
      setDrawing(null);
      setSelection({ kind: 'node', id: nodeId });
      setNotice({ text: `Camino unido a ${nodeName(findNode(nodeId))}`, severity: 'success' });
    }, 'No se pudo unir el camino. Revisa la conexión.');
  };

  const handleEdgeClick = (edge: GraphEdge, lat: number, lng: number) => {
    if (placingPoi) { placePoi(lat, lng, edge); return; }
    if (!drawing) { setSelection({ kind: 'edge', id: edge.id, lat, lng }); return; }
    const from = drawing.from;
    void run(async () => {
      const nodeId = await insertOnEdge(edge, lat, lng, 'WAYPOINT');
      if (!from) { setDrawing({ from: nodeId }); return; }
      await connect(from, nodeId);
      setDrawing(null);
      setNotice({ text: 'Camino unido al sendero existente', severity: 'success' });
    }, 'No se pudo unir el camino. Revisa la conexión.');
  };

  const handleNodeDragEnd = (nodeId: string, lat: number, lng: number) => {
    // Update local state immediately for real-time feedback
    localPositions.current[nodeId] = { lat, lng };
    forceRender(v => v + 1);
    const node = findNode(nodeId);
    if (node) updateNodeMutation.mutate({ id: nodeId, data: { ...node, gps: { lat, lng } } });
  };

  const handleChangeType = (nodeId: string, nodeType: NodeType) => {
    const node = findNode(nodeId);
    if (!node) return;
    const building = neighborsOf(nodeId, rawNodes, edges).find(n => n.nodeType === 'BUILDING');
    // Una entrada sin nombre toma el de su edificio para reconocerla en la lista
    const label = nodeType === 'DOOR' && !node.label && building ? `Entrada ${nodeName(building)}` : node.label;
    // Un punto de interés necesita clase: se arranca con la primera del catálogo
    const poiType = nodeType === 'POI' ? node.poiType || defaultPoiType : null;
    updateNodeMutation.mutate({
      id: nodeId,
      data: { ...node, nodeType, label: nodeType === 'POI' && !label ? poiTypeOf(poiType).label : label, poiType, buildingId: nodeType === 'POI' ? node.buildingId ?? null : null },
    });
  };

  const handlePoiChange = (nodeId: string, patch: Pick<GraphNode, 'poiType' | 'buildingId'>) => {
    const node = findNode(nodeId);
    if (node) updateNodeMutation.mutate({ id: nodeId, data: { ...node, ...patch } });
  };

  const handleFloorChange = (nodeId: string, floor: number | null) => {
    const node = findNode(nodeId);
    if (node) updateNodeMutation.mutate({ id: nodeId, data: { ...node, floor } });
  };

  const handleRename = (nodeId: string, label: string) => {
    const node = findNode(nodeId);
    if (node) updateNodeMutation.mutate({ id: nodeId, data: { ...node, label: label || undefined } });
  };

  const handleDeleteNode = (nodeId: string) => void run(async () => {
    await graphService.deleteNode(nodeId);
    setSelection(null);
    setNotice({ text: 'Punto eliminado', severity: 'success' });
  }, 'No se pudo eliminar el punto.');

  const handleDeleteEdge = (edge: GraphEdge) => void run(async () => {
    await graphService.deleteEdge(edge.id);
    setSelection(null);
    setNotice({ text: 'Camino eliminado', severity: 'success' });
  }, 'No se pudo eliminar el camino.');

  const handleSplit = (edge: GraphEdge, lat: number, lng: number, nodeType: NodeType) => void run(async () => {
    const building = [findNode(edge.nodeA), findNode(edge.nodeB)].find(n => n?.nodeType === 'BUILDING');
    const nodeId = await insertOnEdge(edge, lat, lng, nodeType, nodeType === 'DOOR' ? `Entrada ${nodeName(building)}` : undefined);
    setSelection({ kind: 'node', id: nodeId });
    setNotice({
      text: nodeType === 'DOOR'
        ? 'Entrada creada. Si no quedó justo en la fachada, arrástrala.'
        : 'Punto agregado. Arrástralo para que el camino siga la curva.',
      severity: 'success',
    });
  }, 'No se pudo agregar el punto. Revisa la conexión.');

  const selectNode = (nodeId: string, fly = false) => {
    setSelection({ kind: 'node', id: nodeId });
    const gps = findNode(nodeId)?.gps;
    if (fly && gps) setFocus(f => ({ ...gps, n: (f?.n ?? 0) + 1 }));
  };

  const handlePixelUpdate = (nodeId: string, x: number, y: number) => {
    const node = findNode(nodeId);
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

  const banner: Notice | null = busy
    ? { text: 'Guardando…', severity: 'info' }
    : drawing
      ? {
          text: drawing.from
            ? 'Toca el mapa para seguir el camino · toca un punto o camino existente para unirlo y terminar'
            : 'Toca el mapa, un punto o un camino para empezar',
          severity: 'info',
        }
      : placingPoi
        ? { text: 'Toca un camino para ponerlo sobre el sendero (al aire libre) o el mapa para un punto dentro de un edificio', severity: 'info' }
        : notice;

  const selectedNode = selection?.kind === 'node' ? nodes.find(n => n.nodeId === selection.id) : undefined;
  const selectedEdge = selection?.kind === 'edge' ? edges.find(e => e.id === selection.id) : undefined;

  // Lo que la app necesita para detectar la entrada con precisión: cada edificio con sus entradas bien conectadas
  const doorChecklist = nodes
    .filter(n => n.nodeType === 'BUILDING')
    .map(b => {
      const doors = neighborsOf(b.nodeId, nodes, edges).filter(n => n.nodeType === 'DOOR');
      const broken = doors.filter(d => !doorStatus(d, nodes, edges).ok).length;
      return { id: b.nodeId, label: nodeName(b), doors: doors.length, broken };
    });
  const orphanDoors = nodes.filter(n => n.nodeType === 'DOOR' && !doorStatus(n, nodes, edges).ok);
  const issues = osm ? buildingIssues(nodes, edges, osm.footprints) : null;
  const crossingIds = issues?.crossingIds ?? new Set<string>();

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
        <UserNavPreview nodes={rawNodes} edges={edges} view3d={view3d} onView3d={setView3d} />
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
          <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
            {drawing ? (
              <Button variant="contained" startIcon={<CheckRoundedIcon />} onClick={() => setDrawing(null)}
                sx={{ ...pillSx, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                Terminar camino
              </Button>
            ) : (
              <Button variant="contained" startIcon={<AltRouteRoundedIcon />} onClick={() => startDrawing(null)}
                sx={{ ...pillSx, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                Dibujar camino
              </Button>
            )}
            {!drawing && (
              <Button variant={placingPoi ? 'contained' : 'outlined'} color={placingPoi ? 'warning' : 'primary'}
                startIcon={placingPoi ? <CloseRoundedIcon /> : <PlaceRoundedIcon />}
                onClick={() => { setSelection(null); setPlacingPoi(p => !p); }}
                sx={{ ...pillSx, bgcolor: placingPoi ? undefined : '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {placingPoi ? 'Cancelar' : 'Punto de interés'}
              </Button>
            )}
          </Box>

          {banner && (
            <Box sx={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, maxWidth: '60%' }}>
              <Alert severity={banner.severity} sx={{ borderRadius: '12px', fontSize: '0.78rem', py: 0.25, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
                {banner.text}
              </Alert>
            </Box>
          )}

          <MapViewControls
            view3d={view3d}
            onView3d={setView3d}
            layer={mapLayer}
            onLayer={() => setMapLayer(l => l === 'street' ? 'satellite' : 'street')}
          />

          {view3d ? (
            <CampusMap3D
              nodes={nodes}
              edges={edges}
              satellite={mapLayer === 'satellite'}
              osm={osm}
              nodeLook={n => (n.nodeId === selectedNode?.nodeId || n.nodeId === drawing?.from ? SELECTED_LOOK : typeLook(n))}
              nodeTitle={n => `${nodeName(n)} · ${nodeTypeLabel(n)}`}
              edgeLook={e => editorEdgeLook(e, selection, selectedBuildingOf(selection, nodes), crossingIds.has(e.id))}
              pin={selection?.kind === 'edge' ? { lat: selection.lat, lng: selection.lng } : null}
              rubberFrom={drawing?.from ? findNode(drawing.from)?.gps ?? null : null}
              draggable={!drawing}
              focus={focus}
              onMapClick={handleMapClick}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onNodeDragEnd={handleNodeDragEnd}
            />
          ) : (
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
            <FocusOn target={focus} />
            <MapInteraction
              nodes={nodes}
              edges={edges}
              selection={selection}
              drawing={drawing}
              crossingIds={crossingIds}
              onMapClick={handleMapClick}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onNodeDragEnd={handleNodeDragEnd}
            />
          </MapContainer>
          )}
        </Box>

        {/* ── Right panel: opciones de lo que se tocó en el mapa ── */}
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
          <Box sx={{ p: 2, borderBottom: '1px solid #F1F1F1', display: 'flex', alignItems: 'center', gap: 1 }}>
            {selectedNode && (
              <TypeSwatch type={selectedNode.nodeType} poiType={selectedNode.poiType} size={14} />
            )}
            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', flex: 1, minWidth: 0 }} noWrap>
              {selectedNode ? nodeName(selectedNode) : selectedEdge ? 'Camino' : 'Editar caminos'}
            </Typography>
            {(selectedNode || selectedEdge) && (
              <Tooltip title="Cerrar (Esc)">
                <IconButton size="small" onClick={() => setSelection(null)}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
              </Tooltip>
            )}
          </Box>

          <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
            {selectedNode ? (
              <NodeDetails
                key={selectedNode.nodeId}
                node={selectedNode}
                nodes={nodes}
                edges={edges}
                buildings={buildings}
                busy={busy}
                onRename={handleRename}
                onChangeType={handleChangeType}
                onPoiChange={handlePoiChange}
                onFloorChange={handleFloorChange}
                onDrawFrom={id => startDrawing(id)}
                onDelete={handleDeleteNode}
                onSelect={id => selectNode(id, true)}
              />
            ) : selectedEdge && selection?.kind === 'edge' ? (
              <EdgeDetails
                key={selectedEdge.id}
                edge={selectedEdge}
                nodes={nodes}
                busy={busy}
                onDoor={() => handleSplit(selectedEdge, selection.lat, selection.lng, 'DOOR')}
                onSplit={() => handleSplit(selectedEdge, selection.lat, selection.lng, 'WAYPOINT')}
                onDelete={() => handleDeleteEdge(selectedEdge)}
                onSelect={id => selectNode(id, true)}
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box component="ol" sx={{ m: 0, pl: 2.25, display: 'grid', gap: 0.75, fontSize: '0.82rem', color: 'text.secondary' }}>
                  <li><b>Toca un punto o un camino</b> para ver sus opciones.</li>
                  <li><b>Arrastra un punto</b> para moverlo.</li>
                  <li><b>Dibujar camino</b> para agregar senderos nuevos.</li>
                  <li><b>Punto de interés</b> para agregar cafeterías y otros lugares que la app lista aparte.</li>
                </Box>

                <Box>
                  <SectionLabel>Entradas por edificio</SectionLabel>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                    La app detecta la llegada y termina la ruta en las entradas. Toca un edificio para ir a él.
                  </Typography>
                  {doorChecklist.map(b => {
                    const pending = b.doors === 0 || b.broken > 0;
                    return (
                      <Box
                        key={b.id}
                        onClick={() => selectNode(b.id, true)}
                        sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                          px: 1, py: 0.75, borderRadius: '8px', cursor: 'pointer', '&:hover': { bgcolor: '#F8F9FB' },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }} noWrap>{b.label}</Typography>
                        <Chip
                          size="small"
                          label={b.doors === 0 ? 'Sin entradas' : b.broken > 0 ? `${b.broken} sin unir` : `${b.doors} entrada${b.doors > 1 ? 's' : ''}`}
                          sx={{ fontSize: '0.65rem', height: 20, bgcolor: pending ? '#FEF3C7' : '#EDE9FE', color: pending ? '#92400E' : '#5B21B6' }}
                        />
                      </Box>
                    );
                  })}
                  {orphanDoors.length > 0 && (
                    <Alert severity="warning" sx={{ ...alertSx, mt: 1 }}>
                      Entradas sueltas: {orphanDoors.map(d => nodeName(d)).join(', ')}
                    </Alert>
                  )}
                </Box>

                <Box>
                  <SectionLabel>Caminos y edificios</SectionLabel>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                    Comparado con las plantas de OpenStreetMap que dibujan los dos mapas: si un camino las cruza, la ruta se ve pasando por dentro.
                  </Typography>
                  {!issues ? (
                    <Typography variant="caption" color="text.secondary">Cargando edificios de OpenStreetMap…</Typography>
                  ) : issues.crossings.length === 0 && issues.deepDoors.length === 0 ? (
                    <Alert severity="success" sx={alertSx}>Ningún camino atraviesa un edificio.</Alert>
                  ) : (
                    <>
                      {issues.crossings.map(c => (
                        <Box
                          key={`${c.edge.id}-${c.building}`}
                          onClick={() => {
                            setSelection({ kind: 'edge', id: c.edge.id, ...c.at });
                            setFocus(f => ({ ...c.at, n: (f?.n ?? 0) + 1 }));
                          }}
                          sx={{ px: 1, py: 0.75, borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', '&:hover': { bgcolor: '#FEF2F2' } }}
                        >
                          <b>{nodeName(findNode(c.edge.nodeA))} – {nodeName(findNode(c.edge.nodeB))}</b> cruza {c.building} ({Math.round(c.meters)} m)
                        </Box>
                      ))}
                      {issues.deepDoors.map(d => (
                        <Box
                          key={d.node.nodeId}
                          onClick={() => selectNode(d.node.nodeId, true)}
                          sx={{ px: 1, py: 0.75, borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', '&:hover': { bgcolor: '#FEF2F2' } }}
                        >
                          <b>{nodeName(d.node)}</b> queda {Math.round(d.depth)} m dentro de {d.building}: arrástrala a la fachada
                        </Box>
                      ))}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        En rojo en el mapa. Agrega puntos para rodear el edificio o mueve los que quedaron dentro.
                      </Typography>
                    </>
                  )}
                </Box>

                <Box>
                  <SectionLabel>Colores</SectionLabel>
                  {NODE_TYPES.map(t => (
                    <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
                      <TypeSwatch type={t} size={12} />
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{NODE_TYPE_META[t].label}</Typography>
                    </Box>
                  ))}
                  <Typography variant="caption" color="text.secondary">
                    {nodes.length} puntos · {edges.length} caminos
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
      </> /* closes editor fragment */
      )}
    </Box>
  );
}
