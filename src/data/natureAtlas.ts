// Naturaleza de los pueblos (public/ui/nature.webp), a 2 píxeles por unidad del mundo:
// [x, y, ancho, alto, pies] — «pies» es la altura (desde arriba) donde el objeto toca el suelo.
// Sacado de los sprites del usuario: árboles (roble, pino), 30 arbustos y, de sus hojas de
// bloques, matas de hierba alta y montones de rocas. Se les quitó el lateral de la losa
// isométrica y se fundió su base con el suelo.
export const NATURE_ATLAS = {
  b1: [310, 265, 60, 42, 34],
  b2: [822, 189, 60, 43, 34],
  b3: [372, 265, 60, 42, 34],
  b4: [620, 265, 60, 41, 33],
  b5: [884, 189, 60, 43, 34],
  b6: [946, 189, 60, 43, 34],
  b7: [446, 189, 60, 48, 38],
  b8: [434, 265, 60, 42, 34],
  b9: [0, 265, 60, 43, 34],
  b10: [682, 265, 60, 41, 33],
  b11: [62, 265, 60, 43, 34],
  b12: [698, 189, 60, 44, 35],
  b13: [744, 265, 60, 41, 33],
  b14: [124, 265, 60, 43, 34],
  b15: [570, 189, 60, 45, 36],
  b16: [508, 189, 60, 47, 38],
  b17: [930, 265, 60, 40, 32],
  b18: [760, 189, 60, 44, 35],
  b19: [0, 310, 56, 40, 32],
  b20: [496, 265, 60, 42, 34],
  b21: [186, 265, 60, 43, 34],
  b22: [364, 189, 80, 58, 46],
  b23: [0, 189, 96, 74, 59],
  b24: [248, 265, 60, 43, 34],
  b25: [58, 310, 60, 40, 32],
  b26: [806, 265, 60, 41, 33],
  b27: [868, 265, 60, 41, 33],
  b28: [120, 310, 60, 38, 30],
  b29: [558, 265, 60, 42, 34],
  b30: [632, 189, 64, 45, 36],
  oak: [106, 0, 144, 165, 148],
  oak2: [346, 0, 132, 152, 137],
  pine: [0, 0, 104, 187, 172],
  pine2: [252, 0, 92, 165, 152],
  rock0: [98, 189, 100, 73, 58],
  rock1: [786, 0, 100, 78, 62],
  rock2: [888, 0, 100, 77, 62],
  rock3: [480, 0, 100, 80, 64],
  rock4: [582, 0, 100, 79, 63],
  rock5: [684, 0, 100, 79, 63],
  tall0: [200, 189, 80, 60, 43],
  tall1: [282, 189, 80, 59, 42],
} as const;

export type NatureSprite = keyof typeof NATURE_ATLAS;
/** Píxeles del atlas por unidad del mundo. */
export const NATURE_PX = 2;
/** Tamaño del atlas. */
export const NATURE_W = 1024;
export const NATURE_H = 350;
