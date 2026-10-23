import dexRaw from './ps/pokedex.json';
import type { ElementType } from './types';

// Pokémon de Kanto (los 151) + Sudowoodo (miniboss provisional de Brock).
// Tipos, stats base y nombres vienen de PokeAPI a través de PokéSurvivor
// (js/data/pokedex.js). Los stats de juego (hp, spd, pa, sa) son los que
// PokéSurvivor deriva de los base; df/sd son Defensa y Defensa Especial base.

export interface DexEntry {
  dex: number;
  name: string;
  types: ElementType[];
  /** Vida de juego. */
  hp: number;
  /** Velocidad de juego (unidades/s). */
  spd: number;
  /** Multiplicador de daño con ataques físicos / especiales. */
  pa: number;
  sa: number;
  /** Defensa y Defensa Especial base. */
  df: number;
  sd: number;
  /** 1 común … 5 legendario (gachapón). */
  rarity: number;
  bst: number;
  leg: boolean;
}

export interface PokemonStats {
  hp: number;
  speed: number;
  pa: number;
  sa: number;
  df: number;
  sd: number;
}

export interface PokemonSpecies {
  id: string;
  dex: number;
  name: string;
  types: ElementType[];
  stats: PokemonStats;
  /** Forma base de su línea evolutiva. */
  line: string;
  evolution?: { to: string; level: number };
  rarity: number;
  legendary: boolean;
  bst: number;
}

export const DEX: DexEntry[] = dexRaw as DexEntry[];

export const slug = (name: string) =>
  name.toLowerCase()
    .replace('♀', '-f').replace('♂', '-m')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');

/**
 * Evoluciones por NIVEL de la 1.ª generación (nivel oficial). Las que en los
 * juegos son por piedra o intercambio quedan sin evolución en partida hasta
 * que se decida su regla (decisión pendiente del blueprint).
 */
const LEVEL_EVOLUTIONS: [number, number, number][] = [
  [1, 2, 16], [2, 3, 32], [4, 5, 16], [5, 6, 36], [7, 8, 16], [8, 9, 36],
  [10, 11, 7], [11, 12, 10], [13, 14, 7], [14, 15, 10], [16, 17, 18], [17, 18, 36],
  [19, 20, 20], [21, 22, 20], [23, 24, 22], [27, 28, 22], [29, 30, 16], [32, 33, 16],
  [41, 42, 22], [43, 44, 21], [46, 47, 24], [48, 49, 31], [50, 51, 26], [52, 53, 28],
  [54, 55, 33], [56, 57, 28], [60, 61, 25], [63, 64, 16], [66, 67, 28], [69, 70, 21],
  [72, 73, 30], [74, 75, 25], [77, 78, 40], [79, 80, 37], [81, 82, 30], [84, 85, 31],
  [86, 87, 34], [88, 89, 38], [92, 93, 25], [96, 97, 26], [98, 99, 28], [100, 101, 30],
  [104, 105, 28], [109, 110, 35], [111, 112, 42], [116, 117, 32], [118, 119, 33],
  [129, 130, 20],
  // Pikachu evoluciona con Piedra Trueno; aquí, al nivel 30 (es uno de los iniciales).
  [25, 26, 30], [138, 139, 40], [140, 141, 40], [147, 148, 30], [148, 149, 55],
];

/** Pre-evoluciones (también por piedra/intercambio) para saber la forma base de cada línea. */
const PREVIOUS: Record<number, number> = {
  25: 172, 26: 25, 31: 30, 34: 33, 36: 35, 38: 37, 40: 39, 45: 44, 59: 58, 62: 61, 65: 64, 68: 67,
  71: 70, 76: 75, 91: 90, 94: 93, 103: 102, 121: 120, 134: 133, 135: 133, 136: 133,
};

const byDex = new Map(DEX.map((d) => [d.dex, d]));
const evoFrom = new Map<number, { to: number; level: number }>();
const prevOf = new Map<number, number>();
for (const [from, to, level] of LEVEL_EVOLUTIONS) {
  evoFrom.set(from, { to, level });
  prevOf.set(to, from);
}
for (const [to, from] of Object.entries(PREVIOUS)) if (byDex.has(from)) prevOf.set(Number(to), from);

function baseOf(dex: number): number {
  let d = dex;
  while (prevOf.has(d)) d = prevOf.get(d)!;
  return d;
}

export const POKEMON: Record<string, PokemonSpecies> = {};
for (const d of DEX) {
  const evo = evoFrom.get(d.dex);
  POKEMON[slug(d.name)] = {
    id: slug(d.name),
    dex: d.dex,
    name: d.name,
    types: d.types,
    stats: { hp: d.hp, speed: d.spd, pa: d.pa, sa: d.sa, df: d.df, sd: d.sd },
    line: slug(byDex.get(baseOf(d.dex))!.name),
    evolution: evo ? { to: slug(byDex.get(evo.to)!.name), level: evo.level } : undefined,
    rarity: d.rarity,
    legendary: d.leg,
    bst: d.bst,
  };
}

/** Pokémon con el que empieza cualquier partida guardada nueva. */
export const STARTER_POKEMON = 'charmander';

/**
 * Pokémon que se pueden elegir para jugar: los 3 iniciales de Kanto y
 * Pikachu, disponibles desde el principio. Durante la partida evolucionan
 * con normalidad; el resto de Pokémon solo aparece como enemigo.
 */
export const PLAYABLE_POKEMON = ['bulbasaur', 'charmander', 'squirtle', 'pikachu'];

export const isPlayable = (id: string) => PLAYABLE_POKEMON.includes(id);

/** Texto de presentación en la ficha de los elegibles. */
export const PLAYABLE_BLURB: Record<string, string> = {
  pikachu: 'Su energía eléctrica se acumula en las mejillas. Cuanto más se emociona, más potente se vuelve.',
  charmander: 'La llama de su cola refleja su ánimo: cuanto más arde, más ganas tiene de pelear.',
  bulbasaur: 'La semilla de su lomo guarda la energía del sol. Tranquilo y resistente, no se rinde nunca.',
  squirtle: 'Se protege en su caparazón y contraataca con chorros de agua a toda presión.',
};

export function getSpecies(id: string): PokemonSpecies {
  const p = POKEMON[id];
  if (!p) throw new Error(`Pokémon desconocido: ${id}`);
  return p;
}

export function speciesByDex(dex: number): PokemonSpecies {
  return getSpecies(slug(byDex.get(dex)!.name));
}

export function playablePokemon(): PokemonSpecies[] {
  return PLAYABLE_POKEMON.map(getSpecies);
}

/** Pokémon de Kanto del antiguo sorteo del gachapón (ahora sin uso en la interfaz). */
export function obtainablePokemon(): PokemonSpecies[] {
  return Object.values(POKEMON).filter((p) => p.dex <= 151);
}

/** Lado fuerte: físico o especial. */
export const sideOf = (p: PokemonSpecies) => (p.stats.sa > p.stats.pa ? 'special' : 'physical');
