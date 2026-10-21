import { BALANCE } from '../config/balance';
import { DEX, slug, type DexEntry } from './pokemon';
import type { ElementType } from './types';

// ============================================================================
// Enemigos salvajes. Sistema de tramos y personalidades basado en PokéSurvivor
// (js/data/enemies.js). Required Notice: Copyright 2026 JPTER78
// (https://github.com/JPTER78/pokesurvivor)
//
// Cualquier Pokémon de Kanto (no legendario) puede salir en las oleadas. Cada
// partida sortea un ELENCO por tramo de salas, así cada partida es distinta.
// El comportamiento depende de sus tipos y de una huella fija por especie: el
// tipo elemental y la forma de pelear son propiedades distintas.
// Números PROVISIONALES (BALANCE.enemies).
// ============================================================================

export type Behavior =
  | 'chase'     // va directo a por ti y golpea
  | 'charger'   // se para, apunta y embiste
  | 'ranged'    // mantiene la distancia y dispara
  | 'tank'      // lento y con mucha vida
  | 'runner'    // muy rápido y frágil, va a donde vas a estar
  | 'healer'    // cura a los de alrededor
  | 'shielder'  // pone escudos a sus compañeros
  | 'summoner'  // llama a su manada
  | 'bomber'    // se acerca y explota
  | 'beamer'    // rayo con franja de aviso
  | 'zoner'     // zonas bajo tus pies que estallan
  | 'fan'       // disparos en abanico
  | 'jumper';   // salta y cae donde estabas

export const RANGED_BEHAVIORS: Behavior[] = ['ranged', 'fan', 'beamer', 'zoner', 'healer', 'summoner'];
export const isRangedBehavior = (b: Behavior) => RANGED_BEHAVIORS.includes(b);

export interface EnemyDef {
  id: string;
  dex: number;
  name: string;
  types: ElementType[];
  behavior: Behavior;
  hp: number;
  damage: number;
  speed: number;
  xp: number;
  gold: number;
  /** Daño, recarga y alcance de su ataque a distancia (si lo tiene). */
  shotDmg?: number;
  shotCd?: number;
  range?: number;
  /** Invocador: Pokémon de su manada. */
  minion?: number;
  /** Abanico: número de disparos. */
  fanN?: number;
  /** Zonas por ataque. */
  zones?: number;
  /** Defensas base (ataques físicos / especiales). */
  df: number;
  sd: number;
  /** Pega con su lado fuerte: físico o especial. */
  cat: 'physical' | 'special';
}

export interface BossDef extends EnemyDef {
  role: 'miniboss' | 'boss';
  title: string;
  contactDamage: number;
  /** Fracción de vida a la que se enfurece. */
  phase2At: number;
}

export const ENEMY_TIERS = [
  { bst: [180, 330], hp: 17, spd: 56, dmg: 6, xp: 3.5 },
  { bst: [300, 405], hp: 32, spd: 62, dmg: 8.5, xp: 5 },
  { bst: [385, 465], hp: 52, spd: 60, dmg: 11, xp: 8 },
  { bst: [445, 515], hp: 88, spd: 70, dmg: 14, xp: 13 },
  { bst: [495, 560], hp: 150, spd: 66, dmg: 22, xp: 24 },
] as const;

// Stats base aproximados a partir de los de juego.
const baseHp = (p: DexEntry) => (p.hp - 70) / 0.45;
const baseSpd = (p: DexEntry) => (p.spd - 78) / 0.42;

/** Huella fija 0..1 por especie (decide su personalidad, siempre la misma). */
function hash(n: number, salt: number): number {
  let h = (n * 374761393 + salt * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Personalidades fijas de algunos Pokémon de Kanto.
const HEAL = new Set([35, 36, 113]);
const SHIELD = new Set([95, 122]);
const BOMB = new Set([74, 75, 76, 100, 101, 109, 110]);
/** Invocador → Pokémon de su manada. */
const SUMMON: Record<number, number> = {
  15: 13, 18: 16, 24: 23, 28: 27, 31: 29, 34: 32, 42: 41, 51: 50, 53: 52, 57: 56, 59: 58,
  62: 60, 68: 66, 73: 72, 78: 77, 82: 81, 85: 84, 91: 90, 117: 116, 130: 129,
};

export function behaviorOf(p: DexEntry): Behavior {
  const t = p.types;
  const h = hash(p.dex, 11);
  const has = (...xs: ElementType[]) => xs.some((x) => t.includes(x));
  if (HEAL.has(p.dex)) return 'healer';
  if (SHIELD.has(p.dex)) return 'shielder';
  if (BOMB.has(p.dex)) return 'bomber';
  if (SUMMON[p.dex]) return 'summoner';
  if (has('bug') && h >= 0.6 && h < 0.78) return 'summoner';
  if (has('electric', 'psychic', 'dragon', 'ice') && h < 0.18) return 'beamer';
  if (has('fire', 'ground', 'poison') && h < 0.18) return 'zoner';
  if (has('water', 'grass', 'bug', 'fairy') && h >= 0.18 && h < 0.32) return 'fan';
  if (has('fighting', 'ground', 'normal', 'rock') && h >= 0.42 && h < 0.56) return 'jumper';
  if (has('psychic', 'electric', 'ghost', 'fairy') && h < 0.4) return 'ranged';
  if (has('fire', 'water', 'poison', 'ice') && h < 0.22) return 'ranged';
  if (has('fighting', 'normal', 'ground', 'rock', 'dragon', 'steel', 'dark') && h < 0.4) return 'charger';
  if (baseHp(p) > 95 && baseSpd(p) < 50) return 'tank';
  return 'chase';
}

/** Definición de enemigo de un Pokémon para un tramo. */
export function enemyFor(p: DexEntry, tierIndex: number, behavior = behaviorOf(p)): EnemyDef {
  const tier = ENEMY_TIERS[Math.min(tierIndex, ENEMY_TIERS.length - 1)];
  const hpK = Math.max(0.7, Math.min(1.6, baseHp(p) / 65));
  const spdK = Math.max(0.75, Math.min(1.3, 0.75 + baseSpd(p) / 260));
  const tank = behavior === 'tank';
  const d: EnemyDef = {
    id: slug(p.name), dex: p.dex, name: p.name, types: p.types, behavior,
    hp: Math.round(tier.hp * hpK * (tank ? 1.5 : 1)),
    speed: tier.spd * spdK * (tank ? 0.7 : 1) * BALANCE.ps.enemySpeed,
    damage: Math.round(tier.dmg * (tank ? 1.2 : 1)),
    xp: Math.max(3, Math.round(tier.xp * (tank ? 1.3 : 1))),
    gold: 1 + Math.floor(tierIndex / 2),
    df: p.df, sd: p.sd,
    cat: p.sa > p.pa ? 'special' : 'physical',
  };
  const ti = tierIndex;
  const CD: Partial<Record<Behavior, number>> = {
    ranged: 2.2 - ti * 0.15, fan: 3.2 - ti * 0.15, beamer: 4.4 - ti * 0.2, zoner: 4.6 - ti * 0.2, healer: 3.5, summoner: 7,
  };
  const cd = CD[behavior];
  if (cd) {
    d.shotDmg = Math.round(tier.dmg * (behavior === 'fan' ? 0.7 : 0.8));
    d.shotCd = +cd.toFixed(2);
    d.range = ((behavior === 'beamer' ? 260 : behavior === 'healer' || behavior === 'summoner' ? 230 : 190) + ti * 6) * BALANCE.ps.space;
  }
  if (behavior === 'summoner') d.minion = SUMMON[p.dex] ?? p.dex;
  if (behavior === 'fan') d.fanN = ti < 2 ? 3 : 5;
  if (behavior === 'zoner') d.zones = ti < 2 ? 1 : ti < 4 ? 2 : 3;
  if (behavior === 'bomber') {
    d.speed *= 1.25;
    d.hp = Math.round(d.hp * 0.8);
  }
  return d;
}

const PLAIN: Behavior[] = ['chase', 'charger', 'ranged', 'tank'];
const SUPPORT: Behavior[] = ['healer', 'shielder', 'summoner'];

/** Candidatos de un tramo: Kanto, sin legendarios. */
export function tierCandidates(tierIndex: number): DexEntry[] {
  const [lo, hi] = ENEMY_TIERS[tierIndex].bst;
  return DEX.filter((p) => p.dex <= 151 && !p.leg && p.bst >= lo && p.bst <= hi);
}

/**
 * Elenco de un tramo para una partida: siempre un apoyo (curandero, escudo o
 * invocador) y, desde el segundo tramo, uno de los que atacan con aviso. En el
 * primero el resto son comportamientos sencillos para ir aprendiendo.
 */
export function castForTier(tierIndex: number, pick: <T>(list: T[], n: number) => T[]): EnemyDef[] {
  const all = tierCandidates(tierIndex);
  const kind = (p: DexEntry) => behaviorOf(p);
  const size = BALANCE.enemies.castSize;
  const kinds = SUPPORT.filter((k) => all.some((p) => kind(p) === k));
  const chosen: DexEntry[] = [];
  if (kinds.length) chosen.push(...pick(all.filter((p) => kind(p) === pick(kinds, 1)[0]), 1));
  if (tierIndex > 0) chosen.push(...pick(all.filter((p) => !PLAIN.includes(kind(p)) && !SUPPORT.includes(kind(p))), 1));
  const rest = all.filter((p) => !chosen.includes(p) && (tierIndex > 0 || PLAIN.includes(kind(p))));
  chosen.push(...pick(rest, size - chosen.length));
  const defs = chosen.map((p) => enemyFor(p, tierIndex));
  // El más rápido de los sencillos es el corredor del tramo.
  const plain = defs.filter((d) => d.behavior === 'chase' || d.behavior === 'charger' || d.behavior === 'tank').sort((a, b) => b.speed - a.speed)[0];
  if (plain) {
    plain.behavior = 'runner';
    plain.speed *= 1.6;
    plain.hp = Math.round(plain.hp * 0.7);
  }
  return defs;
}

// Minibosses y jefe del gimnasio de Brock. Selección PROVISIONAL (ejemplo del
// blueprint): Geodude (20), Sudowoodo (40), Onix (50). Su IA de jefe está en
// game/bossAI.ts.
interface BossSpec { dex: number; role: BossDef['role']; behavior: Behavior; tier: number }

const BOSS_SPECS: Record<string, BossSpec> = {
  'geodude-boss': { dex: 74, role: 'miniboss', behavior: 'charger', tier: 1 },
  'sudowoodo-boss': { dex: 185, role: 'miniboss', behavior: 'ranged', tier: 3 },
  'onix-boss': { dex: 95, role: 'boss', behavior: 'charger', tier: 4 },
};

/**
 * Jefe con la fuerza del tramo de enemigos de la sala en la que aparece (en
 * modo prueba la sala escala menos, y el jefe también).
 */
export function bossDefFor(id: string, tierIndex?: number): BossDef {
  const spec = BOSS_SPECS[id];
  const ti = Math.min(ENEMY_TIERS.length - 1, tierIndex ?? spec.tier);
  const p = DEX.find((d) => d.dex === spec.dex)!;
  const base = enemyFor(p, ti, spec.behavior);
  const tier = ENEMY_TIERS[ti];
  const B = BALANCE.bosses[spec.role];
  return {
    ...base,
    id,
    hp: Math.round(tier.hp * B.hp),
    damage: Math.round(tier.dmg * B.damage),
    shotDmg: Math.round(tier.dmg * B.damage * 0.8),
    speed: tier.spd * 0.9 * BALANCE.ps.enemySpeed,
    xp: tier.xp * (spec.role === 'boss' ? 20 : 10),
    gold: 0,
    role: spec.role,
    title: spec.role === 'boss' ? 'Jefe de gimnasio' : 'Miniboss',
    contactDamage: Math.round(tier.dmg * B.damage * 0.7),
    phase2At: 0.5,
  };
}

/** Jefes con su fuerza de referencia (la de las 50 salas). */
export const BOSSES: Record<string, BossDef> = Object.fromEntries(Object.keys(BOSS_SPECS).map((id) => [id, bossDefFor(id)]));
