import type { RoomKind } from '../game/rooms';

// ============================================================================
// Obstáculos de las salas (estilo Archero). Coordenadas del mundo: la arena
// mide 360 × 600, entras abajo en el centro (180, 530) y la salida está arriba
// en el centro. Diseños PROVISIONALES.
//
// - rock: no se puede pasar y para todos los proyectiles.
// - water: no se puede pasar, pero los proyectiles cruzan por encima. Los
//   voladores y fantasmas (Levitación) lo cruzan.
// ============================================================================

export type ObstacleKind = 'rock' | 'water';

export interface Obstacle { kind: ObstacleKind; x: number; y: number; w: number; h: number }

export interface LayoutDef {
  id: string;
  name: string;
  /** Primera sala en la que puede salir. */
  minRoom: number;
  obstacles: Obstacle[];
}

const R = (x: number, y: number, w: number, h: number): Obstacle => ({ kind: 'rock', x, y, w, h });
const W = (x: number, y: number, w: number, h: number): Obstacle => ({ kind: 'water', x, y, w, h });

export const LAYOUTS: LayoutDef[] = [
  { id: 'columnas', name: 'Columnas', minRoom: 2, obstacles: [R(70, 170, 50, 50), R(240, 170, 50, 50), R(70, 360, 50, 50), R(240, 360, 50, 50)] },
  { id: 'rio', name: 'Río', minRoom: 4, obstacles: [W(14, 280, 110, 60), W(170, 280, 30, 60), W(240, 280, 106, 60)] },
  { id: 'pasillo', name: 'Pasillo', minRoom: 6, obstacles: [R(14, 250, 120, 36), R(226, 250, 120, 36), R(60, 420, 40, 40), R(260, 420, 40, 40)] },
  { id: 'charcas', name: 'Charcas', minRoom: 8, obstacles: [W(14, 130, 90, 140), W(256, 330, 90, 140), R(170, 230, 40, 40), R(150, 420, 40, 40)] },
  { id: 'cruz', name: 'Cruz', minRoom: 12, obstacles: [R(160, 220, 40, 140), R(100, 270, 160, 40)] },
  { id: 'zigzag', name: 'Zigzag', minRoom: 25, obstacles: [R(14, 170, 170, 30), R(176, 320, 170, 30), W(110, 440, 140, 36)] },
  { id: 'lagos', name: 'Lagos', minRoom: 30, obstacles: [W(60, 140, 80, 80), W(220, 140, 80, 80), W(140, 300, 80, 70), R(40, 400, 36, 36), R(284, 400, 36, 36)] },
];

/** Sala de jefe: casi abierta. */
export const BOSS_LAYOUT: LayoutDef = { id: 'jefe', name: 'Arena del jefe', minRoom: 0, obstacles: [R(40, 120, 40, 40), R(280, 120, 40, 40)] };

export const OPEN_LAYOUT: LayoutDef = { id: 'abierta', name: 'Abierta', minRoom: 0, obstacles: [] };

/** Diseño de una sala: abierta la primera, de jefe en las de jefe y uno al azar en el resto. */
export function layoutFor(room: number, kind: RoomKind, pick: () => number, width = 360): Obstacle[] {
  if (kind !== 'normal') return mirror(BOSS_LAYOUT.obstacles, false, width);
  const pool = LAYOUTS.filter((l) => l.minRoom <= room);
  if (room <= 1 || !pool.length) return [];
  // La primera sala de cada tramo (1, 11, 21…) es abierta para respirar.
  if (room % 10 === 1) return [];
  const l = pool[Math.floor(pick() * pool.length) % pool.length];
  return mirror(l.obstacles, pick() < 0.5, width);
}

function mirror(list: Obstacle[], flip: boolean, width: number): Obstacle[] {
  return list.map((o) => (flip ? { ...o, x: width - o.x - o.w } : { ...o }));
}
