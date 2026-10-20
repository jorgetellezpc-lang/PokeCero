import { KANTO } from '../src/data/regions';
import type { Enemy } from '../src/game/entities';
import { World, type WorldOptions } from '../src/game/world';

export const brock = KANTO.gyms[0];

export function makeWorld(opts: Partial<WorldOptions> = {}): World {
  return new World({ speciesId: 'charmander', gym: brock, rooms: [1, 2, 3], seed: 42, ...opts });
}

/** Deja la sala vacía para colocar enemigos a mano. */
export function emptyRoom(w: World): void {
  w.enemies = [];
  w.markers = [];
  w.pendingWaves = [];
  w.projectiles = [];
  w.player.invuln = 0;
}

/** Aparece un enemigo en una posición concreta. */
export function spawnAt(w: World, id: string, x: number, y: number): Enemy {
  w.queueSpawn(id);
  const mk = w.markers[w.markers.length - 1];
  mk.x = x;
  mk.y = y;
  mk.t = 0;
  w.update(1 / 60, { x: 0, y: 0 });
  const e = w.enemies[w.enemies.length - 1];
  e.x = x;
  e.y = y;
  return e;
}

export function run(w: World, seconds: number, move = { x: 0, y: 0 }): void {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps && w.phase === 'playing'; i++) w.update(1 / 60, move);
}
