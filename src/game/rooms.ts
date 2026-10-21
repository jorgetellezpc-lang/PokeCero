import { BALANCE } from '../config/balance';
import { ENEMY_TIERS, isRangedBehavior, type EnemyDef } from '../data/enemies';
import type { GymDef } from '../data/types';
import type { Rng } from './rng';

// Oleadas y dificultad: composición de cada sala a partir del elenco de la
// partida y de la curva PROVISIONAL de config/balance.ts.

export type RoomKind = 'normal' | 'miniboss' | 'boss';

export interface RoomScaling {
  difficulty: number;
  hpMult: number;
  damageMult: number;
  speedMult: number;
}

export interface RoomPlan {
  room: number;
  kind: RoomKind;
  scaling: RoomScaling;
  /** Sub-oleadas de enemigos normales. */
  waves: EnemyDef[][];
  bossId?: string;
}

export function roomKind(room: number): RoomKind {
  if (room === BALANCE.rooms.bossRoom) return 'boss';
  if ((BALANCE.rooms.minibossRooms as readonly number[]).includes(room)) return 'miniboss';
  return 'normal';
}

/** Dificultad 1..10 a lo largo de las 50 salas. */
export function difficultyFor(room: number): number {
  const n = BALANCE.rooms.perGym;
  return 1 + (9 * (Math.min(room, n) - 1)) / (n - 1);
}

/** Tramo de enemigos (0..4) de una sala. */
export function tierForRoom(room: number): number {
  return Math.min(ENEMY_TIERS.length - 1, Math.floor((room - 1) / BALANCE.enemies.roomsPerTier));
}

export function scalingFor(room: number): RoomScaling {
  const D = BALANCE.difficulty;
  const r = (room - 1) % BALANCE.enemies.roomsPerTier;
  return {
    difficulty: difficultyFor(room),
    hpMult: 1 + D.hpPerRoom * r,
    damageMult: 1 + D.damagePerRoom * r,
    speedMult: 1 + D.speedPerRoom * (room - 1),
  };
}

export function enemyCountFor(room: number): number {
  const D = BALANCE.difficulty;
  return Math.round(D.countBase + D.countPerLevel * (difficultyFor(room) - 1));
}

export function planRoom(gym: GymDef, room: number, cast: EnemyDef[], rng: Rng): RoomPlan {
  const kind = roomKind(room);
  const scaling = scalingFor(room);
  if (kind !== 'normal') return { room, kind, scaling, waves: [], bossId: gym.bosses[room] };

  const count = enemyCountFor(room);
  const defs: EnemyDef[] = [];
  for (let i = 0; i < count; i++) defs.push(cast[Math.floor(rng.next() * cast.length)]);
  // Desde la sala 2 siempre hay alguien que ataca de lejos (si el elenco lo tiene).
  if (room >= BALANCE.difficulty.guaranteedRangedFrom && !defs.some((d) => isRangedBehavior(d.behavior))) {
    const ranged = cast.filter((d) => isRangedBehavior(d.behavior));
    if (ranged.length) defs[0] = ranged[Math.floor(rng.next() * ranged.length)];
  }
  for (let i = defs.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [defs[i], defs[j]] = [defs[j], defs[i]];
  }
  const [t1, t2] = BALANCE.difficulty.subWaveThresholds;
  const d = scaling.difficulty;
  const nWaves = d < t1 ? 1 : d < t2 ? 2 : 3;
  const waves: EnemyDef[][] = Array.from({ length: nWaves }, () => []);
  defs.forEach((def, i) => waves[i % nWaves].push(def));
  return { room, kind, scaling, waves };
}

/** Secuencia de salas que se juegan en un gimnasio. */
export function roomSequence(testMode: boolean): number[] {
  if (testMode) return [...BALANCE.rooms.testModeRooms];
  return Array.from({ length: BALANCE.rooms.perGym }, (_, i) => i + 1);
}
