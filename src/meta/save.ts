import { BALANCE, PERMANENT_UPGRADES, type PermanentUpgradeDef } from '../config/balance';
import { POKEMON, STARTER_POKEMON } from '../data/pokemon';

// Persistencia del progreso PERMANENTE. Nunca guarda el estado de una partida
// (nivel, cartas): eso vive solo en World y se pierde al morir. El esquema
// lleva versión para poder migrarlo en el futuro (p. ej. a un servidor).

export const SAVE_KEY = 'pokecero.save';
export const SAVE_VERSION = 2;

export type UpgradeId = PermanentUpgradeDef['id'];

export interface Settings {
  /** Gimnasio corto de 8 salas para probar el ciclo completo. */
  testMode: boolean;
  damageNumbers: boolean;
  vibration: boolean;
  music: number;
  sfx: number;
}

export interface SaveData {
  version: number;
  gold: number;
  tickets: number;
  unlockedPokemon: string[];
  selectedPokemon: string;
  /** Medallas por región: { kanto: ['brock'] }. */
  medals: Record<string, string[]>;
  /** Mejor sala alcanzada por gimnasio. */
  bestRoom: Record<string, number>;
  /** Recompensas únicas ya cobradas (p. ej. "brock:20"). */
  claimedRewards: string[];
  /** Mejoras permanentes compradas, por Pokémon (como en PokéSurvivor). */
  upgrades: Record<string, Partial<Record<UpgradeId, number>>>;
  /** Tiradas del gachapón de Kanto sin Legendaria (garantía). */
  pity: number;
  settings: Settings;
  stats: { runs: number; wins: number; kills: number; pulls: number };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    gold: BALANCE.rewards.starterGold,
    tickets: BALANCE.rewards.starterTickets,
    unlockedPokemon: [STARTER_POKEMON],
    selectedPokemon: STARTER_POKEMON,
    medals: {},
    bestRoom: {},
    claimedRewards: [],
    upgrades: {},
    pity: 0,
    settings: { testMode: true, damageNumbers: true, vibration: true, music: 0.5, sfx: 0.7 },
    stats: { runs: 0, wins: 0, kills: 0, pulls: 0 },
  };
}

/** Normaliza datos cargados (versiones antiguas o campos ausentes). */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData> & { permanentUpgrades?: Record<string, number>; version?: number };
  const data: SaveData = {
    ...base,
    ...r,
    version: SAVE_VERSION,
    upgrades: { ...(r.upgrades ?? {}) },
    settings: { ...base.settings, ...(r.settings ?? {}) },
    stats: { ...base.stats, ...(r.stats ?? {}) },
    medals: { ...(r.medals ?? {}) },
    bestRoom: { ...(r.bestRoom ?? {}) },
    claimedRewards: Array.isArray(r.claimedRewards) ? [...r.claimedRewards] : [],
    unlockedPokemon: Array.isArray(r.unlockedPokemon) && r.unlockedPokemon.length ? [...r.unlockedPokemon] : base.unlockedPokemon,
  };
  // v1 → v2: las mejoras eran globales; pasan al Pokémon seleccionado.
  if ((r.version ?? 1) < 2) {
    data.gold = Math.max(Number(r.gold) || 0, 0);
    const old = r.permanentUpgrades;
    if (old) {
      const map: Record<string, UpgradeId> = { hp: 'hp', power: 'atk', defense: 'def', speed: 'spd' };
      const target = data.selectedPokemon;
      data.upgrades[target] = { ...(data.upgrades[target] ?? {}) };
      for (const [k, v] of Object.entries(old)) if (map[k] && v) data.upgrades[target]![map[k]] = Math.min(v, 8);
    }
    delete (data as unknown as Record<string, unknown>).permanentUpgrades;
  }
  data.unlockedPokemon = data.unlockedPokemon.filter((id) => POKEMON[id]);
  if (!data.unlockedPokemon.length) data.unlockedPokemon = [STARTER_POKEMON];
  if (!data.unlockedPokemon.includes(data.selectedPokemon)) data.selectedPokemon = data.unlockedPokemon[0];
  data.gold = Math.max(0, Math.floor(Number(data.gold) || 0));
  data.tickets = Math.max(0, Math.floor(Number(data.tickets) || 0));
  data.pity = Math.max(0, Math.floor(Number(data.pity) || 0));
  for (const ups of Object.values(data.upgrades)) {
    for (const def of PERMANENT_UPGRADES) {
      if (ups[def.id] != null) ups[def.id] = Math.max(0, Math.min(def.maxLevel, Math.floor(Number(ups[def.id]) || 0)));
    }
  }
  return data;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Almacén del progreso permanente. Cada cambio se guarda inmediatamente. */
export class SaveStore {
  data: SaveData;
  private listeners = new Set<() => void>();

  constructor(private storage: StorageLike | null) {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = this.storage?.getItem(SAVE_KEY);
      return migrate(raw ? JSON.parse(raw) : null);
    } catch {
      return defaultSave();
    }
  }

  update(fn: (d: SaveData) => void): void {
    fn(this.data);
    this.persist();
    for (const l of this.listeners) l();
  }

  persist(): void {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // Almacenamiento no disponible (modo privado): el juego sigue en memoria.
    }
  }

  reset(): void {
    this.data = defaultSave();
    this.persist();
    for (const l of this.listeners) l();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export class MemoryStorage implements StorageLike {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

export function browserStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    s.setItem('__pokecero_test', '1');
    s.removeItem('__pokecero_test');
    return s;
  } catch {
    return null;
  }
}
