import { BALANCE } from '../config/balance';
import { ABILITIES, RARITY_INFO, type Rarity } from '../data/abilities';
import { ATTACK_UPGRADES, EVO_KEY, attackEvolutionReady, rawAttackNums, type AttackFamily, type AttackUpgrade } from '../data/signatures';
import { RUN_STAT_UPGRADES, type RunStatId } from '../data/runUpgrades';
import { TYPE_NAMES } from '../data/typeColors';
import type { ElementType } from '../data/types';
import { abilityAvailable, synergiesCompletedBy } from './abilities';
import type { Player } from './entities';
import type { Rng } from './rng';

// ============================================================================
// Las tres cartas de subida de nivel. Basado en PokéSurvivor
// (js/systems/levelup.js). Required Notice: Copyright 2026 JPTER78
// (https://github.com/JPTER78/pokesurvivor)
//
// Cada Pokémon tiene un único ataque (src/data/signatures.ts). Tipos de carta:
// mejora del ataque (solo las que encajan con su comportamiento y no están al
// máximo), EVOLUCIÓN del ataque (dorada, cuando se cumplen sus requisitos),
// estadística y habilidad. Independiente de la interfaz.
// ============================================================================

export type UpgradeFamily = 'attack' | 'attackEvolution' | 'stat' | 'ability' | 'fallback';

export type UpgradeAction =
  | { type: 'attack'; upgradeId: string }
  | { type: 'attackEvolution' }
  | { type: 'stat'; stat: RunStatId }
  | { type: 'ability'; abilityId: string }
  | { type: 'heal'; amount: number }
  | { type: 'gold'; amount: number };

export interface UpgradeChoice {
  key: string;
  family: UpgradeFamily;
  action: UpgradeAction;
  title: string;
  category: string;
  description: string;
  detail: string;
  element?: ElementType;
  /** Rareza (solo habilidades). */
  rarity?: Rarity;
  /** Sinergia que completaría (solo habilidades). */
  synergy?: string;
  /** Peso para el sorteo. */
  w: number;
}

const FAMILY_NAME: Record<AttackFamily, string> = {
  daño: 'Daño', forma: 'Forma', cantidad: 'Cantidad', efecto: 'Efecto', estado: 'Estado', tipo: 'Tipos',
};

/** Mejoras del ataque que encajan y no están al máximo. */
export function availableAttackUpgrades(p: Player): AttackUpgrade[] {
  const A = p.attack;
  const raw = rawAttackNums(A.sig, A.ups, A.evolved);
  return ATTACK_UPGRADES.filter((u) => A.ups.filter((x) => x === u.id).length < u.max && u.fits(A.sig, raw));
}

export function candidateUpgrades(p: Player, rng: Rng): UpgradeChoice[] {
  const W = BALANCE.upgrades.weights;
  const out: UpgradeChoice[] = [];
  const A = p.attack;
  const name = p.moves[0]?.name ?? A.sig.name;

  // --- evolución del ataque ---
  if (attackEvolutionReady(A.sig, A.ups, p.level, A.evolved)) {
    out.push({
      key: 'evo:attack', family: 'attackEvolution', action: { type: 'attackEvolution' }, w: W.evolution,
      title: `${name} → ${A.sig.evoName}`, category: 'EVOLUCIÓN', description: A.sig.evoText.replace(/^./, (c) => c.toUpperCase()),
      detail: '', element: A.sig.primary,
    });
  }

  // --- mejoras del ataque (4 candidatas; la que falta para evolucionar pesa más) ---
  const raw = rawAttackNums(A.sig, A.ups, A.evolved);
  const key = EVO_KEY[A.sig.kind];
  const rest = availableAttackUpgrades(p);
  for (let i = 0; i < 4 && rest.length; i++) {
    const u = rng.weighted(rest, (x) => (!A.evolved && x.id === key && !A.ups.includes(key) ? W.attackKey : W.attack));
    rest.splice(rest.indexOf(u), 1);
    const n = A.ups.filter((x) => x === u.id).length;
    const isKey = !A.evolved && u.id === key && !A.ups.includes(key);
    out.push({
      key: `atk:${u.id}`, family: 'attack', action: { type: 'attack', upgradeId: u.id },
      w: isKey ? W.attackKey : W.attack,
      title: u.id === 'fusion' ? `Fusión ${TYPE_NAMES[A.sig.primary]}/${TYPE_NAMES[A.sig.secondary!]}` : u.name,
      category: `${name} · ${FAMILY_NAME[u.family]}`, description: u.text(A.sig, raw),
      detail: isKey ? 'Clave para evolucionar el ataque' : u.max > 1 ? `${n} / ${u.max}` : '',
      element: u.family === 'tipo' ? A.sig.secondary ?? A.sig.primary : A.sig.primary,
    });
  }

  // --- estadísticas (4 al azar con hueco) ---
  const room = (id: RunStatId) => {
    const max = RUN_STAT_UPGRADES[id].max;
    return !max || (p.statsTaken[id] ?? 0) < max;
  };
  const ids = (Object.keys(RUN_STAT_UPGRADES) as RunStatId[]).filter((id) => room(id));
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const attackLeft = out.some((c) => c.family === 'attack');
  for (const id of ids.slice(0, 4)) {
    const s = RUN_STAT_UPGRADES[id];
    out.push({
      key: `stat:${id}`, family: 'stat', action: { type: 'stat', stat: id }, w: attackLeft ? W.stat : W.statFull,
      title: s.name, category: 'Mejora', description: s.description,
      detail: s.max ? `${p.statsTaken[id] ?? 0} / ${s.max}` : '',
    });
  }
  // --- habilidades (4 candidatas, por rareza; las que completan sinergia pesan el triple) ---
  const abil = Object.values(ABILITIES).filter((a) => abilityAvailable(p, a));
  for (let i = 0; i < 4 && abil.length; i++) {
    const a = rng.weighted(abil, (x) => RARITY_INFO[x.rarity].weight * (synergiesCompletedBy(p, x.id).length ? 3 : 1));
    abil.splice(abil.indexOf(a), 1);
    const n = p.abilities[a.id] ?? 0;
    const syn = synergiesCompletedBy(p, a.id)[0];
    out.push({
      key: `ab:${a.id}`, family: 'ability', action: { type: 'ability', abilityId: a.id },
      w: W.ability * (syn ? 2 : 1), rarity: a.rarity, synergy: syn?.name,
      title: a.name, category: `Habilidad · ${RARITY_INFO[a.rarity].name}`, description: a.description,
      detail: syn ? `¡Activa la sinergia ${syn.name}!` : a.maxStacks > 1 ? `${n} / ${a.maxStacks}` : '',
    });
  }
  return out;
}

const FALLBACKS: UpgradeChoice[] = [
  {
    key: 'fb:heal', family: 'fallback', action: { type: 'heal', amount: BALANCE.upgrades.fallbackHeal }, w: 1,
    title: 'Baya Aranja', category: 'Curación', description: `Recupera el ${Math.round(BALANCE.upgrades.fallbackHeal * 100)}% de la vida máxima`, detail: '',
  },
  {
    key: 'fb:gold', family: 'fallback', action: { type: 'gold', amount: BALANCE.upgrades.fallbackGold }, w: 1,
    title: 'Pepita', category: 'Oro', description: `+${BALANCE.upgrades.fallbackGold} de oro al terminar la partida`, detail: '',
  },
  {
    key: 'fb:gold2', family: 'fallback', action: { type: 'gold', amount: BALANCE.upgrades.fallbackGold * 2 }, w: 1,
    title: 'Maxipepita', category: 'Oro', description: `+${BALANCE.upgrades.fallbackGold * 2} de oro al terminar la partida`, detail: '',
  },
];

/**
 * Exactamente `BALANCE.upgrades.choices` (3) cartas distintas, por peso. La
 * evolución lista sale siempre, y si al ataque le queda alguna mejora, al
 * menos una de las tres es para él.
 */
export function generateChoices(p: Player, rng: Rng): UpgradeChoice[] {
  const n = BALANCE.upgrades.choices;
  const pool = candidateUpgrades(p, rng);
  const picked: UpgradeChoice[] = [];
  const take = (c: UpgradeChoice) => { pool.splice(pool.indexOf(c), 1); picked.push(c); };
  const evo = pool.find((c) => c.family === 'attackEvolution');
  if (evo) take(evo);
  while (picked.length < n && pool.length) take(rng.weighted(pool, (x) => x.w));
  const atk = pool.filter((c) => c.family === 'attack');
  if (atk.length && !picked.some((c) => c.family === 'attack' || c.family === 'attackEvolution')) {
    picked[picked.length - 1] = rng.weighted(atk, (x) => x.w);
  }
  for (const fb of FALLBACKS) if (picked.length < n) picked.push(fb);
  return picked;
}
