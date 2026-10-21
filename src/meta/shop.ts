import { PERMANENT_UPGRADES, permanentUpgradeCost } from '../config/balance';
import type { PermanentPerks } from '../game/world';
import type { SaveStore, UpgradeId } from './save';

// Mejoras permanentes con ORO (no con tickets), de cada Pokémon: solo cuentan
// cuando juegas con él (como en PokéSurvivor).

export type PurchaseResult = 'ok' | 'max' | 'gold' | 'unknown';

export function upgradeLevel(store: SaveStore, pokemon: string, id: UpgradeId): number {
  return store.data.upgrades[pokemon]?.[id] ?? 0;
}

export function canBuy(store: SaveStore, pokemon: string, id: UpgradeId): PurchaseResult {
  const def = PERMANENT_UPGRADES.find((u) => u.id === id);
  if (!def) return 'unknown';
  const lv = upgradeLevel(store, pokemon, id);
  if (lv >= def.maxLevel) return 'max';
  if (store.data.gold < permanentUpgradeCost(def, lv)) return 'gold';
  return 'ok';
}

export function buyUpgrade(store: SaveStore, pokemon: string, id: UpgradeId): PurchaseResult {
  const res = canBuy(store, pokemon, id);
  if (res !== 'ok') return res;
  const def = PERMANENT_UPGRADES.find((u) => u.id === id)!;
  const cost = permanentUpgradeCost(def, upgradeLevel(store, pokemon, id));
  store.update((d) => {
    d.gold -= cost;
    const ups = (d.upgrades[pokemon] ??= {});
    ups[id] = (ups[id] ?? 0) + 1;
  });
  return 'ok';
}

/** Mejoras permanentes del Pokémon → modificadores de la partida. */
export function perksFor(store: SaveStore, pokemon: string): PermanentPerks {
  const L = (id: UpgradeId) => upgradeLevel(store, pokemon, id);
  return {
    hp: L('hp') * 8,
    atkMul: 1 + L('atk') * 0.04,
    spdMul: 1 + L('spd') * 0.03,
    cdMul: 1 - L('cd') * 0.03,
    dmgReduce: L('def') * 0.02,
    regen: L('regen') * 0.2,
    magnetMul: 1 + L('magnet') * 0.12,
    xpMul: 1 + L('xp') * 0.05,
    coinMul: 1 + L('coins') * 0.08,
    crit: L('crit') * 0.03,
  };
}
