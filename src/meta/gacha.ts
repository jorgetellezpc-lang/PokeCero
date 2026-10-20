import { BALANCE } from '../config/balance';
import { obtainablePokemon } from '../data/pokemon';
import type { PokemonSpecies } from '../data/types';
import type { Rng } from '../game/rng';
import type { SaveStore } from './save';

// Gachapón: gasta TICKETS (nunca oro) para obtener Pokémon. Rarezas,
// probabilidades y duplicados son PROVISIONALES (BALANCE.gacha).

export type GachaResult =
  | { ok: true; species: PokemonSpecies; duplicate: boolean; goldGiven: number }
  | { ok: false; reason: 'tickets' };

export function pull(store: SaveStore, rng: Rng): GachaResult {
  const cost = BALANCE.gacha.cost;
  if (store.data.tickets < cost) return { ok: false, reason: 'tickets' };
  const pool = obtainablePokemon();
  const rarity = rng.weighted(['common', 'rare'] as const, (r) => BALANCE.gacha.rarityWeights[r]);
  const candidates = pool.filter((p) => p.rarity === rarity);
  const species = rng.pick(candidates.length ? candidates : pool);
  const duplicate = store.data.unlockedPokemon.includes(species.id);
  const goldGiven = duplicate ? BALANCE.gacha.duplicateGold : 0;
  store.update((d) => {
    d.tickets -= cost;
    if (duplicate) d.gold += goldGiven;
    else d.unlockedPokemon.push(species.id);
  });
  return { ok: true, species, duplicate, goldGiven };
}
