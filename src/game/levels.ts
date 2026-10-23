import { BALANCE } from '../config/balance';
import { getSpecies, speciesByDex, type PokemonSpecies } from '../data/pokemon';

// ============================================================================
// Nivel permanente de cada Pokémon (1-100), como en los juegos:
//
// - Experiencia: curva «media rápida» de Pokémon (n³ en total para el nivel n).
// - Atributos: vida, daño y regeneración crecen con el nivel con el mismo
//   factor para ti y para los enemigos (que se adaptan a tu nivel), así que la
//   correlación vida/daño se mantiene. Lo que te hace más fuerte de verdad son
//   las cartas permanentes y las evoluciones.
// - Experiencia por derrota: base de la especie × nivel / 7, como en Pokémon.
// ============================================================================

export const MAX_LEVEL = BALANCE.levels.max;
export const START_LEVEL = BALANCE.levels.start;

/** Experiencia total para llegar al nivel `level`. */
export const totalXp = (level: number): number => Math.pow(level, 3);

/** Experiencia necesaria para pasar del nivel `level` al siguiente. */
export function xpToNext(level: number): number {
  return totalXp(level + 1) - totalXp(level);
}

/** Multiplicador de vida, daño y regeneración por nivel (1 en el nivel inicial). */
export function levelFactor(level: number): number {
  const k = BALANCE.levels.statPerLevel;
  return (1 + k * (level - 1)) / (1 + k * (START_LEVEL - 1));
}

/** Nivel de los enemigos según el tuyo (se adaptan) y su papel en la sala. */
export function enemyLevel(playerLevel: number, role: 'normal' | 'strong' | 'miniboss' | 'boss' | 'mega'): number {
  const off = BALANCE.levels.enemyOffset[role];
  return Math.max(2, Math.min(MAX_LEVEL, playerLevel + off));
}

/** Experiencia que da derrotar a un Pokémon de ese nivel. */
export function killXp(dex: number, level: number, role: 'normal' | 'miniboss' | 'boss'): number {
  const sp = speciesByDex(dex);
  const base = 8 + (sp?.bst ?? 300) / 20;
  const mult = role === 'boss' ? BALANCE.levels.bossXp : role === 'miniboss' ? BALANCE.levels.minibossXp : 1;
  return ((base * level) / 7) * BALANCE.levels.xpYield * mult;
}

/** Forma de una línea evolutiva a un nivel (Charmander a nivel 20 → Charmeleon). */
export function formAtLevel(line: string, level: number): PokemonSpecies {
  let sp = getSpecies(line);
  while (sp.evolution && level >= sp.evolution.level) sp = getSpecies(sp.evolution.to);
  return sp;
}
