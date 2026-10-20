import { describe, expect, it } from 'vitest';
import { BALANCE, PERMANENT_UPGRADES, permanentUpgradeCost } from '../src/config/balance';
import { KANTO, JOHTO } from '../src/data/regions';
import { Rng } from '../src/game/rng';
import { pull } from '../src/meta/gacha';
import { awardMedal, bankRunGold, claimMilestone, gymStatus, regionUnlocked } from '../src/meta/rewards';
import { MemoryStorage, SAVE_KEY, SaveStore, migrate } from '../src/meta/save';
import { buyUpgrade, permanentBonuses } from '../src/meta/shop';

const fresh = () => new SaveStore(new MemoryStorage());

describe('persistencia', () => {
  it('el progreso permanente sobrevive a "cerrar y abrir" el juego', () => {
    const storage = new MemoryStorage();
    const a = new SaveStore(storage);
    a.update((d) => { d.gold = 500; });
    buyUpgrade(a, 'hp');
    claimMilestone(a, 'brock', 20);
    const b = new SaveStore(storage);
    expect(b.data.permanentUpgrades.hp).toBe(1);
    expect(b.data.claimedRewards).toContain('brock:20');
    expect(b.data.gold).toBe(500 - permanentUpgradeCost(PERMANENT_UPGRADES[0], 0));
  });

  it('migra datos incompletos o corruptos sin perder lo válido', () => {
    expect(migrate(null).gold).toBe(0);
    const m = migrate({ gold: 120, settings: { testMode: false } });
    expect(m.gold).toBe(120);
    expect(m.settings.testMode).toBe(false);
    expect(m.settings.vibration).toBe(true);
    expect(m.permanentUpgrades.power).toBe(0);
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{no es json');
    expect(new SaveStore(storage).data.gold).toBe(0);
  });
});

describe('oro y mejoras permanentes', () => {
  it('no se puede comprar sin oro suficiente', () => {
    const s = fresh();
    expect(buyUpgrade(s, 'power')).toBe('gold');
    expect(s.data.permanentUpgrades.power).toBe(0);
  });

  it('comprar descuenta oro, sube de nivel y respeta el límite', () => {
    const s = fresh();
    s.update((d) => { d.gold = 1e6; });
    const def = PERMANENT_UPGRADES.find((u) => u.id === 'speed')!;
    for (let i = 0; i < def.maxLevel; i++) expect(buyUpgrade(s, 'speed')).toBe('ok');
    expect(buyUpgrade(s, 'speed')).toBe('max');
    expect(permanentBonuses(s).speed).toBeCloseTo(def.perLevel * def.maxLevel);
  });

  it('el oro de la partida se ingresa al terminar', () => {
    const s = fresh();
    bankRunGold(s, 37.8);
    expect(s.data.gold).toBe(37);
  });
});

describe('recompensas', () => {
  it('los tickets de un hito solo se cobran una vez', () => {
    const s = fresh();
    const t0 = s.data.tickets;
    expect(claimMilestone(s, 'brock', 20)).toBe(5);
    expect(claimMilestone(s, 'brock', 20)).toBe(0);
    expect(claimMilestone(s, 'brock', 7)).toBe(0);
    expect(s.data.tickets).toBe(t0 + 5);
  });

  it('la medalla desbloquea el siguiente gimnasio y no se duplica', () => {
    const s = fresh();
    const [brock, misty] = KANTO.gyms;
    expect(gymStatus(s, KANTO, brock)).toBe('available');
    expect(gymStatus(s, KANTO, misty)).toBe('locked');
    expect(awardMedal(s, KANTO, brock)).toBe(true);
    expect(awardMedal(s, KANTO, brock)).toBe(false);
    expect(gymStatus(s, KANTO, brock)).toBe('completed');
    expect(gymStatus(s, KANTO, misty)).toBe('soon');
  });

  it('la siguiente región requiere las 8 medallas de Kanto', () => {
    const s = fresh();
    expect(regionUnlocked(s, JOHTO)).toBe(false);
    for (const g of KANTO.gyms.slice(0, 7)) awardMedal(s, KANTO, g);
    expect(regionUnlocked(s, JOHTO)).toBe(false);
    awardMedal(s, KANTO, KANTO.gyms[7]);
    expect(regionUnlocked(s, JOHTO)).toBe(true);
  });
});

describe('gachapón', () => {
  it('gasta tickets (no oro) y desbloquea Pokémon', () => {
    const s = fresh();
    s.update((d) => { d.tickets = 100; d.gold = 0; });
    const rng = new Rng(5);
    const r = pull(s, rng);
    expect(r.ok).toBe(true);
    expect(s.data.tickets).toBe(100 - BALANCE.gacha.cost);
    for (let i = 0; i < 9; i++) pull(s, rng);
    expect(s.data.unlockedPokemon.length).toBeGreaterThan(1);
  });

  it('sin tickets no se puede tirar', () => {
    const s = fresh();
    s.update((d) => { d.tickets = 0; });
    expect(pull(s, new Rng(1))).toEqual({ ok: false, reason: 'tickets' });
  });
});
