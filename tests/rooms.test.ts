import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { ENEMIES } from '../src/data/enemies';
import { Rng } from '../src/game/rng';
import { difficultyFor, enemyCountFor, planRoom, roomKind, roomSequence, scalingFor } from '../src/game/rooms';
import { brock, makeWorld, run } from './helpers';

describe('salas y dificultad', () => {
  it('estructura de 50 salas con minibosses en 20 y 40 y jefe en 50', () => {
    expect(roomSequence(false)).toHaveLength(50);
    expect(roomKind(20)).toBe('miniboss');
    expect(roomKind(40)).toBe('miniboss');
    expect(roomKind(50)).toBe('boss');
    expect(roomKind(19)).toBe('normal');
  });

  it('la dificultad empieza en 1/10 y crece', () => {
    expect(difficultyFor(1)).toBe(1);
    expect(difficultyFor(50)).toBe(10);
    for (let r = 2; r <= 50; r++) {
      expect(enemyCountFor(r)).toBeGreaterThanOrEqual(enemyCountFor(r - 1));
      expect(scalingFor(r).hpMult).toBeGreaterThan(scalingFor(r - 1).hpMult);
    }
  });

  it('las oleadas mezclan cuerpo a cuerpo y distancia a partir de la sala 2', () => {
    const rng = new Rng(7);
    for (let r = BALANCE.difficulty.guaranteedRangedFrom; r < 50; r++) {
      if (roomKind(r) !== 'normal') continue;
      const ids = planRoom(brock, r, rng).waves.flat();
      const types = new Set(ids.map((id) => ENEMIES[id].archetype));
      expect(types.has('ranged')).toBe(true);
      expect(types.has('melee')).toBe(true);
    }
  });

  it('limpiar una sala abre la salida y cruzarla avanza a la siguiente', () => {
    const w = makeWorld();
    expect(w.room).toBe(1);
    w.debugKillAll();
    run(w, 1);
    for (let i = 0; i < 3 && w.phase === 'levelup'; i++) w.chooseUpgrade(0);
    run(w, 1);
    expect(w.roomCleared).toBe(true);
    expect(w.exitOpen).toBe(true);
    w.player.x = w.exit.x;
    w.player.y = w.exit.y + 10;
    run(w, 0.1);
    expect(w.room).toBe(2);
  });

  it('las salas de miniboss y jefe generan su jefe con barra de vida', () => {
    for (const room of [20, 40, 50]) {
      const w = makeWorld({ rooms: [room] });
      run(w, 3);
      expect(w.boss).not.toBeNull();
      expect(w.boss!.boss!.role).toBe(room === 50 ? 'boss' : 'miniboss');
    }
  });

  it('derrotar al jefe de la sala 50 da la victoria', () => {
    const w = makeWorld({ rooms: [50] });
    run(w, 3);
    expect(w.boss).not.toBeNull();
    w.debugKillAll();
    expect(w.events.some((e) => e.type === 'bossDefeated')).toBe(true);
    for (let i = 0; i < 400 && w.phase !== 'victory'; i++) {
      if (w.phase === 'levelup') w.chooseUpgrade(0);
      w.update(1 / 60, { x: 0, y: 0 });
    }
    expect(w.phase).toBe('victory');
  });

  it('los jefes usan patrones distintos y su embestida/rocas pueden dañar', () => {
    const w = makeWorld({ rooms: [50] });
    run(w, 2);
    const boss = w.boss!;
    const seen = new Set<string>();
    w.player.hp = 1e9;
    w.player.maxHp = 1e9;
    for (let i = 0; i < 60 * 25; i++) {
      w.update(1 / 60, { x: Math.sin(i / 50), y: 0 });
      if (boss.pattern) seen.add(boss.pattern);
      if (w.phase === 'levelup') w.chooseUpgrade(0);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
    expect(w.player.hp).toBeLessThan(1e9);
  });
});
