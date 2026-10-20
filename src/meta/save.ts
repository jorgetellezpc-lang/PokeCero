import { BALANCE, PERMANENT_UPGRADES, type PermanentUpgradeDef } from '../config/balance';
import { STARTER_POKEMON } from '../data/pokemon';

// Persistencia del progreso PERMANENTE. Nunca guarda el estado de una partida
// (nivel, mejoras temporales): eso vive solo en World y se pierde al morir.
// El esquema lleva versión para poder migrarlo en el futuro (p. ej. a un
// servidor) sin perder datos.

export const SAVE_KEY = 'pokecero.save';
export const SAVE_VERSION = 1;

export interface Settings {
  /** Gimnasio corto de 8 salas para probar el ciclo completo. */
  testMode: boolean;
  damageNumbers: boolean;
  vibration: boolean;
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
  permanentUpgrades: Record<PermanentUpgradeDef['id'], number>;
  settings: Settings;
  stats: { runs: number; wins: number; kills: number };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    gold: 0,
    tickets: BALANCE.rewards.starterTickets,
    unlockedPokemon: [STARTER_POKEMON],
    selectedPokemon: STARTER_POKEMON,
    medals: {},
    bestRoom: {},
    claimedRewards: [],
    permanentUpgrades: Object.fromEntries(PERMANENT_UPGRADES.map((u) => [u.id, 0])) as SaveData['permanentUpgrades'],
    settings: { testMode: true, damageNumbers: true, vibration: true },
    stats: { runs: 0, wins: 0, kills: 0 },
  };
}

/** Normaliza datos cargados (versiones antiguas o campos ausentes). */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  // (versión 1: no hay migraciones todavía; aquí se añadirán por versión)
  const data: SaveData = {
    ...base,
    ...r,
    version: SAVE_VERSION,
    permanentUpgrades: { ...base.permanentUpgrades, ...(r.permanentUpgrades ?? {}) },
    settings: { ...base.settings, ...(r.settings ?? {}) },
    stats: { ...base.stats, ...(r.stats ?? {}) },
    medals: { ...(r.medals ?? {}) },
    bestRoom: { ...(r.bestRoom ?? {}) },
    claimedRewards: Array.isArray(r.claimedRewards) ? [...r.claimedRewards] : [],
    unlockedPokemon: Array.isArray(r.unlockedPokemon) && r.unlockedPokemon.length ? [...r.unlockedPokemon] : base.unlockedPokemon,
  };
  if (!data.unlockedPokemon.includes(data.selectedPokemon)) data.selectedPokemon = data.unlockedPokemon[0];
  data.gold = Math.max(0, Math.floor(Number(data.gold) || 0));
  data.tickets = Math.max(0, Math.floor(Number(data.tickets) || 0));
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
