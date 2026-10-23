import { describe, expect, it } from 'vitest';
import { ADVENTURE, ROUTES, TOWNS, placeGym, routeFrom } from '../src/data/adventure';
import { arriveAt, canEnterTown, howToReach, nextTown } from '../src/meta/adventure';
import { MemoryStorage, migrate, SaveStore } from '../src/meta/save';
import { isFree, NavGrid } from '../src/game/obstacles';
import { World } from '../src/game/world';

const townWorld = (id: string) => new World({ speciesId: 'charmander', gym: placeGym(TOWNS[id]), rooms: [1], town: TOWNS[id], seed: 3 });
const routeWorld = (id: string) => new World({ speciesId: 'squirtle', gym: placeGym(ROUTES[id]), rooms: [1, 2, 3, 4, 5], route: ROUTES[id], seed: 3 });

describe('aventura: progreso', () => {
  it('se empieza en Pueblo Paleta y los pueblos se abren al llegar por su ruta', () => {
    const s = new SaveStore(new MemoryStorage());
    expect(s.data.adventure).toEqual({ visited: ['paleta'], at: 'paleta' });
    expect(canEnterTown(s, 'paleta')).toBe(true);
    expect(canEnterTown(s, 'verde')).toBe(false);
    expect(howToReach('verde')).toContain('Ruta 1');
    expect(nextTown('paleta')?.id).toBe('verde');
    arriveAt(s, 'verde');
    expect(canEnterTown(s, 'verde')).toBe(true);
    expect(s.data.adventure.at).toBe('verde');
  });

  it('quien ya tenía la medalla de Brock también empieza en Paleta (y la conserva)', () => {
    const m = migrate({ version: 2, medals: { kanto: ['brock'] }, bestRoom: { brock: 50 } });
    expect(m.adventure).toEqual({ visited: ['paleta'], at: 'paleta' });
    expect(m.medals.kanto).toEqual(['brock']);
    const bad = migrate({ version: 2, adventure: { visited: ['inventado', 'verde'], at: 'inventado' } });
    expect(bad.adventure).toEqual({ visited: ['paleta', 'verde'], at: 'paleta' });
  });

  it('la cadena Paleta → Ruta 1 → Verde → Ruta 2 → Plateada es coherente', () => {
    expect(ADVENTURE).toEqual(['paleta', 'ruta1', 'verde', 'ruta2', 'plateada']);
    expect(routeFrom('paleta')?.to).toBe('verde');
    expect(routeFrom('verde')?.to).toBe('plateada');
    expect(TOWNS.plateada.spots.some((s) => s.kind === 'gym' && s.gym === 'brock')).toBe(true);
    // Verde y Plateada tienen tienda (el entrenamiento se compra allí); Paleta no.
    expect(TOWNS.verde.spots.some((s) => s.kind === 'shop')).toBe(true);
    expect(TOWNS.plateada.spots.some((s) => s.kind === 'shop')).toBe(true);
    expect(TOWNS.paleta.spots.some((s) => s.kind === 'shop')).toBe(false);
  });
});

describe('aventura: pueblos', () => {
  for (const id of Object.keys(TOWNS)) {
    it(`${TOWNS[id].name}: sin enemigos, con todos sus puntos alcanzables a pie`, () => {
      const w = townWorld(id);
      for (let i = 0; i < 240; i++) w.update(1 / 60, { x: 0, y: 0 });
      expect(w.enemies).toHaveLength(0);
      expect(w.phase).toBe('playing');
      const t = TOWNS[id];
      expect(isFree(t.start.x, t.start.y, 12, w.obstacles)).toBe(true);
      expect([w.W, w.H]).toEqual([720, 2520]);
      const nav = new NavGrid(w.W, w.H, w.obstacles);
      // Ningún punto ni Pokémon queda dentro de un obstáculo.
      for (const s of t.spots) expect(isFree(s.x, s.y, 10, w.obstacles), `${id}: ${s.title} libre`).toBe(true);
      for (const n of t.npcs) expect(isFree(n.x, n.y, 10, w.obstacles), `${id}: Pokémon ${n.dex} libre`).toBe(true);
      for (const s of t.spots) expect(nav.reachable(t.start, s), `${id}: ${s.title}`).toBe(true);
    });
  }

  it('las casas y los Pokémon del pueblo no se atraviesan, y la puerta norte no cambia de sala', () => {
    const w = townWorld('paleta');
    const p = w.player;
    // Hacia la casa de tu familia (1170..1310 en y): se queda fuera.
    p.x = 195; p.y = 1345;
    for (let i = 0; i < 120; i++) w.update(1 / 60, { x: 0, y: -1 });
    expect(p.y).toBeGreaterThan(1310);
    // Contra el Bulbasaur del laboratorio.
    p.x = 600; p.y = 2000;
    for (let i = 0; i < 90; i++) w.update(1 / 60, { x: 0, y: -1 });
    expect(Math.hypot(p.x - 600, p.y - 1930)).toBeGreaterThan(14);
    // Contra los árboles del borde.
    p.x = 100; p.y = 1000;
    for (let i = 0; i < 90; i++) w.update(1 / 60, { x: -1, y: 0 });
    expect(p.x).toBeGreaterThan(60);
    // Hasta la salida del norte: sigues en el pueblo.
    p.x = 360; p.y = 140;
    for (let i = 0; i < 120; i++) w.update(1 / 60, { x: 0, y: -1 });
    expect(w.roomIndex).toBe(0);
    expect(w.phase).toBe('playing');
  });
});

describe('aventura: rutas', () => {
  it('la Ruta 1 tiene 5 salas con sus salvajes y el más fuerte en la última', () => {
    const w = routeWorld('ruta1');
    const allowed = new Set([...ROUTES.ruta1.wild, ROUTES.ruta1.strong]);
    const seen = new Set<number>();
    const p = w.player;
    p.hp = p.maxHp = 1e6;
    for (let room = 0; room < 5; room++) {
      expect(w.roomIndex).toBe(room);
      for (const wave of [...w.pendingWaves]) for (const d of wave) seen.add(d.dex);
      for (const e of w.enemies) seen.add(e.def.dex);
      for (const mk of w.markers) seen.add(mk.def.dex);
      if (room === 4) expect([...w.pendingWaves.flat(), ...w.markers.map((m) => m.def)].some((d) => d.dex === ROUTES.ruta1.strong) || w.enemies.some((e) => e.def.dex === ROUTES.ruta1.strong)).toBe(true);
      w.debugKillAll();
      for (let i = 0; i < 600 && w.roomIndex === room && w.phase === 'playing'; i++) {
        if (w.phase !== 'playing') break;
        w.debugKillAll();
        w.update(1 / 60, { x: 0, y: 0 });
        if (w.exitOpen) { p.x = w.exit.x; p.y = w.exit.y; }
      }
      while (w.phase === 'levelup') w.chooseUpgrade(0);
    }
    for (let i = 0; i < 300 && w.phase !== 'victory'; i++) {
      while (w.phase === 'levelup') w.chooseUpgrade(0);
      w.debugKillAll();
      w.update(1 / 60, { x: 0, y: 0 });
    }
    expect(w.phase).toBe('victory');
    for (const d of seen) expect(allowed.has(d), `dex ${d}`).toBe(true);
  });
});
