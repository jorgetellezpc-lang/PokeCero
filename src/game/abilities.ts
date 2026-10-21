import {
  ABILITIES, BASE_MODS, MULTIPLICATIVE, PASSIVES, SYNERGIES, type AbilityDef, type CombatMods, type ModEffect,
  type PassiveDef, type SynergyDef,
} from '../data/abilities';
import type { PokemonSpecies } from '../data/pokemon';
import type { Player } from './entities';

// Combina la pasiva del Pokémon, las habilidades elegidas y las sinergias
// activas en un único objeto de modificadores que consulta el combate.

export function passiveOf(species: PokemonSpecies): PassiveDef {
  return PASSIVES[species.types[0]];
}

function apply(mods: CombatMods, effect: ModEffect, times = 1): void {
  for (const [k, v] of Object.entries(effect) as [keyof CombatMods, CombatMods[keyof CombatMods]][]) {
    const key = k as keyof CombatMods;
    if (typeof v === 'boolean') (mods as unknown as Record<string, unknown>)[key] = v;
    else if (MULTIPLICATIVE.includes(key)) (mods[key] as number) *= Math.pow(v as number, times);
    else (mods[key] as number) += (v as number) * times;
  }
}

export function activeSynergies(p: Player): SynergyDef[] {
  return SYNERGIES.filter((s) =>
    s.abilities.every((id) => (p.abilities[id] ?? 0) > 0) &&
    (!s.moveTypes || p.moves.some((m) => s.moveTypes!.includes(m.def.type))));
}

/** Recalcula los modificadores del jugador. Devuelve las sinergias que se acaban de activar. */
export function recomputeMods(p: Player): SynergyDef[] {
  const mods: CombatMods = { ...BASE_MODS };
  apply(mods, passiveOf(p.species).effect);
  for (const [id, n] of Object.entries(p.abilities)) if (n > 0 && ABILITIES[id]) apply(mods, ABILITIES[id].effect, n);
  const syn = activeSynergies(p);
  for (const s of syn) apply(mods, s.effect);
  const before = new Set(p.synergies);
  p.mods = mods;
  p.synergies = syn.map((s) => s.id);
  return syn.filter((s) => !before.has(s.id));
}

/** ¿Puede salir esta habilidad en las cartas? */
export function abilityAvailable(p: Player, a: AbilityDef): boolean {
  const n = p.abilities[a.id] ?? 0;
  if (n >= a.maxStacks) return false;
  if (a.excludes?.some((id) => (p.abilities[id] ?? 0) > 0)) return false;
  const c = a.condition;
  if (!c) return true;
  if (c.kinds && !p.moves.some((m) => c.kinds!.includes(m.def.kind))) return false;
  if (c.moveTypes && !p.moves.some((m) => c.moveTypes!.includes(m.def.type))) return false;
  if (c.minLevel && p.level < c.minLevel) return false;
  return true;
}

/** Sinergias que se completarían al coger esta habilidad (para avisarlo en la carta). */
export function synergiesCompletedBy(p: Player, abilityId: string): SynergyDef[] {
  if ((p.abilities[abilityId] ?? 0) > 0) return [];
  const after = { ...p.abilities, [abilityId]: 1 };
  return SYNERGIES.filter((s) =>
    s.abilities.includes(abilityId) &&
    s.abilities.every((id) => (after[id] ?? 0) > 0) &&
    (!s.moveTypes || p.moves.some((m) => s.moveTypes!.includes(m.def.type))));
}
