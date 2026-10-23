import { BALANCE } from '../config/balance';
import { ADVENTURE, TOWNS } from '../data/adventure';
import { ATTACK_UPGRADE } from '../data/signatures';
import { ABILITIES } from '../data/abilities';
import { RUN_STAT_UPGRADES } from '../data/runUpgrades';
import { isPlayable, getSpecies } from '../data/pokemon';
import type { UpgradeAction } from '../game/upgradeGenerator';
import { ADMIN_FUNDS } from './admin';

// Persistencia del progreso PERMANENTE: tus Pokémon (nivel, experiencia y
// cartas), oro, tickets, medallas y aventura. Lo que se gana en una partida
// solo se guarda al superar la ruta o el gimnasio (ver ui/screens/run.ts).
// El esquema lleva versión; la 3 empezó de cero (inicial único y niveles).

export const SAVE_KEY = 'pokecero.save';
export const SAVE_VERSION = 3;

/** Un Pokémon tuyo. `line` es su línea evolutiva (el inicial: charmander, squirtle…). */
export interface OwnedPokemon {
  line: string;
  /** Forma actual (evoluciona por nivel). */
  species: string;
  level: number;
  /** Experiencia dentro del nivel. */
  xp: number;
  /** Cartas permanentes conseguidas, en orden. */
  cards: UpgradeAction[];
}

export interface Settings {
  /** Gimnasio corto de 8 salas para probar el ciclo completo. */
  testMode: boolean;
  damageNumbers: boolean;
  vibration: boolean;
  music: number;
  sfx: number;
  /** Calidad del escenario 3D: automática o fija. */
  graphics: GraphicsQuality;
  /** Zoom de la cámara en partida: 1 = normal, más = más cerca. */
  zoom: number;
}

export type GraphicsQuality = 'auto' | 'high' | 'medium' | 'low';

export interface SaveData {
  version: number;
  gold: number;
  tickets: number;
  /** Tus Pokémon. Vacío hasta hacer el test del inicial. */
  owned: OwnedPokemon[];
  /** Líneas que tienes (lo mismo que `owned`, para el gachapón). */
  unlockedPokemon: string[];
  /** Línea del Pokémon con el que juegas ('' si aún no tienes ninguno). */
  selectedPokemon: string;
  /** Medallas por región: { kanto: ['brock'] }. */
  medals: Record<string, string[]>;
  /** Mejor sala alcanzada por gimnasio. */
  bestRoom: Record<string, number>;
  /** Recompensas únicas ya cobradas (p. ej. "brock:20"). */
  claimedRewards: string[];
  /** Tiradas del gachapón de Kanto sin Legendaria (garantía). */
  pity: number;
  settings: Settings;
  stats: { runs: number; wins: number; kills: number; pulls: number };
  /** Aventura: lugares a los que ya has llegado y dónde estás (data/adventure.ts). */
  adventure: { visited: string[]; at: string };
  /** Modo admin (meta/admin.ts): oro y tickets ilimitados y todo abierto. */
  admin?: boolean;
  /** Oro y tickets reales de antes de activar el modo admin. */
  adminBackup?: { gold: number; tickets: number };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    gold: BALANCE.rewards.starterGold,
    tickets: BALANCE.rewards.starterTickets,
    owned: [],
    unlockedPokemon: [],
    selectedPokemon: '',
    medals: {},
    bestRoom: {},
    claimedRewards: [],
    pity: 0,
    settings: { testMode: true, damageNumbers: true, vibration: true, music: 0.5, sfx: 0.7, graphics: 'auto', zoom: 1 },
    stats: { runs: 0, wins: 0, kills: 0, pulls: 0 },
    adventure: { visited: ['paleta'], at: 'paleta' },
  };
}

/** Normaliza datos cargados. Las partidas de antes de la versión 3 empiezan de cero. */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData> & { version?: number };
  if ((r.version ?? 1) < 3) return base;
  const data: SaveData = {
    ...base,
    ...r,
    version: SAVE_VERSION,
    settings: { ...base.settings, ...(r.settings ?? {}) },
    stats: { ...base.stats, ...(r.stats ?? {}) },
    medals: { ...(r.medals ?? {}) },
    bestRoom: { ...(r.bestRoom ?? {}) },
    claimedRewards: Array.isArray(r.claimedRewards) ? [...r.claimedRewards] : [],
  };
  delete (data as unknown as Record<string, unknown>).upgrades;
  // Tus Pokémon: solo los jugables, sin repetir, con nivel y cartas válidos.
  const seen = new Set<string>();
  data.owned = (Array.isArray(r.owned) ? r.owned : []).filter((o) => o && isPlayable(o.line) && !seen.has(o.line) && seen.add(o.line)).map((o) => ({
    line: o.line,
    species: safeSpecies(o.species, o.line),
    level: Math.max(1, Math.min(BALANCE.levels.max, Math.floor(Number(o.level) || BALANCE.levels.start))),
    xp: Math.max(0, Number(o.xp) || 0),
    cards: (Array.isArray(o.cards) ? o.cards : []).filter(validCard),
  }));
  data.unlockedPokemon = data.owned.map((o) => o.line);
  if (!data.owned.some((o) => o.line === data.selectedPokemon)) data.selectedPokemon = data.owned[0]?.line ?? '';
  // Aventura: lugares conocidos, siempre con Pueblo Paleta.
  const adv = r.adventure;
  const known = new Set(ADVENTURE);
  const visited = Array.isArray(adv?.visited) ? adv!.visited.filter((id) => known.has(id) && TOWNS[id]) : [];
  if (!visited.includes('paleta')) visited.unshift('paleta');
  data.adventure = { visited, at: adv && visited.includes(adv.at) ? adv.at : 'paleta' };
  data.gold = Math.max(0, Math.floor(Number(data.gold) || 0));
  data.tickets = Math.max(0, Math.floor(Number(data.tickets) || 0));
  data.pity = Math.max(0, Math.floor(Number(data.pity) || 0));
  data.admin = data.admin === true;
  if (!data.admin) delete data.adminBackup;
  refillAdmin(data);
  return data;
}

function safeSpecies(id: string, line: string): string {
  try {
    const sp = getSpecies(id);
    return sp.line === line ? sp.id : line;
  } catch {
    return line;
  }
}

/** Una carta guardada es válida si su mejora, estadística o habilidad existe. */
function validCard(c: UpgradeAction): boolean {
  if (!c || typeof c !== 'object') return false;
  switch (c.type) {
    case 'attack': return !!ATTACK_UPGRADE[c.upgradeId];
    case 'attackEvolution': return true;
    case 'stat': return !!RUN_STAT_UPGRADES[c.stat] && c.stat !== 'heal';
    case 'ability': return !!ABILITIES[c.abilityId];
    default: return false;
  }
}

/** En modo admin el oro y los tickets nunca se acaban. */
function refillAdmin(d: SaveData): void {
  if (!d.admin) return;
  d.gold = Math.max(d.gold, ADMIN_FUNDS);
  d.tickets = Math.max(d.tickets, ADMIN_FUNDS);
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
    refillAdmin(this.data);
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
