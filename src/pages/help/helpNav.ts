import { createContext } from 'react';

/** Salta a una sección o tema de la página de ayuda por su id. */
export const HelpNavContext = createContext<(id: string) => void>(() => {});

/** Quita las marcas de enlace y código para buscar sobre el texto plano. */
export function plainText(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1').replace(/`/g, '');
}

/** Minúsculas y sin tildes, para que «navegacion» encuentre «Navegación». */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
