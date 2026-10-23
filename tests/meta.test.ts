import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { PLAYABLE_POKEMON } from '../src/data/pokemon';
import { JOHTO, KANTO } from '../src/data/regions';
import { World } from '../src/game/world';
import { Rng } from '../src/game/rng';
import { pull } from '../src/meta/gacha';
import { awardMedal, bankRunGold, claimMilestone, gymStatus, regionUnlocked } from '../src/meta/rewards';
import { MemoryStorage, migrate, SAVE_KEY, SaveStore } from '../src/meta/save';
import { active, addOwned, chooseStarter, commitRun, hasStarter, missingStarters, progressOf, selectOwned } from '../src/meta/team';
import { captureBoss, capturedMon, CAPTURE_COST, payCapture } from '../src/meta/capture';
import { formAtLevel, START_LEVEL } from '../src/game/levels';

const fresh = () => new SaveStore(new MemoryStorage());

describe('persistencia', () => {
  it('tus Pokémon y el progreso sobreviven a «cerrar y abrir» el juego', () => {
    const storage = new MemoryStorage();
    const a = new SaveStore(storage);
    chooseStarter(a, 'squirtle');
    claimMilestone(a, 'brock', 20);
    const b = new SaveStore(storage);
    expect(b.data.owned).toEqual([{ line: 'squirtle', species: 'squirtle', level: START_LEVEL, xp: 0, cards: [] }]);
    expect(b.data.selectedPokemon).toBe('squirtle');
    expect(b.data.claimedRewards).toContain('brock:20');
  });

  it('las partidas de antes de la versión 3 empiezan de cero (y un guardado roto también)', () => {
    const m = migrate({ version: 2, gold: 9999, medals: { kanto: ['brock'] }, selectedPokemon: 'charmander', upgrades: { charmander: { hp: 3 } } });
    expect(m.version).toBe(3);
    expect(m.gold).toBe(BALANCE.rewards.starterGold);
    expect(m.medals).toEqual({});
    expect(m.owned).toEqual([]);
    expect('upgrades' in m).toBe(false);
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{no es json');
    expect(new SaveStore(storage).data.gold).toBe(BALANCE.rewards.starterGold);
  });

  it('limpia Pokémon y cartas no válidos de un guardado v3', () => {
    const m = migrate({ version: 3, selectedPokemon: 'mewtwo', owned: [
      { line: 'pikachu', species: 'raichu', level: 300, xp: 5, cards: [{ type: 'stat', stat: 'atk' }, { type: 'stat', stat: 'heal' }, { type: 'attack', upgradeId: 'nada' }] },
      { line: 'mewtwo', species: 'mewtwo', level: 50, xp: 0, cards: [] },
      { line: 'pikachu', species: 'pikachu', level: 5, xp: 0, cards: [] },
    ] });
    expect(m.owned).toHaveLength(1);
    expect(m.owned[0]).toMatchObject({ line: 'pikachu', species: 'raichu', level: 100, cards: [{ type: 'stat', stat: 'atk' }] });
    expect(m.selectedPokemon).toBe('pikachu');
  });
});

describe('inicial único y equipo', () => {
  it('una partida nueva no tiene Pokémon hasta hacer el test; luego solo el elegido, en el nivel 5', () => {
    const s = fresh();
    expect(PLAYABLE_POKEMON).toEqual(['bulbasaur', 'charmander', 'squirtle', 'pikachu']);
    expect(hasStarter(s)).toBe(false);
    chooseStarter(s, 'bulbasaur');
    expect(hasStarter(s)).toBe(true);
    expect(active(s)).toMatchObject({ line: 'bulbasaur', level: START_LEVEL });
    expect(missingStarters(s)).toEqual(['charmander', 'squirtle', 'pikachu']);
  });

  it('la experiencia y las cartas solo se guardan al superar la partida', () => {
    const s = fresh();
    chooseStarter(s, 'charmander');
    const w = new World({ speciesId: 'charmander', gym: KANTO.gyms[0], rooms: [1], seed: 2, progress: progressOf(active(s)!) });
    w.addXp(5000);
    w.takeLevelUps(() => 0);
    // Caer: no se llama a commitRun → nada cambia.
    expect(active(s)!.level).toBe(START_LEVEL);
    commitRun(s, 'charmander', w);
    expect(active(s)!.level).toBe(w.player.level);
    expect(active(s)!.cards.length).toBe(w.player.level - START_LEVEL);
    expect(active(s)!.species).toBe(formAtLevel('charmander', w.player.level).id);
  });

  it('capturar: el reto cuesta tickets, el jefe se adapta a tu nivel y el capturado llega con tu nivel', () => {
    const s = fresh();
    chooseStarter(s, 'charmander');
    s.update((d) => { d.tickets = CAPTURE_COST; });
    expect(payCapture(s)).toBe(true);
    expect(payCapture(s)).toBe(false);
    const low = captureBoss('squirtle', 5);
    const high = captureBoss('squirtle', 40);
    expect(low.dex).toBe(7);
    expect(high.dex).toBe(9);
    expect(high.hp).toBeGreaterThan(low.hp);
    const mon = capturedMon('squirtle', 20, 3);
    expect(mon).toMatchObject({ line: 'squirtle', species: 'wartortle', level: 20 });
    expect(mon.cards.length).toBe(20 - START_LEVEL);
    addOwned(s, mon);
    addOwned(s, mon);
    expect(s.data.owned.map((o) => o.line)).toEqual(['charmander', 'squirtle']);
    selectOwned(s, 'squirtle');
    expect(active(s)!.line).toBe('squirtle');
    selectOwned(s, 'pikachu');
    expect(active(s)!.line).toBe('squirtle');
  });

  it('los demás Pokémon siguen saliendo como enemigos', () => {
    const w = new World({ speciesId: 'squirtle', gym: KANTO.gyms[0], rooms: [1, 2, 3], seed: 5 });
    const cast = w.cast.flat().map((d) => d.dex);
    expect(cast.length).toBeGreaterThan(10);
    expect(cast.some((dex) => ![1, 4, 7, 25].includes(dex))).toBe(true);
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
