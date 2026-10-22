import { Rng } from '../game/rng';

// ============================================================================
// Ilustraciones procedurales para los menús (pixel art generado en código):
// la isla de la región (portada y mapa) y el fondo de cueva de los gimnasios.
// Se generan una vez y se guardan como data URL.
// ============================================================================

const cache = new Map<string, string>();

type RGB = [number, number, number];
const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

/** Ruido de valor con interpolación suave (varias octavas). */
function noise2(seed: number): (x: number, y: number) => number {
  const rng = new Rng(seed);
  const N = 64;
  const grid = Array.from({ length: N * N }, () => rng.next());
  const at = (i: number, j: number) => grid[((j % N) + N) % N * N + (((i % N) + N) % N)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const one = (x: number, y: number) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = smooth(x - i);
    const fy = smooth(y - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * fx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fx;
    return a + (b - a) * fy;
  };
  return (x, y) => one(x, y) * 0.55 + one(x * 2.1, y * 2.1) * 0.28 + one(x * 4.3, y * 4.3) * 0.17;
}

export interface IslandOpts {
  seed: number;
  /** Tamaño en píxeles de arte (se escala con image-rendering: pixelated). */
  w: number;
  h: number;
  /** Puntos donde poner pueblos (0..1), p. ej. las ciudades de los gimnasios. */
  towns?: { x: number; y: number }[];
  /** Pinta el agua alrededor (false = fondo transparente fuera de la isla). */
  sea?: boolean;
}

/** Isla pixel art con playa, prados, bosques, montañas nevadas, río y pueblos. */
export function islandArt(o: IslandOpts): string {
  const key = `island:${JSON.stringify(o)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { w, h } = o;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const n = noise2(o.seed);
  const m = noise2(o.seed + 99);
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w) * 2 - 1;
      const ny = (y / h) * 2 - 1;
      const d = Math.sqrt(nx * nx * 1.05 + ny * ny * 0.95);
      height[y * w + x] = n(x / 18, y / 18) * 0.9 - d * d * 1.25 + 0.42;
    }
  }
  const P = {
    deep: hex('#1d5fb4'), sea: hex('#2f86d6'), shallow: hex('#55b4ea'), foam: hex('#bfe9ff'),
    sand: hex('#f2d58a'), grass: hex('#6cc04a'), grass2: hex('#58a83c'), forest: hex('#2f7a34'),
    rock: hex('#8f8a80'), rock2: hex('#6f6a62'), snow: hex('#f4f8ff'),
  };
  const put = (i: number, col: RGB, a = 255) => {
    img.data[i * 4] = col[0];
    img.data[i * 4 + 1] = col[1];
    img.data[i * 4 + 2] = col[2];
    img.data[i * 4 + 3] = a;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const e = height[i];
      const shade = x > 0 && y > 0 ? e - height[i - w - 1] : 0;
      let col: RGB;
      if (e < -0.05) {
        if (o.sea === false) { put(i, P.sea, 0); continue; }
        col = e < -0.3 ? P.deep : e < -0.12 ? P.sea : P.shallow;
        if (e > -0.075 && e < -0.06) col = P.foam;
      } else if (e < 0.02) col = P.sand;
      else if (e < 0.5) {
        col = m(x / 9, y / 9) > 0.56 ? P.forest : (x + y) % 7 === 0 && m(x / 3, y / 3) > 0.6 ? P.grass2 : P.grass;
      } else if (e < 0.8) col = shade > 0.004 ? P.rock : P.rock2;
      else col = P.snow;
      put(i, col);
    }
  }
  ctx.putImageData(img, 0, 0);
  const rng = new Rng(o.seed * 7 + 3);
  // Árboles (puntitos con brillo) en los bosques.
  for (let k = 0; k < (w * h) / 26; k++) {
    const x = rng.int(1, w - 2);
    const y = rng.int(2, h - 2);
    const e = height[y * w + x];
    if (e < 0.04 || e > 0.48 || m(x / 9, y / 9) < 0.5) continue;
    ctx.fillStyle = '#1f5a26';
    ctx.fillRect(x - 1, y, 3, 2);
    ctx.fillRect(x, y - 1, 1, 1);
    ctx.fillStyle = '#4fa850';
    ctx.fillRect(x, y, 1, 1);
  }
  // Río: de la montaña más alta al mar.
  let best = 0;
  for (let i = 0; i < w * h; i++) if (height[i] > height[best]) best = i;
  let rx = best % w;
  let ry = Math.floor(best / w);
  ctx.fillStyle = '#4aa8ec';
  for (let s = 0; s < w * 2 && height[ry * w + rx] > -0.05; s++) {
    ctx.fillRect(rx, ry, 2, 1);
    let nx = rx;
    let ny = ry;
    let low = Infinity;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]] as const) {
      const xx = rx + dx;
      const yy = ry + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const v = height[yy * w + xx] + rng.next() * 0.02;
      if (v < low) { low = v; nx = xx; ny = yy; }
    }
    if (nx === rx && ny === ry) break;
    rx = nx;
    ry = ny;
  }
  // Pueblos: casitas de tejado rojo o azul.
  for (const t of o.towns ?? []) {
    const cx = Math.round(t.x * w);
    const cy = Math.round(t.y * h);
    for (let k = 0; k < 4; k++) {
      const x = cx + rng.int(-5, 4);
      const y = cy + rng.int(-3, 4);
      ctx.fillStyle = '#f2ece0';
      ctx.fillRect(x, y + 1, 3, 2);
      ctx.fillStyle = rng.next() < 0.5 ? '#d8483c' : '#3c78d8';
      ctx.fillRect(x - 1, y, 5, 1);
      ctx.fillRect(x, y - 1, 3, 1);
    }
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

/** Fondo de gimnasio: cueva con antorchas y rocas (para la cabecera del gimnasio). */
export function caveArt(seed: number, tint = '#8a7a64'): string {
  const key = `cave:${seed}:${tint}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const w = 120;
  const h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2a1e16');
  g.addColorStop(1, '#5a4634');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rng = new Rng(seed);
  const [r, gg, b] = hex(tint);
  // Paredes de roca a capas.
  for (let k = 0; k < 140; k++) {
    const x = rng.int(-4, w);
    const y = rng.int(0, h - 10);
    const s = rng.int(4, 12);
    const l = 0.4 + rng.next() * 0.5;
    ctx.fillStyle = `rgb(${Math.round(r * l)}, ${Math.round(gg * l)}, ${Math.round(b * l)})`;
    ctx.fillRect(x, y, s, Math.ceil(s * 0.6));
    ctx.fillStyle = `rgba(255, 240, 210, ${0.08 + rng.next() * 0.08})`;
    ctx.fillRect(x, y, s, 1);
  }
  // Suelo.
  ctx.fillStyle = '#6a5438';
  ctx.fillRect(0, h - 12, w, 12);
  ctx.fillStyle = '#7e6644';
  for (let x = 0; x < w; x += 6) ctx.fillRect(x + rng.int(0, 3), h - 12 + rng.int(0, 10), 3, 1);
  // Antorchas con resplandor.
  for (const tx of [18, w - 20]) {
    const glow = ctx.createRadialGradient(tx, 18, 1, tx, 18, 22);
    glow.addColorStop(0, 'rgba(255, 200, 90, 0.75)');
    glow.addColorStop(1, 'rgba(255, 160, 60, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(tx - 22, 0, 44, 44);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(tx - 1, 18, 2, 8);
    ctx.fillStyle = '#ffd25a';
    ctx.fillRect(tx - 1, 14, 3, 4);
    ctx.fillStyle = '#ff8a2a';
    ctx.fillRect(tx, 15, 1, 3);
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
