import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { ALL_MOVES, getMove } from '../src/data/moves';
import { typeMultiplier } from '../src/data/typeChart';
import { emptyRoom, makeWorld, run, spawnAt } from './helpers';

describe('combate', () => {
  it('un enemigo cuerpo a cuerpo persigue y daña al jugador por contacto', () => {
    const w = makeWorld();
    emptyRoom(w);
    w.player.moves = [];
    const p = w.player;
    const e = spawnAt(w, 19, 'chase', p.x, p.y - 150);
    const d0 = Math.hypot(e.x - p.x, e.y - p.y);
    run(w, 0.5);
    expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeLessThan(d0);
    const hp0 = p.hp;
    run(w, 6);
    expect(p.hp).toBeLessThan(hp0);
  });

  it('un enemigo que embiste avisa (apunta) antes de lanzarse', () => {
    const w = makeWorld();
    emptyRoom(w);
    w.player.moves = [];
    const e = spawnAt(w, 66, 'charger', w.player.x, w.player.y - 100);
    e.pt = 0;
    run(w, 0.1);
    expect(e.phase).toBe('aim');
    run(w, 0.6);
    expect(e.phase).toBe('dash');
  });

  it('un enemigo a distancia dispara proyectiles reales que dañan al jugador', () => {
    const w = makeWorld();
    emptyRoom(w);
    w.player.moves = [];
    const p = w.player;
    const e = spawnAt(w, 13, 'ranged', p.x, p.y - 120);
    e.shotCd = 0;
    run(w, 0.05);
    expect(w.projectiles.some((x) => !x.friendly)).toBe(true);
    const hp0 = p.hp;
    e.shotCd = 99;
    run(w, 2);
    expect(p.hp).toBeLessThan(hp0);
  });

  it('los proyectiles enemigos se pueden esquivar', () => {
    const w = makeWorld();
    emptyRoom(w);
    w.player.moves = [];
    const p = w.player;
    const e = spawnAt(w, 13, 'ranged', p.x, p.y - 140);
    e.shotCd = 0;
    run(w, 0.05);
    e.shotCd = 99;
    e.speed = 0;
    const hp0 = p.hp;
    run(w, 1.5, { x: 1, y: 0 });
    expect(p.hp).toBe(hp0);
  });

  it('las zonas con aviso no dañan hasta que estallan', () => {
    const w = makeWorld();
    emptyRoom(w);
    w.player.moves = [];
    const p = w.player;
    // Un enemigo quieto lejos para que la sala no se dé por superada.
    const dummy = spawnAt(w, 143, 'tank', 40, 40);
    dummy.speed = 0;
    w.addHazard({ kind: 'zone', x: p.x, y: p.y, r: 30, delay: 1, dmg: 10, element: 'fire', cat: 'special', color: '#f00' });
    const hp0 = p.hp;
    run(w, 0.8);
    expect(p.hp).toBe(hp0);
    run(w, 0.3);
    expect(p.hp).toBeLessThan(hp0);
  });

  it('los movimientos del jugador derrotan enemigos, que sueltan experiencia y oro', () => {
    const w = makeWorld();
    emptyRoom(w);
    const p = w.player;
    spawnAt(w, 10, 'chase', p.x, p.y - 120).speed = 0;
    spawnAt(w, 13, 'ranged', p.x + 60, p.y - 160).shotCd = 99;
    for (const e of w.enemies) e.speed = 0;
    run(w, 10);
    expect(w.enemies).toHaveLength(0);
    expect(w.kills).toBe(2);
    expect(w.runGold).toBeGreaterThan(0);
    run(w, 2);
    expect(p.xp > 0 || p.level > 1).toBe(true);
  });

  it('todos los tipos de movimiento hacen daño o efecto en combate', () => {
    for (const def of ALL_MOVES) {
      const w = makeWorld();
      emptyRoom(w);
      const p = w.player;
      p.moves = [];
      w.addMove(def.id);
      const e = spawnAt(w, 143, 'tank', p.x + 40, p.y - 15);
      e.hp = e.maxHp = 1e6;
      e.speed = 0;
      e.touchCd = 99;
      p.hp = p.maxHp = 1e6;
      // El rastro deja charcos por donde pasas: hay que caminar hacia el enemigo.
      run(w, 5, def.kind === 'trail' ? { x: 0.25, y: -0.1 } : { x: 0, y: 0 });
      if (def.kind === 'buff') {
        expect(Object.values(p.buffs).some((b) => b.n > 0), def.id).toBe(true);
      } else {
        expect(e.hp, def.id).toBeLessThan(1e6);
      }
    }
  });

  it('el jugador muere y la partida termina en derrota', () => {
    const w = makeWorld();
    w.player.hp = 1;
    w.player.invuln = 0;
    w.hurtPlayer(500, 'normal', 'physical');
    expect(w.phase).toBe('dead');
    expect(w.events.some((e) => e.type === 'defeat')).toBe(true);
  });

  it('la reducción de daño y la invulnerabilidad funcionan', () => {
    const a = makeWorld();
    const b = makeWorld({ perks: { hp: 0, atkMul: 1, spdMul: 1, cdMul: 1, dmgReduce: 0.3, regen: 0, magnetMul: 1, xpMul: 1, coinMul: 1, crit: 0 } });
    a.player.invuln = 0;
    b.player.invuln = 0;
    a.hurtPlayer(40, 'normal', 'physical');
    b.hurtPlayer(40, 'normal', 'physical');
    const lostA = a.player.maxHp - a.player.hp;
    const lostB = b.player.maxHp - b.player.hp;
    expect(lostB).toBeLessThan(lostA);
    const hp = a.player.hp;
    a.hurtPlayer(40, 'normal', 'physical');
    expect(a.player.hp).toBe(hp);
    void BALANCE;
  });

  it('tabla de tipos suavizada (×1,6 / ×0,6 / ×0,3)', () => {
    expect(typeMultiplier('water', ['fire'])).toBeCloseTo(1.6);
    expect(typeMultiplier('fire', ['water'])).toBeCloseTo(0.6);
    expect(typeMultiplier('normal', ['ghost'])).toBeCloseTo(0.3);
    expect(typeMultiplier('water', ['rock', 'ground'])).toBeCloseTo(2.4);
    expect(getMove('ember').type).toBe('fire');
  });
});
