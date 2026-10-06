import { poiTypeOf } from '../../utils/poi-catalog';

/** Entrada de edificio en el mapa: insignia del color dado con una puerta blanca (HTML para marcadores de Leaflet y MapLibre). */
export function doorIconHtml(color: string, border: string, size: number, ring = false): string {
  const glyph = Math.round(size * 0.7);
  const halo = ring ? `0 0 0 3px ${color}55,0 0 0 5px ${color}22,` : '';
  return `<div style="width:${size}px;height:${size}px;box-sizing:border-box;border-radius:${Math.round(size * 0.3)}px;`
    + `background:${color};border:2px solid ${border};display:flex;align-items:center;justify-content:center;`
    + `box-shadow:${halo}0 1px 4px rgba(0,0,0,.35);cursor:pointer;">`
    + `<svg viewBox="0 0 24 24" width="${glyph}" height="${glyph}" aria-hidden="true">`
    + '<path d="M7 21V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5V21" fill="#fff"/>'
    + '<path d="M4.5 21h15" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'
    + `<circle cx="14.2" cy="12.5" r="1.3" fill="${color}"/></svg></div>`;
}

/** Las puertas son un poco más grandes que los puntos para reconocer el dibujo. */
export const DOOR_EXTRA_PX = 6;

/** Punto de interés: círculo blanco con borde del color de su clase y el emoji del catálogo. */
export function poiIconHtml(emoji: string, color: string, size: number, ring = false): string {
  const halo = ring ? `0 0 0 3px ${color}55,0 0 0 5px ${color}22,` : '';
  return `<div style="width:${size}px;height:${size}px;box-sizing:border-box;border-radius:50%;background:#fff;`
    + `border:2.5px solid ${color};display:flex;align-items:center;justify-content:center;`
    + `font-size:${Math.round(size * 0.55)}px;line-height:1;box-shadow:${halo}0 1px 4px rgba(0,0,0,.35);cursor:pointer;">`
    + `${emoji}</div>`;
}

/** Dibujo de un punto en los mapas del panel: puerta, emoji de su clase o null (punto simple). */
export function nodeBadgeHtml(
  node: { nodeType: string; poiType?: string | null }, color: string, border: string, size: number, ring = false,
): string | null {
  if (node.nodeType === 'DOOR') return doorIconHtml(color, border, size + DOOR_EXTRA_PX, ring);
  if (node.nodeType === 'POI') return poiIconHtml(poiTypeOf(node.poiType).emoji, color, size + DOOR_EXTRA_PX, ring);
  return null;
}
