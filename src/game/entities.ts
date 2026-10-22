import type { CombatMods } from '../data/abilities';
import type { BossDef, BossSignature, EnemyDef, Behavior } from '../data/enemies';
import type { ItemId } from '../data/items';
import type { BuffStat, MoveCategory, MoveDef, MoveNums } from '../data/moves';
import type { PokemonSpecies } from '../data/pokemon';
import type { Signature } from '../data/signatures';
import type { RunStatId } from '../data/runUpgrades';
import type { ElementType } from '../data/types';
import type { Animator } from '../render/animator';

// Estado de las entidades de combate. Sin dependencias de DOM: la partida se
// puede simular en Node (tests) y dibujarse aparte (render/).
// (x, y) son siempre los PIES / la sombra.

export interface Vec { x: number; y: number }

export interface OwnedMove {
  def: MoveDef;
  level: number;
  evolved: boolean;
  /** Nombre visible (cambia al evolucionar). */
  name: string;
  /** Recarga restante. */
  t: number;
  /** Ángulo de los orbes. */
  angle: number;
  /** Estadísticas efectivas (se recalculan al mejorar). */
  s: MoveNums;
  dealt: number;
}

/** Ataque característico de la partida (src/data/signatures.ts). */
export interface AttackState {
  sig: Signature;
  /** Mejoras cogidas, en orden (ids de ATTACK_UPGRADES). */
  ups: string[];
  evolved: boolean;
}

export interface Buff { n: number; t: number; amount: number; max: number }

export interface Player extends Vec {
  r: number;
  species: PokemonSpecies;
  anim: Animator;
  hp: number;
  maxHp: number;
  baseSpeed: number;
  /** Multiplicadores de la partida (cartas, objeto y mejoras permanentes). */
  atkMul: number;
  spdMul: number;
  cdMul: number;
  dmgReduce: number;
  regenFlat: number;
  magnet: number;
  xpMul: number;
  coinMul: number;
  crit: number;
  buffs: Record<BuffStat, Buff>;
  invuln: number;
  level: number;
  xp: number;
  /** Movimientos activos. Con el ataque característico, solo uno: el de `attack`. */
  moves: OwnedMove[];
  attack: AttackState;
  /** Veces que se ha cogido cada carta de estadística. */
  statsTaken: Partial<Record<RunStatId, number>>;
  item: ItemId | null;
  focusCd: number;
  /** Hacia dónde apunta (rad). */
  aim: number;
  moveAngle: number;
  moving: boolean;
  hitFlash: number;
  lastPatch: Vec | null;
  /** Habilidades de la partida (id → acumulaciones). */
  abilities: Record<string, number>;
  /** Modificadores de combate (pasiva + habilidades + sinergias). */
  mods: CombatMods;
  synergies: string[];
  /** Usos de Robustez que quedan en esta sala. */
  sturdyLeft: number;
  /** Ángulo de los escudos de Pantalla Luz. */
  guardAngle: number;
}

export type EnemyPhase = 'walk' | 'aim' | 'dash' | 'fuse' | 'cast';

export interface BossCast {
  id: 'slam' | 'dash' | 'leap' | 'rain' | 'beam' | 'volley' | 'nova' | BossSignature;
  t: number;
  wind: number;
  after: number;
  ang: number;
  len?: number;
  dur?: number;
  go?: boolean;
  fired?: boolean;
  /** Repeticiones que quedan (Rodada). */
  n?: number;
  tx?: number;
  ty?: number;
}

export interface BossBrain {
  melee: BossCast['id'][];
  ranged: BossCast['id'][];
  farLike: number;
  mode: 'far' | 'close';
  modeT: number;
  cd: number;
  cast: BossCast | null;
  fury: boolean;
  side: number;
  /** Fase actual (0, 1, 2…). */
  phase: number;
  /** Ataque que usará en cuanto pueda (al cambiar de fase). */
  forced?: BossCast['id'];
}

export interface Jump { sx: number; sy: number; tx: number; ty: number; t: number; dur: number }

export interface Enemy extends Vec {
  id: number;
  def: EnemyDef | BossDef;
  boss: BossDef | null;
  behavior: Behavior;
  types: ElementType[];
  cat: 'physical' | 'special';
  anim: Animator;
  scale: number;
  r: number;
  bodyH: number;
  hp: number;
  maxHp: number;
  damage: number;
  shotDmg: number;
  speed: number;
  flash: number;
  // Estados
  slow: number; slowT: number;
  burn: number; burnT: number; burnTick: number;
  poison: number; poisonT: number; poisonTick: number;
  stunT: number;
  shield: number; shieldT: number;
  kx: number; ky: number;
  touchCd: number;
  // Comportamiento
  phase: EnemyPhase;
  pt: number;
  dx: number; dy: number;
  shotCd: number;
  skillCd: number;
  jump: Jump | null;
  side: number;
  ai: BossBrain | null;
  summoned: boolean;
  /** Bajo tierra (Excavar): no se le puede golpear. */
  hidden: boolean;
  /** Orbes: enfriamiento por movimiento (id → s). */
  orbitCd: Record<string, number>;
}

/** Enemigo derrotado: se queda en el suelo con la animación de caer y se desvanece. */
export interface Corpse extends Vec { anim: Animator; fade: number; boss: boolean }

export interface Projectile extends Vec {
  id: number;
  vx: number; vy: number;
  r: number;
  dmg: number;
  friendly: boolean;
  element: ElementType;
  cat: MoveCategory;
  pierce: number;
  life: number;
  t: number;
  color: string;
  hits: Set<number>;
  homing: number;
  /** Bumerán: segundos hasta darse la vuelta. */
  boom: number;
  back: boolean;
  bounce: number;
  burn: number; poison: number; slow: number; knock: number; drain: number;
  /** Movimiento de origen (para estadísticas y evolución). */
  move: OwnedMove | null;
  /** Rebotes que le quedan contra las paredes. */
  wallBounce: number;
  shape: string;
  /** Fragmento de una División (no se vuelve a dividir ni estalla). */
  frag?: boolean;
  /** Amplitud de la trayectoria ondulante. */
  wobble?: number;
  /** Color de la estela (tipo secundario) y nivel de mejora (0-3) para el brillo. */
  trail?: string;
  tier?: number;
}

export type FieldKind = 'mine' | 'meteor' | 'turret' | 'patch' | 'charge' | 'spin' | 'quake' | 'vortex' | 'stunzone';

/** Lo que un movimiento deja en el mapa un rato (minas, meteoros, torretas, charcos…). */
export interface Field extends Vec {
  kind: FieldKind;
  move: OwnedMove;
  color: string;
  t: number;
  life: number;
  r: number;
  dmg: number;
  arm?: number;
  fall?: number;
  shotT?: number;
  tick?: number;
  at?: number;
  n?: number;
  i?: number;
  next?: number;
  a?: number;
  ca?: number;
  sa?: number;
  pull?: number;
  delay?: number;
  gone?: boolean;
}

/** Ataque enemigo con aviso en el suelo: zona circular o franja (rayo / embestida). */
export interface Hazard extends Vec {
  kind: 'zone' | 'beam';
  r: number;
  angle: number;
  len: number;
  w: number;
  delay: number;
  t: number;
  dmg: number;
  element: ElementType;
  cat: 'physical' | 'special';
  color: string;
}

export type PickupKind = 'xp' | 'xpBig' | 'coin' | 'heal' | 'ticket' | 'item';

export interface Pickup extends Vec { kind: PickupKind; value: number; item?: ItemId; pulled: boolean; t: number }

export interface FloatText extends Vec { text: string; color: string; life: number; size: number }
export interface Particle extends Vec { vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
export interface Ring extends Vec { r: number; maxR: number; life: number; maxLife: number; color: string; width: number }
export interface Slash extends Vec { angle: number; radius: number; arc: number; life: number; color: string }
export interface Beam extends Vec { angle: number; len: number; w: number; life: number; color: string }
