import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { emptyRoom, makeWorld, run, spawnAt } from './helpers';

describe('combate', () => {
  it('un enemigo cuerpo a cuerpo persigue y daña al jugador', () => {
    const w = makeWorld();
    emptyRoom(w);
    w.player.attacks = [];
    const p = w.player;
    const e = spawnAt(w, 'rattata', p.x, p.y - 150);
    const d0 = Math.hypot(e.x - p.x, e.y - p.y);
    run(w, 0.5);
    expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeLessThan(d0);
    const hp0 = p.hp;
    p.invuln = 0;
    run(w, 4);
    expect(p.hp).toBeLessThan(hp0);
  });

  it('un enemigo a distancia dispara proyectiles reales que dañan al jugador', () => {
    const w = makeWorld();
    emptyRoom(w);
    w.player.attacks = [];
    const p = w.player;
    const e = spawnAt(w, 'weedle', p.x, p.y - 170);
    e.attackTimer = 0;
    // Durante la preparación todavía no hay proyectil ni daño.
    run(w, 0.1);
    expect(e.state).toBe('windup');
    expect(w.projectiles.filter((x) => x.owner === 'enemy')).toHaveLength(0);
    const hp0 = p.hp;
    run(w, 0.7);
    expect(w.projectiles.some((x) => x.owner === 'enemy')).toBe(true);
    expect(p.hp).toBe(hp0);
    run(w, 2);
    expect(p.hp).toBeLessThan(hp0);
  });

  it('los proyectiles enemigos se pueden esquivar', () => {
    const w = makeWorld();
    emptyRoom(w);
    w.player.attacks = [];
    const p = w.player;
    const e = spawnAt(w, 'weedle', p.x, p.y - 170);
    e.attackTimer = 0;
    run(w, 0.75); // dispara
    expect(w.projectiles.some((x) => x.owner === 'enemy')).toBe(true);
    e.attackTimer = 99; // sin más disparos
    const hp0 = p.hp;
    run(w, 1.2, { x: 1, y: 0 }); // apartarse lateralmente
    expect(p.hp).toBe(hp0);
  });

  it('los ataques del jugador derrotan enemigos, que sueltan experiencia y oro', () => {
    const w = makeWorld();
    emptyRoom(w);
    const p = w.player;
    spawnAt(w, 'caterpie', p.x, p.y - 120);
    spawnAt(w, 'weedle', p.x + 60, p.y - 160);
    for (const e of w.enemies) e.attackTimer = 99;
    run(w, 10);
    expect(w.enemies).toHaveLength(0);
    expect(w.kills).toBe(2);
    expect(w.runGold).toBeGreaterThan(0);
    // La experiencia se recoge al acercarse (o se atrae al limpiar la sala).
    run(w, 2);
    expect(p.xp > 0 || p.level > 1).toBe(true);
  });

  it('el jugador muere y la partida termina en derrota', () => {
    const w = makeWorld();
    w.player.hp = 1;
    w.player.invuln = 0;
    w.hitPlayer(50);
    expect(w.phase).toBe('dead');
    expect(w.events.some((e) => e.type === 'defeat')).toBe(true);
  });

  it('la defensa reduce el daño recibido', () => {
    const a = makeWorld();
    const b = makeWorld({ permanent: { hp: 0, power: 0, defense: 0.3, speed: 0 } });
    a.player.invuln = 0;
    b.player.invuln = 0;
    a.hitPlayer(20);
    b.hitPlayer(20);
    expect(a.player.maxHp - a.player.hp).toBe(20);
    expect(b.player.maxHp - b.player.hp).toBe(14);
  });

  it('tras recibir daño hay invulnerabilidad temporal', () => {
    const w = makeWorld();
    w.player.invuln = 0;
    w.hitPlayer(10);
    const hp = w.player.hp;
    w.hitPlayer(10);
    expect(w.player.hp).toBe(hp);
    run(w, BALANCE.player.invulnerability + 0.05);
  });
});
