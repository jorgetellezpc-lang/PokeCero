import { TYPE_NAMES } from '../data/typeColors';
import type { ElementType } from '../data/types';
import { h } from './dom';

// Símbolo blanco de cada tipo, para ponerlo dentro de un círculo de su color
// (ficha del Pokémon, tarjeta del gimnasio en el mapa).

const PATHS: Partial<Record<ElementType, string>> = {
  electric: 'M13 2 4 14h6l-1 8 9-12h-6z',
  fire: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 2 4 3 4 0-3-1-6 0-9z',
  water: 'M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z',
  grass: 'M20 4C10 4 4 9 4 16c0 2 1 4 2 4 1-6 5-9 10-11-4 3-7 6-8 11 9 0 12-7 12-16z',
  poison: 'M12 3a7 7 0 0 0-7 7c0 3 2 5 4 6v3h6v-3c2-1 4-3 4-6a7 7 0 0 0-7-7zm-3 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  psychic: 'M12 4c-5 0-8 3-8 7s3 6 6 6 5-2 5-4-1-3-3-3-2 1-2 2h2c0 1-1 1-2 1-1 0-2-1-2-2 0-2 2-4 4-4 3 0 5 2 5 5 0 4-3 7-7 7v2c5 0 9-4 9-9s-3-8-7-8z',
  ground: 'M2 20 9 7l4 7 2-3 7 9z',
  rock: 'M7 4h8l5 6-3 9H7l-4-7z',
};

export function typeGlyph(t: ElementType | string, size = 22): HTMLElement {
  const path = PATHS[t as ElementType];
  const box = h('span', { class: 'pk3-glyph' });
  if (!path) {
    box.textContent = (TYPE_NAMES as Record<string, string>)[t]?.[0] ?? '?';
    return box;
  }
  box.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${path}" fill="#fff"/></svg>`;
  return box;
}
