import type { ElementType } from './types';

export const TYPE_NAMES: Record<ElementType, string> = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', grass: 'Planta', electric: 'Eléctrico', rock: 'Roca',
  ground: 'Tierra', poison: 'Veneno', flying: 'Volador', bug: 'Bicho', psychic: 'Psíquico', fighting: 'Lucha',
  ice: 'Hielo', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro', steel: 'Acero', fairy: 'Hada',
};

export const TYPE_COLORS: Record<ElementType, string> = {
  normal: '#c4bcb0', fire: '#ff6a1f', water: '#3d8bff', grass: '#45b23c', electric: '#ffd21a', rock: '#b8a058',
  ground: '#dcb66c', poison: '#a043d0', flying: '#93b2ff', bug: '#90b82a', psychic: '#ff4f9a', fighting: '#e04a2e',
  ice: '#62d2ea', ghost: '#7a64c8', dragon: '#5a3cff', dark: '#6a5a62', steel: '#a8b4c4', fairy: '#ff8acb',
};
