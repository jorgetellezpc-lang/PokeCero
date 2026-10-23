import { ADVENTURE, ROUTES, TOWNS, routeFrom, type TownDef } from '../data/adventure';
import type { SaveStore } from './save';

// Progreso de la aventura: a qué pueblos has llegado y dónde estás. Los
// pueblos se abren al llegar a ellos por su ruta (en el orden de ADVENTURE).

/** Visitado (en modo admin, todos los pueblos cuentan como visitados). */
export const isVisited = (store: SaveStore, townId: string) => !!store.data.admin || store.data.adventure.visited.includes(townId);

/** Se puede entrar a un pueblo si ya has llegado a él. */
export const canEnterTown = (store: SaveStore, townId: string) => !!TOWNS[townId] && isVisited(store, townId);

/** Llegas a un pueblo (al ganar su ruta o al entrar desde el mapa). */
export function arriveAt(store: SaveStore, townId: string): void {
  if (!TOWNS[townId]) return;
  store.update((d) => {
    if (!d.adventure.visited.includes(townId)) d.adventure.visited.push(townId);
    d.adventure.at = townId;
  });
}

/** Cómo se llega a un pueblo que aún no has visitado (texto para el mapa). */
export function howToReach(townId: string): string {
  const route = Object.values(ROUTES).find((r) => r.to === townId);
  if (!route) return 'Aún no se puede visitar. ¡Próximamente!';
  return `Llega por la ${route.name} desde ${TOWNS[route.from].name}.`;
}

/** Siguiente pueblo de la aventura desde uno dado (por su ruta). */
export function nextTown(townId: string): TownDef | undefined {
  const r = routeFrom(townId);
  return r ? TOWNS[r.to] : undefined;
}

/** Pueblos de la aventura, en orden. */
export const adventureTowns = () => ADVENTURE.filter((id) => TOWNS[id]).map((id) => TOWNS[id]);
