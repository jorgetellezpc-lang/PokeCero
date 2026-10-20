import { BALANCE } from '../config/balance';
import type { ElementType } from './types';

// Tabla de tipos SIMPLIFICADA (subconjunto de la oficial). Multiplicadores
// suavizados y centralizados en BALANCE.typeChart.
const STRONG: Partial<Record<ElementType, ElementType[]>> = {
  fire: ['grass', 'bug'],
  water: ['fire', 'rock', 'ground'],
  grass: ['water', 'rock', 'ground'],
  electric: ['water', 'flying'],
  rock: ['fire', 'flying', 'bug'],
  ground: ['fire', 'electric', 'rock', 'poison'],
  poison: ['grass'],
  flying: ['grass', 'bug', 'fighting'],
  bug: ['grass', 'psychic'],
  fighting: ['normal', 'rock'],
  psychic: ['poison', 'fighting'],
};

const WEAK: Partial<Record<ElementType, ElementType[]>> = {
  fire: ['water', 'rock', 'fire'],
  water: ['grass', 'water'],
  grass: ['fire', 'grass', 'poison', 'flying', 'bug'],
  electric: ['grass', 'electric', 'ground'],
  normal: ['rock'],
  poison: ['poison', 'ground', 'rock'],
  bug: ['fire', 'flying', 'poison'],
};

export function typeMultiplier(attack: ElementType, defender: ElementType[]): number {
  let m = 1;
  for (const t of defender) {
    if (STRONG[attack]?.includes(t)) m *= BALANCE.typeChart.strong;
    else if (WEAK[attack]?.includes(t)) m *= BALANCE.typeChart.weak;
  }
  return m;
}
