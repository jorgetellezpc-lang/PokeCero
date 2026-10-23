import type { Obstacle } from './layouts';
import type { GymDef } from './types';

// ============================================================================
// Aventura por Kanto (primera versión jugable): pueblos que se recorren a pie,
// sin combate, y rutas de combate estilo Archero entre ellos.
//
//   Pueblo Paleta → Ruta 1 → Ciudad Verde → Ruta 2 → Ciudad Plateada (Brock)
//
// Todo son datos: la sala del pueblo (360 × 840, la salida al norte), sus
// edificios, carteles, puertas y Pokémon con los que hablar, y las rutas
// (salas, salvajes y el más fuerte de la última sala). Diseños PROVISIONALES
// hasta tener ilustraciones de cada pueblo.
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

export interface TownDef {
  id: string;
  name: string;
  kind: 'town';
  /** Gimnasio del pueblo, si tiene. */
  gym?: string;
  /** Dónde apareces. */
  start: { x: number; y: number };
  obstacles: Obstacle[];
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

const house = (x: number, y: number, w: number, h: number, wall: string, roof: string): Obstacle => ({ kind: 'house', x, y, w, h, wall, roof });
const water = (x: number, y: number, w: number, h: number): Obstacle => ({ kind: 'water', x, y, w, h });
const theme = (grass: string, grassDark: string, path: string, rock: string) => ({ grass, grassDark, path, rock });

export const TOWNS: Record<string, TownDef> = {
  paleta: {
    id: 'paleta', name: 'Pueblo Paleta', kind: 'town', start: { x: 180, y: 640 },
    blurb: 'Un pueblo tranquilo junto al mar. Aquí empieza tu aventura.',
    theme: theme('#6cb85a', '#4f9a42', '#d8c08a', '#8c8478'),
    obstacles: [
      house(40, 360, 110, 90, '#f4ead8', '#d0503c'),
      house(210, 360, 110, 90, '#f4ead8', '#3c78d0'),
      house(100, 520, 160, 90, '#e8eef4', '#5a6a80'),
      water(30, 760, 300, 60),
    ],
    npcs: [{ dex: 16, x: 110, y: 230, dir: 4 }, { dex: 1, x: 300, y: 590, dir: 6 }],
    spots: [
      { kind: 'exit', x: 180, y: 46, label: 'Ir a la Ruta 1', title: 'Ruta 1', route: 'ruta1', lines: ['Al norte está la Ruta 1, camino de Ciudad Verde. Hay Pokémon salvajes en la hierba.'] },
      { kind: 'sign', x: 180, y: 300, label: 'Leer', title: 'Cartel', lines: ['PUEBLO PALETA', 'Donde empiezan todos los sueños.'] },
      { kind: 'talk', x: 95, y: 462, label: 'Llamar', title: 'Casa de tu familia', lines: ['—¡Ten mucho cuidado ahí fuera!', '—Y vuelve cuando quieras, aquí siempre hay sitio para ti.'] },
      { kind: 'talk', x: 265, y: 462, label: 'Llamar', title: 'Casa de tu rival', lines: ['No contesta nadie. Tu rival ya ha salido hacia Ciudad Verde…'] },
      { kind: 'talk', x: 180, y: 622, label: 'Entrar', title: 'Laboratorio Pokémon', lines: ['—¡Hola! Tu Pokémon y tú hacéis buen equipo.', '—Sigue la Ruta 1 hacia el norte. En Ciudad Plateada te espera Brock, el primer líder de gimnasio.'] },
      { kind: 'talk', x: 110, y: 262, label: 'Hablar', title: 'Pidgey', dex: 16, lines: ['¡Pidgey! ¡Pid-pidgey!', '(Parece que te anima a seguir hacia el norte.)'] },
      { kind: 'talk', x: 300, y: 620, label: 'Hablar', title: 'Bulbasaur', dex: 1, lines: ['¡Bulba, bulbasaur!', '(Es uno de los Pokémon del laboratorio.)'] },
    ],
  },
  verde: {
    id: 'verde', name: 'Ciudad Verde', kind: 'town', gym: 'giovanni', start: { x: 180, y: 760 },
    blurb: 'Una ciudad entre árboles. Su gimnasio lleva tiempo cerrado.',
    theme: theme('#62b052', '#468e3a', '#d0b880', '#8a8478'),
    obstacles: [
      house(30, 300, 120, 100, '#f4e2e2', '#e05a5a'),
      house(210, 300, 120, 100, '#e2ecf8', '#3c7ad8'),
      house(90, 520, 180, 120, '#d8d0c0', '#5a5040'),
    ],
    npcs: [{ dex: 113, x: 60, y: 430, dir: 0 }, { dex: 32, x: 300, y: 700, dir: 6 }],
    spots: [
      { kind: 'exit', x: 180, y: 46, label: 'Ir a la Ruta 2', title: 'Ruta 2', route: 'ruta2', lines: ['Al norte, la Ruta 2 cruza el bosque hasta Ciudad Plateada.'] },
      { kind: 'center', x: 90, y: 412, label: 'Entrar al Centro', title: 'Centro Pokémon', dex: 113, lines: ['—¡Bienvenido al Centro Pokémon!', '—Tu Pokémon está en plena forma. ¡Buena suerte en la ruta!'] },
      { kind: 'shop', x: 270, y: 412, label: 'Entrar a la tienda', title: 'Tienda · Entrenamiento' },
      { kind: 'gym', x: 180, y: 652, label: 'Mirar la puerta', title: 'Gimnasio de Ciudad Verde', gym: 'giovanni', lines: ['La puerta está cerrada con llave.', 'Un cartel dice: «El líder está de viaje».'] },
      { kind: 'sign', x: 180, y: 470, label: 'Leer', title: 'Cartel', lines: ['CIUDAD VERDE', 'Siempre verde, siempre tranquila.'] },
      { kind: 'talk', x: 60, y: 462, label: 'Hablar', title: 'Chansey', dex: 113, lines: ['¡Chansey!', '(Te sonríe desde la puerta del Centro.)'] },
      { kind: 'talk', x: 300, y: 732, label: 'Hablar', title: 'Nidoran♂', dex: 32, lines: ['¡Nido!', '(Parece que vive cerca de la ciudad.)'] },
    ],
  },
  plateada: {
    id: 'plateada', name: 'Ciudad Plateada', kind: 'town', gym: 'brock', start: { x: 180, y: 760 },
    blurb: 'Una ciudad en lo alto de la montaña, con un gimnasio de gran tradición.',
    theme: theme('#8aa868', '#6c8a50', '#c8b890', '#8c8478'),
    obstacles: [
      house(80, 220, 200, 140, '#b8b0a0', '#6a6050'),
      house(30, 540, 120, 100, '#f4e2e2', '#e05a5a'),
      house(210, 540, 120, 100, '#e2ecf8', '#3c7ad8'),
    ],
    npcs: [{ dex: 74, x: 300, y: 400, dir: 6 }, { dex: 113, x: 60, y: 670, dir: 0 }],
    spots: [
      { kind: 'gym', x: 180, y: 372, label: 'Entrar al gimnasio', title: 'Gimnasio de Ciudad Plateada', gym: 'brock' },
      { kind: 'center', x: 90, y: 652, label: 'Entrar al Centro', title: 'Centro Pokémon', dex: 113, lines: ['—¡Bienvenido al Centro Pokémon!', '—Brock usa Pokémon de tipo Roca. El Agua y la Planta les hacen mucho daño.'] },
      { kind: 'shop', x: 270, y: 652, label: 'Entrar a la tienda', title: 'Tienda · Entrenamiento' },
      { kind: 'sign', x: 180, y: 440, label: 'Leer', title: 'Cartel', lines: ['CIUDAD PLATEADA', 'Gris como la piedra de sus montañas.'] },
      { kind: 'talk', x: 300, y: 432, label: 'Hablar', title: 'Geodude', dex: 74, lines: ['¡Geo, geodude!', '(Parece que entrena para el gimnasio.)'] },
      { kind: 'exit', x: 180, y: 46, label: 'Mirar el camino', title: 'Ruta 3', lines: ['El camino hacia la Ruta 3 está cortado por ahora. ¡Próximamente!'] },
    ],
  },
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
