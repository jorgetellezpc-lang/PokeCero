import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { getSpecies } from '../src/data/pokemon';
import { xpToNext } from '../src/game/progression';
import { Rng } from '../src/game/rng';
import { candidateUpgrades, generateChoices } from '../src/game/upgradeGenerator';
import { attackStats } from '../src/game/weapons';
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
    expect(w.time).toBe(t); // pausado
  });

  it('solo se aplica una mejora por subida', () => {
    const w = makeWorld();
    w.addXp(xpToNext(1));
    run(w, 1 / 60);
    expect(w.chooseUpgrade(0)).toBe(true);
    expect(w.phase).toBe('playing');
    expect(w.chooseUpgrade(1)).toBe(false);
  });

  it('varias subidas a la vez se eligen una tras otra', () => {
    const w = makeWorld();
    w.addXp(xpToNext(1) + xpToNext(2));
    run(w, 1 / 60);
    expect(w.pendingLevelUps).toBe(2);
    w.chooseUpgrade(0);
    expect(w.phase).toBe('levelup');
    expect(w.choices).toHaveLength(3);
    w.chooseUpgrade(0);
    expect(w.phase).toBe('playing');
  });

  it('las mejoras modifican de verdad el combate', () => {
    const w = makeWorld();
    const power0 = w.player.power;
    w.pendingLevelUps = 1;
    w.phase = 'levelup';
    w.choices = [{ key: 'stat:power', family: 'stat', action: { type: 'stat', stat: 'power' }, title: '', category: '', description: '', detail: '' }];
    w.chooseUpgrade(0);
    expect(w.player.power).toBeCloseTo(power0 * 1.12);

    // Un nuevo ataque se añade y empieza a disparar.
    w.pendingLevelUps = 1;
    w.phase = 'levelup';
    w.choices = [{ key: 'new:giro_fuego', family: 'newAttack', action: { type: 'newAttack', attackId: 'giro_fuego' }, title: '', category: '', description: '', detail: '' }];
    w.chooseUpgrade(0);
    expect(w.player.attacks.map((a) => a.def.id)).toContain('giro_fuego');

    // Mejorar un ataque aumenta sus estadísticas efectivas.
    const a = w.player.attacks[0];
    const before = attackStats(a.def, a.level);
    w.pendingLevelUps = 1;
    w.phase = 'levelup';
    w.choices = [{ key: 'up:ascuas', family: 'attackUpgrade', action: { type: 'attackUpgrade', attackId: 'ascuas', toLevel: 2 }, title: '', category: '', description: '', detail: '' }];
    w.chooseUpgrade(0);
    expect(attackStats(a.def, a.level).damage).toBeGreaterThan(before.damage);
  });

  it('una mejora de daño hace que el enemigo muera antes', () => {
    const timeToKill = (stacks: number) => {
      const w = makeWorld();
      emptyRoom(w);
      w.player.statStacks.power = stacks;
      w.recomputeStats();
      const e = spawnAt(w, 'sandshrew', w.player.x, w.player.y - 140);
      e.attackTimer = 99;
      e.speed = 0;
      let t = 0;
      while (w.enemies.length && t < 30) {
        w.update(1 / 60, { x: 0, y: 0 });
        t += 1 / 60;
      }
      return t;
    };
    expect(timeToKill(4)).toBeLessThan(timeToKill(0));
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
    expect(w.events.some((e) => e.type === 'evolved')).toBe(true);
  });

  it('Pikachu no evoluciona por nivel (no se fuerzan tres formas)', () => {
    const w = makeWorld({ speciesId: 'pikachu' });
    w.addXp(100000);
    expect(w.player.species.id).toBe('pikachu');
    expect(w.player.level).toBe(BALANCE.experience.maxLevel);
  });
});

describe('generador de mejoras', () => {
  it('solo ofrece ataques compatibles con la especie y nunca mejoras sin efecto', () => {
    const rng = new Rng(1);
    const species = getSpecies('charmander');
    for (let i = 0; i < 200; i++) {
      const choices = generateChoices({ species, attacks: { ascuas: 5 }, statStacks: { speed: 4 } }, rng);
      expect(choices).toHaveLength(3);
      for (const c of choices) {
        if (c.action.type === 'newAttack') expect(species.learnset).toContain(c.action.attackId);
        expect(c.key).not.toBe('up:ascuas'); // ya al máximo
        expect(c.key).not.toBe('stat:speed'); // ya al máximo
      }
    }
  });

  it('respeta el máximo de ataques simultáneos', () => {
    const species = getSpecies('charmeleon');
    const attacks = { ascuas: 1, aranazo: 1, giro_fuego: 1, ataque_rapido: 1 };
    expect(Object.keys(attacks).length).toBe(BALANCE.upgrades.maxAttacks);
    const c = candidateUpgrades({ species, attacks, statStacks: {} });
    expect(c.some((x) => x.family === 'newAttack')).toBe(false);
  });

  it('completa con cartas de reserva útiles si no quedan opciones', () => {
    const species = getSpecies('pikachu');
    const maxed = { impactrueno: 5, ataque_rapido: 5, chispa: 5, rayo: 5 };
    const stacks = { hp: 6, power: 6, speed: 4, defense: 5, haste: 5, magnet: 3, regen: 3 };
    const c = generateChoices({ species, attacks: maxed, statStacks: stacks }, new Rng(3));
    expect(c).toHaveLength(3);
    expect(c.every((x) => x.family === 'fallback')).toBe(true);
  });
});
