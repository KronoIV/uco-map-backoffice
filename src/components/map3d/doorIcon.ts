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
