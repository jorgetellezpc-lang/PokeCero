import type { MoveKind } from './moves';
import type { ElementType } from './types';

// ============================================================================
// HABILIDADES DE PARTIDA (estilo Archero, con identidad Pokémon)
// ----------------------------------------------------------------------------
// Diseño original de Pokécero. Conceptos de juego inspirados en Archero
// (multidisparo, rebotes, flechas elementales, guardianes…), sin código ni
// recursos de terceros.
//
// Todo es DATOS: cada habilidad declara rareza, condiciones de aparición,
// acumulación máxima, exclusiones y su efecto como modificadores. La lógica
// que los aplica está en game/abilities.ts y game/combat.ts.
// Valores PROVISIONALES.
// ============================================================================

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_INFO: Record<Rarity, { name: string; color: string; weight: number }> = {
  common: { name: 'Común', color: '#9fb1c9', weight: 7 },
  rare: { name: 'Rara', color: '#4fb4ff', weight: 4 },
  epic: { name: 'Épica', color: '#c47bff', weight: 2 },
  legendary: { name: 'Legendaria', color: '#ffcb3d', weight: 1 },
};

/** Modificadores de combate de la partida (suma de habilidades, sinergias y pasiva). */
export interface CombatMods {
  /** Proyectiles extra al frente (paralelos). */
  front: number;
  /** Pares de proyectiles en diagonal (±45°). */
  diagonal: number;
  /** Pares de proyectiles a los lados (±90°). */
  side: number;
  /** Proyectiles hacia atrás. */
  rear: number;
  /** Repeticiones de cada ráfaga de proyectiles (multidisparo). */
  multishot: number;
  /** Multiplicador de daño de los proyectiles (los extra lo reducen). */
  projDmg: number;
  pierce: number;
  ricochet: number;
  wallBounce: number;
  /** Estados al golpear con cualquier movimiento. */
  burnOnHit: number;
  poisonOnHit: number;
  slowOnHit: number;
  stunChance: number;
  /** Multiplicador del daño de quemadura y veneno. */
  dotMult: number;
  crit: number;
  critMult: number;
  /** Curación (fracción de la vida máxima) al derrotar a un enemigo. */
  killHeal: number;
  /** Explosión al derrotar: daño = fracción de la vida máxima del enemigo. */
  killExplode: number;
  killExplodeRadius: number;
  killExplodePoison: number;
  /** Probabilidad de derrotar al instante a un enemigo (no jefe) con poca vida. */
  execute: number;
  executeAt: number;
  dodge: number;
  /** Orbes guardianes que bloquean disparos enemigos. */
  guardians: number;
  /** Golpes mortales que se resisten con 1 PV por sala. */
  sturdy: number;
  /** Daño extra con movimientos de los tipos del Pokémon (STAB). */
  stab: number;
  /** Daño extra con movimientos del propio tipo cuando queda poca vida (Mar Llamas…). */
  pinch: number;
  /** Multiplicadores generales. */
  dmg: number;
  dmgTaken: number;
  enemyDmg: number;
  /** Reducción de daño a vida completa (Multiescamas). */
  fullHpShield: number;
  regen: number;
  /** Al recibir un golpe cuerpo a cuerpo: estado al atacante. */
  contactStun: number;
  contactPoison: number;
  contactSlow: number;
  /** Inmune a las zonas del suelo. */
  levitate: boolean;
  /** Los avisos enemigos duran más (fracción). */
  foresight: number;
  speed: number;
}

export const BASE_MODS: CombatMods = {
  front: 0, diagonal: 0, side: 0, rear: 0, multishot: 0, projDmg: 1, pierce: 0, ricochet: 0, wallBounce: 0,
  burnOnHit: 0, poisonOnHit: 0, slowOnHit: 0, stunChance: 0, dotMult: 1, crit: 0, critMult: 0,
  killHeal: 0, killExplode: 0, killExplodeRadius: 40, killExplodePoison: 0, execute: 0, executeAt: 0.3,
  dodge: 0, guardians: 0, sturdy: 0, stab: 0.2, pinch: 0, dmg: 1, dmgTaken: 1, enemyDmg: 1, fullHpShield: 0,
  regen: 0, contactStun: 0, contactPoison: 0, contactSlow: 0, levitate: false, foresight: 0, speed: 1,
};

/** Efecto declarativo: suma (números), multiplica (claves *Mult) o activa (booleanos). */
export type ModEffect = Partial<{ [K in keyof CombatMods]: CombatMods[K] }>;
/** Claves que se combinan multiplicando en lugar de sumando. */
export const MULTIPLICATIVE: (keyof CombatMods)[] = ['projDmg', 'dotMult', 'dmg', 'dmgTaken', 'enemyDmg', 'speed'];

/** Movimientos que disparan proyectiles (a los que afectan las habilidades de disparo). */
export const PROJECTILE_KINDS: MoveKind[] = ['projectile', 'homing', 'bounce'];

export interface AbilityCondition {
  /** Hace falta algún movimiento de estos comportamientos. */
  kinds?: MoveKind[];
  /** Hace falta algún movimiento de estos tipos. */
  moveTypes?: ElementType[];
  minLevel?: number;
}

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  maxStacks: number;
  /** Efecto de cada acumulación. */
  effect: ModEffect;
  condition?: AbilityCondition;
  /** No aparece si ya tienes alguna de estas. */
  excludes?: string[];
  icon: string;
}

const A = (d: AbilityDef) => d;

export const ABILITIES: Record<string, AbilityDef> = Object.fromEntries([
  // --- Disparo ---
  A({ id: 'doble-disparo', name: 'Doble Disparo', rarity: 'rare', maxStacks: 3, icon: '⇈',
    description: '+1 proyectil al frente en cada disparo (−15% daño por proyectil).',
    effect: { front: 1, projDmg: 0.85 }, condition: { kinds: PROJECTILE_KINDS } }),
  A({ id: 'abanico', name: 'Abanico', rarity: 'rare', maxStacks: 2, icon: '⋎',
    description: '+2 proyectiles en diagonal.', effect: { diagonal: 1 }, condition: { kinds: PROJECTILE_KINDS } }),
  A({ id: 'flancos', name: 'Flancos', rarity: 'common', maxStacks: 2, icon: '⇹',
    description: '+2 proyectiles hacia los lados.', effect: { side: 1 }, condition: { kinds: PROJECTILE_KINDS } }),
  A({ id: 'retaguardia', name: 'Retaguardia', rarity: 'common', maxStacks: 2, icon: '⇊',
    description: '+1 proyectil hacia atrás.', effect: { rear: 1 }, condition: { kinds: PROJECTILE_KINDS } }),
  A({ id: 'rafaga', name: 'Ráfaga', rarity: 'epic', maxStacks: 1, icon: '≫',
    description: 'Cada disparo sale dos veces seguidas (−10% daño).', effect: { multishot: 1, projDmg: 0.9 },
    condition: { kinds: PROJECTILE_KINDS } }),
  A({ id: 'perforacion', name: 'Perforación', rarity: 'common', maxStacks: 3, icon: '➶',
    description: 'Los proyectiles atraviesan a 1 enemigo más.', effect: { pierce: 1 }, condition: { kinds: PROJECTILE_KINDS } }),
  A({ id: 'rebote', name: 'Rebote', rarity: 'rare', maxStacks: 3, icon: '↯',
    description: 'Los proyectiles saltan a 1 enemigo cercano más.', effect: { ricochet: 1 }, condition: { kinds: PROJECTILE_KINDS } }),
  A({ id: 'rebote-muro', name: 'Rebote en Muro', rarity: 'common', maxStacks: 2, icon: '⌐',
    description: 'Los proyectiles rebotan 2 veces en las paredes.', effect: { wallBounce: 2 }, condition: { kinds: PROJECTILE_KINDS } }),
  // --- Estados (cualquier movimiento) ---
  A({ id: 'cuerpo-llama', name: 'Cuerpo Llama', rarity: 'common', maxStacks: 3, icon: '♨',
    description: 'Tus golpes queman.', effect: { burnOnHit: 1 } }),
  A({ id: 'punto-toxico', name: 'Punto Tóxico', rarity: 'common', maxStacks: 3, icon: '☣',
    description: 'Tus golpes envenenan.', effect: { poisonOnHit: 1 } }),
  A({ id: 'toque-gelido', name: 'Toque Gélido', rarity: 'common', maxStacks: 2, icon: '❄',
    description: 'Tus golpes ralentizan un 25%.', effect: { slowOnHit: 0.25 } }),
  A({ id: 'electricidad-estatica', name: 'Electricidad Estática', rarity: 'rare', maxStacks: 3, icon: 'ϟ',
    description: '8% de paralizar 0,8 s con cada golpe.', effect: { stunChance: 0.08 } }),
  // --- Ataque ---
  A({ id: 'francotirador', name: 'Francotirador', rarity: 'rare', maxStacks: 3, icon: '⌖',
    description: '+8% de crítico y +25% de daño crítico.', effect: { crit: 0.08, critMult: 0.25 } }),
  A({ id: 'ataque-certero', name: 'Golpe Certero', rarity: 'epic', maxStacks: 2, icon: '✕',
    description: '6% de derrotar al instante a un enemigo (no jefe) por debajo del 30% de vida.', effect: { execute: 0.06 } }),
  A({ id: 'detonacion', name: 'Detonación', rarity: 'epic', maxStacks: 2, icon: '✺',
    description: 'Los enemigos explotan al caer: dañan a los de alrededor con el 25% de su vida.', effect: { killExplode: 0.25 } }),
  // --- Defensa y sustento ---
  A({ id: 'sed-de-sangre', name: 'Absorción', rarity: 'rare', maxStacks: 3, icon: '❤',
    description: 'Recuperas un 2% de vida por cada enemigo derrotado.', effect: { killHeal: 0.02 } }),
  A({ id: 'guardianes', name: 'Pantalla Luz', rarity: 'rare', maxStacks: 2, icon: '◎',
    description: '2 escudos giran a tu alrededor y paran disparos enemigos.', effect: { guardians: 2 } }),
  A({ id: 'evasion', name: 'Doble Equipo', rarity: 'common', maxStacks: 3, icon: '≋',
    description: '8% de esquivar cualquier golpe.', effect: { dodge: 0.08 } }),
  A({ id: 'robustez', name: 'Robustez', rarity: 'legendary', maxStacks: 1, icon: '⛰',
    description: 'Una vez por sala, un golpe mortal te deja con 1 de vida.', effect: { sturdy: 1 }, excludes: [] }),
].map((a) => [a.id, a]));

// ----------------------------------------------------------------------------
// Sinergias: se activan solas al reunir sus requisitos.
// ----------------------------------------------------------------------------

export interface SynergyDef {
  id: string;
  name: string;
  description: string;
  abilities: string[];
  /** Además hace falta un movimiento de alguno de estos tipos. */
  moveTypes?: ElementType[];
  effect: ModEffect;
}

export const SYNERGIES: SynergyDef[] = [
  { id: 'infierno', name: 'Infierno', abilities: ['cuerpo-llama'], moveTypes: ['fire'],
    description: 'Cuerpo Llama + un movimiento de Fuego: las quemaduras hacen el doble.', effect: { dotMult: 2, burnOnHit: 1 } },
  { id: 'nube-toxica', name: 'Nube Tóxica', abilities: ['punto-toxico', 'detonacion'],
    description: 'Las explosiones envenenan y son un 50% más grandes.', effect: { killExplodePoison: 3, killExplodeRadius: 20 } },
  { id: 'conductor', name: 'Conductor', abilities: ['electricidad-estatica'], moveTypes: ['water', 'electric'],
    description: 'Electricidad Estática + un movimiento de Agua o Eléctrico: el doble de parálisis.', effect: { stunChance: 0.1 } },
  { id: 'cobertura-total', name: 'Cobertura Total', abilities: ['abanico', 'flancos', 'retaguardia'],
    description: 'Disparas en todas direcciones: +25% de daño de proyectiles.', effect: { projDmg: 1.25 } },
  { id: 'rebote-infinito', name: 'Rebote Infinito', abilities: ['rebote', 'rebote-muro'],
    description: '+1 rebote entre enemigos y +1 en paredes.', effect: { ricochet: 1, wallBounce: 1 } },
  { id: 'cazador', name: 'Cazador', abilities: ['francotirador', 'ataque-certero'],
    description: 'Golpe Certero funciona por debajo del 45% de vida.', effect: { executeAt: 0.15, execute: 0.04 } },
  { id: 'fortaleza', name: 'Fortaleza', abilities: ['guardianes', 'evasion'],
    description: '+1 escudo de Pantalla Luz y +5% de esquiva.', effect: { guardians: 1, dodge: 0.05 } },
];

// ----------------------------------------------------------------------------
// Habilidad pasiva de cada Pokémon (según su tipo principal).
// ----------------------------------------------------------------------------

export interface PassiveDef { id: string; name: string; description: string; effect: ModEffect }

export const PASSIVES: Record<ElementType, PassiveDef> = {
  fire: { id: 'mar-llamas', name: 'Mar Llamas', description: 'Con poca vida (<33%), +50% de daño con movimientos de Fuego.', effect: { pinch: 0.5 } },
  water: { id: 'torrente', name: 'Torrente', description: 'Con poca vida (<33%), +50% de daño con movimientos de Agua.', effect: { pinch: 0.5 } },
  grass: { id: 'espesura', name: 'Espesura', description: 'Con poca vida (<33%), +50% de daño con movimientos de Planta.', effect: { pinch: 0.5 } },
  bug: { id: 'enjambre', name: 'Enjambre', description: 'Con poca vida (<33%), +50% de daño con movimientos de Bicho.', effect: { pinch: 0.5 } },
  electric: { id: 'electricidad-estatica', name: 'Electricidad Estática', description: 'Quien te golpea cuerpo a cuerpo queda paralizado (30%).', effect: { contactStun: 0.3 } },
  poison: { id: 'punto-toxico', name: 'Punto Tóxico', description: 'Quien te golpea cuerpo a cuerpo queda envenenado.', effect: { contactPoison: 2 } },
  normal: { id: 'afortunado', name: 'Afortunado', description: '+6% de golpe crítico.', effect: { crit: 0.06 } },
  flying: { id: 'levitacion', name: 'Levitación', description: 'Inmune a las zonas de daño del suelo.', effect: { levitate: true } },
  ghost: { id: 'levitacion', name: 'Levitación', description: 'Inmune a las zonas de daño del suelo.', effect: { levitate: true } },
  rock: { id: 'robustez', name: 'Robustez', description: 'Una vez por sala, un golpe mortal te deja con 1 de vida.', effect: { sturdy: 1 } },
  ground: { id: 'velo-arena', name: 'Velo Arena', description: '+10% de esquiva.', effect: { dodge: 0.1 } },
  psychic: { id: 'prevision', name: 'Previsión', description: 'Los avisos de ataques enemigos duran un 30% más.', effect: { foresight: 0.3 } },
  fighting: { id: 'agallas', name: 'Agallas', description: '+15% de daño.', effect: { dmg: 1.15 } },
  ice: { id: 'manto-niveo', name: 'Manto Níveo', description: '+10% de esquiva.', effect: { dodge: 0.1 } },
  dragon: { id: 'multiescamas', name: 'Multiescamas', description: 'Con la vida completa recibes la mitad de daño.', effect: { fullHpShield: 0.5 } },
  fairy: { id: 'cura-natural', name: 'Cura Natural', description: 'Recuperas 1 de vida por segundo.', effect: { regen: 1 } },
  steel: { id: 'cuerpo-puro', name: 'Cuerpo Puro', description: '−12% de daño recibido.', effect: { dmgTaken: 0.88 } },
  dark: { id: 'intimidacion', name: 'Intimidación', description: 'Los enemigos hacen un 10% menos de daño.', effect: { enemyDmg: 0.9 } },
};
