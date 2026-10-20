import { PERMANENT_UPGRADES, permanentUpgradeCost, type PermanentUpgradeDef } from '../config/balance';
import type { PermanentBonuses } from '../game/world';
import type { SaveStore } from './save';

// Mejoras permanentes con ORO (no con tickets).

export type PurchaseResult = 'ok' | 'max' | 'gold' | 'unknown';

export function upgradeLevel(store: SaveStore, id: PermanentUpgradeDef['id']): number {
  return store.data.permanentUpgrades[id] ?? 0;
}

export function canBuy(store: SaveStore, id: PermanentUpgradeDef['id']): PurchaseResult {
  const def = PERMANENT_UPGRADES.find((u) => u.id === id);
  if (!def) return 'unknown';
  const lv = upgradeLevel(store, id);
  if (lv >= def.maxLevel) return 'max';
  if (store.data.gold < permanentUpgradeCost(def, lv)) return 'gold';
  return 'ok';
}

export function buyUpgrade(store: SaveStore, id: PermanentUpgradeDef['id']): PurchaseResult {
  const res = canBuy(store, id);
  if (res !== 'ok') return res;
  const def = PERMANENT_UPGRADES.find((u) => u.id === id)!;
  const cost = permanentUpgradeCost(def, upgradeLevel(store, id));
  store.update((d) => {
    d.gold -= cost;
    d.permanentUpgrades[id] = (d.permanentUpgrades[id] ?? 0) + 1;
  });
  return 'ok';
}

/** Bonificaciones permanentes que recibe la partida. PROVISIONAL: globales para todos los Pokémon. */
export function permanentBonuses(store: SaveStore): PermanentBonuses {
  const b: PermanentBonuses = { hp: 0, power: 0, defense: 0, speed: 0 };
  for (const def of PERMANENT_UPGRADES) b[def.id] = def.perLevel * upgradeLevel(store, def.id);
  return b;
}
