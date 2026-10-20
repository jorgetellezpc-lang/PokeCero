import type { RunStatId } from '../data/runUpgrades';
import type { AttackDef, BossDef, BossPatternId, ElementType, EnemyDef, PokemonSpecies } from '../data/types';

// Estado de las entidades de combate. Sin dependencias de DOM: la partida
// puede simularse en Node (tests) y dibujarse aparte (render/).

export interface Vec { x: number; y: number }

export interface OwnedAttack {
  def: AttackDef;
  level: number;
  timer: number;
  angle: number;
}

export interface Player extends Vec {
  r: number;
  species: PokemonSpecies;
  hp: number;
  maxHp: number;
  speed: number;
  power: number;
  defense: number;
  haste: number;
  magnet: number;
  regen: number;
  invuln: number;
  level: number;
  xp: number;
  attacks: OwnedAttack[];
  statStacks: Partial<Record<RunStatId, number>>;
  facing: number;
  moving: boolean;
  animTime: number;
  hitFlash: number;
}

export type EnemyState = 'move' | 'windup' | 'strike' | 'recover';

export interface Enemy extends Vec {
  id: number;
  def: EnemyDef | BossDef;
  boss: BossDef | null;
  r: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  state: EnemyState;
  stateTime: number;
  attackTimer: number;
  aim: Vec;
  /** Ya golpeó durante la embestida actual. */
  struck: boolean;
  strafe: number;
  knock: Vec;
  hitFlash: number;
  /** Enfriamientos por ataque de orbe (id de ataque → s). */
  orbitCd: Record<string, number>;
  facing: number;
  animTime: number;
  // Jefes
  pattern: BossPatternId | null;
  patternIndex: number;
  phase2: boolean;
  contact: number;
  contactCd: number;
}

export interface Projectile extends Vec {
  id: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  owner: 'player' | 'enemy';
  element: ElementType;
  pierce: number;
  life: number;
  color: string;
  hit: Set<number>;
}

/** Área de efecto: con `delay` > 0 se muestra como aviso antes de activarse. */
export interface Zone extends Vec {
  r: number;
  owner: 'player' | 'enemy';
  element: ElementType;
  damage: number;
  delay: number;
  life: number;
  tick: number;
  tickEvery: number;
  color: string;
  /** Si es true golpea una sola vez al activarse. */
  burst: boolean;
  fired: boolean;
}

export interface Gem extends Vec { value: number; pulled: boolean }

export interface SpawnMarker extends Vec { t: number; enemyId: string; boss: boolean }

export interface FloatText extends Vec { text: string; color: string; life: number; size: number }

export interface Particle extends Vec { vx: number; vy: number; life: number; maxLife: number; color: string; size: number }

/** Efecto visual de onda (nova). */
export interface Ring extends Vec { r: number; maxR: number; life: number; color: string }
