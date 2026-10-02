import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TripAnalytics } from '../../types/analytics';
import { fmtPercent } from '../../utils/analyticsFormat';

interface Props {
  origins: TripAnalytics['originPoints'];
  destinations: TripAnalytics['destinationPoints'];
  height?: number;
}

const ORIGIN = '#F59E0B';
const DESTINATION = '#047857';
// Centro aproximado del campus (si todavía no hay puntos)
const CAMPUS: [number, number] = [6.1501, -75.3662];

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map(p => p.join(',')).join('|');
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView(points[0], 18); return; }
    map.fitBounds(points as LatLngBoundsExpression, { padding: [30, 30], maxZoom: 18 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambian los puntos
  }, [key, map]);
  return null;
}

/** Dónde empiezan los recorridos (naranja) y a qué edificios llegan (verde); el tamaño es la cantidad. */
export default function TripsMap({ origins, destinations, height = 360 }: Props) {
  const maxOrigin = Math.max(1, ...origins.map(o => o.weight));
  const maxDest = Math.max(1, ...destinations.map(d => d.total));
  const points: [number, number][] = [
    ...origins.map(o => [o.lat, o.lng] as [number, number]),
    ...destinations.map(d => [d.lat, d.lng] as [number, number]),
  ];

  return (
    <Box>
      <Box sx={{ height, borderRadius: '14px', overflow: 'hidden', border: '1px solid #F1F1F1' }}>
        <MapContainer center={CAMPUS} zoom={17} maxZoom={20} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
            maxNativeZoom={19}
            maxZoom={20}
          />
          <FitBounds points={points} />
          {origins.map(o => (
            <CircleMarker
              key={`o${o.lat},${o.lng}`} center={[o.lat, o.lng]}
              radius={5 + 13 * Math.sqrt(o.weight / maxOrigin)}
              pathOptions={{ color: ORIGIN, fillColor: ORIGIN, fillOpacity: 0.35, weight: 1 }}
            >
              <Tooltip>{o.weight.toLocaleString('es-CO')} {o.weight === 1 ? 'recorrido empezó' : 'recorridos empezaron'} aquí</Tooltip>
            </CircleMarker>
          ))}
          {destinations.map(d => (
            <CircleMarker
              key={`d${d.building}`} center={[d.lat, d.lng]}
              radius={8 + 18 * Math.sqrt(d.total / maxDest)}
              pathOptions={{ color: DESTINATION, fillColor: DESTINATION, fillOpacity: 0.3, weight: 2 }}
            >
              <Tooltip direction="top">
                <strong>{d.label}</strong><br />
                {d.total.toLocaleString('es-CO')} recorridos · {fmtPercent(d.total ? d.arrived / d.total : null)} llegaron
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </Box>
      <Box sx={{ display: 'flex', gap: 2.5, mt: 1, flexWrap: 'wrap' }}>
        {[[ORIGIN, 'Dónde empezaron'], [DESTINATION, 'Edificio de destino']].map(([c, l]) => (
          <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c, opacity: 0.7 }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{l}</Typography>
          </Box>
        ))}
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>· El tamaño del círculo indica la cantidad</Typography>
      </Box>
    </Box>
  );
}
