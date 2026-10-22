import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { getSpecies, POKEMON } from '../src/data/pokemon';
import { xpToNext } from '../src/game/progression';
import { emptyRoom, makeWorld, run, spawnAt } from './helpers';

describe('experiencia y subidas de nivel', () => {
  it('subir de nivel ofrece exactamente tres cartas distintas y pausa el combate', () => {
    const w = makeWorld();
    w.addXp(xpToNext(1));
    run(w, 1 / 60);
    expect(w.phase).toBe('levelup');
    expect(w.choices).toHaveLength(3);
    expect(new Set(w.choices.map((c) => c.key)).size).toBe(3);
    const t = w.time;
    w.update(1, { x: 1, y: 0 });
    expect(w.time).toBe(t);
  });

  it('solo se aplica una mejora por subida', () => {
    const w = makeWorld();
    w.addXp(xpToNext(1));
    run(w, 1 / 60);
    expect(w.chooseUpgrade(0)).toBe(true);
    expect(w.phase).toBe('playing');
    expect(w.chooseUpgrade(1)).toBe(false);
  });

  it('las cartas modifican de verdad el combate', () => {
    const w = makeWorld();
    const atk0 = w.player.atkMul;
    const pick = (action: never) => {
      w.pendingLevelUps = 1;
      w.phase = 'levelup';
      w.choices = [{ key: 'x', family: 'stat', action, title: '', category: '', description: '', detail: '', w: 1 }];
      w.chooseUpgrade(0);
    };
    pick({ type: 'stat', stat: 'atk' } as never);
    expect(w.player.atkMul).toBeCloseTo(atk0 * 1.1);
    const atk = w.player.moves[0];
    const dmg0 = atk.s.dmg!;
    pick({ type: 'attack', upgradeId: 'potencia' } as never);
    pick({ type: 'attack', upgradeId: 'potencia' } as never);
    expect(w.player.attack.ups).toEqual(['potencia', 'potencia']);
    expect(atk.level).toBe(3);
    expect(atk.s.dmg!).toBeCloseTo(dmg0 * 1.22 * 1.22);
  });

  it('una mejora de daño hace que el enemigo muera antes', () => {
    const timeToKill = (atk: number) => {
      const w = makeWorld();
      emptyRoom(w);
      w.player.atkMul = atk;
      const e = spawnAt(w, 27, 'tank', w.player.x, w.player.y - 140, 2);
      e.speed = 0;
      let t = 0;
      while (w.enemies.length && t < 40) {
        w.update(1 / 60, { x: 0, y: 0 });
        t += 1 / 60;
      }
      return t;
    };
    expect(timeToKill(1.6)).toBeLessThan(timeToKill(1));
  });

  it('la evolución depende del nivel de la especie, no de la sala', () => {
    const w = makeWorld();
    const evoLevel = getSpecies('charmander').evolution!.level;
    let xp = 0;
    for (let l = 1; l < evoLevel; l++) xp += xpToNext(l);
    w.addXp(xp - 1);
    expect(w.player.species.id).toBe('charmander');
    w.addXp(1);
    expect(w.player.level).toBe(evoLevel);
    expect(w.player.species.id).toBe('charmeleon');
  });

  it('Pikachu no evoluciona por nivel (no se fuerzan tres formas)', () => {
    const w = makeWorld({ speciesId: 'pikachu' });
    w.addXp(1e6);
    expect(w.player.species.id).toBe('pikachu');
    expect(w.player.level).toBe(BALANCE.experience.maxLevel);
  });
});

describe('Pokémon', () => {
  it('hay 151 Pokémon de Kanto jugables y cada uno empieza con un único ataque', () => {
    const kanto = Object.values(POKEMON).filter((p) => p.dex <= 151);
    expect(kanto).toHaveLength(151);
    for (const p of kanto.slice(0, 151)) {
      const w = makeWorld({ speciesId: p.id });
      expect(w.player.moves, p.name).toHaveLength(1);
      expect(w.player.moves[0].def.id.startsWith('sig:')).toBe(true);
    }
  });
});
