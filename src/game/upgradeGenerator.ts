import { BALANCE } from '../config/balance';
import { categoryOf, evolutionOf, getMove, ladderOf, maxLevelOf, type NeedStat } from '../data/moves';
import { sideOf } from '../data/pokemon';
import { RUN_STAT_UPGRADES, type RunStatId } from '../data/runUpgrades';
import { TYPE_NAMES } from '../data/typeColors';
import type { ElementType } from '../data/types';
import type { Player } from './entities';
import type { Rng } from './rng';

// ============================================================================
// Las tres cartas de subida de nivel. Basado en PokéSurvivor
// (js/systems/levelup.js). Required Notice: Copyright 2026 JPTER78
// (https://github.com/JPTER78/pokesurvivor)
//
// Tipos de carta: movimiento nuevo (si quedan huecos), mejora de movimiento,
// estadística y EVOLUCIÓN de movimiento (dorada: movimiento al máximo + su
// estadística asociada cogida en la partida). Independiente de la interfaz.
// ============================================================================

export type UpgradeFamily = 'newMove' | 'moveUpgrade' | 'moveEvolution' | 'stat' | 'fallback';

export type UpgradeAction =
  | { type: 'newMove'; moveId: string }
  | { type: 'moveUpgrade'; moveId: string }
  | { type: 'moveEvolution'; moveId: string }
  | { type: 'stat'; stat: RunStatId }
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
  /** Peso para el sorteo. */
  w: number;
}

const CAT_NAME = { physical: 'Físico', special: 'Especial' };

export function candidateUpgrades(p: Player, rng: Rng): UpgradeChoice[] {
  const W = BALANCE.upgrades.weights;
  const out: UpgradeChoice[] = [];
  const owned = new Set(p.moves.map((m) => m.def.id));
  const full = p.moves.length >= BALANCE.upgrades.maxAttacks;

  // --- movimientos nuevos (6 candidatos; los de su lado fuerte, el doble) ---
  if (!full) {
    const buffs = p.moves.filter((m) => m.def.kind === 'buff').length;
    const pool = p.species.learnset.filter((id) => !owned.has(id) && !(buffs >= BALANCE.upgrades.maxBuffs && getMove(id).kind === 'buff'));
    const side = sideOf(p.species);
    const fit = (id: string) => {
      const cat = categoryOf(getMove(id));
      return !cat || cat === side ? 2 : 1;
    };
    const rest = [...pool];
    for (let i = 0; i < 6 && rest.length; i++) {
      const id = rng.weighted(rest, fit);
      rest.splice(rest.indexOf(id), 1);
      const d = getMove(id);
      const cat = categoryOf(d);
      out.push({
        key: `new:${id}`, family: 'newMove', action: { type: 'newMove', moveId: id }, w: W.newMove,
        title: d.name, category: `Nuevo · ${TYPE_NAMES[d.type]}${cat ? ` · ${CAT_NAME[cat]}` : ''}`,
        description: d.desc, detail: cat && cat !== side ? `Pega mejor con ataques ${side === 'special' ? 'especiales' : 'físicos'}` : '',
        element: d.type,
      });
    }
  }

  // --- evoluciones listas (y estadísticas que las desbloquean) ---
  const waiting: Partial<Record<NeedStat, string>> = {};
  for (const m of p.moves) {
    if (m.evolved || m.level < maxLevelOf(m.def)) continue;
    const evo = evolutionOf(m.def.id);
    if (!evo) continue;
    if (!p.statsTaken[evo.needs]) {
      waiting[evo.needs] = m.name;
      continue;
    }
    out.push({
      key: `evo:${m.def.id}`, family: 'moveEvolution', action: { type: 'moveEvolution', moveId: m.def.id }, w: W.evolution,
      title: `${m.name} → ${evo.name}`, category: 'EVOLUCIÓN', description: evo.text, detail: '', element: m.def.type,
    });
  }

  // --- mejoras de movimientos que ya tienes ---
  for (const m of p.moves) {
    if (m.level >= maxLevelOf(m.def)) continue;
    out.push({
      key: `up:${m.def.id}`, family: 'moveUpgrade', action: { type: 'moveUpgrade', moveId: m.def.id }, w: W.moveUpgrade,
      title: m.name, category: `Mejora · Nv ${m.level} → ${m.level + 1}`, description: ladderOf(m.def)[m.level - 1].t,
      detail: '', element: m.def.type,
    });
  }

  // --- estadísticas (5 al azar con hueco + las que piden una evolución) ---
  const room = (id: RunStatId) => {
    const max = RUN_STAT_UPGRADES[id].max;
    return !max || (p.statsTaken[id] ?? 0) < max;
  };
  const ids = (Object.keys(RUN_STAT_UPGRADES) as RunStatId[]).filter((id) => room(id) && !waiting[id as NeedStat]);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const statIds = ids.slice(0, 5).concat((Object.keys(waiting) as NeedStat[]).filter((id) => room(id)));
  for (const id of statIds) {
    const s = RUN_STAT_UPGRADES[id];
    const evoFor = waiting[id as NeedStat];
    out.push({
      key: `stat:${id}`, family: 'stat', action: { type: 'stat', stat: id },
      w: evoFor ? W.statForEvolution : full ? W.statFull : W.stat,
      title: s.name, category: evoFor ? `Evoluciona ${evoFor}` : 'Mejora', description: s.description,
      detail: s.max ? `${p.statsTaken[id] ?? 0} / ${s.max}` : '',
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

/** Exactamente `BALANCE.upgrades.choices` (3) cartas distintas, por peso. La evolución lista sale siempre. */
export function generateChoices(p: Player, rng: Rng): UpgradeChoice[] {
  const n = BALANCE.upgrades.choices;
  const pool = candidateUpgrades(p, rng);
  const picked: UpgradeChoice[] = [];
  const evo = pool.findIndex((c) => c.family === 'moveEvolution');
  if (evo >= 0) picked.push(pool.splice(evo, 1)[0]);
  while (picked.length < n && pool.length) {
    const c = rng.weighted(pool, (x) => x.w);
    pool.splice(pool.indexOf(c), 1);
    if (!picked.some((x) => x.key === c.key)) picked.push(c);
  }
  for (const fb of FALLBACKS) if (picked.length < n) picked.push(fb);
  return picked;
}
