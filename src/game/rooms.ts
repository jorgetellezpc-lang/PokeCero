import { BALANCE } from '../config/balance';
import { ENEMIES } from '../data/enemies';
import type { EnemyDef, GymDef } from '../data/types';
import type { Rng } from './rng';

// Oleadas y dificultad: composición de cada sala a partir de la curva
// PROVISIONAL de config/balance.ts.

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
  /** Sub-oleadas de enemigos normales (ids). */
  waves: string[][];
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

export function scalingFor(room: number): RoomScaling {
  const D = BALANCE.difficulty;
  const r = room - 1;
  return {
    difficulty: difficultyFor(room),
    hpMult: 1 + D.hpPerRoom * r,
    damageMult: 1 + D.damagePerRoom * r,
    speedMult: 1 + D.speedPerRoom * r,
  };
}

export function enemyCountFor(room: number): number {
  const D = BALANCE.difficulty;
  return Math.round(D.countBase + D.countPerLevel * (difficultyFor(room) - 1));
}

export function rangedShareFor(room: number): number {
  const D = BALANCE.difficulty;
  return Math.min(D.rangedShareMax, D.rangedShareBase + D.rangedSharePerLevel * (difficultyFor(room) - 1));
}

export function planRoom(gym: GymDef, room: number, rng: Rng): RoomPlan {
  const kind = roomKind(room);
  const scaling = scalingFor(room);
  if (kind !== 'normal') {
    return { room, kind, scaling, waves: [], bossId: gym.bosses[room] };
  }
  const pool: EnemyDef[] = gym.enemyPool.map((id) => ENEMIES[id]).filter((e) => e && e.minRoom <= room && e.weight > 0);
  const melee = pool.filter((e) => e.archetype === 'melee');
  const ranged = pool.filter((e) => e.archetype === 'ranged');

  const count = enemyCountFor(room);
  let rangedCount = ranged.length ? Math.round(count * rangedShareFor(room)) : 0;
  if (ranged.length && room >= BALANCE.difficulty.guaranteedRangedFrom) rangedCount = Math.max(1, rangedCount);
  if (!melee.length) rangedCount = count;

  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const list = i < rangedCount ? ranged : melee;
    ids.push(rng.weighted(list, (e) => e.weight).id);
  }
  // Mezclar para que melee y distancia aparezcan combinados.
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  const [t1, t2] = BALANCE.difficulty.subWaveThresholds;
  const d = scaling.difficulty;
  const nWaves = d < t1 ? 1 : d < t2 ? 2 : 3;
  const waves: string[][] = Array.from({ length: nWaves }, () => []);
  ids.forEach((id, i) => waves[i % nWaves].push(id));
  return { room, kind, scaling, waves };
}

/** Secuencia de salas que se juegan en un gimnasio. */
export function roomSequence(testMode: boolean): number[] {
  if (testMode) return [...BALANCE.rooms.testModeRooms];
  return Array.from({ length: BALANCE.rooms.perGym }, (_, i) => i + 1);
}
