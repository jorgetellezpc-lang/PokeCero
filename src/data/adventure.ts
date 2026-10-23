import type { BuildingStyle, Obstacle } from './layouts';
import type { GymDef } from './types';

// ============================================================================
// Aventura por Kanto (primera versión jugable): pueblos que se recorren a pie,
// sin combate, y rutas de combate estilo Archero entre ellos.
//
//   Pueblo Paleta → Ruta 1 → Ciudad Verde → Ruta 2 → Ciudad Plateada (Brock)
//
// Todo son datos: el pueblo (720 × 2520, la salida al norte), su suelo, sus
// edificios, árboles, vallas y decorado, los carteles, puertas y Pokémon con
// los que hablar, y las rutas (salas, salvajes y el más fuerte de la última
// sala). El pixel art de los pueblos se genera a partir de estos datos
// (render/townArt.ts). Diseños PROVISIONALES.
// ============================================================================

export type SpotKind = 'talk' | 'sign' | 'shop' | 'center' | 'gym' | 'exit';

/** Algo con lo que interactuar al acercarse. */
export interface Spot {
  kind: SpotKind;
  x: number;
  y: number;
  /** Texto del botón (p. ej. «Hablar», «Entrar a la tienda»). */
  label: string;
  /** Quién habla o qué es (título del diálogo). */
  title: string;
  /** Diálogo (carteles, personajes, puertas cerradas). */
  lines?: string[];
  /** Gimnasio al que lleva (kind 'gym'). */
  gym?: string;
  /** Ruta a la que lleva (kind 'exit'). */
  route?: string;
  /** Retrato (nº de Pokédex) para el diálogo. */
  dex?: number;
}

/** Pokémon que está en el pueblo (se dibuja con su sprite y no se le puede atravesar). */
export interface TownNpc { dex: number; x: number; y: number; dir?: number }

/** Suelo pintado: caminos de tierra, plazas empedradas y arena. */
export interface Ground { kind: 'path' | 'plaza' | 'sand'; x: number; y: number; w: number; h: number }

/**
 * Decorado. Las áreas (flores, hierba alta, puentes) se pintan en el suelo;
 * los objetos (farolas, carteles, buzones…) se dibujan de pie y no se atraviesan.
 */
export interface Decor {
  kind: 'flowers' | 'tallgrass' | 'bridge' | 'lamp' | 'sign' | 'signpost' | 'mailbox' | 'barrel' | 'crate' | 'well' | 'bush';
  x: number; y: number; w?: number; h?: number;
}

export interface TownDef {
  id: string;
  name: string;
  kind: 'town';
  /** Tamaño del pueblo (las salas de combate miden 360 × 840). */
  W: number;
  H: number;
  /** Gimnasio del pueblo, si tiene. */
  gym?: string;
  /** Dónde apareces. */
  start: { x: number; y: number };
  /** Todo lo que no se atraviesa: edificios, árboles, vallas, agua, rocas y los objetos del decorado. */
  obstacles: Obstacle[];
  ground: Ground[];
  decor: Decor[];
  npcs: TownNpc[];
  spots: Spot[];
  /** Colores del suelo (reutiliza el tema de las salas). */
  theme: GymDef['theme'];
  blurb: string;
}

export interface RouteDef {
  id: string;
  name: string;
  kind: 'route';
  from: string;
  to: string;
  rooms: number;
  /** Salvajes de la ruta (nº de Pokédex). */
  wild: number[];
  /** El más fuerte, en la última sala. */
  strong: number;
  theme: GymDef['theme'];
}

export type PlaceDef = TownDef | RouteDef;

const TW = 720;
const TH = 2520;

const house = (x: number, y: number, w: number, h: number, wall: string, roof: string): Obstacle => ({ kind: 'house', style: 'house', x, y, w, h, wall, roof });
const building = (style: BuildingStyle, x: number, y: number, w: number, h: number, wall: string, roof: string): Obstacle => ({ kind: 'house', style, x, y, w, h, wall, roof });
const water = (x: number, y: number, w: number, h: number): Obstacle => ({ kind: 'water', x, y, w, h });
const trees = (x: number, y: number, w: number, h: number): Obstacle => ({ kind: 'tree', x, y, w, h });
const fence = (x: number, y: number, w: number, h: number): Obstacle => ({ kind: 'fence', x, y, w, h });
const rock = (x: number, y: number, w: number, h: number): Obstacle => ({ kind: 'rock', x, y, w, h });
const path = (x: number, y: number, w: number, h: number): Ground => ({ kind: 'path', x, y, w, h });
const plaza = (x: number, y: number, w: number, h: number): Ground => ({ kind: 'plaza', x, y, w, h });
const d = (kind: Decor['kind'], x: number, y: number, w?: number, h?: number): Decor => ({ kind, x, y, w, h });
const theme = (grass: string, grassDark: string, pathC: string, rockC: string) => ({ grass, grassDark, path: pathC, rock: rockC });

/** Bosque en los bordes del pueblo, con un hueco para el camino al norte (y al sur, si se entra por ahí). */
function forest(south: boolean, bottom = TH): Obstacle[] {
  const gap = [300, 420];
  const o = [trees(0, 0, 60, bottom), trees(TW - 60, 0, 60, bottom), trees(60, 0, gap[0] - 60, 70), trees(gap[1], 0, TW - 60 - gap[1], 70)];
  if (south) o.push(trees(60, TH - 70, gap[0] - 60, 70), trees(gap[1], TH - 70, TW - 60 - gap[1], 70));
  return o;
}

/** Hueco que ocupa cada objeto del decorado (lo que no se atraviesa). */
const PROP_BOX: Partial<Record<Decor['kind'], [number, number]>> = {
  lamp: [8, 5], sign: [22, 6], signpost: [8, 6], mailbox: [10, 6], barrel: [14, 8], crate: [16, 8], well: [30, 14], bush: [22, 10],
};

/** Quita los puentes del agua (se cruzan andando). */
function cutBridges(obstacles: Obstacle[], decor: Decor[]): Obstacle[] {
  let out = obstacles;
  for (const b of decor.filter((x) => x.kind === 'bridge')) {
    const bw = b.w ?? 0;
    const bh = b.h ?? 0;
    out = out.flatMap((o) => {
      if (o.kind !== 'water' || b.x >= o.x + o.w || b.x + bw <= o.x || b.y >= o.y + o.h || b.y + bh <= o.y) return [o];
      const parts: Obstacle[] = [];
      if (b.x > o.x) parts.push({ ...o, w: b.x - o.x });
      if (b.x + bw < o.x + o.w) parts.push({ ...o, x: b.x + bw, w: o.x + o.w - b.x - bw });
      if (b.y > o.y) parts.push({ ...o, x: Math.max(o.x, b.x), w: Math.min(o.x + o.w, b.x + bw) - Math.max(o.x, b.x), h: b.y - o.y });
      if (b.y + bh < o.y + o.h) parts.push({ ...o, x: Math.max(o.x, b.x), y: b.y + bh, w: Math.min(o.x + o.w, b.x + bw) - Math.max(o.x, b.x), h: o.y + o.h - b.y - bh });
      return parts.filter((p) => p.w > 0 && p.h > 0);
    });
  }
  return out;
}

type TownSpec = Omit<TownDef, 'kind' | 'W' | 'H'>;

/** Completa un pueblo: un cartel de madera en cada punto «Leer» y los huecos del decorado. */
function town(spec: TownSpec): TownDef {
  const decor = [...spec.decor];
  for (const s of spec.spots) if (s.kind === 'sign') decor.push(d('sign', s.x, s.y - 20));
  const props: Obstacle[] = [];
  for (const dc of decor) {
    const box = PROP_BOX[dc.kind];
    if (box) props.push({ kind: 'prop', x: dc.x - box[0] / 2, y: dc.y - box[1], w: box[0], h: box[1] });
  }
  return { ...spec, kind: 'town', W: TW, H: TH, decor, obstacles: [...cutBridges(spec.obstacles, decor), ...props] };
}

const CENTER_LINES = (tip: string) => ['—¡Bienvenido al Centro Pokémon!', tip];

export const TOWNS: Record<string, TownDef> = {
  paleta: town({
    id: 'paleta', name: 'Pueblo Paleta', start: { x: 360, y: 2200 },
    blurb: 'Un pueblo tranquilo junto al mar. Aquí empieza tu aventura.',
    theme: theme('#6cb85a', '#4f9a42', '#d8c08a', '#8c8478'),
    ground: [
      path(325, 0, 70, 2250), path(150, 1316, 420, 44), path(395, 1876, 150, 44),
      { kind: 'sand', x: 0, y: 2236, w: TW, h: 100 },
    ],
    obstacles: [
      ...forest(false, 2300),
      water(0, 2326, TW, TH - 2326),
      water(470, 560, 160, 150),
      house(110, 1170, 170, 140, '#f2e6d0', '#d0503c'),
      house(440, 1170, 170, 140, '#e8eef4', '#3c78d0'),
      building('lab', 400, 1680, 240, 180, '#eef2f6', '#6a7a90'),
      fence(90, 1700, 200, 6), fence(90, 1860, 200, 6), fence(90, 1700, 6, 166), fence(284, 1700, 6, 166),
      trees(70, 400, 120, 90), trees(70, 800, 140, 110), trees(530, 880, 110, 120), trees(70, 1460, 100, 100),
      trees(560, 1450, 80, 120), trees(70, 2000, 150, 100), trees(470, 2000, 170, 80),
      rock(452, 690, 26, 22), rock(620, 548, 24, 22), rock(200, 960, 28, 22), rock(560, 1040, 24, 20),
      trees(200, 240, 90, 70), trees(450, 250, 110, 80), trees(230, 1560, 60, 50), trees(450, 1530, 60, 50),
    ],
    decor: [
      d('tallgrass', 80, 110, 200, 100), d('tallgrass', 450, 120, 190, 90), d('tallgrass', 100, 1712, 180, 142),
      d('flowers', 200, 520, 90, 60), d('flowers', 560, 770, 80, 50), d('flowers', 90, 1000, 80, 50), d('flowers', 220, 1090, 70, 40),
      d('flowers', 470, 1100, 90, 40), d('flowers', 130, 1600, 90, 50), d('flowers', 470, 2110, 120, 50), d('flowers', 90, 2150, 100, 50),
      d('lamp', 305, 420), d('lamp', 415, 820), d('lamp', 305, 1220), d('lamp', 415, 1620), d('lamp', 305, 2020),
      d('signpost', 420, 112), d('mailbox', 300, 1316), d('mailbox', 424, 1316),
      d('barrel', 630, 1300), d('crate', 96, 1300), d('well', 200, 1500), d('bush', 600, 1170), d('bush', 90, 1150),
      d('bush', 120, 620), d('bush', 150, 640), d('bush', 560, 420), d('bush', 590, 440), d('bush', 250, 1010), d('bush', 470, 980),
      d('bush', 620, 1650), d('bush', 250, 2110), d('bush', 560, 2160), d('bush', 280, 1640), d('bush', 460, 1600),
    ],
    npcs: [{ dex: 16, x: 230, y: 700, dir: 4 }, { dex: 1, x: 600, y: 1930, dir: 6 }],
    spots: [
      { kind: 'exit', x: 360, y: 80, label: 'Ir a la Ruta 1', title: 'Ruta 1', route: 'ruta1', lines: ['Al norte está la Ruta 1, camino de Ciudad Verde. Hay Pokémon salvajes en la hierba.'] },
      { kind: 'sign', x: 420, y: 2184, label: 'Leer', title: 'Cartel', lines: ['PUEBLO PALETA', 'Donde empiezan todos los sueños.'] },
      { kind: 'talk', x: 195, y: 1334, label: 'Llamar', title: 'Casa de tu familia', lines: ['—¡Ten mucho cuidado ahí fuera!', '—Y vuelve cuando quieras, aquí siempre hay sitio para ti.'] },
      { kind: 'talk', x: 525, y: 1334, label: 'Llamar', title: 'Casa de tu rival', lines: ['No contesta nadie. Tu rival ya ha salido hacia Ciudad Verde…'] },
      { kind: 'talk', x: 520, y: 1884, label: 'Entrar', title: 'Laboratorio Pokémon', lines: ['—¡Hola! Tu Pokémon y tú hacéis buen equipo.', '—Sigue la Ruta 1 hacia el norte. En Ciudad Plateada te espera Brock, el primer líder de gimnasio.'] },
      { kind: 'talk', x: 230, y: 736, label: 'Hablar', title: 'Pidgey', dex: 16, lines: ['¡Pidgey! ¡Pid-pidgey!', '(Parece que te anima a seguir hacia el norte.)'] },
      { kind: 'talk', x: 600, y: 1966, label: 'Hablar', title: 'Bulbasaur', dex: 1, lines: ['¡Bulba, bulbasaur!', '(Es uno de los Pokémon del laboratorio.)'] },
    ],
  }),
  verde: town({
    id: 'verde', name: 'Ciudad Verde', gym: 'giovanni', start: { x: 360, y: 2420 },
    blurb: 'Una ciudad entre árboles. Su gimnasio lleva tiempo cerrado.',
    theme: theme('#62b052', '#468e3a', '#d0b880', '#8a8478'),
    ground: [
      path(325, 1100, 70, 1420), plaza(190, 1100, 340, 60), path(120, 380, 70, 780), path(120, 380, 270, 60), path(325, 0, 70, 440),
      path(130, 1458, 460, 44), plaza(90, 1866, 540, 74),
    ],
    obstacles: [
      ...forest(true),
      water(450, 380, 190, 190),
      building('gym', 210, 900, 300, 200, '#c8c0b0', '#4f8a46'),
      house(110, 1310, 170, 130, '#f4e6d4', '#e08a3c'),
      house(440, 1310, 170, 130, '#eef2e4', '#4f9a52'),
      building('center', 100, 1700, 190, 150, '#f6f2ec', '#e0483c'),
      building('mart', 430, 1710, 170, 140, '#f2f4f8', '#3c74d0'),
      fence(440, 590, 210, 6),
      trees(420, 690, 220, 140), trees(200, 480, 110, 130), trees(560, 1520, 90, 150), trees(70, 1500, 40, 160),
      trees(70, 1960, 200, 120), trees(450, 1960, 200, 120), trees(70, 2200, 180, 180), trees(470, 2200, 180, 180),
    ],
    decor: [
      d('tallgrass', 430, 110, 200, 100), d('tallgrass', 70, 110, 220, 110),
      d('flowers', 210, 660, 90, 60), d('flowers', 70, 1180, 220, 60), d('flowers', 440, 1180, 200, 60), d('flowers', 240, 1560, 120, 50),
      d('flowers', 410, 1580, 120, 50), d('flowers', 280, 2120, 40, 200),
      d('lamp', 305, 1300), d('lamp', 415, 1600), d('lamp', 305, 2000), d('lamp', 415, 2300), d('lamp', 205, 700), d('lamp', 420, 300),
      d('mailbox', 300, 1458), d('mailbox', 424, 1458), d('bush', 90, 1290), d('bush', 630, 1290), d('barrel', 620, 1860), d('crate', 640, 1880),
      d('signpost', 440, 2410), d('bush', 230, 560), d('bush', 230, 1040), d('bush', 480, 1040), d('bush', 250, 1250), d('bush', 470, 1250),
      d('bush', 260, 2150), d('bush', 460, 2160), d('well', 220, 1620),
    ],
    npcs: [{ dex: 113, x: 310, y: 1800, dir: 0 }, { dex: 32, x: 560, y: 616, dir: 6 }],
    spots: [
      { kind: 'exit', x: 360, y: 80, label: 'Ir a la Ruta 2', title: 'Ruta 2', route: 'ruta2', lines: ['Al norte, la Ruta 2 cruza el bosque hasta Ciudad Plateada.'] },
      { kind: 'center', x: 195, y: 1872, label: 'Entrar al Centro', title: 'Centro Pokémon', dex: 113, lines: CENTER_LINES('—Tu Pokémon está en plena forma. ¡Buena suerte en la ruta!') },
      { kind: 'shop', x: 515, y: 1872, label: 'Entrar a la tienda', title: 'Tienda · Entrenamiento' },
      { kind: 'gym', x: 360, y: 1124, label: 'Mirar la puerta', title: 'Gimnasio de Ciudad Verde', gym: 'giovanni', lines: ['La puerta está cerrada con llave.', 'Un cartel dice: «El líder está de viaje».'] },
      { kind: 'sign', x: 420, y: 2384, label: 'Leer', title: 'Cartel', lines: ['CIUDAD VERDE', 'Siempre verde, siempre tranquila.'] },
      { kind: 'talk', x: 195, y: 1464, label: 'Llamar', title: 'Casa', lines: ['—Dicen que el líder del gimnasio es un hombre muy poderoso… y muy misterioso.'] },
      { kind: 'talk', x: 525, y: 1464, label: 'Llamar', title: 'Casa', lines: ['—En la Ruta 2 hay Caterpie y Weedle. ¡Cuidado con los Beedrill!'] },
      { kind: 'talk', x: 310, y: 1834, label: 'Hablar', title: 'Chansey', dex: 113, lines: ['¡Chansey!', '(Te sonríe desde la puerta del Centro.)'] },
      { kind: 'talk', x: 560, y: 652, label: 'Hablar', title: 'Nidoran♂', dex: 32, lines: ['¡Nido!', '(Parece que vive junto al estanque.)'] },
    ],
  }),
  plateada: town({
    id: 'plateada', name: 'Ciudad Plateada', gym: 'brock', start: { x: 360, y: 2420 },
    blurb: 'Una ciudad en lo alto de la montaña, con un gimnasio de gran tradición.',
    theme: theme('#8aa868', '#6c8a50', '#c8b890', '#8c8478'),
    ground: [
      path(325, 940, 70, 1580), plaza(180, 940, 360, 64), path(110, 300, 70, 700), path(110, 300, 285, 60), path(325, 0, 70, 360),
      path(130, 1356, 460, 44), plaza(80, 1766, 560, 74),
    ],
    obstacles: [
      ...forest(true),
      building('gym', 180, 700, 360, 240, '#a8a090', '#5a5248'),
      house(100, 1220, 160, 130, '#ece2d0', '#a0603c'),
      house(460, 1220, 160, 130, '#e2e6ea', '#5a6a8a'),
      building('center', 90, 1610, 190, 150, '#f6f2ec', '#e0483c'),
      building('mart', 450, 1620, 170, 140, '#f2f4f8', '#3c74d0'),
      rock(220, 420, 40, 32), rock(500, 380, 50, 40), rock(560, 520, 40, 34), rock(230, 570, 44, 36), rock(470, 1080, 40, 32),
      rock(200, 1090, 40, 30), rock(600, 1480, 36, 30), rock(90, 1500, 36, 30), rock(420, 200, 60, 44), rock(150, 160, 50, 40),
      trees(70, 1900, 180, 180), trees(470, 1900, 180, 180), trees(70, 2200, 200, 180), trees(450, 2200, 200, 180), trees(600, 300, 60, 380),
    ],
    decor: [
      d('flowers', 200, 1170, 80, 40), d('flowers', 440, 1170, 80, 40), d('flowers', 250, 1480, 100, 50), d('flowers', 400, 1500, 110, 50),
      d('lamp', 305, 1100), d('lamp', 415, 1400), d('lamp', 415, 1700), d('lamp', 415, 2000), d('lamp', 305, 2300), d('lamp', 200, 640),
      d('mailbox', 290, 1356), d('mailbox', 430, 1356), d('barrel', 620, 1760), d('crate', 100, 1880), d('bush', 560, 960), d('bush', 160, 960),
      d('signpost', 440, 2410), d('bush', 250, 1150), d('bush', 470, 1150), d('bush', 250, 1560), d('bush', 470, 1560), d('bush', 270, 2120),
      d('bush', 450, 2120),
    ],
    npcs: [{ dex: 74, x: 590, y: 1000, dir: 6 }, { dex: 113, x: 300, y: 1700, dir: 0 }],
    spots: [
      { kind: 'gym', x: 360, y: 966, label: 'Entrar al gimnasio', title: 'Gimnasio de Ciudad Plateada', gym: 'brock' },
      { kind: 'center', x: 185, y: 1782, label: 'Entrar al Centro', title: 'Centro Pokémon', dex: 113, lines: CENTER_LINES('—Brock usa Pokémon de tipo Roca. El Agua y la Planta les hacen mucho daño.') },
      { kind: 'shop', x: 535, y: 1782, label: 'Entrar a la tienda', title: 'Tienda · Entrenamiento' },
      { kind: 'sign', x: 420, y: 2384, label: 'Leer', title: 'Cartel', lines: ['CIUDAD PLATEADA', 'Gris como la piedra de sus montañas.'] },
      { kind: 'talk', x: 180, y: 1374, label: 'Llamar', title: 'Casa', lines: ['—Brock entrena cada día. ¡Dicen que su Onix es enorme!'] },
      { kind: 'talk', x: 540, y: 1374, label: 'Llamar', title: 'Casa', lines: ['—El museo de la ciudad está cerrado por obras. ¡Próximamente!'] },
      { kind: 'talk', x: 590, y: 1034, label: 'Hablar', title: 'Geodude', dex: 74, lines: ['¡Geo, geodude!', '(Parece que entrena para el gimnasio.)'] },
      { kind: 'talk', x: 300, y: 1734, label: 'Hablar', title: 'Chansey', dex: 113, lines: ['¡Chansey!', '(Te sonríe desde la puerta del Centro.)'] },
      { kind: 'exit', x: 360, y: 80, label: 'Mirar el camino', title: 'Ruta 3', lines: ['El camino hacia la Ruta 3 está cortado por ahora. ¡Próximamente!'] },
    ],
  }),
};

export const ROUTES: Record<string, RouteDef> = {
  ruta1: {
    id: 'ruta1', name: 'Ruta 1', kind: 'route', from: 'paleta', to: 'verde', rooms: 5,
    wild: [16, 19], strong: 17, theme: theme('#6cb85a', '#4f9a42', '#c8a868', '#8c8478'),
  },
  ruta2: {
    id: 'ruta2', name: 'Ruta 2', kind: 'route', from: 'verde', to: 'plateada', rooms: 5,
    wild: [10, 13, 16, 19], strong: 15, theme: theme('#4c9a44', '#367a32', '#b8a070', '#7a7468'),
  },
};

/** Orden de la aventura. */
export const ADVENTURE = ['paleta', 'ruta1', 'verde', 'ruta2', 'plateada'];

export function placeDef(id: string): PlaceDef {
  const p = TOWNS[id] ?? ROUTES[id];
  if (!p) throw new Error(`Lugar desconocido: ${id}`);
  return p;
}

/** Ruta que sale de un pueblo hacia el siguiente, si hay. */
export function routeFrom(townId: string): RouteDef | undefined {
  return Object.values(ROUTES).find((r) => r.from === townId);
}

/** Gimnasio de mentira para que World dibuje la sala con los colores del lugar. */
export function placeGym(p: PlaceDef): GymDef {
  return {
    id: p.id, order: 0, city: p.name, leader: '', type: 'normal', badge: '', playable: true,
    enemyPool: [], bosses: {}, mapPos: { x: 0.5, y: 0.5 }, theme: p.theme,
  };
}
