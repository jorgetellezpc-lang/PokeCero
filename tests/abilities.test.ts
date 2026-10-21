import { describe, expect, it } from 'vitest';
import { ABILITIES, BASE_MODS, SYNERGIES } from '../src/data/abilities';
import { abilityAvailable, passiveOf } from '../src/game/abilities';
import type { World } from '../src/game/world';
import { Rng } from '../src/game/rng';
import { generateChoices } from '../src/game/upgradeGenerator';
import { emptyRoom, makeWorld, run, spawnAt } from './helpers';

/** Elige una habilidad por el mismo camino que la carta de subida de nivel. */
function take(w: World, id: string, times = 1): void {
  for (let i = 0; i < times; i++) {
    w.phase = 'levelup';
    w.pendingLevelUps = 1;
    w.choices = [{ key: `ab:${id}`, family: 'ability', action: { type: 'ability', abilityId: id }, title: id, category: '', description: '', detail: '', w: 1 }];
    expect(w.chooseUpgrade(0)).toBe(true);
  }
}

/** Dispara una vez el movimiento inicial contra un blanco y cuenta los proyectiles. */
function volley(w: World): number {
  emptyRoom(w);
  spawnAt(w, 74, 'chase', w.player.x, w.player.y - 160);
  w.projectiles = [];
  w.player.moves[0].t = 0;
  w.update(1 / 60, { x: 0, y: 0 });
  return w.projectiles.filter((p) => p.friendly).length;
}

describe('habilidades', () => {
  it('se acumulan hasta su límite y no vuelven a salir', () => {
    const w = makeWorld();
    take(w, 'perforacion', 3);
    expect(w.player.abilities.perforacion).toBe(3);
    expect(w.player.mods.pierce).toBe(3);
    expect(abilityAvailable(w.player, ABILITIES.perforacion)).toBe(false);
    take(w, 'perforacion');
    expect(w.player.abilities.perforacion).toBe(3);
    for (let s = 0; s < 200; s++) {
      const keys = generateChoices(w.player, new Rng(s)).map((c) => c.key);
      expect(keys).not.toContain('ab:perforacion');
      expect(new Set(keys).size).toBe(3);
    }
  });

  it('los efectos multiplicativos se componen y los aditivos se suman', () => {
    const w = makeWorld();
    take(w, 'doble-disparo', 2);
    expect(w.player.mods.front).toBe(2);
    expect(w.player.mods.projDmg).toBeCloseTo(0.85 * 0.85);
  });

  it('las habilidades de proyectil no salen si no tienes movimientos de proyectil', () => {
    const w = makeWorld();
    w.player.moves = [];
    w.addMove('fire-spin');
    expect(abilityAvailable(w.player, ABILITIES['doble-disparo'])).toBe(false);
    expect(abilityAvailable(w.player, ABILITIES['cuerpo-llama'])).toBe(true);
  });

  it('las cartas de habilidad aparecen en las subidas de nivel', () => {
    const w = makeWorld();
    let seen = 0;
    for (let s = 0; s < 100; s++) seen += generateChoices(w.player, new Rng(s)).filter((c) => c.family === 'ability').length;
    expect(seen).toBeGreaterThan(30);
  });

  it('Doble Disparo, Abanico, Flancos y Retaguardia añaden proyectiles', () => {
    const base = volley(makeWorld());
    const w = makeWorld();
    take(w, 'doble-disparo');
    expect(volley(w)).toBe(base * 2);
    take(w, 'abanico');
    take(w, 'flancos');
    take(w, 'retaguardia');
    expect(volley(w)).toBe(base * 2 + 5);
  });

  it('Ráfaga repite la andanada poco después', () => {
    const w = makeWorld();
    take(w, 'rafaga');
    const n = volley(w);
    run(w, 0.2);
    expect(w.projectiles.filter((p) => p.friendly).length).toBeGreaterThanOrEqual(n * 2);
  });

  it('Perforación atraviesa a varios enemigos en fila', () => {
    const w = makeWorld();
    take(w, 'perforacion', 2);
    emptyRoom(w);
    const p = w.player;
    const a = spawnAt(w, 74, 'turret', p.x, p.y - 80);
    const b = spawnAt(w, 74, 'turret', p.x, p.y - 140);
    const c = spawnAt(w, 74, 'turret', p.x, p.y - 200);
    [a, b, c].forEach((e) => { e.hp = e.maxHp = 9999; });
    w.player.moves[0].t = 0;
    w.update(1 / 60, { x: 0, y: 0 });
    w.player.moves[0].t = 99;
    run(w, 1);
    expect(a.hp).toBeLessThan(9999);
    expect(b.hp).toBeLessThan(9999);
    expect(c.hp).toBeLessThan(9999);
  });

  it('Rebote Muro devuelve el proyectil al chocar con la pared', () => {
    const w = makeWorld();
    take(w, 'rebote-muro');
    volley(w);
    const pr = w.projectiles.find((x) => x.friendly)!;
    pr.x = w.W - 8;
    pr.y = w.H / 2;
    pr.vx = 300;
    pr.vy = 0;
    w.update(1 / 60, { x: 0, y: 0 });
    expect(pr.vx).toBeLessThan(0);
    expect(pr.wallBounce).toBe(1);
  });

  it('Pantalla Luz para los proyectiles enemigos', () => {
    const w = makeWorld();
    take(w, 'guardianes');
    emptyRoom(w);
    const p = w.player;
    const e = spawnAt(w, 13, 'ranged', p.x, p.y - 150);
    e.hp = 9999;
    p.moves = [];
    const hp = p.hp;
    // Tiros constantes hacia el jugador: alguno debe chocar con un escudo.
    let blocked = 0;
    for (let i = 0; i < 40; i++) {
      w.enemyShot(e, Math.atan2(p.y - 10 - e.y, p.x - e.x), 1, 0);
      const n = w.projectiles.length;
      run(w, 0.5);
      if (w.projectiles.length < n) blocked++;
      p.invuln = 0;
    }
    expect(blocked).toBeGreaterThan(0);
    expect(p.hp).toBeLessThanOrEqual(hp);
  });

  it('Robustez deja con 1 de vida ante un golpe mortal, una vez por sala', () => {
    const w = makeWorld();
    take(w, 'robustez');
    emptyRoom(w);
    spawnAt(w, 74, 'turret', 40, 40).hp = 9999;
    const p = w.player;
    w.hurtPlayer(9999, 'normal', 'physical');
    expect(p.hp).toBe(1);
    p.invuln = 0;
    w.hurtPlayer(9999, 'normal', 'physical');
    expect(p.hp).toBeLessThanOrEqual(0);
  });

  it('Doble Equipo esquiva parte de los golpes', () => {
    const w = makeWorld();
    take(w, 'evasion', 3);
    emptyRoom(w);
    spawnAt(w, 74, 'turret', 40, 40).hp = 9999;
    const p = w.player;
    let dodged = 0;
    for (let i = 0; i < 300; i++) {
      p.hp = p.maxHp;
      p.invuln = 0;
      w.hurtPlayer(5, 'normal', 'physical');
      if (p.hp === p.maxHp) dodged++;
    }
    expect(dodged / 300).toBeGreaterThan(0.15);
    expect(dodged / 300).toBeLessThan(0.35);
  });

  it('Detonación daña a los enemigos de alrededor y Absorción cura', () => {
    const w = makeWorld();
    take(w, 'detonacion', 2);
    take(w, 'sed-de-sangre');
    emptyRoom(w);
    const p = w.player;
    p.moves = [];
    const a = spawnAt(w, 74, 'turret', 180, 200);
    const b = spawnAt(w, 74, 'turret', 195, 200);
    b.hp = b.maxHp = 500;
    a.maxHp = 400;
    p.hp = p.maxHp / 2;
    const hp0 = p.hp;
    a.hp = 0;
    w.update(1 / 60, { x: 0, y: 0 });
    expect(b.hp).toBeLessThan(500);
    expect(p.hp).toBeGreaterThan(hp0);
  });

  it('Golpe Certero remata a enemigos normales con poca vida', () => {
    const w = makeWorld();
    take(w, 'ataque-certero');
    w.player.mods.execute = 1;
    emptyRoom(w);
    const e = spawnAt(w, 74, 'turret', 180, 200);
    e.maxHp = 1000;
    e.hp = 200;
    w.hitEnemy(e, 1, 'normal', 'physical', 0, 1, 0, {});
    expect(e.hp).toBe(0);
  });

  it('Cuerpo Llama quema y la sinergia Infierno se activa con un movimiento de Fuego', () => {
    const w = makeWorld();
    take(w, 'cuerpo-llama');
    expect(w.player.synergies).toContain('infierno');
    expect(w.events.some((e) => e.type === 'synergy' && e.name === 'Infierno')).toBe(true);
    expect(w.player.mods.dotMult).toBe(2);
    emptyRoom(w);
    const e = spawnAt(w, 74, 'turret', 180, 200);
    w.hitEnemy(e, 1, 'water', 'special', 0, 1, 0, {});
    expect(e.burn).toBeGreaterThan(0);
  });

  it('las sinergias de varias habilidades solo se activan al reunirlas todas', () => {
    const w = makeWorld();
    take(w, 'abanico');
    take(w, 'flancos');
    expect(w.player.synergies).not.toContain('cobertura-total');
    take(w, 'retaguardia');
    expect(w.player.synergies).toContain('cobertura-total');
    for (const s of SYNERGIES) for (const id of s.abilities) expect(ABILITIES[id]).toBeDefined();
  });

  it('cada Pokémon tiene su pasiva y el STAB sube el daño de su tipo', () => {
    expect(passiveOf(makeWorld().player.species).name).toBe('Mar Llamas');
    expect(makeWorld({ speciesId: 'pikachu' }).player.mods.contactStun).toBeGreaterThan(0);
    const dmg = (stab: number) => {
      const w = makeWorld({ seed: 7 });
      w.player.crit = 0;
      w.player.mods.crit = 0;
      w.player.mods.stab = stab;
      emptyRoom(w);
      const e = spawnAt(w, 19, 'turret', 180, 200);
      e.hp = e.maxHp = 9999;
      w.hitEnemy(e, 50, 'fire', 'special', 0, 1, 0, {});
      return 9999 - e.hp;
    };
    expect(dmg(0.2)).toBeGreaterThan(dmg(0));
  });

  it('Levitación ignora las zonas del suelo', () => {
    const w = makeWorld({ speciesId: 'gastly' });
    expect(w.player.mods.levitate).toBe(true);
    emptyRoom(w);
    spawnAt(w, 74, 'turret', 40, 40).hp = 9999;
    w.player.moves = [];
    const p = w.player;
    const hp = p.hp;
    w.addHazard({ kind: 'zone', x: p.x, y: p.y, r: 40, delay: 0, dmg: 20, element: 'ground', cat: 'physical', color: '#fff' });
    run(w, 0.1);
    expect(p.hp).toBe(hp);
  });

  it('una partida nueva empieza sin habilidades de la anterior', () => {
    const a = makeWorld();
    take(a, 'doble-disparo', 3);
    const b = makeWorld();
    expect(b.player.abilities).toEqual({});
    expect(b.player.mods.front).toBe(0);
    expect(BASE_MODS.front).toBe(0);
  });
});
