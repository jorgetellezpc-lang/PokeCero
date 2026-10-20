import { BALANCE } from '../config/balance';
import { ATTACK_MAX_LEVEL, getAttack } from '../data/attacks';
import { RUN_STAT_UPGRADES, type RunStatId } from '../data/runUpgrades';
import type { ElementType, PokemonSpecies } from '../data/types';
import type { Rng } from './rng';

// Generador de las tres cartas de mejora. Es independiente de la interfaz:
// recibe el estado relevante del jugador y devuelve descripciones de mejoras
// que la partida (World) sabe aplicar.

export type UpgradeFamily = 'newAttack' | 'attackUpgrade' | 'stat' | 'fallback';

export type UpgradeAction =
  | { type: 'newAttack'; attackId: string }
  | { type: 'attackUpgrade'; attackId: string; toLevel: number }
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
  /** Línea con valores numéricos (p. ej. "Nv 2 → 3"). */
  detail: string;
  /** Tipo elemental para colorear la carta (si aplica). */
  element?: ElementType;
}

export interface UpgradeContext {
  species: PokemonSpecies;
  /** Ataques que posee el jugador con su nivel actual. */
  attacks: Record<string, number>;
  statStacks: Partial<Record<RunStatId, number>>;
}

export function candidateUpgrades(ctx: UpgradeContext): UpgradeChoice[] {
  const out: UpgradeChoice[] = [];
  const owned = Object.keys(ctx.attacks);

  if (owned.length < BALANCE.upgrades.maxAttacks) {
    for (const id of ctx.species.learnset) {
      if (ctx.attacks[id] !== undefined) continue;
      const a = getAttack(id);
      out.push({
        key: `new:${id}`, family: 'newAttack', action: { type: 'newAttack', attackId: id },
        title: a.name, category: 'Nuevo ataque', description: a.description,
        detail: `Daño ${a.base.damage}${a.kind === 'orbit' ? '' : ` · cada ${a.base.cooldown}s`}`,
        element: a.type,
      });
    }
  }

  for (const id of owned) {
    const a = getAttack(id);
    const lv = ctx.attacks[id];
    if (lv >= ATTACK_MAX_LEVEL(a)) continue;
    const mod = a.levels[lv - 1];
    out.push({
      key: `up:${id}`, family: 'attackUpgrade', action: { type: 'attackUpgrade', attackId: id, toLevel: lv + 1 },
      title: a.name, category: 'Mejora de ataque', description: mod.desc,
      detail: `Nv ${lv} → ${lv + 1}`, element: a.type,
    });
  }

  for (const s of Object.values(RUN_STAT_UPGRADES)) {
    const stacks = ctx.statStacks[s.id] ?? 0;
    if (stacks >= s.maxStacks) continue;
    out.push({
      key: `stat:${s.id}`, family: 'stat', action: { type: 'stat', stat: s.id },
      title: s.name, category: 'Estadística',
      description: s.effect.replace('{v}', s.format(s.amount)),
      detail: `${stacks} / ${s.maxStacks}`,
    });
  }
  return out;
}

const FALLBACKS: UpgradeChoice[] = [
  {
    key: 'fb:heal', family: 'fallback', action: { type: 'heal', amount: BALANCE.upgrades.fallbackHeal },
    title: 'Baya Aranja', category: 'Curación',
    description: `Recupera el ${Math.round(BALANCE.upgrades.fallbackHeal * 100)}% de la vida máxima`, detail: '',
  },
  {
    key: 'fb:gold', family: 'fallback', action: { type: 'gold', amount: BALANCE.upgrades.fallbackGold },
    title: 'Pepita', category: 'Oro', description: `+${BALANCE.upgrades.fallbackGold} de oro al terminar la partida`, detail: '',
  },
  {
    key: 'fb:gold2', family: 'fallback', action: { type: 'gold', amount: BALANCE.upgrades.fallbackGold * 2 },
    title: 'Maxipepita', category: 'Oro', description: `+${BALANCE.upgrades.fallbackGold * 2} de oro al terminar la partida`, detail: '',
  },
];

/**
 * Devuelve exactamente `BALANCE.upgrades.choices` (3) cartas distintas.
 * Primero elige familia según peso y luego una mejora de esa familia. Si no
 * hay suficientes opciones válidas se completa con cartas de reserva que
 * siempre tienen efecto.
 */
export function generateChoices(ctx: UpgradeContext, rng: Rng): UpgradeChoice[] {
  const n = BALANCE.upgrades.choices;
  const pool = candidateUpgrades(ctx);
  const weights = BALANCE.upgrades.familyWeights;
  const picked: UpgradeChoice[] = [];
  while (picked.length < n && pool.length) {
    const families = [...new Set(pool.map((c) => c.family))] as Exclude<UpgradeFamily, 'fallback'>[];
    const fam = rng.weighted(families, (f) => weights[f]);
    const inFam = pool.filter((c) => c.family === fam);
    const choice = rng.pick(inFam);
    picked.push(choice);
    pool.splice(pool.indexOf(choice), 1);
  }
  for (const fb of FALLBACKS) if (picked.length < n) picked.push(fb);
  return picked;
}
