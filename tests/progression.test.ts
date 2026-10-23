import { describe, expect, it } from 'vitest';
import { getSpecies, POKEMON } from '../src/data/pokemon';
import { levelFactor, MAX_LEVEL, START_LEVEL, xpToNext } from '../src/game/levels';
import { emptyRoom, makeWorld, run, spawnAt } from './helpers';

describe('experiencia y subidas de nivel', () => {
  it('subir de nivel ofrece exactamente tres cartas distintas y pausa el combate', () => {
    const w = makeWorld();
    w.addXp(xpToNext(w.player.level));
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
    w.addXp(xpToNext(w.player.level));
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
    expect(w.player.atkMul).toBeCloseTo(atk0 * 1.05);
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
    for (let l = START_LEVEL; l < evoLevel; l++) xp += xpToNext(l);
    w.addXp(xp - 1);
    expect(w.player.species.id).toBe('charmander');
    w.addXp(1);
    expect(w.player.level).toBe(evoLevel);
    expect(w.player.species.id).toBe('charmeleon');
  });

  it('Pikachu evoluciona a Raichu al nivel 30 y se llega como mucho al nivel 100', () => {
    const w = makeWorld({ speciesId: 'pikachu' });
    w.addXp(1e9);
    expect(w.player.species.id).toBe('raichu');
    expect(w.player.level).toBe(MAX_LEVEL);
  });

  it('el nivel sube la vida y el daño con el mismo factor que a los enemigos', () => {
    const lo = makeWorld({ speciesId: 'squirtle', progress: { level: START_LEVEL, xp: 0, cards: [] } });
    const hi = makeWorld({ speciesId: 'squirtle', progress: { level: 50, xp: 0, cards: [] } });
    const k = levelFactor(50) / levelFactor(START_LEVEL);
    expect(hi.player.maxHp / lo.player.maxHp).toBeCloseTo(k);
    expect(hi.player.atkMul / lo.player.atkMul).toBeCloseTo(k);
    expect(levelFactor(100)).toBeGreaterThan(levelFactor(50));
  });

  it('las cartas guardadas se vuelven a aplicar al empezar la partida', () => {
    const cards = [{ type: 'stat', stat: 'atk' }, { type: 'attack', upgradeId: 'potencia' }, { type: 'stat', stat: 'hp' }] as never[];
    const w = makeWorld({ speciesId: 'charmander', progress: { level: 12, xp: 30, cards } });
    const base = makeWorld({ speciesId: 'charmander', progress: { level: 12, xp: 30, cards: [] } });
    expect(w.player.level).toBe(12);
    expect(w.player.xp).toBe(30);
    expect(w.player.attack.ups).toEqual(['potencia']);
    expect(w.player.atkMul).toBeCloseTo(base.player.atkMul * 1.05);
    expect(w.player.maxHp).toBeCloseTo(base.player.maxHp * 1.06);
    expect(w.player.cards).toEqual(cards);
  });

  it('los enemigos se adaptan a tu nivel', () => {
    const at = (level: number) => {
      const w = makeWorld({ progress: { level, xp: 0, cards: [] } });
      emptyRoom(w);
      return spawnAt(w, 19, 'runner', w.player.x, w.player.y - 140, 0);
    };
    const a = at(START_LEVEL);
    const b = at(40);
    expect(b.level).toBeGreaterThan(a.level);
    expect(b.maxHp / a.maxHp).toBeCloseTo(levelFactor(b.level) / levelFactor(a.level));
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
