import { BALANCE } from '../config/balance';
import { TOWNS, placeGym } from '../data/adventure';
import { bossPhase as ph, megaBossDef, type BossDef, type BossSignature } from '../data/enemies';
import { getSpecies } from '../data/pokemon';
import { formAtLevel, START_LEVEL, xpToNext } from '../game/levels';
import { World } from '../game/world';
import type { OwnedPokemon, SaveStore } from './save';

// ============================================================================
// Captura de los otros iniciales: reto 1v1 contra un «mega jefe» muy difícil,
// desde el laboratorio de Pueblo Paleta. Abierto desde el principio; cada
// intento cuesta tickets. Su nivel y su evolución se adaptan a los tuyos.
// Al ganar se une a tu equipo con un nivel como el tuyo.
// ============================================================================

export const CAPTURE_COST = BALANCE.capture.cost;

/** Golpes del reto según el tipo (reutilizan los ataques de jefe; nombres del tipo). */
const MOVES: Record<string, { names: [string, string]; moves: [BossSignature[], BossSignature[]] }> = {
  fire: { names: ['Rueda Fuego', 'Lanzallamas'], moves: [['rollout'], ['rollout', 'storm']] },
  water: { names: ['Surf', 'Hidrobomba'], moves: [['quake'], ['quake', 'slide']] },
  grass: { names: ['Látigo Cepa', 'Hojas Navaja'], moves: [['slide'], ['slide', 'tomb']] },
  electric: { names: ['Placaje Eléctrico', 'Trueno'], moves: [['rollout'], ['rollout', 'quake']] },
};

/** El reto: el inicial en la forma de su nivel, con fuerza según tu nivel. */
export function captureBoss(line: string, playerLevel: number): BossDef {
  const lv = playerLevel + BALANCE.levels.enemyOffset.mega;
  const sp = formAtLevel(line, lv);
  const set = MOVES[getSpecies(line).types[0]] ?? MOVES.fire;
  const tier = Math.floor(playerLevel / BALANCE.capture.levelsPerTier);
  return megaBossDef(sp.dex, tier, [
    ph(1, sp.name, [], 0),
    ph(0.66, `¡${sp.name} usa ${set.names[0]}!`, set.moves[0], 0.5, 1.15),
    ph(0.33, `¡${sp.name} usa ${set.names[1]}!`, set.moves[1], 0.65, 1.3),
  ]);
}

export function canAffordCapture(store: SaveStore): boolean {
  return store.data.tickets >= CAPTURE_COST;
}

/** Cobra el intento. Devuelve false si no hay tickets. */
export function payCapture(store: SaveStore): boolean {
  if (!canAffordCapture(store)) return false;
  store.update((d) => { d.tickets -= CAPTURE_COST; });
  return true;
}

/**
 * El Pokémon capturado: con tu nivel, su forma a ese nivel y las cartas que
 * habría elegido subiendo desde el nivel 5 (elegidas por la casa).
 */
export function capturedMon(line: string, level: number, seed = Date.now()): OwnedPokemon {
  const w = new World({ speciesId: formAtLevel(line, START_LEVEL).id, gym: placeGym(TOWNS.paleta), rooms: [1], town: TOWNS.paleta, seed });
  const p = w.player;
  while (p.level < level) {
    w.addXp(xpToNext(p.level) - p.xp + 0.001);
    w.takeLevelUps(() => 0);
  }
  return { line, species: p.species.id, level: p.level, xp: 0, cards: [...p.cards] };
}
