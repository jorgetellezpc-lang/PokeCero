import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { castForTier, isRangedBehavior } from '../src/data/enemies';
import { Rng } from '../src/game/rng';
import { difficultyFor, enemyCountFor, planRoom, roomKind, roomSequence, tierForRoom } from '../src/game/rooms';
import { brock, makeWorld, run } from './helpers';

const pickFrom = (rng: Rng) => <T>(list: T[], n: number): T[] => {
  const copy = [...list];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rng.next() * copy.length), 1)[0]);
  return out;
};

describe('salas y dificultad', () => {
  it('estructura de 50 salas con minibosses en 20 y 40 y jefe en 50', () => {
    expect(roomSequence(false)).toHaveLength(50);
    expect(roomKind(20)).toBe('miniboss');
    expect(roomKind(40)).toBe('miniboss');
    expect(roomKind(50)).toBe('boss');
    expect(roomKind(19)).toBe('normal');
  });

  it('la dificultad empieza en 1/10, crece y los enemigos cambian de tramo', () => {
    expect(difficultyFor(1)).toBe(1);
    expect(difficultyFor(50)).toBe(10);
    for (let r = 2; r <= 50; r++) expect(enemyCountFor(r)).toBeGreaterThanOrEqual(enemyCountFor(r - 1));
    expect(tierForRoom(1)).toBe(0);
    expect(tierForRoom(11)).toBe(1);
    expect(tierForRoom(49)).toBe(4);
  });

  it('cada partida sortea un elenco por tramo, con apoyo y personalidades', () => {
    const rng = new Rng(9);
    for (let t = 0; t < 5; t++) {
      const cast = castForTier(t, pickFrom(rng));
      expect(cast.length).toBe(BALANCE.enemies.castSize);
      expect(cast.every((e) => e.dex <= 151)).toBe(true);
      expect(cast.some((e) => e.behavior === 'runner')).toBe(true);
    }
  });

  it('desde la sala 2 las oleadas mezclan cuerpo a cuerpo y distancia', () => {
    const rng = new Rng(7);
    const casts = [0, 1, 2, 3, 4].map((t) => castForTier(t, pickFrom(rng)));
    for (let r = BALANCE.difficulty.guaranteedRangedFrom; r < 50; r++) {
      if (roomKind(r) !== 'normal') continue;
      const defs = planRoom(brock, r, casts[tierForRoom(r)], rng).waves.flat();
      expect(defs.some((d) => isRangedBehavior(d.behavior)), `sala ${r}`).toBe(true);
      expect(defs.some((d) => !isRangedBehavior(d.behavior)), `sala ${r}`).toBe(true);
    }
  });

  it('limpiar una sala abre la salida y cruzarla avanza a la siguiente', () => {
    const w = makeWorld();
    expect(w.room).toBe(1);
    w.debugKillAll();
    for (let i = 0; i < 120; i++) {
      while (w.phase === 'levelup') w.chooseUpgrade(0);
      if (w.phase === 'item') w.chooseItem(true);
      w.update(1 / 60, { x: 0, y: 0 });
    }
    expect(w.roomCleared).toBe(true);
    expect(w.exitOpen).toBe(true);
    w.player.x = w.exit.x;
    w.player.y = w.exit.y + 10;
    run(w, 0.1);
    expect(w.room).toBe(2);
  });

  it('las salas de miniboss y jefe generan su jefe', () => {
    for (const room of [20, 40, 50]) {
      const w = makeWorld({ rooms: [room] });
      run(w, 3);
      expect(w.boss).not.toBeNull();
      expect(w.boss!.boss!.role).toBe(room === 50 ? 'boss' : 'miniboss');
    }
  });

  it('derrotar al jefe de la sala 50 da la victoria y suelta un objeto', () => {
    const w = makeWorld({ rooms: [50] });
    run(w, 3);
    w.debugKillAll();
    expect(w.events.some((e) => e.type === 'bossDefeated')).toBe(true);
    expect(w.pickups.some((g) => g.kind === 'item')).toBe(true);
    for (let i = 0; i < 600 && w.phase !== 'victory'; i++) {
      if (w.phase === 'levelup') w.chooseUpgrade(0);
      if (w.phase === 'item') w.chooseItem(true);
      w.update(1 / 60, { x: 0, y: 0 });
    }
    expect(w.phase).toBe('victory');
  });

  it('el jefe pasa por 3 fases con ataques propios y se enfurece en la última', () => {
    const w = makeWorld({ rooms: [50] });
    run(w, 2);
    const boss = w.boss!;
    const seen = new Set<string>();
    const phases: number[] = [];
    w.player.hp = w.player.maxHp = 1e9;
    for (let i = 0; i < 60 * 45; i++) {
      w.update(1 / 60, { x: Math.sin(i / 50), y: Math.cos(i / 70) * 0.5 });
      if (boss.ai?.cast) seen.add(boss.ai.cast.id);
      for (const ev of w.events.splice(0)) if (ev.type === 'bossPhase') phases.push(ev.phase);
      if (w.phase === 'levelup') w.chooseUpgrade(0);
      if (i === 60 * 12) boss.hp = boss.maxHp * 0.6;
      if (i === 60 * 26) boss.hp = boss.maxHp * 0.3;
      boss.hp = Math.max(boss.hp, 1);
    }
    expect(phases).toEqual([2, 3]);
    expect(seen.size).toBeGreaterThanOrEqual(4);
    // Onix: estrena Excavar en la fase 2 y Tormenta Arena en la 3.
    expect(seen.has('dig')).toBe(true);
    expect(seen.has('storm')).toBe(true);
    expect(boss.ai!.fury).toBe(true)
;
    expect(w.player.hp).toBeLessThan(1e9);
  });
});
