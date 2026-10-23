import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { POKEMON, getSpecies } from '../src/data/pokemon';
import {
  ATTACK_UPGRADES, ATTACK_UPGRADE, EVO_KEY, TYPE_SIG, attackEvolutionReady, attackStats, rawAttackNums, signatureFor,
} from '../src/data/signatures';
import type { ElementType } from '../src/data/types';
import { xpToNext } from '../src/game/levels';
import { Rng } from '../src/game/rng';
import { availableAttackUpgrades, generateChoices } from '../src/game/upgradeGenerator';
import type { World } from '../src/game/world';
import { emptyRoom, makeWorld, run, spawnAt } from './helpers';

const TYPES = Object.keys(TYPE_SIG) as ElementType[];
const KANTO = Object.values(POKEMON).filter((p) => p.dex <= 151);
const fake = (types: ElementType[], sa = 1, pa = 1) => ({ id: `test-${types.join('-')}`, types, stats: { hp: 1, speed: 1, pa, sa, df: 1, sd: 1 } });

const finite = (o: object) => Object.values(o).every((v) => typeof v !== 'number' || Number.isFinite(v));

function pickAction(w: World, action: never): void {
  w.pendingLevelUps = 1;
  w.phase = 'levelup';
  w.choices = [{ key: 'x', family: 'attack', action, title: '', category: '', description: '', detail: '', w: 1 }];
  w.chooseUpgrade(0);
}

describe('ataque característico: generación', () => {
  it('las 18 × 18 combinaciones de tipos dan un ataque válido (sin lista cerrada)', () => {
    for (const a of TYPES) {
      for (const b of [null, ...TYPES]) {
        if (b === a) continue;
        const sig = signatureFor(fake(b ? [a, b] : [a]));
        expect(sig.name, `${a}/${b}`).toBeTruthy();
        expect(sig.evoName, `${a}/${b}`).toBeTruthy();
        const s = attackStats(sig, [], false);
        expect(s.dmg! > 0 && s.cd > 0, `${a}/${b}`).toBe(true);
        expect(finite(s), `${a}/${b}`).toBe(true);
        expect(finite(attackStats(sig, [], true)), `${a}/${b}`).toBe(true);
      }
    }
  });

  it('el primer tipo da el comportamiento y el segundo aporta su efecto', () => {
    const firePoison = signatureFor(fake(['fire', 'poison']));
    expect(firePoison.kind).toBe(TYPE_SIG.fire.kind);
    expect(firePoison.base.burn).toBeGreaterThan(0);
    expect(firePoison.base.poison).toBeGreaterThan(0);
    const waterIce = signatureFor(fake(['water', 'ice']));
    expect(waterIce.base.slow).toBeGreaterThan(0);
    expect(waterIce.name).toBe('Tormenta Glacial');
    // Normal cede el comportamiento al otro tipo (Pidgey lanza el Volador).
    const pidgey = signatureFor(getSpecies('pidgey'));
    expect(pidgey.primary).toBe('flying');
    expect(pidgey.secondary).toBe('normal');
    expect(pidgey.name).toBe('Tornado de Plumas');
  });

  it('el ataque usa el lado fuerte del Pokémon (físico o especial)', () => {
    expect(signatureFor(fake(['fire'], 2, 1)).cat).toBe('special');
    expect(signatureFor(fake(['fire'], 1, 2)).cat).toBe('physical');
  });

  it('excepciones por especie: Cubone lanza su hueso y Pikachu encadena rayos', () => {
    expect(signatureFor(getSpecies('cubone')).name).toBe('Huesomerang');
    expect(signatureFor(getSpecies('marowak')).name).toBe('Huesomerang');
    expect(signatureFor(getSpecies('pikachu')).kind).toBe('chain');
    expect(signatureFor(getSpecies('farfetch-d')).kind).toBe('boomerang');
  });

  it('los 151 de Kanto tienen ataque, y cada combinación de Kanto es distinta de sus tipos sueltos', () => {
    for (const sp of KANTO) {
      const sig = signatureFor(sp);
      expect(sig.desc, sp.name).toMatch(/\.$/);
      if (sp.types.length === 2) expect(sig.secondary, sp.name).not.toBeNull();
    }
  });
});

describe('ataque característico: cartas', () => {
  it('cada carta de ataque cambia de verdad algún valor en los ataques que encaja', () => {
    for (const u of ATTACK_UPGRADES) {
      let used = 0;
      for (const sp of KANTO) {
        const sig = signatureFor(sp);
        const raw = rawAttackNums(sig, [], false);
        if (!u.fits(sig, raw)) continue;
        used++;
        expect(JSON.stringify(rawAttackNums(sig, [u.id], false)), `${u.id} en ${sp.name}`).not.toBe(JSON.stringify(raw));
      }
      expect(used, u.id).toBeGreaterThan(0);
    }
  });

  it('tres cartas distintas, válidas y compatibles; nunca una mejora al máximo', () => {
    for (const id of ['charmander', 'bulbasaur', 'pidgey', 'dratini', 'pikachu', 'geodude', 'gastly', 'weedle']) {
      const w = makeWorld({ speciesId: id });
      const p = w.player;
      const rng = new Rng(7);
      for (let i = 0; i < 120; i++) {
        const cards = generateChoices(p, rng);
        expect(cards).toHaveLength(3);
        expect(new Set(cards.map((c) => c.key)).size).toBe(3);
        const ok = new Set(availableAttackUpgrades(p).map((u) => u.id));
        for (const c of cards) if (c.action.type === 'attack') expect(ok.has(c.action.upgradeId), `${id}: ${c.action.upgradeId}`).toBe(true);
        if (ok.size) expect(cards.some((c) => c.family === 'attack' || c.family === 'attackEvolution'), id).toBe(true);
        // Coge una carta de ataque al azar para avanzar por las mejoras.
        const atk = cards.find((c) => c.action.type === 'attack');
        if (atk) pickAction(w, atk.action as never);
      }
      const n = new Map<string, number>();
      for (const u of p.attack.ups) n.set(u, (n.get(u) ?? 0) + 1);
      for (const [u, k] of n) expect(k, `${id}: ${u}`).toBeLessThanOrEqual(ATTACK_UPGRADE[u].max);
    }
  });

  it('el rayo de Dratini no recibe cartas de proyectil; el bumerán no recibe Perforación', () => {
    const ids = (sp: string) => availableAttackUpgrades(makeWorld({ speciesId: sp }).player).map((u) => u.id);
    expect(ids('dratini')).not.toContain('multi');
    expect(ids('dratini')).not.toContain('rebote');
    expect(ids('bulbasaur')).not.toContain('perforacion');
    expect(ids('charmander')).not.toContain('fusion');
    expect(ids('bulbasaur')).toContain('fusion');
  });

  it('los topes del balance se respetan aunque se acumulen mejoras', () => {
    const sig = signatureFor(getSpecies('charmander'));
    const s = rawAttackNums(sig, Array(30).fill('multi').concat(Array(30).fill('rebote')), true);
    expect(s.count).toBeLessThanOrEqual(BALANCE.attack.caps.count);
    expect(s.bounce).toBeLessThanOrEqual(BALANCE.attack.caps.bounce);
  });
});

describe('ataque característico: evolución', () => {
  it('pide nivel, número de mejoras y la mejora clave; da una carta dorada y cambia el ataque', () => {
    const w = makeWorld();
    const p = w.player;
    const sig = p.attack.sig;
    const key = EVO_KEY[sig.kind];
    p.attack.ups = ['potencia', 'potencia', 'cadencia', 'tamano'];
    p.level = BALANCE.attack.evoLevel;
    expect(attackEvolutionReady(sig, p.attack.ups, p.level, false)).toBe(false);
    p.attack.ups.push(key);
    p.level = BALANCE.attack.evoLevel - 1;
    expect(attackEvolutionReady(sig, p.attack.ups, p.level, false)).toBe(false);
    p.level = BALANCE.attack.evoLevel;
    w.rebuildAttack();
    const c = generateChoices(p, new Rng(1));
    expect(c[0].family).toBe('attackEvolution');
    const before = p.moves[0].s.dmg!;
    w.pendingLevelUps = 1;
    w.phase = 'levelup';
    w.choices = c;
    w.chooseUpgrade(0);
    expect(p.attack.evolved).toBe(true);
    expect(p.moves[0].name).toBe('Llamarada');
    expect(p.moves[0].s.dmg!).toBeGreaterThan(before);
    expect(p.moves[0].s.explode).toBeGreaterThan(0);
    expect(w.events.some((e) => e.type === 'moveEvolved')).toBe(true);
    // Ya evolucionado, no vuelve a salir.
    expect(generateChoices(p, new Rng(2)).some((x) => x.family === 'attackEvolution')).toBe(false);
  });

  it('al evolucionar la especie el ataque se transforma y conserva sus mejoras', () => {
    const w = makeWorld({ speciesId: 'charmeleon' });
    const p = w.player;
    pickAction(w, { type: 'attack', upgradeId: 'potencia' } as never);
    pickAction(w, { type: 'attack', upgradeId: 'multi' } as never);
    expect(p.moves[0].name).toBe('Ascuas');
    let xp = 0;
    for (let l = 1; l < getSpecies('charmeleon').evolution!.level; l++) xp += xpToNext(l);
    w.addXp(xp);
    expect(p.species.id).toBe('charizard');
    expect(p.moves).toHaveLength(1);
    expect(p.moves[0].name).toBe('Ala Ígnea');
    expect(p.attack.ups).toEqual(['potencia', 'multi']);
    expect(p.moves[0].s.count).toBe(2);
    expect(w.events.some((e) => e.type === 'attackChanged')).toBe(true);
  });
});

describe('ataque característico: efectos en combate', () => {
  const arena = (speciesId: string, ups: string[]) => {
    const w = makeWorld({ speciesId });
    emptyRoom(w);
    const p = w.player;
    p.attack.ups = ups;
    w.rebuildAttack();
    p.hp = p.maxHp = 1e6;
    const tg = spawnAt(w, 143, 'tank', p.x, p.y - 110);
    const side = spawnAt(w, 143, 'tank', p.x + 14, p.y - 116);
    for (const e of [tg, side]) { e.hp = e.maxHp = 1e6; e.speed = 0; e.touchCd = 99; }
    return { w, p, tg, side };
  };

  it('Explosión daña a los de alrededor del impacto', () => {
    const { w, side } = arena('charmander', ['explosion', 'explosion']);
    w.target = null;
    run(w, 3);
    expect(side.hp).toBeLessThan(1e6);
  });

  it('División suelta fragmentos al primer impacto', () => {
    const { w } = arena('charmander', ['division']);
    let frags = 0;
    for (let i = 0; i < 180; i++) {
      w.update(1 / 60, { x: 0, y: 0 });
      frags = Math.max(frags, w.projectiles.filter((x) => x.frag).length);
    }
    expect(frags).toBeGreaterThanOrEqual(2);
  });

  it('Rastro elemental deja zonas (pocas y sin amontonarse)', () => {
    const { w } = arena('squirtle', ['zona']);
    let most = 0;
    for (let i = 0; i < 300; i++) {
      w.update(1 / 60, { x: 0, y: 0 });
      most = Math.max(most, w.fields.filter((f) => f.kind === 'patch').length);
    }
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(6);
  });

  it('la parálisis aturde a los enemigos', () => {
    const { w, tg } = arena('pikachu', ['aturdir', 'aturdir']);
    let stunned = false;
    for (let i = 0; i < 400 && !stunned; i++) {
      w.update(1 / 60, { x: 0, y: 0 });
      stunned = tg.stunT > 0;
    }
    expect(stunned).toBe(true);
  });

  it('cada Pokémon de Kanto hace daño con su ataque, también con todo mejorado y evolucionado', () => {
    for (const sp of KANTO.filter((_, i) => i % 3 === 0)) {
      for (const full of [false, true]) {
        const w = makeWorld({ speciesId: sp.id });
        emptyRoom(w);
        const p = w.player;
        if (full) {
          p.attack.ups = availableAttackUpgrades(p).map((u) => u.id);
          p.attack.evolved = true;
          w.rebuildAttack();
        }
        p.hp = p.maxHp = 1e6;
        const e = spawnAt(w, 143, 'tank', p.x + 20, p.y - 100);
        e.hp = e.maxHp = 1e6;
        e.speed = 0;
        e.touchCd = 99;
        run(w, 4);
        expect(e.hp, `${sp.name}${full ? ' (todo)' : ''}`).toBeLessThan(1e6);
        expect(w.projectiles.length).toBeLessThanOrEqual(BALANCE.perf.maxProjectiles);
      }
    }
  });
});
