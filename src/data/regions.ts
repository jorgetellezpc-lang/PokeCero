import type { GymDef, RegionDef } from './types';

// Regiones y gimnasios. Solo Brock tiene contenido jugable en el prototipo; el
// resto existe como datos para el mapa y la progresión (medallas en orden).
// Añadir una región = añadir un RegionDef, sin tocar mapa ni progresión.

const theme = (grass: string, grassDark: string, path: string, rock: string) => ({ grass, grassDark, path, rock });

const lockedGym = (
  id: string, order: number, city: string, leader: string, type: GymDef['type'], badge: string,
  x: number, y: number,
): GymDef => ({
  id, order, city, leader, type, badge, playable: false, enemyPool: [], bosses: {},
  mapPos: { x, y }, theme: theme('#58a048', '#3c7c34', '#c8a868', '#8a8478'),
});

export const KANTO: RegionDef = {
  id: 'kanto',
  name: 'Kanto',
  playable: true,
  gyms: [
    {
      id: 'brock', order: 1, city: 'Ciudad Plateada', leader: 'Brock', type: 'rock', badge: 'Medalla Roca',
      playable: true,
      // Las oleadas normales sortean Pokémon de toda Kanto (data/enemies.ts).
      enemyPool: [],
      // PROVISIONAL — ejemplo del blueprint, pendiente de decisión de diseño.
      bosses: { 20: 'geodude-boss', 40: 'sudowoodo-boss', 50: 'onix-boss' },
      arenas: { normal: ['brock-normal', 'brock-2', 'brock-3'], boss: 'brock-boss' },
      mapPos: { x: 0.24, y: 0.2 },
      theme: theme('#6aa850', '#4c8838', '#c8a870', '#8c8478'),
    },
    lockedGym('misty', 2, 'Ciudad Celeste', 'Misty', 'water', 'Medalla Cascada', 0.72, 0.16),
    lockedGym('surge', 3, 'Ciudad Carmín', 'Lt. Surge', 'electric', 'Medalla Trueno', 0.7, 0.62),
    lockedGym('erika', 4, 'Ciudad Azulona', 'Erika', 'grass', 'Medalla Arcoíris', 0.4, 0.42),
    lockedGym('koga', 5, 'Ciudad Fucsia', 'Koga', 'poison', 'Medalla Alma', 0.5, 0.82),
    lockedGym('sabrina', 6, 'Ciudad Azafrán', 'Sabrina', 'psychic', 'Medalla Pantano', 0.66, 0.4),
    lockedGym('blaine', 7, 'Isla Canela', 'Blaine', 'fire', 'Medalla Volcán', 0.2, 0.9),
    lockedGym('giovanni', 8, 'Ciudad Verde', 'Giovanni', 'ground', 'Medalla Tierra', 0.18, 0.56),
  ],
};

export const JOHTO: RegionDef = { id: 'johto', name: 'Johto', requires: 'kanto', playable: false, gyms: [] };

export const REGIONS: RegionDef[] = [KANTO, JOHTO];

export function findGym(gymId: string): { region: RegionDef; gym: GymDef } {
  for (const region of REGIONS) {
    const gym = region.gyms.find((g) => g.id === gymId);
    if (gym) return { region, gym };
  }
  throw new Error(`Gimnasio desconocido: ${gymId}`);
}
