import type { Decor, TownDef } from '../data/adventure';
import type { Obstacle } from '../data/layouts';

// ============================================================================
// Pixel art de los pueblos, generado a partir de los datos (data/adventure.ts).
// Vista 3/4 cenital como los Pokémon clásicos: 1 unidad del mundo = 1 píxel
// del dibujo, que luego se amplía sin suavizar.
//
//   - Suelo (un único lienzo): hierba con matas, caminos de tierra con bordes
//     irregulares, plazas empedradas, arena, agua con orilla y espuma, flores,
//     hierba alta, puentes y las sombras de lo que está de pie.
//   - Objetos de pie (lienzos pequeños): árboles, casas, vallas, rocas,
//     farolas, carteles… Se ordenan por la línea de sus pies junto a los
//     Pokémon, para que un tejado o una copa tapen a quien pasa por detrás.
// ============================================================================

type RGB = [number, number, number];

const hex = (s: string): RGB => {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c: RGB, t: number): RGB => (t >= 0 ? mix(c, [255, 255, 255], t) : mix(c, [12, 10, 24], -t));

/** Ruido determinista por píxel (0..1). */
function hash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruido suave por celdas (manchas de hierba, bordes de camino). */
function vnoise(x: number, y: number, cell: number, seed = 0): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(gx, gy, seed);
  const b = hash(gx + 1, gy, seed);
  const c = hash(gx, gy + 1, seed);
  const d = hash(gx + 1, gy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/** Pinta un rectángulo de píxeles (coordenadas enteras). */
const box = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: RGB | string) => {
  ctx.fillStyle = typeof c === 'string' ? c : css(c);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

// --- paleta --------------------------------------------------------------------

const GRASS: RGB[] = ['#275a20', '#3b822b', '#4c9733', '#5fab3c', '#84c64e'].map(hex);
const DIRT: RGB[] = ['#94653a', '#b98448', '#d29e58', '#e2b46c', '#efc985'].map(hex);
const STONE: RGB[] = ['#6f6a62', '#97918a', '#b7b1a4', '#cdc7b8', '#e2ddcf'].map(hex);
const SAND: RGB[] = ['#d2b474', '#e4ca8c', '#efd9a2', '#f7e8bf'].map(hex);
const WATER: RGB[] = ['#245fb0', '#2f74c6', '#3b89d8', '#69b2ec', '#d8f2ff'].map(hex);
const BANK: RGB[] = ['#5b3f26', '#7a5634', '#93693f'].map(hex);
const WOOD: RGB[] = ['#4a2e18', '#6e4526', '#8e5c32', '#ae7842', '#c9965a'].map(hex);
const LEAF: RGB[] = ['#1e4a1e', '#2d6626', '#3f8530', '#57a33b', '#79c04a', '#a2d968'].map(hex);
const OUTLINE: RGB = hex('#1f1b2a');
const FLOWERS: RGB[] = ['#f6f4ee', '#f08ab0', '#ffd23a', '#a98ef0', '#ea5a4a'].map(hex);
const GLASS: RGB[] = ['#f2b448', '#ffd97a', '#fff1bd'].map(hex);

// --- objetos de pie --------------------------------------------------------------

/** Algo que se dibuja de pie: imagen, dónde va y la línea de sus pies (para ordenar). */
export interface Sprite { img: HTMLCanvasElement; x: number; y: number; base: number }

const TREE_W = 44;
const TREE_H = 58;

/** Árbol frondoso con luz desde arriba a la izquierda. */
function treeSprite(variant: number): HTMLCanvasElement {
  const [c, ctx] = canvas(TREE_W, TREE_H);
  const tint = [0, 0.06, -0.08][variant % 3];
  const leaf = LEAF.map((l) => shade(l, tint));
  // Tronco
  box(ctx, 18, 38, 9, 18, WOOD[0]);
  box(ctx, 19, 38, 7, 17, WOOD[2]);
  box(ctx, 19, 38, 2, 17, WOOD[3]);
  box(ctx, 24, 40, 2, 15, WOOD[1]);
  box(ctx, 16, 54, 13, 3, WOOD[0]);
  box(ctx, 17, 54, 11, 2, WOOD[1]);
  // Copa: unión de círculos
  const blobs = variant % 2 === 0
    ? [[22, 21, 17], [11, 27, 10], [33, 27, 10], [22, 31, 12], [15, 14, 9], [29, 14, 9]]
    : [[22, 19, 15], [12, 28, 11], [32, 28, 11], [22, 33, 11], [22, 9, 9]];
  const inside = (x: number, y: number) => blobs.some(([bx, by, r]) => (x - bx) ** 2 + (y - by) ** 2 <= r * r);
  const img = ctx.getImageData(0, 0, TREE_W, TREE_H);
  for (let y = 0; y < 46; y++) {
    for (let x = 0; x < TREE_W; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const edge = !inside(x - 0.5, y + 0.5) || !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y - 0.5) || !inside(x + 0.5, y + 1.5);
      let col: RGB;
      if (edge) col = leaf[0];
      else {
        // Racimos de hojas: cada racimo con su propio brillo, y el conjunto más oscuro abajo a la derecha.
        const d = Math.hypot(x - 15, y - 10) / 34;
        const clump = vnoise(x, y, 5, variant + 7) - 0.5;
        const s = d + clump * 0.45 + (hash(x, y, variant) - 0.5) * 0.12;
        col = s < 0.28 ? leaf[5] : s < 0.45 ? leaf[4] : s < 0.62 ? leaf[3] : s < 0.8 ? leaf[2] : leaf[1];
      }
      const i = (y * TREE_W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const TREES = [0, 1, 2, 3].map((v) => (typeof document === 'undefined' ? null : treeSprite(v)));

/** Edificio en 3/4: tejado de tejas, fachada con puerta y ventanas encendidas. */
function buildingSprite(o: Obstacle): { img: HTMLCanvasElement; ox: number; oy: number } {
  const style = o.style ?? 'house';
  const OX = 6;
  const OY = 34;
  const W = o.w + OX * 2;
  const H = o.h + OY;
  const [c, ctx] = canvas(W, H);
  const wall = hex(o.wall ?? '#efe6d6');
  const roof = hex(o.roof ?? '#c84a3a');
  const wallH = Math.round(Math.min(78, o.h * (style === 'gym' ? 0.5 : 0.44)));
  const wallTop = H - wallH;
  const roofTop = 6;
  const roofBottom = wallTop + 4;

  // --- fachada ---
  const wx = OX;
  const ww = o.w;
  box(ctx, wx - 1, wallTop - 1, ww + 2, wallH + 1, OUTLINE);
  box(ctx, wx, wallTop, ww, wallH, wall);
  if (style === 'gym') {
    // Sillares de piedra
    for (let y = wallTop; y < H - 4; y += 7) {
      const off = ((y - wallTop) / 7) % 2 ? 6 : 0;
      box(ctx, wx, y, ww, 1, shade(wall, -0.25));
      for (let x = wx + off; x < wx + ww; x += 12) box(ctx, x, y, 1, 7, shade(wall, -0.2));
      for (let x = wx + off + 1; x < wx + ww; x += 12) box(ctx, x, y + 1, 10, 1, shade(wall, 0.15));
    }
  } else if (style === 'lab') {
    for (let x = wx + 10; x < wx + ww; x += 22) box(ctx, x, wallTop, 1, wallH, shade(wall, -0.12));
    box(ctx, wx, wallTop + 2, ww, 2, shade(wall, 0.4));
  } else {
    // Tablones
    for (let y = wallTop + 5; y < H - 4; y += 5) box(ctx, wx, y, ww, 1, shade(wall, -0.1));
    box(ctx, wx, wallTop + 1, ww, 1, shade(wall, 0.35));
  }
  if (style === 'center') box(ctx, wx, H - 22, ww, 14, hex('#e0483c'));
  if (style === 'mart') box(ctx, wx, H - 22, ww, 14, hex('#3c74d0'));
  // Esquinas y zócalo
  box(ctx, wx, wallTop, 3, wallH, shade(wall, -0.18));
  box(ctx, wx + ww - 3, wallTop, 3, wallH, shade(wall, -0.25));
  box(ctx, wx, H - 5, ww, 5, STONE[1]);
  box(ctx, wx, H - 5, ww, 1, STONE[3]);
  // Sombra del alero sobre la fachada
  box(ctx, wx, wallTop, ww, 4, 'rgba(20, 12, 30, 0.35)');

  // Puerta
  const cx = Math.round(wx + ww / 2);
  const glass = style === 'center' || style === 'mart' || style === 'lab';
  const dw = style === 'gym' ? 30 : glass ? 22 : 16;
  const dh = style === 'gym' ? 30 : 24;
  const dx = cx - dw / 2;
  const dy = H - 5 - dh;
  box(ctx, dx - 2, dy - 2, dw + 4, dh + 2, OUTLINE);
  if (glass) {
    box(ctx, dx, dy, dw, dh, hex('#7cc6ea'));
    box(ctx, dx, dy, dw, 3, hex('#d8f2ff'));
    box(ctx, cx - 1, dy, 2, dh, hex('#4a86b0'));
    box(ctx, dx + 3, dy + 5, 2, 10, hex('#e8faff'));
  } else {
    box(ctx, dx, dy, dw, dh, WOOD[2]);
    for (let x = dx + 3; x < dx + dw; x += 4) box(ctx, x, dy, 1, dh, WOOD[1]);
    if (style === 'gym') box(ctx, cx - 1, dy, 2, dh, WOOD[0]);
    box(ctx, dx + dw - 5, dy + dh / 2, 2, 2, hex('#ffd34a'));
  }
  // Escalón
  box(ctx, dx - 4, H - 3, dw + 8, 3, STONE[2]);
  box(ctx, dx - 4, H - 3, dw + 8, 1, STONE[4]);

  // Ventanas encendidas
  const winW = style === 'lab' ? 18 : 14;
  const winH = style === 'lab' ? 14 : 12;
  const wy = wallTop + Math.round((wallH - 5 - winH) * 0.42);
  const slots: number[] = [];
  const step = winW + 18;
  for (let x = wx + 12; x + winW <= wx + ww - 10; x += step) if (x + winW < dx - 6 || x > dx + dw + 6) slots.push(x);
  for (const x of slots) {
    box(ctx, x - 2, wy - 2, winW + 4, winH + 4, style === 'gym' ? STONE[0] : WOOD[1]);
    box(ctx, x, wy, winW, winH, GLASS[1]);
    box(ctx, x, wy, winW, 3, GLASS[2]);
    box(ctx, x, wy + winH - 3, winW, 3, GLASS[0]);
    box(ctx, x + winW / 2 - 1, wy, 2, winH, WOOD[1]);
    box(ctx, x, wy + winH / 2 - 1, winW, 2, WOOD[1]);
    if (style === 'house') {
      // Jardinera con flores
      box(ctx, x - 2, wy + winH + 2, winW + 4, 4, WOOD[1]);
      for (let k = 0; k < winW; k += 3) box(ctx, x + k, wy + winH, 2, 2, FLOWERS[(k / 3 + Math.round(x)) % FLOWERS.length]);
    }
  }

  // --- tejado a dos aguas: faldón de atrás (corto, con luz), cumbrera y faldón delantero ---
  const rx = 0;
  const rw = W;
  const rh = roofBottom - roofTop;
  const ridge = roofTop + Math.round(rh * 0.3);
  box(ctx, rx, roofTop - 1, rw, rh + 2, OUTLINE);
  // Faldón trasero
  for (let y = roofTop + 1; y < ridge; y++) {
    const t = (y - roofTop) / (ridge - roofTop);
    box(ctx, rx + 3, y, rw - 6, 1, shade(roof, 0.3 - t * 0.15));
  }
  for (let y = roofTop + 3; y < ridge - 1; y += 4) {
    const off = ((y - roofTop) / 4) % 2 ? 4 : 0;
    for (let x = rx + 4 + off; x < rx + rw - 4; x += 8) box(ctx, x, y, 1, 3, shade(roof, 0.05));
  }
  // Faldón delantero, en hileras de tejas
  const rows = Math.max(3, Math.ceil((roofBottom - ridge - 3) / 6));
  for (let r = 0; r < rows; r++) {
    const y0 = ridge + 3 + r * 6;
    if (y0 >= roofBottom) break;
    const t = r / rows;
    const base = shade(roof, 0.02 - t * 0.3);
    box(ctx, rx + 1, y0, rw - 2, Math.min(6, roofBottom - y0), base);
    box(ctx, rx + 1, y0, rw - 2, 1, shade(base, 0.22));
    box(ctx, rx + 1, y0 + 5, rw - 2, 1, shade(base, -0.28));
    const off = r % 2 ? 5 : 0;
    for (let x = rx + 1 + off; x < rx + rw - 1; x += 10) box(ctx, x, y0 + 1, 1, 4, shade(base, -0.2));
  }
  // Cumbrera
  box(ctx, rx + 1, ridge - 1, rw - 2, 4, shade(roof, -0.42));
  box(ctx, rx + 1, ridge - 1, rw - 2, 1, shade(roof, 0.35));
  // Hastiales (los lados del tejado) y alero
  box(ctx, rx + 1, roofTop, 3, rh, shade(roof, -0.2));
  box(ctx, rx + rw - 4, roofTop, 3, rh, shade(roof, -0.4));
  box(ctx, rx + 1, roofBottom - 3, rw - 2, 3, shade(roof, -0.5));

  const midY = Math.round((ridge + roofBottom) / 2) + 1;
  if (style === 'house') {
    // Chimenea
    const chx = Math.round(W * 0.72);
    box(ctx, chx - 1, roofTop - 12, 14, 16, OUTLINE);
    box(ctx, chx, roofTop - 11, 12, 15, hex('#9a5a44'));
    box(ctx, chx, roofTop - 11, 12, 3, hex('#5a3a32'));
    for (let y = roofTop - 6; y < roofTop + 4; y += 4) box(ctx, chx, y, 12, 1, hex('#7a4636'));
  } else if (style === 'center') {
    // Poké Ball en el tejado
    const r = 13;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d2 = x * x + y * y;
        if (d2 > r * r) continue;
        const col = d2 > (r - 1.5) ** 2 || Math.abs(y) <= 1 ? OUTLINE : y < 0 ? hex(x + y < -8 ? '#ff8a7a' : '#e83a32') : hex('#f4f4f4');
        box(ctx, cx + x, midY + y, 1, 1, col);
      }
    }
    box(ctx, cx - 4, midY - 3, 8, 7, OUTLINE);
    box(ctx, cx - 2, midY - 1, 4, 3, hex('#ffffff'));
  } else if (style === 'mart') {
    // Rótulo de la tienda
    box(ctx, cx - 26, midY - 8, 52, 16, OUTLINE);
    box(ctx, cx - 25, midY - 7, 50, 14, hex('#f4f8ff'));
    box(ctx, cx - 25, midY + 3, 50, 4, hex('#3c74d0'));
    // Bolsa
    box(ctx, cx - 6, midY - 5, 12, 8, hex('#3c74d0'));
    box(ctx, cx - 3, midY - 7, 6, 2, hex('#3c74d0'));
  } else if (style === 'lab') {
    // Antena parabólica
    const ax = Math.round(W * 0.78);
    box(ctx, ax, roofTop - 14, 2, 16, STONE[0]);
    box(ctx, ax - 7, roofTop - 20, 16, 8, OUTLINE);
    box(ctx, ax - 6, roofTop - 19, 14, 6, STONE[4]);
    box(ctx, ax - 6, roofTop - 15, 14, 2, STONE[2]);
  } else if (style === 'gym') {
    // Emblema del gimnasio
    box(ctx, cx - 20, midY - 14, 40, 28, OUTLINE);
    box(ctx, cx - 18, midY - 12, 36, 24, STONE[3]);
    box(ctx, cx - 18, midY - 12, 36, 3, STONE[4]);
    box(ctx, cx - 10, midY - 6, 20, 12, hex('#b08a50'));
    box(ctx, cx - 6, midY - 9, 12, 18, hex('#c8a060'));
    box(ctx, cx - 6, midY - 9, 12, 3, hex('#e8c888'));
  }
  return { img: c, ox: o.x - OX, oy: o.y + o.h - H };
}

/** Roca: pedrusco facetado que ocupa su hueco. */
function rockSprite(o: Obstacle): HTMLCanvasElement {
  const W = o.w + 4;
  const H = o.h + 10;
  const [c, ctx] = canvas(W, H);
  const img = ctx.getImageData(0, 0, W, H);
  const cx = W / 2;
  const cy = H * 0.56;
  const rx = W / 2 - 1;
  const ry = H / 2 - 1;
  const inside = (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (vnoise(x, y, 6, o.x) - 0.5) * 0.5 <= 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const edge = !inside(x - 0.5, y + 0.5) || !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y - 0.5) || !inside(x + 0.5, y + 1.5);
      const s = Math.hypot(x - W * 0.35, y - H * 0.3) / Math.max(W, H) + (vnoise(x, y, 4, o.y) - 0.5) * 0.3;
      const col = edge ? OUTLINE : s < 0.22 ? STONE[4] : s < 0.4 ? STONE[3] : s < 0.6 ? STONE[2] : s < 0.8 ? STONE[1] : STONE[0];
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Valla horizontal: postes cada 12 px y dos travesaños. */
function fenceH(w: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w, 18);
  box(ctx, 0, 4, w, 3, WOOD[0]);
  box(ctx, 0, 5, w, 1, WOOD[3]);
  box(ctx, 0, 10, w, 3, WOOD[0]);
  box(ctx, 0, 11, w, 1, WOOD[3]);
  for (let x = 0; x < w; x += 12) post(ctx, Math.min(x, w - 5), 0);
  return c;
}

function post(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  box(ctx, x, y, 5, 17, WOOD[0]);
  box(ctx, x + 1, y + 1, 3, 15, WOOD[2]);
  box(ctx, x + 1, y + 1, 1, 15, WOOD[4]);
  box(ctx, x, y, 5, 2, WOOD[1]);
}

/** Tramo de valla vertical: un poste con el travesaño hasta el siguiente. */
function fencePost(): HTMLCanvasElement {
  const [c, ctx] = canvas(5, 29);
  box(ctx, 1, 0, 3, 14, WOOD[0]);
  box(ctx, 2, 0, 1, 14, WOOD[3]);
  post(ctx, 0, 12);
  return c;
}

function propSprite(k: Decor['kind']): HTMLCanvasElement | null {
  switch (k) {
    case 'lamp': {
      const [c, ctx] = canvas(12, 34);
      box(ctx, 3, 30, 6, 4, OUTLINE);
      box(ctx, 5, 10, 2, 22, hex('#3c3a48'));
      box(ctx, 5, 10, 1, 22, hex('#6a6878'));
      box(ctx, 1, 1, 10, 11, OUTLINE);
      box(ctx, 2, 3, 8, 7, GLASS[1]);
      box(ctx, 3, 4, 3, 3, GLASS[2]);
      box(ctx, 0, 0, 12, 2, hex('#3c3a48'));
      return c;
    }
    case 'sign': {
      const [c, ctx] = canvas(26, 22);
      box(ctx, 4, 10, 3, 12, WOOD[0]);
      box(ctx, 19, 10, 3, 12, WOOD[0]);
      box(ctx, 0, 0, 26, 14, OUTLINE);
      box(ctx, 1, 1, 24, 12, WOOD[3]);
      box(ctx, 1, 1, 24, 2, WOOD[4]);
      box(ctx, 1, 11, 24, 2, WOOD[2]);
      box(ctx, 5, 5, 16, 1, WOOD[1]);
      box(ctx, 5, 8, 11, 1, WOOD[1]);
      return c;
    }
    case 'signpost': {
      const [c, ctx] = canvas(34, 30);
      box(ctx, 15, 6, 4, 24, WOOD[0]);
      box(ctx, 16, 6, 2, 24, WOOD[2]);
      // Flecha hacia el camino
      box(ctx, 2, 3, 26, 12, OUTLINE);
      box(ctx, 28, 5, 2, 8, OUTLINE);
      box(ctx, 30, 7, 2, 4, OUTLINE);
      box(ctx, 3, 4, 25, 10, WOOD[3]);
      box(ctx, 28, 6, 2, 6, WOOD[3]);
      box(ctx, 3, 4, 25, 2, WOOD[4]);
      box(ctx, 7, 8, 14, 2, WOOD[1]);
      return c;
    }
    case 'mailbox': {
      const [c, ctx] = canvas(12, 20);
      box(ctx, 5, 8, 2, 12, WOOD[0]);
      box(ctx, 0, 0, 12, 10, OUTLINE);
      box(ctx, 1, 1, 10, 8, hex('#d84a3a'));
      box(ctx, 1, 1, 10, 2, hex('#ff8a6a'));
      box(ctx, 9, 2, 2, 5, hex('#ffd34a'));
      return c;
    }
    case 'barrel': {
      const [c, ctx] = canvas(16, 20);
      box(ctx, 1, 0, 14, 20, OUTLINE);
      box(ctx, 2, 1, 12, 18, WOOD[2]);
      box(ctx, 2, 1, 12, 3, WOOD[4]);
      box(ctx, 4, 4, 2, 15, WOOD[3]);
      box(ctx, 2, 6, 12, 2, STONE[0]);
      box(ctx, 2, 14, 12, 2, STONE[0]);
      return c;
    }
    case 'crate': {
      const [c, ctx] = canvas(18, 18);
      box(ctx, 0, 0, 18, 18, OUTLINE);
      box(ctx, 1, 1, 16, 16, WOOD[3]);
      box(ctx, 1, 1, 16, 4, WOOD[4]);
      box(ctx, 1, 8, 16, 2, WOOD[1]);
      box(ctx, 8, 5, 2, 12, WOOD[1]);
      return c;
    }
    case 'well': {
      const [c, ctx] = canvas(34, 40);
      box(ctx, 4, 2, 3, 26, WOOD[1]);
      box(ctx, 27, 2, 3, 26, WOOD[1]);
      box(ctx, 0, 0, 34, 8, OUTLINE);
      box(ctx, 1, 1, 32, 6, hex('#b04a3a'));
      box(ctx, 1, 1, 32, 2, hex('#e0705a'));
      box(ctx, 2, 22, 30, 18, OUTLINE);
      box(ctx, 3, 23, 28, 16, STONE[2]);
      box(ctx, 3, 23, 28, 5, STONE[0]);
      box(ctx, 5, 24, 24, 3, WATER[0]);
      for (let x = 3; x < 31; x += 7) box(ctx, x, 30, 1, 9, STONE[1]);
      box(ctx, 3, 34, 28, 1, STONE[1]);
      return c;
    }
    case 'bush': {
      const [c, ctx] = canvas(26, 18);
      const img = ctx.getImageData(0, 0, 26, 18);
      for (let y = 0; y < 18; y++) {
        for (let x = 0; x < 26; x++) {
          const inside = (px: number, py: number) => ((px - 13) / 12.5) ** 2 + ((py - 10) / 8.5) ** 2 <= 1;
          if (!inside(x + 0.5, y + 0.5)) continue;
          const edge = !inside(x - 0.5, y + 0.5) || !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y - 0.5) || !inside(x + 0.5, y + 1.5);
          const s = Math.hypot(x - 9, y - 5) / 20 + (vnoise(x, y, 3, 5) - 0.5) * 0.4;
          const col = edge ? LEAF[0] : s < 0.3 ? LEAF[5] : s < 0.5 ? LEAF[4] : s < 0.7 ? LEAF[3] : LEAF[2];
          const i = (y * 26 + x) * 4;
          img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return c;
    }
    default:
      return null;
  }
}

// --- suelo -------------------------------------------------------------------------

const enum T { Grass, Path, Plaza, Sand, Water }

function paintGround(t: TownDef): HTMLCanvasElement {
  const { W, H } = t;
  const [c, ctx] = canvas(W, H);
  const terr = new Uint8Array(W * H);
  const order: Record<string, T> = { sand: T.Sand, path: T.Path, plaza: T.Plaza };
  // Arena primero, luego caminos y plazas. Bordes irregulares con ruido.
  const grounds = [...t.ground].sort((a, b) => order[a.kind] - order[b.kind]);
  for (const g of grounds) {
    const kind = order[g.kind];
    const pad = g.kind === 'plaza' ? 0 : 7;
    for (let y = Math.max(0, g.y - pad); y < Math.min(H, g.y + g.h + pad); y++) {
      for (let x = Math.max(0, g.x - pad); x < Math.min(W, g.x + g.w + pad); x++) {
        const out = Math.max(g.x - x, x - (g.x + g.w - 1), g.y - y, y - (g.y + g.h - 1));
        const lim = g.kind === 'plaza' ? 0 : vnoise(x, y, 11, 3) * 7 + vnoise(x, y, 4, 13) * 3 - 5;
        if (out <= lim) terr[y * W + x] = kind;
      }
    }
  }
  // Agua con esquinas redondeadas y orilla irregular (salvo donde toca el borde del pueblo).
  for (const o of t.obstacles) {
    if (o.kind !== 'water') continue;
    const r = Math.min(26, o.w / 3, o.h / 3);
    for (let y = o.y; y < Math.min(H, o.y + o.h); y++) {
      for (let x = o.x; x < Math.min(W, o.x + o.w); x++) {
        const qx = Math.max(o.x > 0 ? o.x + r - x : 0, o.x + o.w < W ? x - (o.x + o.w - 1 - r) : 0, 0);
        const qy = Math.max(o.y > 0 ? o.y + r - y : 0, o.y + o.h < H ? y - (o.y + o.h - 1 - r) : 0, 0);
        const wob = (vnoise(x, y, 8, 17) - 0.5) * 6;
        const edge = Math.min(o.x > 0 ? x - o.x : 99, o.x + o.w < W ? o.x + o.w - 1 - x : 99, o.y > 0 ? y - o.y : 99, o.y + o.h < H ? o.y + o.h - 1 - y : 99);
        if (Math.hypot(qx, qy) <= r && edge + wob >= 0) terr[y * W + x] = T.Water;
      }
    }
  }
  // Los puentes van por encima del agua (se pintan después).
  const img = ctx.createImageData(W, H);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? T.Grass : terr[y * W + x]);
  // Distancia a la orilla de arriba (para la pared de tierra de la orilla).
  const fromTop = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    let run = 99;
    for (let y = 0; y < H; y++) {
      if (terr[y * W + x] === T.Water) { run = run === 99 && y === 0 ? 99 : Math.min(98, run + 1); fromTop[y * W + x] = run; } else run = 0;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = terr[y * W + x];
      const n = hash(x, y, 1);
      let col: RGB;
      if (k === T.Grass) {
        const v = vnoise(x, y, 18, 2) * 0.7 + vnoise(x, y, 5, 9) * 0.3 + (n - 0.5) * 0.18;
        col = v < 0.34 ? GRASS[1] : v < 0.74 ? GRASS[2] : GRASS[3];
        if (n > 0.985) col = GRASS[4];
        const below = at(x, y + 1);
        if (below !== T.Grass && below !== T.Water) col = GRASS[0];
        else if (at(x, y - 1) !== T.Grass && at(x, y - 1) !== T.Water) col = GRASS[3];
      } else if (k === T.Path) {
        const v = vnoise(x, y, 9, 4) * 0.6 + n * 0.4;
        col = v < 0.32 ? DIRT[1] : v < 0.8 ? DIRT[2] : DIRT[3];
        if (at(x, y - 1) === T.Grass) col = DIRT[0];
        else if (at(x, y - 2) === T.Grass) col = DIRT[1];
        else if (at(x, y + 1) === T.Grass || at(x - 1, y) === T.Grass || at(x + 1, y) === T.Grass) col = DIRT[1];
      } else if (k === T.Plaza) {
        // Losas de 12 × 10 al tresbolillo
        const row = Math.floor(y / 10);
        const lx = (x + (row % 2 ? 6 : 0)) % 12;
        const ly = y % 10;
        const tone = hash(Math.floor((x + (row % 2 ? 6 : 0)) / 12), row, 5);
        col = lx === 0 || ly === 0 ? STONE[1] : ly === 1 ? STONE[4] : tone < 0.35 ? STONE[2] : STONE[3];
        if (n > 0.97) col = STONE[2];
      } else if (k === T.Sand) {
        const v = vnoise(x, y, 6, 6) * 0.5 + n * 0.5;
        col = v < 0.25 ? SAND[0] : v < 0.7 ? SAND[1] : v < 0.95 ? SAND[2] : SAND[3];
      } else {
        const ft = fromTop[y * W + x];
        const landL = at(x - 1, y) !== T.Water;
        const landR = at(x + 1, y) !== T.Water;
        const landB = at(x, y + 1) !== T.Water;
        if (ft <= 6) col = ft <= 1 ? BANK[2] : ft <= 4 ? (x % 6 < 3 ? BANK[1] : BANK[0]) : BANK[0];
        else if (ft === 7 || landL || landR || landB) col = WATER[4];
        else {
          const v = vnoise(x, y, 22, 8);
          col = v < 0.35 ? WATER[0] : v < 0.75 ? WATER[1] : WATER[2];
          // Ondas
          if ((y + Math.floor(vnoise(x, 0, 30, 1) * 8)) % 9 === 0 && vnoise(x, y, 6, 11) > 0.62) col = WATER[3];
        }
      }
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Matas de hierba y piedrecitas.
  for (let y = 4; y < H; y += 7) {
    for (let x = 2; x < W; x += 9) {
      const jx = x + Math.floor(hash(x, y, 21) * 8);
      const jy = y + Math.floor(hash(x, y, 22) * 6);
      const k = at(jx, jy);
      const r = hash(x, y, 23);
      if (k === T.Grass && r < 0.58) {
        box(ctx, jx, jy - 2, 1, 3, GRASS[0]);
        box(ctx, jx + 2, jy - 3, 1, 4, GRASS[0]);
        box(ctx, jx + 4, jy - 1, 1, 2, GRASS[0]);
        box(ctx, jx + 2, jy - 3, 1, 1, GRASS[4]);
        box(ctx, jx, jy - 2, 1, 1, GRASS[4]);
      } else if (k === T.Path && r < 0.16) {
        box(ctx, jx, jy, 2, 1, DIRT[0]);
        box(ctx, jx, jy - 1, 2, 1, DIRT[4]);
      } else if (k === T.Sand && r < 0.06) {
        box(ctx, jx, jy, 2, 2, hex('#f4f0e8'));
        box(ctx, jx + 1, jy + 1, 1, 1, hex('#e0a0a0'));
      }
    }
  }

  // Detalles sueltos en la hierba lejos de los caminos: florecillas, piedrecitas y matas oscuras.
  for (let y = 24; y < H - 24; y += 44) {
    for (let x = 24; x < W - 24; x += 44) {
      const jx = x + Math.floor((hash(x, y, 61) - 0.5) * 30);
      const jy = y + Math.floor((hash(x, y, 62) - 0.5) * 30);
      if ([[0, 0], [-14, -10], [14, -10], [-14, 10], [14, 10]].some(([dx, dy]) => at(jx + dx, jy + dy) !== T.Grass)) continue;
      const r = hash(x, y, 63);
      if (r < 0.16) {
        const col = FLOWERS[Math.floor(hash(x, y, 64) * FLOWERS.length)];
        for (let i = 0; i < 4; i++) {
          const fx = jx + Math.floor((hash(i, x, 65) - 0.5) * 12);
          const fy = jy + Math.floor((hash(i, y, 66) - 0.5) * 8);
          box(ctx, fx, fy + 1, 1, 2, GRASS[0]);
          box(ctx, fx - 1, fy - 1, 3, 2, col);
          box(ctx, fx, fy - 1, 1, 1, hex('#ffe066'));
        }
      } else if (r < 0.26) {
        for (let i = 0; i < 3; i++) {
          const sx = jx + Math.floor((hash(i, x, 67) - 0.5) * 10);
          const sy = jy + Math.floor((hash(i, y, 68) - 0.5) * 6);
          box(ctx, sx, sy, 3, 2, STONE[1]);
          box(ctx, sx, sy, 2, 1, STONE[3]);
        }
      } else if (r < 0.5) {
        // Mata de hierba más alta
        for (let i = 0; i < 7; i++) {
          const bx = jx - 6 + i * 2;
          const tall = 3 + Math.floor(hash(i, x + y, 69) * 4);
          box(ctx, bx, jy - tall, 1, tall, i % 2 ? GRASS[0] : GRASS[1]);
          box(ctx, bx, jy - tall, 1, 1, GRASS[3]);
        }
      }
    }
  }

  for (const dc of t.decor) paintDecorArea(ctx, dc);
  return c;
}

function paintDecorArea(ctx: CanvasRenderingContext2D, dc: Decor): void {
  const w = dc.w ?? 0;
  const h = dc.h ?? 0;
  if (dc.kind === 'flowers') {
    const n = Math.round((w * h) / 150);
    for (let i = 0; i < n; i++) {
      const x = dc.x + Math.floor(hash(i, dc.x, 31) * w);
      const y = dc.y + Math.floor(hash(i, dc.y, 32) * h);
      const col = FLOWERS[Math.floor(hash(i, dc.x + dc.y, 33) * FLOWERS.length)];
      box(ctx, x - 1, y + 2, 1, 2, GRASS[0]);
      box(ctx, x + 2, y + 2, 1, 2, GRASS[0]);
      box(ctx, x, y - 1, 2, 1, col);
      box(ctx, x - 1, y, 4, 2, col);
      box(ctx, x, y + 2, 2, 1, col);
      box(ctx, x, y, 2, 2, hex('#ffd84a'));
      box(ctx, x - 1, y + 3, 4, 1, 'rgba(20,40,10,0.35)');
    }
  } else if (dc.kind === 'tallgrass') {
    // Filas de hojas altas, más oscuras abajo
    box(ctx, dc.x, dc.y, w, h, GRASS[1]);
    for (let y = dc.y + 6; y < dc.y + h; y += 5) {
      for (let x = dc.x; x < dc.x + w; x += 3) {
        const tall = 5 + Math.floor(hash(x, y, 41) * 4);
        const off = Math.floor(hash(x, y, 42) * 2);
        box(ctx, x + off, y - tall, 2, tall, GRASS[2]);
        box(ctx, x + off, y - tall, 1, tall, GRASS[3]);
        box(ctx, x + off, y - tall, 1, 1, GRASS[4]);
        box(ctx, x + off + 1, y - 2, 1, 2, GRASS[0]);
      }
    }
    box(ctx, dc.x, dc.y + h - 2, w, 2, GRASS[0]);
  } else if (dc.kind === 'bridge') {
    box(ctx, dc.x, dc.y, w, h, OUTLINE);
    const vertical = h > w;
    if (vertical) {
      for (let y = dc.y; y < dc.y + h; y += 6) {
        box(ctx, dc.x + 2, y, w - 4, 5, WOOD[3]);
        box(ctx, dc.x + 2, y, w - 4, 1, WOOD[4]);
      }
      box(ctx, dc.x, dc.y, 3, h, WOOD[1]);
      box(ctx, dc.x + w - 3, dc.y, 3, h, WOOD[1]);
    } else {
      for (let x = dc.x; x < dc.x + w; x += 6) {
        box(ctx, x, dc.y + 2, 5, h - 4, WOOD[3]);
        box(ctx, x, dc.y + 2, 1, h - 4, WOOD[4]);
      }
      box(ctx, dc.x, dc.y, w, 3, WOOD[1]);
      box(ctx, dc.x, dc.y + h - 3, w, 3, WOOD[1]);
    }
  }
}

/** Sombra de un objeto de pie, pintada en el suelo (elipse en píxeles). */
function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  ctx.fillStyle = 'rgba(16, 30, 12, 0.32)';
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(1 - (y / (ry + 0.5)) ** 2));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 1);
  }
}

// --- montaje -------------------------------------------------------------------------

export interface TownArt {
  ground: HTMLCanvasElement;
  sprites: Sprite[];
  /** Miniatura para el minimapa (1/4 del tamaño). */
  mini: HTMLCanvasElement;
  water: Obstacle[];
}

const POST = typeof document === 'undefined' ? null : fencePost();

export function buildTownArt(t: TownDef): TownArt {
  const ground = paintGround(t);
  const g = ground.getContext('2d')!;
  const sprites: Sprite[] = [];

  for (const o of t.obstacles) {
    if (o.kind === 'house') {
      const b = buildingSprite(o);
      // Sombra hacia la derecha y abajo
      g.fillStyle = 'rgba(16, 30, 12, 0.3)';
      g.fillRect(o.x + o.w + 6, o.y + 8, 8, o.h - 4);
      g.fillRect(o.x + 4, o.y + o.h, o.w + 10, 5);
      sprites.push({ img: b.img, x: b.ox, y: b.oy, base: o.y + o.h });
    } else if (o.kind === 'tree') {
      // Bosquecillo: árboles al tresbolillo que llenan el hueco.
      const sx = 30;
      const sy = 24;
      let row = 0;
      for (let y = o.y + o.h - 4; y >= o.y + 6; y -= sy, row++) {
        for (let x = o.x + 14 + (row % 2 ? sx / 2 : 0); x <= o.x + o.w - 6; x += sx) {
          const jx = x + Math.round((hash(x, y, 51) - 0.5) * 8);
          const jy = y + Math.round((hash(x, y, 52) - 0.5) * 6);
          const img = TREES[Math.floor(hash(x, y, 53) * 4)]!;
          shadow(g, jx + 4, jy - 1, 15, 5);
          sprites.push({ img, x: jx - TREE_W / 2, y: jy - TREE_H, base: jy });
        }
        if (o.w < sx) {
          const img = TREES[row % 4]!;
          sprites.push({ img, x: o.x + o.w / 2 - TREE_W / 2, y: y - TREE_H, base: y });
        }
      }
    } else if (o.kind === 'fence') {
      if (o.w >= o.h) {
        sprites.push({ img: fenceH(o.w), x: o.x, y: o.y + o.h - 18, base: o.y + o.h });
      } else {
        for (let y = o.y + 12; y <= o.y + o.h; y += 12) sprites.push({ img: POST!, x: o.x, y: y - 29, base: y });
      }
    } else if (o.kind === 'rock') {
      shadow(g, o.x + o.w / 2 + 3, o.y + o.h - 1, o.w / 2 + 2, 4);
      sprites.push({ img: rockSprite(o), x: o.x - 2, y: o.y - 8, base: o.y + o.h });
    }
  }
  for (const dc of t.decor) {
    const img = propSprite(dc.kind);
    if (!img) continue;
    shadow(g, dc.x + 3, dc.y - 1, Math.max(4, img.width / 2), 3);
    sprites.push({ img, x: Math.round(dc.x - img.width / 2), y: dc.y - img.height + 1, base: dc.y });
  }
  sprites.sort((a, b) => a.base - b.base);

  // Minimapa: suelo y lo que está de pie, en pequeño.
  const [mini, m] = canvas(t.W / 4, t.H / 4);
  m.imageSmoothingEnabled = true;
  m.drawImage(ground, 0, 0, t.W / 4, t.H / 4);
  for (const s of sprites) m.drawImage(s.img, s.x / 4, s.y / 4, s.img.width / 4, s.img.height / 4);
  return { ground, sprites, mini, water: t.obstacles.filter((o) => o.kind === 'water') };
}
