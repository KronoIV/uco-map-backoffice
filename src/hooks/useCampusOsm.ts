import { useEffect, useState } from 'react';
import type { GraphNode } from '../types';
import { loadCampusOsmBBox, osmBBox, type CampusOsm } from '../utils/campus-osm';

/** Edificios y senderos de OpenStreetMap alrededor del grafo: los mismos que dibuja la app. */
export function useCampusOsm(nodes: GraphNode[]): CampusOsm | null {
  const [osm, setOsm] = useState<CampusOsm | null>(null);
  const withGps = nodes.filter(n => n.gps);
  const bbox = withGps.length === 0 ? '' : osmBBox({
    minLat: Math.min(...withGps.map(n => n.gps.lat)),
    maxLat: Math.max(...withGps.map(n => n.gps.lat)),
    minLng: Math.min(...withGps.map(n => n.gps.lng)),
    maxLng: Math.max(...withGps.map(n => n.gps.lng)),
  });

  useEffect(() => {
    if (!bbox) return;
    let alive = true;
    loadCampusOsmBBox(bbox, data => { if (alive) setOsm(data); });
    return () => { alive = false; };
  }, [bbox]);

  return osm;
}
