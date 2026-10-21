import { BALANCE } from '../config/balance';
import type { ElementType } from '../data/types';

// ============================================================================
// Sprites pixel art de los ataques: formas (llama, gota, burbuja, hoja,
// rayo…) generadas por código a resolución de arte y coloreadas con la paleta
// del tipo. Basado en PokéSurvivor (js/entities/vfx.js). Required Notice:
// Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)
// ============================================================================

/** Paletas por tipo: contorno, oscuro, medio, claro, brillo. */
export const PAL: Record<string, string[]> = {
  fire: ['#6b1200', '#b8300a', '#ff6a1f', '#ffb22e', '#fff2a0'],
  water: ['#0f2f78', '#1f56c4', '#3d8bff', '#8ccaff', '#eaf7ff'],
  grass: ['#14400f', '#24721e', '#45b23c', '#97e36c', '#eaffd0'],
  electric: ['#6b4300', '#c48a00', '#ffd21a', '#fff36a', '#ffffff'],
  psychic: ['#5e0a3a', '#b0246e', '#ff4f9a', '#ff9fcf', '#ffe8f3'],
  ice: ['#134a60', '#2f8aa8', '#62d2ea', '#bff3ff', '#ffffff'],
  fighting: ['#561208', '#9a2a16', '#e04a2e', '#ff9c6c', '#ffe2cc'],
  poison: ['#2e0a3c', '#5e1f7e', '#a043d0', '#d995f2', '#f7e2ff'],
  ground: ['#3a250c', '#6e4c1e', '#aa7c3c', '#dcb66c', '#f6e6b8'],
  flying: ['#283c66', '#5672b0', '#93b2ff', '#d2e2ff', '#ffffff'],
  bug: ['#2e3a06', '#5b7414', '#90b82a', '#cbe86c', '#f4ffd2'],
  rock: ['#2e2418', '#5a4a34', '#8e7a5a', '#c6b08a', '#f0e4c6'],
  ghost: ['#160e2c', '#33256a', '#5c48aa', '#9e8aea', '#e8deff'],
  dragon: ['#160a50', '#2e1ea0', '#5a3cff', '#a490ff', '#e8e2ff'],
  dark: ['#0e0a0c', '#2a2026', '#463840', '#7c6a74', '#d4c4cc'],
  steel: ['#232d38', '#56667a', '#8c9caf', '#cad6e2', '#ffffff'],
  fairy: ['#6a2050', '#b04a8a', '#ff8acb', '#ffc4e6', '#ffffff'],
  normal: ['#3e3834', '#7a7068', '#c4bcb0', '#ece6dc', '#ffffff'],
  enemy: ['#4a0a1e', '#a02248', '#ff5a7e', '#ffa8bc', '#ffffff'],
};
const IDX: Record<string, number> = { o: 0, d: 1, m: 2, l: 3, w: 4 };

class Grid {
  g: (string | null)[][];
  constructor(public w: number, public h: number) {
    this.g = Array.from({ length: h }, () => Array<string | null>(w).fill(null));
  }
  set(x: number, y: number, c: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = c;
  }
  get(x: number, y: number): string | null {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.g[y][x] : null;
  }
  fill(fn: (x: number, y: number) => string | null): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = fn(x, y);
      if (c) this.g[y][x] = c;
    }
  }
  /** Contorno de 1 px alrededor de lo opaco, como en los sprites de PMD. */
  outline(): void {
    const marks: [number, number][] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.g[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const c = this.get(x + a, y + b); return c && c !== 'o'; })) marks.push([x, y]);
    }
    for (const [x, y] of marks) this.g[y][x] = 'o';
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string, side?: string): void {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      if (side) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!this.get(Math.round(x + a), Math.round(y + b))) this.set(x + a, y + b, side);
      this.set(x, y, c);
    }
  }
  arc(cx: number, cy: number, r: number, a0: number, a1: number, c: string): void {
    const n = Math.ceil(r * Math.abs(a1 - a0) * 2) + 2;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      this.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c);
    }
  }
}

const H = (a: number, b: number, c: number) => {
  let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

interface Shape { w: number; h: number; frames?: number; dir?: boolean; spin?: boolean; gen: (P: Grid, f: number) => void }

// Todas miran hacia la DERECHA (se rotan al dibujar si son direccionales).
const SHAPES: Record<string, Shape> = {
  fire: { w: 15, h: 11, frames: 3, dir: true, gen(P, f) {
    const cx = 10.5;
    const cy = 5;
    for (let x = 1; x <= 9; x++) {
      const t = (x - 1) / 8;
      const th = 0.5 + t * 2.6 + (H(x, f, 3) - 0.5) * 1.3;
      const yc = cy + Math.sin(x * 1.4 + f * 2.1) * 0.8 * (1 - t);
      for (let y = 0; y < P.h; y++) {
        const d = Math.abs(y - yc);
        if (d > th || (t < 0.3 && H(x, y + f * 7, 5) < 0.4)) continue;
        P.set(x, y, d < th * 0.4 && t > 0.3 ? 'l' : 'm');
      }
    }
    P.fill((x, y) => { const d = Math.hypot(x - cx, (y - cy) * 1.1); return d < 1.3 ? 'w' : d < 2.4 ? 'l' : d < 3.5 ? 'm' : null; });
    P.outline();
  } },
  drop: { w: 13, h: 9, dir: true, gen(P) {
    for (let x = 2; x <= 7; x++) {
      const th = ((x - 2) / 5) * 2.6;
      for (let y = 0; y < P.h; y++) { const d = Math.abs(y - 4); if (d <= th) P.set(x, y, d < th * 0.5 ? 'l' : 'm'); }
    }
    P.fill((x, y) => { const d = Math.hypot(x - 8.5, y - 4); return d < 1.6 ? 'l' : d < 3.3 ? 'm' : null; });
    P.set(9, 2, 'w');
    P.set(10, 3, 'w');
    P.outline();
  } },
  bubble: { w: 11, h: 11, frames: 2, gen(P, f) {
    const rx = 4.3 + f * 0.3;
    const ry = 4.3 - f * 0.3;
    P.fill((x, y) => { const e = Math.hypot((x - 5) / rx, (y - 5) / ry); return e <= 1 ? (e > 0.76 ? 'm' : 'L') : null; });
    P.set(3, 3, 'w');
    P.set(4, 3, 'w');
    P.set(3, 4, 'w');
    P.outline();
  } },
  leaf: { w: 12, h: 7, spin: true, gen(P) {
    P.fill((x, y) => { const dx = Math.abs(x - 5.5) / 5.6; const dy = (y - 3) / 2.7; return dx + dy * dy <= 1 ? (y < 3 ? 'l' : 'm') : null; });
    for (let x = 2; x <= 9; x++) P.set(x, 3, 'd');
    P.set(4, 2, 'w');
    P.outline();
  } },
  bolt: { w: 15, h: 10, frames: 2, dir: true, gen(P, f) {
    const pts = f ? [[0, 3], [4, 7], [7, 2], [10, 7], [14, 4]] : [[0, 6], [4, 2], [7, 7], [10, 2], [14, 5]];
    for (let i = 0; i < pts.length - 1; i++) P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 'w', 'l');
    P.outline();
  } },
  shard: { w: 13, h: 7, dir: true, gen(P) {
    P.fill((x, y) => (Math.abs(x - 6) / 6.2 + Math.abs(y - 3) / 3.4 <= 1 ? (y < 3 ? 'l' : 'm') : null));
    for (let x = 6; x <= 11; x++) P.set(x, 3, 'w');
    P.outline();
  } },
  rock: { w: 12, h: 11, frames: 3, spin: true, gen(P, f) {
    const r = [0, 1, 2, 3, 4, 5, 6].map((i) => 3.6 + H(i, f, 9) * 1.4);
    P.fill((x, y) => {
      const dx = x - 5.5;
      const dy = y - 5;
      const a = ((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 6;
      const i = Math.floor(a);
      const t = a - i;
      const R = r[i] * (1 - t) + r[(i + 1) % 6] * t;
      const d = Math.hypot(dx, dy);
      if (d > R) return null;
      const lit = (-dx * 0.6 - dy * 0.8) / R;
      return lit > 0.35 ? 'l' : lit > -0.3 ? 'm' : 'd';
    });
    P.set(4, 3, 'w');
    P.outline();
  } },
  blob: { w: 12, h: 11, frames: 2, gen(P, f) {
    P.fill((x, y) => {
      const dx = x - 5.5;
      const dy = y - 4.8;
      const R = 3.9 + Math.sin(Math.atan2(dy, dx) * 3 + f * 2) * 0.5;
      const d = Math.hypot(dx, dy);
      if (d > R) return null;
      const lit = (-dx * 0.6 - dy * 0.8) / R;
      return lit > 0.4 ? 'l' : lit > -0.35 ? 'm' : 'd';
    });
    P.set(4, 3, 'w');
    P.set(6, 9, 'm');
    P.outline();
  } },
  needle: { w: 13, h: 5, dir: true, gen(P) {
    for (let x = 1; x <= 9; x++) P.set(x, 2, 'm');
    for (let x = 3; x <= 8; x++) P.set(x, 1, 'l');
    P.set(10, 2, 'w');
    P.set(11, 2, 'w');
    P.outline();
  } },
  star: { w: 11, h: 11, frames: 2, spin: true, gen(P, f) {
    const L = f ? 3 : 4;
    for (let i = -L; i <= L; i++) {
      P.set(5 + i, 5, Math.abs(i) === L ? 'm' : 'l');
      P.set(5, 5 + i, Math.abs(i) === L ? 'm' : 'l');
    }
    for (let i = 1; i <= (f ? 2 : 1); i++) for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) P.set(5 + a * i, 5 + b * i, 'l');
    P.set(5, 5, 'w');
  } },
  streak: { w: 15, h: 5, dir: true, gen(P) {
    for (let x = 0; x < 15; x++) P.set(x, 2, x < 4 ? 'd' : x < 8 ? 'm' : x < 12 ? 'l' : 'w');
    for (let x = 7; x <= 12; x++) { P.set(x, 1, 'l'); P.set(x, 3, 'm'); }
  } },
  wind: { w: 13, h: 11, frames: 2, spin: true, gen(P, f) {
    P.arc(6, 5, 4.6, -0.6 + f * 0.7, 2.9 + f * 0.7, 'l');
    P.arc(6, 5, 3.6, -0.3 + f * 0.7, 2.2 + f * 0.7, 'w');
    P.arc(6, 5, 2.2, 1.8 + f, 4.6 + f, 'l');
  } },
  ring: { w: 13, h: 13, frames: 2, gen(P, f) {
    P.fill((x, y) => {
      const d = Math.hypot(x - 6, y - 6);
      if (Math.abs(d - (5 + f * 0.6)) < 0.75) return 'm';
      if (Math.abs(d - (3 + f * 0.5)) < 0.7) return 'l';
      return null;
    });
    P.set(6, 6, 'w');
  } },
  crescent: { w: 12, h: 11, dir: true, gen(P) {
    P.fill((x, y) => {
      const a = Math.hypot(x - 6.5, y - 5);
      const b = Math.hypot(x - 3.8, y - 5);
      if (a > 4.8 || b < 4.2) return null;
      return b < 5.1 ? 'l' : 'm';
    });
    P.outline();
  } },
  note: { w: 11, h: 11, dir: true, gen(P) {
    P.arc(1, 5, 2.2, -0.7, 0.7, 'w');
    P.arc(1, 5, 4.6, -0.6, 0.6, 'l');
    P.arc(1, 5, 7.2, -0.5, 0.5, 'm');
  } },
  ball: { w: 11, h: 11, frames: 2, gen(P, f) {
    P.fill((x, y) => { const d = Math.hypot(x - 5, y - 5); return d < 1.5 ? 'w' : d < 2.9 ? 'l' : d < 4.2 + f * 0.3 ? 'm' : null; });
    P.outline();
  } },
  shadow: { w: 13, h: 13, frames: 3, gen(P, f) {
    P.fill((x, y) => { const d = Math.hypot(x - 6, y - 6); return d < 1.6 ? 'l' : d < 3 ? 'm' : d < 4.4 ? 'd' : null; });
    for (let k = 0; k < 6; k++) {
      const a = k * 1.05 + f * 0.7;
      const r = 4.8 + H(k, f, 4) * 1.4;
      P.set(6 + Math.cos(a) * r, 6 + Math.sin(a) * r, 'm');
    }
    P.set(5, 5, 'w');
    P.outline();
  } },
  heart: { w: 9, h: 8, gen(P) {
    ['.ll...ll.', 'lwll.llll', 'lllllllll', 'lllllllll', '.lllllll.', '..lllll..', '...lll...', '....l....']
      .forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') P.set(x, y, c === 'w' ? 'w' : 'l'); }));
    P.outline();
  } },
  impact: { w: 15, h: 15, frames: 2, gen(P, f) {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + (f ? Math.PI / 8 : 0);
      const L = (k % 2 ? 3.5 : 6) * (f ? 1 : 0.75);
      P.line(7, 7, 7 + Math.cos(a) * L, 7 + Math.sin(a) * L, 'l');
    }
    P.fill((x, y) => (Math.hypot(x - 7, y - 7) < 1.8 ? 'w' : null));
  } },
};

/** Forma del proyectil de cada movimiento (y forma por defecto de cada tipo). */
const MOVE_SHAPE: Record<string, string> = {
  'quick-attack': 'streak', ember: 'fire', 'heat-wave': 'fire', 'fire-spin': 'fire', flamethrower: 'fire',
  'water-gun': 'drop', bubble: 'bubble', 'razor-leaf': 'leaf', 'leaf-storm': 'leaf', 'thunder-shock': 'bolt',
  confusion: 'ring', psychic: 'ring', sludge: 'blob', 'poison-sting': 'needle', 'mud-shot': 'blob', gust: 'wind',
  'hyper-voice': 'note', 'string-shot': 'star', 'rock-throw': 'rock', 'rock-slide': 'rock', 'aura-sphere': 'ball',
  'shadow-ball': 'shadow', 'fairy-wind': 'star', 'dark-pulse': 'crescent', bonemerang: 'crescent', 'psycho-cut': 'crescent',
  spikes: 'star', 'toxic-spikes': 'star', hail: 'shard', 'meteor-mash': 'rock', 'will-o-wisp': 'ball', substitute: 'star',
  'aerial-ace': 'wind', 'flame-wheel': 'fire', 'bubble-beam': 'bubble', hex: 'shadow', 'flame-charge': 'fire',
  whirlpool: 'drop', 'seed-bomb': 'leaf', 'energy-ball': 'ball', 'thunder-wave': 'bolt', 'electro-ball': 'bolt',
  extrasensory: 'ring', 'mist-ball': 'ring', 'acid-spray': 'blob', 'sand-tomb': 'rock', magnitude: 'rock',
  whirlwind: 'wind', 'air-slash': 'crescent', 'signal-beam': 'star', 'u-turn': 'needle', 'rock-tomb': 'rock',
  'ancient-power': 'rock', 'power-gem': 'shard', 'ice-shard': 'shard', 'freeze-dry': 'shard', 'vacuum-wave': 'ring',
  'shadow-sneak': 'shadow', 'ominous-wind': 'shadow', 'dragon-breath': 'fire', 'draining-kiss': 'heart',
  'disarming-voice': 'note', 'mirror-shot': 'shard', 'sucker-punch': 'crescent',
};
const TYPE_SHAPE: Partial<Record<ElementType, string>> = {
  fire: 'fire', water: 'drop', grass: 'leaf', electric: 'bolt', psychic: 'ring', ice: 'shard', fighting: 'ball',
  poison: 'blob', ground: 'blob', flying: 'wind', bug: 'needle', rock: 'rock', ghost: 'shadow', dragon: 'fire',
  dark: 'crescent', steel: 'shard', fairy: 'star', normal: 'star',
};

export function shapeFor(moveId: string | null, type: ElementType): string {
  return (moveId && MOVE_SHAPE[moveId]) || TYPE_SHAPE[type] || 'ball';
}

const cache = new Map<string, HTMLCanvasElement>();

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function sprite(shape: string, pal: string, frame: number): HTMLCanvasElement {
  const S = SHAPES[shape] ?? SHAPES.ball;
  const f = Math.floor(frame) % (S.frames ?? 1);
  const k = `${shape}|${pal}|${f}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const P = new Grid(S.w, S.h);
  S.gen(P, f);
  const cv = document.createElement('canvas');
  cv.width = S.w;
  cv.height = S.h;
  const c = cv.getContext('2d')!;
  const colors = PAL[pal] ?? PAL.normal;
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    const ch = P.g[y][x];
    if (!ch) continue;
    c.fillStyle = ch === 'L' ? rgba(colors[3], 0.5) : colors[IDX[ch]];
    c.fillRect(x, y, 1, 1);
  }
  cache.set(k, cv);
  return cv;
}

/** Dibuja una forma centrada en (x, y). */
export function drawShape(
  ctx: CanvasRenderingContext2D, shape: string, pal: string, x: number, y: number,
  o: { angle?: number; scale?: number; frame?: number; alpha?: number } = {},
): void {
  const S = SHAPES[shape] ?? SHAPES.ball;
  const cv = sprite(shape, pal, o.frame ?? 0);
  const k = BALANCE.ps.spritePx * (o.scale ?? 1);
  ctx.save();
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= o.alpha;
  ctx.translate(x, y);
  let a = 0;
  if (S.dir) a = o.angle ?? 0;
  else if (S.spin) a = o.angle ?? 0;
  if (a) ctx.rotate(Math.round(a / (Math.PI / 8)) * (Math.PI / 8));
  ctx.drawImage(cv, (-S.w * k) / 2, (-S.h * k) / 2, S.w * k, S.h * k);
  ctx.restore();
}

export const isDirectional = (shape: string) => !!SHAPES[shape]?.dir;
export const spins = (shape: string) => !!SHAPES[shape]?.spin;
export const frameCount = (shape: string) => SHAPES[shape]?.frames ?? 1;
