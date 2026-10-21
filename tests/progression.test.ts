import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { getMove, maxLevelOf, poolFor } from '../src/data/moves';
import { getSpecies, POKEMON } from '../src/data/pokemon';
import { xpToNext } from '../src/game/progression';
import { Rng } from '../src/game/rng';
import { generateChoices } from '../src/game/upgradeGenerator';
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
    pick({ type: 'newMove', moveId: 'fire-spin' } as never);
    expect(w.player.moves.map((m) => m.def.id)).toContain('fire-spin');
    const ember = w.player.moves[0];
    const dmg0 = ember.s.dmg!;
    pick({ type: 'moveUpgrade', moveId: 'ember' } as never);
    pick({ type: 'moveUpgrade', moveId: 'ember' } as never);
    expect(ember.level).toBe(3);
    expect(ember.s.dmg!).toBeGreaterThan(dmg0);
  });

  it('un movimiento al máximo con su estadística cogida da una carta dorada de evolución', () => {
    const w = makeWorld();
    const ember = w.player.moves[0];
    ember.level = maxLevelOf(ember.def);
    w.player.statsTaken.atk = 1; // Ascuas → Llamarada necesita Potencia
    const c = generateChoices(w.player, new Rng(1));
    expect(c[0].family).toBe('moveEvolution');
    w.pendingLevelUps = 1;
    w.phase = 'levelup';
    w.choices = c;
    const before = ember.s.dmg!;
    w.chooseUpgrade(0);
    expect(ember.evolved).toBe(true);
    expect(ember.name).toBe('Llamarada');
    expect(ember.s.dmg!).toBeGreaterThan(before);
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

describe('Pokémon y movimientos', () => {
  it('hay 151 Pokémon de Kanto jugables, cada uno con movimientos de sus tipos', () => {
    const kanto = Object.values(POKEMON).filter((p) => p.dex <= 151);
    expect(kanto).toHaveLength(151);
    for (const p of kanto) {
      expect(p.learnset.length).toBeGreaterThanOrEqual(10);
      expect(p.learnset).toContain(p.startingAttack);
      for (const id of p.learnset) {
        const t = getMove(id).type;
        expect(t === 'normal' || p.types.includes(t), `${p.name}: ${id}`).toBe(true);
      }
    }
    expect(poolFor(['fire'])).toContain('ember');
  });

  it('el generador solo ofrece movimientos compatibles y respeta el máximo', () => {
    const w = makeWorld();
    const rng = new Rng(3);
    for (let i = 0; i < 100; i++) {
      for (const c of generateChoices(w.player, rng)) {
        if (c.action.type === 'newMove') expect(w.player.species.learnset).toContain(c.action.moveId);
      }
    }
    for (const id of ['tackle', 'fire-spin', 'flamethrower']) w.addMove(id);
    expect(w.player.moves).toHaveLength(BALANCE.upgrades.maxAttacks);
    for (let i = 0; i < 50; i++) expect(generateChoices(w.player, rng).some((c) => c.family === 'newMove')).toBe(false);
  });
});
