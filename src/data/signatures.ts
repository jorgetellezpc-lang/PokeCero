// ============================================================================
// Ataque característico: cada Pokémon tiene UN ataque principal que sale de
// sus tipos (y, si hace falta, de una excepción por especie). Todas las cartas
// de ataque lo mejoran a él.
//
// Catálogo declarativo, sin lógica de combate ni de dibujo:
//  - TYPE_SIG: lo que aporta cada tipo. El tipo que "lanza" el ataque da el
//    comportamiento, la forma y los valores base; el otro tipo aporta su
//    efecto (payload). Así salen las 18×17 combinaciones sin una lista cerrada.
//  - PAIR_NAMES: nombres propios para algunas combinaciones (opcional).
//  - SPECIES_SIG: excepciones por especie (Cubone lanza un hueso…).
//  - ATTACK_UPGRADES: las cartas de mejora del ataque y cuándo encajan.
//  - Evolución del ataque: requisitos en BALANCE.attack y efecto por
//    comportamiento (EVO_MODS de moves.ts) + por tipo (TYPE_SIG.evo).
//
// Los valores base parten de los movimientos iniciales que ya había (unidades
// de PokéSurvivor; scaleNums los pasa a la arena). Balance PROVISIONAL.
// ============================================================================

import { BALANCE } from '../config/balance';
import { evoModsOf, scaleNums, type MoveDef, type MoveMods, type MoveNums } from './moves';
import type { PokemonSpecies } from './pokemon';
import { TYPE_NAMES } from './typeColors';
import type { ElementType } from './types';

/** Comportamientos que puede tener un ataque característico. */
export type Delivery = 'projectile' | 'homing' | 'bounce' | 'boomerang' | 'beam' | 'chain';

/** Cambio sobre los valores: `add` suma (y crea la clave si no existe), `mul` multiplica. */
export interface Mod { add?: MoveMods; mul?: MoveMods }

type Gender = 'm' | 'f';

interface TypeSig {
  kind: Delivery;
  /** Valores base cuando este tipo lanza el ataque. */
  base: MoveNums;
  /** Forma del proyectil (render/vfx.ts). */
  shape: string;
  /** Nombre con el tipo puro, y al evolucionar. */
  name: string;
  evoName: string;
  /** Sustantivo para combinarlo con el adjetivo del otro tipo. */
  noun: [string, Gender];
  evoNoun: [string, Gender];
  /** Adjetivo (masculino, femenino) cuando aporta su efecto como segundo tipo. */
  adj: [string, string];
  /** Lo que aporta como segundo tipo. */
  payload: Mod;
  payloadText: string;
  /** Extra al evolucionar el ataque (además del de su comportamiento). */
  evo: Mod;
  evoText: string;
}

const T = (d: TypeSig) => d;

export const TYPE_SIG: Record<ElementType, TypeSig> = {
  normal: T({
    kind: 'homing', shape: 'star', base: { cd: 0.55, dmg: 13, speed: 330, life: 1.8, size: 7, homing: 5, count: 1, spread: 0.12 },
    name: 'Rapidez', evoName: 'Meteoro', noun: ['Estrella', 'f'], evoNoun: ['Meteoro', 'm'], adj: ['', ''],
    payload: { mul: { dmg: 1.1 } }, payloadText: 'golpea un 10 % más fuerte',
    evo: { add: { count: 1 } }, evoText: '+1 estrella',
  }),
  fire: T({
    kind: 'projectile', shape: 'fire', base: { cd: 0.52, dmg: 18, speed: 310, count: 1, spread: 0.12, pierce: 0, life: 1.6, size: 7, burn: 1 },
    name: 'Ascuas', evoName: 'Llamarada', noun: ['Llama', 'f'], evoNoun: ['Llamarada', 'f'], adj: ['ígneo', 'ígnea'],
    payload: { add: { burn: 1 } }, payloadText: 'quema',
    evo: { add: { burn: 2, explode: 18 } }, evoText: 'quema el doble y estalla',
  }),
  water: T({
    kind: 'projectile', shape: 'drop', base: { cd: 0.44, dmg: 14, speed: 350, count: 1, spread: 0.1, pierce: 1, life: 1.5, size: 6 },
    name: 'Pistola Agua', evoName: 'Hidrocañón', noun: ['Chorro', 'm'], evoNoun: ['Hidrocañón', 'm'], adj: ['acuático', 'acuática'],
    payload: { add: { pierce: 1, knock: 30 } }, payloadText: 'atraviesa y empuja',
    evo: { add: { pierce: 2, knock: 50 } }, evoText: 'atraviesa a 2 más y empuja',
  }),
  grass: T({
    kind: 'boomerang', shape: 'leaf', base: { cd: 0.9, dmg: 10, speed: 330, count: 2, spread: 0.5, radius: 210, size: 6 },
    name: 'Hoja Afilada', evoName: 'Lluevehojas', noun: ['Hoja', 'f'], evoNoun: ['Tormenta de hojas', 'f'], adj: ['vegetal', 'vegetal'],
    payload: { add: { drain: 1 } }, payloadText: 'te cura un poco al golpear',
    evo: { add: { count: 1, drain: 1 } }, evoText: '+1 hoja y cura al golpear',
  }),
  electric: T({
    kind: 'projectile', shape: 'bolt', base: { cd: 0.4, dmg: 13, speed: 480, count: 1, spread: 0.08, pierce: 2, life: 1.1, size: 5 },
    name: 'Impactrueno', evoName: 'Trueno', noun: ['Descarga', 'f'], evoNoun: ['Trueno', 'm'], adj: ['eléctrico', 'eléctrica'],
    payload: { add: { shock: 0.12 }, mul: { speed: 1.15 } }, payloadText: 'puede paralizar',
    evo: { add: { shock: 0.15, pierce: 1 } }, evoText: 'paraliza más a menudo',
  }),
  psychic: T({
    kind: 'projectile', shape: 'ring', base: { cd: 0.58, dmg: 13, speed: 280, count: 1, spread: 0.1, pierce: 0, life: 2.2, size: 8, homing: 2 },
    name: 'Confusión', evoName: 'Psicocarga', noun: ['Onda', 'f'], evoNoun: ['Psicocarga', 'f'], adj: ['psíquico', 'psíquica'],
    payload: { add: { homing: 2 } }, payloadText: 'busca al enemigo',
    evo: { add: { homing: 2, pierce: 1 }, mul: { dmg: 1.15 } }, evoText: 'persigue mejor y atraviesa',
  }),
  poison: T({
    kind: 'projectile', shape: 'blob', base: { cd: 0.6, dmg: 17, speed: 290, count: 1, spread: 0.12, pierce: 0, life: 1.5, size: 8, poison: 1 },
    name: 'Residuos', evoName: 'Bomba Lodo', noun: ['Lodo', 'm'], evoNoun: ['Bomba de lodo', 'f'], adj: ['tóxico', 'tóxica'],
    payload: { add: { poison: 1 } }, payloadText: 'envenena',
    evo: { add: { poison: 2, zone: 16 } }, evoText: 'envenena el doble y deja un charco tóxico',
  }),
  ground: T({
    kind: 'boomerang', shape: 'crescent', base: { cd: 0.95, dmg: 16, speed: 300, count: 1, spread: 0.5, radius: 230, size: 8, knock: 40 },
    name: 'Bumerán de Barro', evoName: 'Tierra Viva', noun: ['Disco', 'm'], evoNoun: ['Disco telúrico', 'm'], adj: ['sísmico', 'sísmica'],
    payload: { add: { explode: 14, knock: 20 } }, payloadText: 'estalla en un área pequeña',
    evo: { add: { explode: 22, count: 1 } }, evoText: '+1 disco y estalla al golpear',
  }),
  flying: T({
    kind: 'homing', shape: 'wind', base: { cd: 0.55, dmg: 9, count: 2, spread: 0.35, speed: 330, life: 1.6, size: 7, homing: 4 },
    name: 'Tajo Aéreo', evoName: 'Ataque Aéreo', noun: ['Cuchilla', 'f'], evoNoun: ['Vendaval', 'm'], adj: ['aéreo', 'aérea'],
    payload: { add: { homing: 1 }, mul: { speed: 1.2 } }, payloadText: 'vuela más rápido y corrige el rumbo',
    evo: { add: { count: 1 }, mul: { speed: 1.2 } }, evoText: '+1 cuchilla, más rápida',
  }),
  bug: T({
    kind: 'bounce', shape: 'needle', base: { cd: 0.6, dmg: 10, speed: 340, life: 1.6, size: 7, bounce: 3, count: 1, spread: 0.12 },
    name: 'Rayo Señal', evoName: 'Zumbido', noun: ['Aguijón', 'm'], evoNoun: ['Enjambre', 'm'], adj: ['de enjambre', 'de enjambre'],
    payload: { add: { split: 1 } }, payloadText: 'se divide al impactar',
    evo: { add: { split: 1, bounce: 1 } }, evoText: 'se divide al impactar',
  }),
  rock: T({
    kind: 'projectile', shape: 'rock', base: { cd: 0.7, dmg: 24, speed: 260, count: 1, spread: 0.12, pierce: 0, life: 1.4, size: 9, knock: 90 },
    name: 'Lanzarrocas', evoName: 'Roca Afilada', noun: ['Roca', 'f'], evoNoun: ['Avalancha', 'f'], adj: ['pétreo', 'pétrea'],
    payload: { add: { knock: 60 }, mul: { dmg: 1.1, size: 1.15 } }, payloadText: 'golpea más fuerte y empuja',
    evo: { add: { explode: 20 }, mul: { size: 1.3 } }, evoText: 'rocas más grandes que estallan',
  }),
  ice: T({
    kind: 'homing', shape: 'shard', base: { cd: 0.32, dmg: 9, speed: 380, life: 1.5, size: 6, homing: 7, count: 1, spread: 0.12, slow: 0.25 },
    name: 'Canto Helado', evoName: 'Ventisca', noun: ['Esquirla', 'f'], evoNoun: ['Ventisca', 'f'], adj: ['gélido', 'gélida'],
    payload: { add: { slow: 0.35 } }, payloadText: 'ralentiza',
    evo: { add: { slow: 0.2, shock: 0.1 } }, evoText: 'ralentiza más y puede congelar',
  }),
  fighting: T({
    kind: 'projectile', shape: 'ball', base: { cd: 0.62, dmg: 17, speed: 300, count: 1, spread: 0.1, pierce: 0, life: 2, size: 8, homing: 4 },
    name: 'Esfera Aural', evoName: 'Onda Certera', noun: ['Esfera', 'f'], evoNoun: ['Onda certera', 'f'], adj: ['marcial', 'marcial'],
    payload: { add: { crit: 0.1, knock: 30 } }, payloadText: 'hace más críticos',
    evo: { add: { crit: 0.15, knock: 60 }, mul: { size: 1.25 } }, evoText: 'más críticos y empuja',
  }),
  ghost: T({
    kind: 'projectile', shape: 'shadow', base: { cd: 0.66, dmg: 19, speed: 280, count: 1, spread: 0.1, pierce: 2, life: 1.6, size: 9 },
    name: 'Bola Sombra', evoName: 'Pesadilla', noun: ['Sombra', 'f'], evoNoun: ['Pesadilla', 'f'], adj: ['espectral', 'espectral'],
    payload: { add: { pierce: 1, hex: 1.35 } }, payloadText: 'atraviesa y castiga a quien sufre un estado',
    evo: { add: { pierce: 2, hex: 1.5 } }, evoText: 'atraviesa a 2 más y castiga los estados',
  }),
  dragon: T({
    kind: 'beam', shape: 'fire', base: { cd: 1, dmg: 24, radius: 230, width: 34 },
    name: 'Furia Dragón', evoName: 'Cometa Draco', noun: ['Aliento', 'm'], evoNoun: ['Cometa', 'm'], adj: ['dracónico', 'dracónica'],
    payload: { mul: { dmg: 1.15, size: 1.1, width: 1.1 } }, payloadText: 'hace un 15 % más de daño',
    evo: { add: { explode: 20 } }, evoText: 'estalla donde golpea',
  }),
  fairy: T({
    kind: 'homing', shape: 'heart', base: { cd: 0.55, dmg: 13, speed: 280, life: 2, size: 7, homing: 5, drain: 1, count: 1, spread: 0.12 },
    name: 'Beso Drenaje', evoName: 'Fuerza Lunar', noun: ['Beso', 'm'], evoNoun: ['Fuerza lunar', 'f'], adj: ['feérico', 'feérica'],
    payload: { add: { drain: 1, slow: 0.15 } }, payloadText: 'encandila y te cura un poco',
    evo: { add: { count: 1, slow: 0.15 } }, evoText: '+1 proyectil y encandila',
  }),
  steel: T({
    kind: 'bounce', shape: 'shard', base: { cd: 0.64, dmg: 10, speed: 340, life: 1.6, size: 7, bounce: 3, count: 1, spread: 0.12 },
    name: 'Disparo Espejo', evoName: 'Foco Resplandor', noun: ['Destello', 'm'], evoNoun: ['Resplandor', 'm'], adj: ['metálico', 'metálica'],
    payload: { add: { bounce: 1, knock: 20 } }, payloadText: 'rebota a otro enemigo',
    evo: { add: { bounce: 2 }, mul: { dmg: 1.15 } }, evoText: '+2 rebotes',
  }),
  dark: T({
    kind: 'homing', shape: 'crescent', base: { cd: 0.7, dmg: 22, speed: 330, life: 1.6, size: 7, homing: 6, count: 1, spread: 0.12 },
    name: 'Golpe Bajo', evoName: 'Tajo Umbrío', noun: ['Golpe', 'm'], evoNoun: ['Tajo', 'm'], adj: ['sombrío', 'sombría'],
    payload: { add: { crit: 0.12 } }, payloadText: 'hace más críticos',
    evo: { add: { crit: 0.15, pierce: 1 } }, evoText: 'más críticos y atraviesa',
  }),
};

/** Nombres propios de algunas combinaciones (clave: tipos ordenados alfabéticamente). */
const PAIR_NAMES: Record<string, [string, string]> = {
  'flying/normal': ['Tornado de Plumas', 'Huracán de Plumas'],
  'ice/water': ['Tormenta Glacial', 'Ventisca Abisal'],
  'grass/poison': ['Enredadera Tóxica', 'Jungla Venenosa'],
  'electric/steel': ['Tormenta Magnética', 'Pulso Magnético'],
  'ground/rock': ['Avalancha Sísmica', 'Cataclismo'],
  'fairy/psychic': ['Nova Astral', 'Supernova Astral'],
  'dragon/flying': ['Ciclón Dracónico', 'Tempestad Dracónica'],
  'fire/flying': ['Ala Ígnea', 'Pájaro de Fuego'],
  'bug/poison': ['Aguijón Venenoso', 'Enjambre Tóxico'],
  'ghost/poison': ['Niebla Maldita', 'Pesadilla Tóxica'],
  'psychic/water': ['Marea Mental', 'Maremoto Psíquico'],
  'rock/water': ['Concha Fósil', 'Marea Fósil'],
};

interface SpeciesSig {
  name: string;
  evoName: string;
  kind?: Delivery;
  shape?: string;
  /** Sustituye valores base. */
  base?: MoveNums;
  /** Ajuste sobre los valores ya combinados. */
  mod?: Mod;
  note: string;
}

/** Excepciones por especie (clave: id de la especie). Toda la línea comparte la suya. */
const SPECIES_SIG: Record<string, SpeciesSig> = {};
const lineSig = (ids: string[], s: SpeciesSig) => { for (const id of ids) SPECIES_SIG[id] = s; };
lineSig(['cubone', 'marowak'], {
  name: 'Huesomerang', evoName: 'Ataque Óseo', shape: 'crescent', mod: { mul: { dmg: 1.15, size: 1.1 }, add: { knock: 30 } },
  note: 'Lanza su hueso: más pesado y contundente.',
});
lineSig(['pikachu', 'raichu'], {
  name: 'Rayo', evoName: 'Placaje Eléctrico', kind: 'chain', base: { cd: 0.95, dmg: 21, count: 4, radius: 140, shock: 0.1 },
  note: 'El rayo salta de un enemigo a otro.',
});
lineSig(['farfetch-d'], {
  name: 'Puerro Cortante', evoName: 'Corte Furia', kind: 'boomerang', shape: 'leaf',
  base: { cd: 0.85, dmg: 15, speed: 320, count: 1, spread: 0.5, radius: 220, size: 8 },
  note: 'Su puerro va y vuelve como un bumerán.',
});
lineSig(['voltorb', 'electrode'], {
  name: 'Bola Voltio', evoName: 'Autodestrucción', mod: { add: { explode: 20 } }, note: 'Cada descarga estalla al impactar.',
});
lineSig(['exeggcute', 'exeggutor'], {
  name: 'Bomba Huevo', evoName: 'Lluvia de Huevos', kind: 'projectile', shape: 'blob',
  base: { cd: 0.72, dmg: 18, speed: 260, count: 1, spread: 0.12, pierce: 0, life: 1.6, size: 9 }, mod: { add: { explode: 18 } },
  note: 'Lanza huevos que estallan.',
});
lineSig(['koffing', 'weezing'], {
  name: 'Nube Tóxica', evoName: 'Gas Venenoso', mod: { add: { zone: 16 } }, note: 'Deja una nube tóxica donde impacta.',
});
lineSig(['magikarp'], {
  name: 'Salpicadura', evoName: 'Hidrobomba', mod: { mul: { dmg: 0.7 } }, note: 'Un chapoteo débil… hasta que evoluciona.',
});

/** Mejora clave de cada comportamiento para que el ataque pueda evolucionar. */
export const EVO_KEY: Record<Delivery, string> = {
  projectile: 'perforacion', homing: 'multi', bounce: 'rebote', boomerang: 'multi', beam: 'tamano', chain: 'multi',
};

export interface Signature {
  /** Id estable del ataque (para estadísticas y dibujo). */
  id: string;
  name: string;
  evoName: string;
  /** Tipo que lanza el ataque (da el comportamiento y el daño por tipo) y el que aporta su efecto. */
  primary: ElementType;
  secondary: ElementType | null;
  kind: Delivery;
  shape: string;
  cat: 'physical' | 'special';
  /** Valores base (unidades de PokéSurvivor, sin escalar). */
  base: MoveNums;
  evo: Mod;
  desc: string;
  evoText: string;
  /** Nota de la excepción por especie, si la hay. */
  note?: string;
}

const KIND_TEXT: Record<Delivery, string> = {
  projectile: 'Proyectil directo al enemigo más cercano',
  homing: 'Proyectiles que persiguen al enemigo',
  bounce: 'Salta de un enemigo a otro',
  boomerang: 'Va y vuelve, cortando a la ida y a la vuelta',
  beam: 'Rayo en línea recta que atraviesa a todos',
  chain: 'Descarga que salta entre enemigos',
};

export function applyMod(s: MoveNums, mod: Mod | undefined, times = 1): void {
  if (!mod) return;
  for (let i = 0; i < times; i++) {
    for (const [k, v] of Object.entries(mod.add ?? {}) as [keyof MoveNums, number][]) s[k] = ((s[k] as number) ?? 0) + v;
    for (const [k, v] of Object.entries(mod.mul ?? {}) as [keyof MoveNums, number][]) if (s[k] != null) s[k] = (s[k] as number) * v;
  }
}

/** Tipo que lanza el ataque: el principal, salvo Normal con otro tipo (Pidgey lanza el Volador). */
export function deliveryTypes(types: readonly ElementType[]): [ElementType, ElementType | null] {
  const [a, b] = [types[0], types[1] ?? null];
  if (b && a === 'normal') return [b, a];
  return [a, b];
}

const adjFor = (t: ElementType, g: Gender) => TYPE_SIG[t].adj[g === 'm' ? 0 : 1];
const nameWith = ([noun, g]: [string, Gender], t: ElementType) => (adjFor(t, g) ? `${noun} ${adjFor(t, g)}` : noun);

/** Genera el ataque característico de una especie (tipos + excepción). */
export function signatureFor(sp: Pick<PokemonSpecies, 'id' | 'types' | 'stats'>): Signature {
  const [primary, secondary] = deliveryTypes(sp.types);
  const P = TYPE_SIG[primary];
  const ex = SPECIES_SIG[sp.id];
  const kind = ex?.kind ?? P.kind;
  const base: MoveNums = { ...(ex?.base ?? P.base) };
  if (secondary) applyMod(base, TYPE_SIG[secondary].payload);
  applyMod(base, ex?.mod);
  const pair = secondary ? PAIR_NAMES[[primary, secondary].sort().join('/')] : undefined;
  const name = ex?.name ?? pair?.[0] ?? (secondary ? nameWith(P.noun, secondary) : P.name);
  const evoName = ex?.evoName ?? pair?.[1] ?? (secondary ? nameWith(P.evoNoun, secondary) : P.evoName);
  const evo: Mod = { add: { ...evoModsOf(kind)?.m }, mul: {} };
  // Lo de EVO_MODS que multiplica (daño, tamaño…) va a `mul`; el resto suma.
  for (const k of ['dmg', 'size', 'radius', 'width', 'spread', 'cd', 'charge', 'rate', 'dur', 'knock', 'pull', 'stun'] as const) {
    if (evo.add![k] != null) { evo.mul![k] = evo.add![k]; delete evo.add![k]; }
  }
  for (const [k, v] of Object.entries(P.evo.add ?? {}) as [keyof MoveNums, number][]) evo.add![k] = (evo.add![k] ?? 0) + v;
  for (const [k, v] of Object.entries(P.evo.mul ?? {}) as [keyof MoveNums, number][]) evo.mul![k] = (evo.mul![k] ?? 1) * v;
  const desc = `${KIND_TEXT[kind]}${secondary && TYPE_SIG[secondary].payloadText ? `; ${TYPE_SIG[secondary].payloadText}` : ''}.`;
  return {
    id: `sig:${ex ? sp.id : [primary, secondary].filter(Boolean).join('-')}`,
    name, evoName, primary, secondary, kind, shape: ex?.shape ?? P.shape,
    cat: sp.stats.sa > sp.stats.pa ? 'special' : 'physical',
    base, evo, desc, evoText: `${evoModsOf(kind)?.t ?? ''}; ${P.evoText}.`, note: ex?.note,
  };
}

/** Definición de movimiento del ataque (la que usa el motor de combate). */
export function attackDef(sig: Signature, evolved: boolean): MoveDef {
  return {
    ...sig.base, id: sig.id, name: evolved ? sig.evoName : sig.name, type: sig.primary, kind: sig.kind,
    desc: sig.desc, cat: sig.cat, shape: sig.shape, trail: sig.secondary ?? undefined,
  };
}

// ----------------------------------------------------------------------------
// Mejoras del ataque (cartas)
// ----------------------------------------------------------------------------

export type AttackFamily = 'daño' | 'forma' | 'cantidad' | 'efecto' | 'estado' | 'tipo';

export interface AttackUpgrade {
  id: string;
  name: string;
  family: AttackFamily;
  max: number;
  /** ¿Encaja con este ataque? (s: valores actuales, sin escalar). */
  fits: (sig: Signature, s: MoveNums) => boolean;
  mod: (sig: Signature, s: MoveNums) => Mod;
  text: (sig: Signature, s: MoveNums) => string;
}

const SHOTS: Delivery[] = ['projectile', 'homing', 'bounce'];
const isShot = (sig: Signature) => SHOTS.includes(sig.kind);
const STATUS_KEYS = ['burn', 'poison', 'slow', 'shock', 'drain', 'hex'] as const;

const U = (d: AttackUpgrade) => d;

export const ATTACK_UPGRADES: AttackUpgrade[] = [
  U({ id: 'potencia', name: 'Potencia', family: 'daño', max: 5, fits: () => true,
    mod: () => ({ mul: { dmg: 1.22 } }), text: () => '+22 % de daño' }),
  U({ id: 'cadencia', name: 'Cadencia', family: 'daño', max: 4, fits: () => true,
    mod: () => ({ mul: { cd: 0.86 } }), text: () => 'Ataca un 16 % más a menudo' }),
  U({ id: 'velocidad', name: 'Velocidad', family: 'daño', max: 2, fits: (sig) => isShot(sig) || sig.kind === 'boomerang',
    mod: () => ({ mul: { speed: 1.25 } }), text: () => 'Proyectiles un 25 % más rápidos' }),
  U({ id: 'tamano', name: 'Tamaño', family: 'forma', max: 3, fits: (sig) => sig.kind !== 'chain',
    mod: (sig) => (sig.kind === 'beam' ? { mul: { width: 1.25 } } : { mul: { size: 1.25 } }),
    text: (sig) => (sig.kind === 'beam' ? 'Rayo un 25 % más grueso' : 'Proyectiles un 25 % más grandes') }),
  U({ id: 'alcance', name: 'Alcance', family: 'forma', max: 2, fits: () => true,
    mod: (sig) => (isShot(sig) ? { mul: { life: 1.3 } } : { mul: { radius: 1.2 } }),
    text: (sig) => (sig.kind === 'chain' ? 'Salta un 20 % más lejos' : isShot(sig) ? 'Llega un 30 % más lejos' : 'Llega un 20 % más lejos') }),
  U({ id: 'multi', name: 'Proyectil extra', family: 'cantidad', max: 3,
    fits: (sig, s) => sig.kind !== 'beam' && (s.count ?? 1) < BALANCE.attack.caps.count,
    mod: (sig) => (sig.kind === 'chain' ? { add: { count: 2 } } : { add: { count: 1 } }),
    text: (sig) => (sig.kind === 'chain' ? '+2 saltos' : sig.kind === 'boomerang' ? '+1 bumerán' : '+1 proyectil') }),
  U({ id: 'perforacion', name: 'Perforación', family: 'cantidad', max: 3,
    fits: (sig, s) => (sig.kind === 'projectile' || sig.kind === 'homing') && (s.pierce ?? 0) < BALANCE.attack.caps.pierce,
    mod: () => ({ add: { pierce: 1 } }), text: () => 'Atraviesa a 1 enemigo más' }),
  U({ id: 'serpenteo', name: 'Trayectoria ondulante', family: 'cantidad', max: 1,
    fits: (sig) => sig.kind === 'projectile' || sig.kind === 'bounce',
    mod: () => ({ add: { wobble: 9, pierce: 1 } }), text: () => 'Ondula al avanzar, barre más espacio y atraviesa a 1 más' }),
  U({ id: 'rebote', name: 'Rebote', family: 'efecto', max: 3,
    fits: (sig, s) => isShot(sig) && (s.bounce ?? 0) < BALANCE.attack.caps.bounce,
    mod: () => ({ add: { bounce: 1 } }), text: () => 'Salta a 1 enemigo cercano más' }),
  U({ id: 'persecucion', name: 'Persecución', family: 'efecto', max: 2, fits: (sig) => sig.kind === 'projectile' || sig.kind === 'bounce',
    mod: () => ({ add: { homing: 3 } }), text: () => 'Los proyectiles buscan al enemigo' }),
  U({ id: 'division', name: 'División', family: 'efecto', max: 2,
    fits: (sig, s) => isShot(sig) && (s.split ?? 0) < BALANCE.attack.caps.split,
    mod: () => ({ add: { split: 1 } }), text: (_, s) => `Al impactar se divide en ${(s.split ?? 0) + 2} fragmentos` }),
  U({ id: 'explosion', name: 'Explosión', family: 'efecto', max: 3,
    fits: (_, s) => (s.explode ?? 0) < BALANCE.attack.caps.explode,
    mod: () => ({ add: { explode: 16 } }), text: (_, s) => (s.explode ? 'Explosión un 50 % más grande' : 'Estalla al impactar y daña alrededor') }),
  U({ id: 'zona', name: 'Rastro elemental', family: 'efecto', max: 2, fits: () => true,
    mod: () => ({ add: { zone: 14 } }), text: (sig, s) => (s.zone ? 'Zona más grande' : `Deja una zona de ${TYPE_NAMES[sig.primary]} que daña`) }),
  U({ id: 'critico', name: 'Punto débil', family: 'estado', max: 3, fits: (_, s) => (s.crit ?? 0) < BALANCE.attack.caps.crit,
    mod: () => ({ add: { crit: 0.08 } }), text: () => '+8 % de probabilidad de crítico' }),
  U({ id: 'aturdir', name: 'Impacto aturdidor', family: 'estado', max: 2, fits: (_, s) => (s.shock ?? 0) < BALANCE.attack.caps.shock,
    mod: () => ({ add: { shock: 0.08, knock: 25 } }), text: () => 'Empuja y puede aturdir (+8 %)' }),
  U({ id: 'intensidad', name: 'Intensidad elemental', family: 'estado', max: 3,
    fits: (_, s) => STATUS_KEYS.some((k) => s[k]),
    mod: (_, s) => {
      const add: MoveMods = {};
      if (s.burn) add.burn = 1;
      if (s.poison) add.poison = 1;
      if (s.slow) add.slow = 0.1;
      if (s.shock) add.shock = 0.05;
      if (s.drain) add.drain = 1;
      return { add, mul: { hex: 1.15 } };
    },
    text: (_, s) => {
      const parts: string[] = [];
      if (s.burn) parts.push('quema más');
      if (s.poison) parts.push('envenena más');
      if (s.slow) parts.push('ralentiza más');
      if (s.shock) parts.push('paraliza más');
      if (s.drain) parts.push('cura más');
      if (s.hex) parts.push('castiga más los estados');
      return parts.join(', ').replace(/^./, (c) => c.toUpperCase());
    } }),
  U({ id: 'fusion', name: 'Fusión de tipos', family: 'tipo', max: 1, fits: (sig) => !!sig.secondary,
    mod: (sig) => {
      const m: Mod = { add: { ...TYPE_SIG[sig.secondary!].payload.add }, mul: { ...TYPE_SIG[sig.secondary!].payload.mul } };
      m.mul!.dmg = (m.mul!.dmg ?? 1) * 1.1;
      return m;
    },
    text: (sig) => `Duplica el efecto ${TYPE_NAMES[sig.secondary!]} (${TYPE_SIG[sig.secondary!].payloadText}) y +10 % de daño` }),
];

export const ATTACK_UPGRADE: Record<string, AttackUpgrade> = Object.fromEntries(ATTACK_UPGRADES.map((u) => [u.id, u]));

/** Valores sin escalar con las mejoras aplicadas en orden. */
export function rawAttackNums(sig: Signature, ups: readonly string[], evolved: boolean): MoveNums {
  const s: MoveNums = { ...sig.base };
  for (const id of ups) {
    const u = ATTACK_UPGRADE[id];
    if (u) applyMod(s, u.mod(sig, s));
  }
  if (evolved) applyMod(s, sig.evo);
  const C = BALANCE.attack.caps;
  for (const k of Object.keys(C) as (keyof typeof C)[]) if (s[k] != null) s[k] = Math.min(s[k] as number, C[k]);
  return s;
}

/** Estadísticas efectivas en la arena (mejoras + evolución + escala). */
export function attackStats(sig: Signature, ups: readonly string[], evolved: boolean): MoveNums {
  const s = scaleNums(sig.kind, rawAttackNums(sig, ups, evolved));
  if (s.dmg != null) s.dmg *= BALANCE.attack.power;
  return s;
}

/** ¿Cumple los requisitos para evolucionar el ataque? */
export function attackEvolutionReady(sig: Signature, ups: readonly string[], level: number, evolved: boolean): boolean {
  const A = BALANCE.attack;
  return !evolved && level >= A.evoLevel && ups.length >= A.evoUpgrades && ups.includes(EVO_KEY[sig.kind]);
}
