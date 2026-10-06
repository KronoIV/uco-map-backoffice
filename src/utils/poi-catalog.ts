// Clases de Puntos de Interés (POI). El backend guarda solo la clave (GraphNode.poiType); aquí viven nombre e icono.
// Copia idéntica en uco-map-app/src/navigation/poi-catalog.ts y uco-map-admin/src/utils/poi-catalog.ts
// (`npm run check:routing` en el admin lo verifica). Para agregar una clase basta una entrada en POI_TYPES.

export interface PoiType {
    /** Clave guardada en el nodo: mayúsculas, números y _ (p. ej. "CAFETERIA"). */
    key:    string;
    label:  string;
    plural: string;
    /** Icono para el panel y los mapas. */
    emoji:  string;
    /** Icono Font Awesome de la app (clase sin el prefijo "fas"). */
    icon:   string;
    color:  string;
}

export const POI_TYPES: readonly PoiType[] = [
    { key: 'CAFETERIA', label: 'Cafetería', plural: 'Cafeterías', emoji: '☕', icon: 'fa-mug-hot', color: '#B45309' },
    // { key: 'BANOS',  label: 'Baños', plural: 'Baños', emoji: '🚻', icon: 'fa-restroom', color: '#0284C7' },
];

const GENERIC: Omit<PoiType, 'key'> = {
    label: 'Punto de interés', plural: 'Puntos de interés', emoji: '📍', icon: 'fa-location-dot', color: '#6366F1',
};

/** Clase de un POI; una clave que aún no está en el catálogo se muestra como punto de interés genérico. */
export function poiTypeOf(key: string | null | undefined): PoiType {
    return POI_TYPES.find(t => t.key === key) ?? { ...GENERIC, key: key || 'POI' };
}
