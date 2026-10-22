// Tipos compartidos de datos del juego. Todo el contenido (Pokémon, enemigos,
// ataques, gimnasios) se define como datos que cumplen estas interfaces, para
// no duplicar lógica por especie.

export type ElementType =
  | 'normal' | 'fire' | 'water' | 'grass' | 'electric' | 'rock' | 'ground'
  | 'poison' | 'flying' | 'bug' | 'psychic' | 'fighting' | 'ice' | 'ghost'
  | 'dragon' | 'dark' | 'steel' | 'fairy';

export interface GymDef {
  id: string;
  order: number;
  city: string;
  leader: string;
  type: ElementType;
  badge: string;
  /** Si el gimnasio tiene contenido jugable. */
  playable: boolean;
  /** Enemigos de oleadas normales (ids). */
  enemyPool: string[];
  /** Jefes por sala: { 20: id, 40: id, 50: id }. PROVISIONAL. */
  bosses: Record<number, string>;
  /** Posición en el mapa de la región (0..1). */
  mapPos: { x: number; y: number };
  theme: { grass: string; grassDark: string; path: string; rock: string };
  /** Arenas ilustradas (data/arenas.ts): salas normales y de jefe. */
  arenas?: { normal: string; boss: string };
}

export interface RegionDef {
  id: string;
  name: string;
  gyms: GymDef[];
  /** Región que hay que completar para desbloquear esta. */
  requires?: string;
  playable: boolean;
}
