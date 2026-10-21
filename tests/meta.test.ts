import { describe, expect, it } from 'vitest';
import { BALANCE, PERMANENT_UPGRADES, permanentUpgradeCost } from '../src/config/balance';
import { JOHTO, KANTO } from '../src/data/regions';
import { Rng } from '../src/game/rng';
import { pull } from '../src/meta/gacha';
import { awardMedal, bankRunGold, claimMilestone, gymStatus, regionUnlocked } from '../src/meta/rewards';
import { MemoryStorage, migrate, SAVE_KEY, SaveStore } from '../src/meta/save';
import { buyUpgrade, perksFor, upgradeLevel } from '../src/meta/shop';

const fresh = () => new SaveStore(new MemoryStorage());

describe('persistencia', () => {
  it('el progreso permanente sobrevive a "cerrar y abrir" el juego', () => {
    const storage = new MemoryStorage();
    const a = new SaveStore(storage);
    const gold0 = a.data.gold;
    buyUpgrade(a, 'charmander', 'hp');
    claimMilestone(a, 'brock', 20);
    const b = new SaveStore(storage);
    expect(upgradeLevel(b, 'charmander', 'hp')).toBe(1);
    expect(b.data.claimedRewards).toContain('brock:20');
    expect(b.data.gold).toBe(gold0 - permanentUpgradeCost(PERMANENT_UPGRADES[0], 0));
  });

  it('migra un guardado v1 (mejoras globales) a v2 (por Pokémon)', () => {
    const m = migrate({ version: 1, gold: 120, selectedPokemon: 'charmander', unlockedPokemon: ['charmander'], permanentUpgrades: { hp: 2, power: 1, defense: 0, speed: 3 } });
    expect(m.version).toBe(2);
    expect(m.gold).toBe(120);
    expect(m.upgrades.charmander).toEqual({ hp: 2, atk: 1, spd: 3 });
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{no es json');
    expect(new SaveStore(storage).data.gold).toBe(BALANCE.rewards.starterGold);
  });
});

describe('oro y mejoras permanentes', () => {
  it('no se puede comprar sin oro suficiente', () => {
    const s = fresh();
    s.update((d) => { d.gold = 0; });
    expect(buyUpgrade(s, 'charmander', 'atk')).toBe('gold');
  });

  it('las mejoras son de cada Pokémon, respetan el límite y llegan a la partida', () => {
    const s = fresh();
    s.update((d) => { d.gold = 1e7; });
    const def = PERMANENT_UPGRADES.find((u) => u.id === 'spd')!;
    for (let i = 0; i < def.maxLevel; i++) expect(buyUpgrade(s, 'charmander', 'spd')).toBe('ok');
    expect(buyUpgrade(s, 'charmander', 'spd')).toBe('max');
    expect(perksFor(s, 'charmander').spdMul).toBeCloseTo(1 + 0.03 * def.maxLevel);
    expect(perksFor(s, 'squirtle').spdMul).toBe(1);
  });

  it('el oro de la partida se ingresa al terminar', () => {
    const s = fresh();
    const g = s.data.gold;
    bankRunGold(s, 37.8);
    expect(s.data.gold).toBe(g + 37);
  });
});

describe('recompensas', () => {
  it('los tickets de un hito solo se cobran una vez', () => {
    const s = fresh();
    const t0 = s.data.tickets;
    expect(claimMilestone(s, 'brock', 20)).toBe(5);
    expect(claimMilestone(s, 'brock', 20)).toBe(0);
    expect(s.data.tickets).toBe(t0 + 5);
  });

  it('la medalla desbloquea el siguiente gimnasio y la región necesita las 8', () => {
    const s = fresh();
    const [brock, misty] = KANTO.gyms;
    expect(gymStatus(s, KANTO, misty)).toBe('locked');
    expect(awardMedal(s, KANTO, brock)).toBe(true);
    expect(awardMedal(s, KANTO, brock)).toBe(false);
    expect(gymStatus(s, KANTO, misty)).toBe('soon');
    expect(regionUnlocked(s, JOHTO)).toBe(false);
    for (const g of KANTO.gyms) awardMedal(s, KANTO, g);
    expect(regionUnlocked(s, JOHTO)).toBe(true);
  });
});

describe('gachapón', () => {
  it('×1 gasta un ticket; ×10 gasta diez y garantiza una Épica o mejor', () => {
    const s = fresh();
    s.update((d) => { d.tickets = 100; });
    const rng = new Rng(5);
    expect(pull(s, rng, 1)).toHaveLength(1);
    expect(s.data.tickets).toBe(99);
    for (let i = 0; i < 5; i++) {
      const r = pull(s, rng, 10)!;
      expect(r).toHaveLength(10);
      expect(r.some((x) => x.rarity >= 4)).toBe(true);
    }
    expect(s.data.tickets).toBe(49);
    expect(s.data.unlockedPokemon.length).toBeGreaterThan(5);
  });

  it('la garantía da una Legendaria a las N tiradas y los repetidos dan oro', () => {
    const s = fresh();
    s.update((d) => { d.tickets = 1000; d.pity = BALANCE.gacha.pity - 1; });
    const r = pull(s, new Rng(2), 1)!;
    expect(r[0].rarity).toBe(5);
    expect(s.data.pity).toBe(0);
    const gold0 = s.data.gold;
    for (let i = 0; i < 30; i++) pull(s, new Rng(i), 10);
    expect(s.data.gold).toBeGreaterThan(gold0);
  });

  it('sin tickets no se puede tirar', () => {
    const s = fresh();
    s.update((d) => { d.tickets = 0; });
    expect(pull(s, new Rng(1), 1)).toBeNull();
  });
});
