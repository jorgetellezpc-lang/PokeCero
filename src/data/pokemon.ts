import type { PokemonSpecies } from './types';

// Pokémon jugables del prototipo (conjunto reducido; objetivo final: 151).
// Estadísticas, ataques iniciales y niveles de evolución son PROVISIONALES.
// Las evoluciones usan el nivel oficial de cada especie como valor inicial.

export const POKEMON: Record<string, PokemonSpecies> = {
  charmander: {
    id: 'charmander', name: 'Charmander', types: ['fire'], line: 'charmander',
    stats: { hp: 90, power: 1.1, defense: 0, speed: 112 },
    startingAttack: 'ascuas',
    learnset: ['ascuas', 'aranazo', 'giro_fuego', 'ataque_rapido'],
    evolution: { to: 'charmeleon', level: 16 },
    sprite: { shape: 'biped', main: '#f08030', belly: '#f8d070', accent: '#ffd020' },
    obtainable: true, rarity: 'common',
  },
  charmeleon: {
    id: 'charmeleon', name: 'Charmeleon', types: ['fire'], line: 'charmander',
    stats: { hp: 125, power: 1.3, defense: 0.05, speed: 120 },
    startingAttack: 'ascuas',
    learnset: ['ascuas', 'aranazo', 'giro_fuego', 'ataque_rapido', 'lanzallamas'],
    // Charizard (nivel 36) queda fuera del prototipo: la relación nivel 36 /
    // evoluciones está pendiente de diseño.
    sprite: { shape: 'biped', main: '#e0402a', belly: '#f8c888', accent: '#ffd020' },
    obtainable: false, rarity: 'common',
  },
  squirtle: {
    id: 'squirtle', name: 'Squirtle', types: ['water'], line: 'squirtle',
    stats: { hp: 105, power: 1.0, defense: 0.08, speed: 104 },
    startingAttack: 'pistola_agua',
    learnset: ['pistola_agua', 'placaje', 'burbuja', 'ataque_rapido'],
    evolution: { to: 'wartortle', level: 16 },
    sprite: { shape: 'turtle', main: '#68b0e8', belly: '#f0d890', accent: '#a06030' },
    obtainable: true, rarity: 'common',
  },
  wartortle: {
    id: 'wartortle', name: 'Wartortle', types: ['water'], line: 'squirtle',
    stats: { hp: 140, power: 1.2, defense: 0.12, speed: 110 },
    startingAttack: 'pistola_agua',
    learnset: ['pistola_agua', 'placaje', 'burbuja', 'ataque_rapido', 'hidrobomba'],
    sprite: { shape: 'turtle', main: '#5880d0', belly: '#f0d890', accent: '#e8e8f8' },
    obtainable: false, rarity: 'common',
  },
  bulbasaur: {
    id: 'bulbasaur', name: 'Bulbasaur', types: ['grass', 'poison'], line: 'bulbasaur',
    stats: { hp: 100, power: 1.05, defense: 0.05, speed: 104 },
    startingAttack: 'hoja_afilada',
    learnset: ['hoja_afilada', 'placaje', 'latigo_cepa', 'polvo_veneno'],
    evolution: { to: 'ivysaur', level: 16 },
    sprite: { shape: 'quad', main: '#70c8a0', belly: '#a8e0c0', accent: '#48a048' },
    obtainable: true, rarity: 'common',
  },
  ivysaur: {
    id: 'ivysaur', name: 'Ivysaur', types: ['grass', 'poison'], line: 'bulbasaur',
    stats: { hp: 135, power: 1.25, defense: 0.1, speed: 110 },
    startingAttack: 'hoja_afilada',
    learnset: ['hoja_afilada', 'placaje', 'latigo_cepa', 'polvo_veneno'],
    sprite: { shape: 'quad', main: '#60a8a0', belly: '#98d0b8', accent: '#e05878' },
    obtainable: false, rarity: 'common',
  },
  pikachu: {
    id: 'pikachu', name: 'Pikachu', types: ['electric'], line: 'pikachu',
    stats: { hp: 80, power: 1.1, defense: 0, speed: 132 },
    startingAttack: 'impactrueno',
    learnset: ['impactrueno', 'ataque_rapido', 'chispa', 'rayo'],
    // Sin evolución por nivel (Raichu evoluciona con piedra): no se fuerza.
    sprite: { shape: 'mouse', main: '#f8d030', belly: '#f8e070', accent: '#e83020' },
    obtainable: true, rarity: 'rare',
  },
};

/** Pokémon con el que empieza cualquier partida guardada nueva. PROVISIONAL. */
export const STARTER_POKEMON = 'charmander';

export function getSpecies(id: string): PokemonSpecies {
  const p = POKEMON[id];
  if (!p) throw new Error(`Pokémon desconocido: ${id}`);
  return p;
}

export function obtainablePokemon(): PokemonSpecies[] {
  return Object.values(POKEMON).filter((p) => p.obtainable);
}
