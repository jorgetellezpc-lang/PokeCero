import { BALANCE } from '../config/balance';
import { obtainablePokemon, type PokemonSpecies } from '../data/pokemon';
import type { Rng } from '../game/rng';
import type { SaveStore } from './save';

// Gachapón de Kanto, como el de PokéSurvivor (js/systems/gacha.js).
// Required Notice: Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)
// Gasta TICKETS (nunca oro): 1 por tirada. La ×10 garantiza al menos una
// Épica o mejor; a las N tiradas sin Legendaria, la siguiente lo es. Los
// repetidos se convierten en oro. Valores PROVISIONALES (BALANCE.gacha).

export const RARITY_NAME: Record<number, string> = { 1: 'Común', 2: 'Poco común', 3: 'Rara', 4: 'Épica', 5: 'Legendaria' };
export const RARITY_COLOR: Record<number, string> = { 1: '#9fb1c9', 2: '#5fe08a', 3: '#4fb4ff', 4: '#c47bff', 5: '#ffcb3d' };

export interface PullResult { species: PokemonSpecies; rarity: number; isNew: boolean; refund: number }

function pool(rarity: number): PokemonSpecies[] {
  return obtainablePokemon().filter((p) => p.rarity === rarity);
}

/** Pool no vacío más cercano a esa rareza. */
function poolNear(rarity: number): { rarity: number; list: PokemonSpecies[] } {
  for (const d of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
    const r = rarity + d;
    if (r < 1 || r > 5) continue;
    const list = pool(r);
    if (list.length) return { rarity: r, list };
  }
  return { rarity, list: obtainablePokemon() };
}

function rollRarity(rng: Rng, min = 1): number {
  const rates = BALANCE.gacha.rates.filter(([r]) => r >= min);
  return rng.weighted(rates, ([, w]) => w)[0];
}

/** Hace `n` tiradas (1 o 10). Devuelve null si no hay tickets suficientes. */
export function pull(store: SaveStore, rng: Rng, n: 1 | 10 = 1): PullResult[] | null {
  if (store.data.tickets < n) return null;
  const out: PullResult[] = [];
  store.update((d) => {
    d.tickets -= n;
    for (let i = 0; i < n; i++) {
      d.pity++;
      let want: number;
      if (d.pity >= BALANCE.gacha.pity) want = 5;
      else if (n === 10 && i === n - 1 && !out.some((r) => r.rarity >= 4)) want = rollRarity(rng, 4);
      else want = rollRarity(rng);
      const { rarity, list } = poolNear(want);
      if (rarity === 5) d.pity = 0;
      const species = rng.pick(list);
      const isNew = !d.unlockedPokemon.includes(species.id);
      const refund = isNew ? 0 : BALANCE.gacha.refund[rarity];
      if (isNew) d.unlockedPokemon.push(species.id);
      d.gold += refund;
      out.push({ species, rarity, isNew, refund });
    }
    d.stats.pulls += n;
  });
  return out;
}
