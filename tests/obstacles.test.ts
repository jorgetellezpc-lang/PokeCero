import { describe, expect, it } from 'vitest';
import { BOSS_LAYOUT, LAYOUTS, layoutFor, type Obstacle } from '../src/data/layouts';
import { isFree, NavGrid } from '../src/game/obstacles';
import { roomSequence } from '../src/game/rooms';
import type { World } from '../src/game/world';
import { emptyRoom, makeWorld, run, spawnAt } from './helpers';

const W = 360;
const H = 600;
const START = { x: 180, y: 530 };
const EXIT = { x: 180, y: 30 };

function setObstacles(w: World, list: Obstacle[]): void {
  w.obstacles = list;
  w.nav = new NavGrid(w.W, w.H, list);
}

const rock = (x: number, y: number, ww: number, h: number): Obstacle => ({ kind: 'rock', x, y, w: ww, h });
const water = (x: number, y: number, ww: number, h: number): Obstacle => ({ kind: 'water', x, y, w: ww, h });

describe('obstáculos', () => {
  it('todos los diseños dejan libre la entrada, la salida y el sitio del jefe, sin zonas cerradas', () => {
    for (const l of [...LAYOUTS, BOSS_LAYOUT]) {
      for (const flip of [false, true]) {
        const obs = l.obstacles.map((o) => (flip ? { ...o, x: W - o.x - o.w } : o));
        expect(isFree(START.x, START.y, 20, obs), `${l.id} entrada`).toBe(true);
        expect(isFree(EXIT.x, EXIT.y + 10, 20, obs), `${l.id} salida`).toBe(true);
        expect(isFree(180, 170, 30, obs) || l !== BOSS_LAYOUT, `${l.id} jefe`).toBe(true);
        const nav = new NavGrid(W, H, obs);
        expect(nav.reachable(START, EXIT), `${l.id} camino`).toBe(true);
        // Cualquier punto libre de la zona de juego se puede alcanzar andando.
        for (let x = 30; x < W - 30; x += 15) {
          for (let y = 40; y < H - 30; y += 15) {
            if (!isFree(x, y, 24, obs)) continue;
            expect(nav.reachable({ x, y }, START), `${l.id} (${x},${y})`).toBe(true);
          }
        }
      }
    }
  });

  it('la primera sala es abierta, las de jefe casi y el resto con obstáculos', () => {
    expect(layoutFor(1, 'normal', () => 0.3)).toEqual([]);
    expect(layoutFor(50, 'boss', () => 0.3).length).toBe(BOSS_LAYOUT.obstacles.length);
    expect(layoutFor(8, 'normal', () => 0.3).length).toBeGreaterThan(0);
    const w = makeWorld({ rooms: roomSequence(true) });
    const counts: number[] = [];
    for (let i = 0; i < w.rooms.length; i++) { w.startRoom(i); counts.push(w.obstacles.length); }
    expect(counts.filter((n) => n > 0).length).toBeGreaterThanOrEqual(6);
  });

  it('no puedes atravesar una roca', () => {
    const w = makeWorld();
    emptyRoom(w);
    spawnAt(w, 74, 'tank', 40, 40).hp = 1e9;
    setObstacles(w, [rock(140, 400, 80, 40)]);
    const p = w.player;
    p.x = 180;
    p.y = 470;
    run(w, 2, { x: 0, y: -1 });
    expect(p.y).toBeGreaterThanOrEqual(440 + p.r - 0.5);
  });

  it('el agua corta el paso salvo con Levitación', () => {
    for (const [sp, crosses] of [['charmander', false], ['gastly', true]] as const) {
      const w = makeWorld({ speciesId: sp });
      emptyRoom(w);
      spawnAt(w, 74, 'tank', 40, 40).hp = 1e9;
      setObstacles(w, [water(14, 380, 332, 50)]);
      w.player.x = 180;
      w.player.y = 470;
      run(w, 2.5, { x: 0, y: -1 });
      expect(w.player.y < 380, sp).toBe(crosses);
    }
  });

  it('los enemigos rodean un muro para llegar a ti', () => {
    const w = makeWorld();
    emptyRoom(w);
    const p = w.player;
    p.moves = [];
    p.hp = p.maxHp = 1e9;
    setObstacles(w, [rock(60, 300, 240, 30)]);
    p.x = 180;
    p.y = 450;
    const e = spawnAt(w, 19, 'chase', 180, 200);
    e.hp = 1e9;
    let reached = false;
    for (let i = 0; i < 60 * 12 && !reached; i++) {
      w.update(1 / 60, { x: 0, y: 0 });
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 4) reached = true;
    }
    expect(reached).toBe(true);
  });

  it('un enemigo a distancia tapado por una roca se recoloca y te dispara', () => {
    const w = makeWorld();
    emptyRoom(w);
    const p = w.player;
    p.moves = [];
    p.hp = p.maxHp = 1e6;
    setObstacles(w, [rock(150, 400, 60, 40)]);
    p.x = 180;
    p.y = 500;
    const e = spawnAt(w, 13, 'ranged', 180, 330);
    e.hp = 1e9;
    run(w, 8);
    expect(p.hp).toBeLessThan(1e6);
  });

  it('los voladores cruzan el agua en línea recta', () => {
    const w = makeWorld();
    emptyRoom(w);
    w.player.moves = [];
    w.player.hp = w.player.maxHp = 1e9;
    setObstacles(w, [water(14, 300, 332, 40)]);
    const e = spawnAt(w, 41, 'chase', 180, 200); // Zubat
    e.hp = 1e9;
    run(w, 4);
    expect(e.y).toBeGreaterThan(340);
  });

  it('las rocas paran tus disparos y los enemigos (y Rebote Muro rebota en ellas)', () => {
    const w = makeWorld();
    emptyRoom(w);
    const target = spawnAt(w, 74, 'tank', 180, 150);
    target.hp = target.maxHp = 1e9;
    target.speed = 0;
    setObstacles(w, [rock(120, 330, 120, 40)]);
    w.player.moves[0].t = 0;
    run(w, 1.5);
    expect(target.hp).toBe(1e9);
    // Disparo enemigo contra la roca: no llega.
    const shooter = spawnAt(w, 13, 'ranged', 180, 250);
    shooter.hp = 1e9;
    w.player.moves = [];
    const hp = w.player.hp;
    w.player.invuln = 0;
    w.projectiles = [];
    w.enemyShot(shooter, Math.PI / 2, 1, 0);
    run(w, 0.8);
    expect(w.player.hp).toBe(hp);
  });

  it('Rebote Muro hace rebotar tus proyectiles en las rocas', () => {
    const w = makeWorld();
    w.player.abilities['rebote-muro'] = 1;
    w.refreshMods();
    emptyRoom(w);
    spawnAt(w, 74, 'tank', 40, 40).hp = 1e9;
    setObstacles(w, [rock(120, 300, 120, 40)]);
    w.projectiles = [];
    w.update(1 / 60, { x: 0, y: 0 });
    w.projectiles.push({
      id: w.newId(), x: 180, y: 360, vx: 0, vy: -300, r: 5, dmg: 1, friendly: true, element: 'fire', cat: 'special', pierce: 0,
      life: 2, t: 0, color: '#f80', hits: new Set(), homing: 0, boom: 0, back: false, bounce: 0, burn: 0, poison: 0, slow: 0,
      knock: 0, drain: 0, move: null, wallBounce: 2, shape: 'orb',
    });
    const pr = w.projectiles[w.projectiles.length - 1];
    run(w, 0.15);
    expect(pr.vy).toBeGreaterThan(0);
    expect(pr.wallBounce).toBe(1);
  });

  it('apuntas antes a un enemigo a la vista que a uno más cerca tras una roca', () => {
    const w = makeWorld();
    emptyRoom(w);
    setObstacles(w, [rock(140, 420, 80, 30)]);
    const p = w.player;
    p.x = 180;
    p.y = 500;
    const behind = spawnAt(w, 74, 'tank', 180, 380);
    const visible = spawnAt(w, 74, 'tank', 330, 520);
    behind.speed = visible.speed = 0;
    behind.hp = visible.hp = 1e9;
    run(w, 0.1);
    expect(w.target).toBe(visible);
  });

  it('en partidas completas los enemigos nunca aparecen dentro de un obstáculo', () => {
    const w = makeWorld({ rooms: roomSequence(true), seed: 9 });
    w.player.hp = w.player.maxHp = 1e9;
    for (let i = 0; i < w.rooms.length; i++) {
      w.startRoom(i);
      for (let f = 0; f < 60 * 6; f++) {
        if (w.phase === 'levelup') w.chooseUpgrade(0);
        if (w.phase === 'item') w.chooseItem(true);
        w.update(1 / 60, { x: 0, y: 0 });
        for (const e of w.enemies) {
          if (e.jump || e.hidden) continue;
          const fly = e.types.includes('flying') || e.types.includes('ghost');
          expect(isFree(e.x, e.y, e.r * 0.5, w.obstacles, fly), `${e.def.name} sala ${w.room}`).toBe(true);
        }
      }
    }
  });
});
