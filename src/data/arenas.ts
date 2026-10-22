import type { Obstacle } from './layouts';

// ============================================================================
// Arenas ilustradas (diseño del usuario): la ilustración es el suelo de la
// sala y las colisiones están calcadas encima. Coordenadas en píxeles de la
// ilustración (941 × 1672); `ox`, `oy` y `s` la colocan en el mundo: el ancho
// de la sala (360) va de x = ox a x = ox + 360 / s, y su borde de arriba
// (la salida) está en y = oy.
//
// Cada roca: [x0, y0, x1, y1, arriba] = su base (choca) y hasta dónde llega
// el dibujo por arriba (para taparte cuando pasas por detrás).
// ============================================================================

export interface ArenaDef {
  id: string;
  image: string;
  /** La misma ilustración con transparencia fuera de las rocas. */
  occluder: string;
  imgW: number;
  imgH: number;
  ox: number;
  oy: number;
  /** Unidades de mundo por píxel de la ilustración. */
  s: number;
  /** Alto de la sala en el mundo. */
  H: number;
  rocks: [number, number, number, number, number][];
  /** Zonas sin suelo (muros, antorchas, esquinas) que no se ven como rocas. */
  blockers: [number, number, number, number][];
}

const NORMAL_S = 360 / 760;
const BOSS_S = 360 / 860;

export const ARENAS: Record<string, ArenaDef> = {
  'brock-normal': {
    id: 'brock-normal', image: 'arenas/arena-brock.webp', occluder: 'arenas/arena-brock-occ.webp',
    imgW: 941, imgH: 1672, ox: 90, oy: 230, s: NORMAL_S, H: Math.round((1205 - 230) * NORMAL_S),
    rocks: [
      [335, 330, 475, 390, 285], [595, 300, 680, 345, 265], [480, 450, 620, 520, 395], [295, 580, 435, 650, 530],
      [625, 615, 725, 680, 560], [465, 685, 660, 735, 655], [130, 740, 330, 850, 680], [470, 880, 600, 955, 835],
      [650, 840, 835, 920, 795], [270, 990, 415, 1080, 905], [615, 1040, 795, 1110, 985],
      [95, 330, 170, 430, 320], [95, 490, 230, 580, 490], [760, 330, 850, 440, 330], [760, 450, 850, 590, 445],
      [820, 670, 850, 790, 660],
    ],
    blockers: [
      [90, 230, 405, 288], [555, 230, 850, 288],
      [90, 1188, 330, 1400], [630, 1188, 850, 1400], [90, 1300, 375, 1400], [558, 1300, 850, 1400],
      [90, 1040, 140, 1110], [835, 1100, 850, 1188],
      // Bordes: sin huecos entre las rocas de los lados donde esconderse.
      [90, 230, 140, 1400], [805, 230, 850, 1400],
    ],
  },
  'brock-boss': {
    id: 'brock-boss', image: 'arenas/arena-brock-boss.webp', occluder: 'arenas/arena-brock-boss-occ.webp',
    imgW: 941, imgH: 1672, ox: 40, oy: 400, s: BOSS_S, H: Math.round((1160 - 400) * BOSS_S),
    rocks: [[235, 560, 375, 620, 500], [685, 680, 810, 740, 625], [145, 860, 285, 930, 800], [595, 1000, 795, 1100, 895]],
    blockers: [
      [40, 400, 385, 465], [580, 400, 900, 465], [40, 430, 150, 560], [800, 430, 900, 560],
      [40, 1140, 355, 1400], [590, 1140, 900, 1400], [40, 1000, 130, 1140], [840, 1000, 900, 1140],
    ],
  },
};

/** Rectángulo en píxeles de la ilustración → mundo. */
export function arenaRect(a: ArenaDef, x0: number, y0: number, x1: number, y1: number): { x: number; y: number; w: number; h: number } {
  return { x: (x0 - a.ox) * a.s, y: (y0 - a.oy) * a.s, w: (x1 - x0) * a.s, h: (y1 - y0) * a.s };
}

/** Colisiones de la arena en coordenadas del mundo. */
export function arenaObstacles(a: ArenaDef): Obstacle[] {
  return [
    ...a.rocks.map(([x0, y0, x1, y1]) => ({ kind: 'rock' as const, ...arenaRect(a, x0, y0, x1, y1) })),
    ...a.blockers.map(([x0, y0, x1, y1]) => ({ kind: 'rock' as const, ...arenaRect(a, x0, y0, x1, y1) })),
  ];
}
