import { ABILITIES } from '../data/abilities';
import { getSpecies, PLAYABLE_POKEMON } from '../data/pokemon';
import { RUN_STAT_UPGRADES } from '../data/runUpgrades';
import { ATTACK_UPGRADE } from '../data/signatures';
import type { UpgradeAction } from '../game/upgradeGenerator';
import { formAtLevel, levelFactor, START_LEVEL } from '../game/levels';
import type { Progress, World } from '../game/world';
import type { OwnedPokemon, SaveStore } from './save';

// Tus Pokémon: el inicial único (test de compatibilidad) y los que captures.
// Cada uno tiene su nivel, su experiencia y sus cartas permanentes.

export const hasStarter = (store: SaveStore) => store.data.owned.length > 0;

export const ownedOf = (store: SaveStore, line: string): OwnedPokemon | undefined => store.data.owned.find((o) => o.line === line);

/** El Pokémon con el que juegas ahora. */
export function active(store: SaveStore): OwnedPokemon | undefined {
  return ownedOf(store, store.data.selectedPokemon) ?? store.data.owned[0];
}

/** Iniciales que aún no tienes (se capturan en el laboratorio). */
export const missingStarters = (store: SaveStore) => PLAYABLE_POKEMON.filter((l) => !ownedOf(store, l));

export const progressOf = (o: OwnedPokemon): Progress => ({ level: o.level, xp: o.xp, cards: [...o.cards] });

/** Elegir el inicial (tras el test): empieza en el nivel 5, sin cartas. */
export function chooseStarter(store: SaveStore, line: string): void {
  store.update((d) => {
    d.owned = [{ line, species: formAtLevel(line, START_LEVEL).id, level: START_LEVEL, xp: 0, cards: [] }];
    d.unlockedPokemon = [line];
    d.selectedPokemon = line;
  });
}

/** Añadir un Pokémon capturado. */
export function addOwned(store: SaveStore, mon: OwnedPokemon): void {
  store.update((d) => {
    if (d.owned.some((o) => o.line === mon.line)) return;
    d.owned.push(mon);
    d.unlockedPokemon = d.owned.map((o) => o.line);
  });
}

export function selectOwned(store: SaveStore, line: string): void {
  if (!ownedOf(store, line)) return;
  store.update((d) => { d.selectedPokemon = line; });
}

/** Al superar una ruta o un gimnasio: se guardan el nivel, la experiencia, la forma y las cartas. */
export function commitRun(store: SaveStore, line: string, w: World): void {
  const p = w.player;
  store.update((d) => {
    const o = d.owned.find((x) => x.line === line);
    if (!o) return;
    o.species = p.species.id;
    o.level = p.level;
    o.xp = p.xp;
    o.cards = [...p.cards];
  });
}

/** Vida y velocidad reales de tu Pokémon (nivel y cartas), para la ficha. */
export function statsOf(o: OwnedPokemon): { hp: number; speed: number } {
  const sp = getSpecies(o.species);
  const n = (stat: string) => o.cards.filter((c) => c.type === 'stat' && c.stat === stat).length;
  return {
    hp: Math.round(sp.stats.hp * levelFactor(o.level) * Math.pow(1.06, n('hp'))),
    speed: Math.round(sp.stats.speed * Math.pow(1.03, n('spd'))),
  };
}

/** Nombre y grupo de una carta permanente (para la lista de mejoras). */
export function cardLabel(c: UpgradeAction): { group: 'Ataque' | 'Estadística' | 'Habilidad'; name: string; text: string } {
  switch (c.type) {
    case 'attack': return { group: 'Ataque', name: ATTACK_UPGRADE[c.upgradeId]?.name ?? c.upgradeId, text: 'Mejora del ataque característico.' };
    case 'attackEvolution': return { group: 'Ataque', name: 'Evolución del ataque', text: 'El ataque característico evolucionó.' };
    case 'stat': return { group: 'Estadística', name: RUN_STAT_UPGRADES[c.stat].name, text: RUN_STAT_UPGRADES[c.stat].description };
    case 'ability': return { group: 'Habilidad', name: ABILITIES[c.abilityId]?.name ?? c.abilityId, text: ABILITIES[c.abilityId]?.description ?? '' };
    default: return { group: 'Estadística', name: '', text: '' };
  }
}
