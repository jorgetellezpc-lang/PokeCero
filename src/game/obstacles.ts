import type { Obstacle } from '../data/layouts';
import type { Vec } from './entities';

// Colisiones con los obstáculos de la sala y navegación por cuadrícula para
// que los enemigos los rodeen en vez de atascarse. Sin DOM.

/** ¿Este obstáculo bloquea a quien levita? (el agua no). */
export const blocks = (o: Obstacle, flyer: boolean) => o.kind === 'rock' || !flyer;

/** Saca un círculo de los obstáculos que lo bloquean. Devuelve true si chocó. */
export function pushOut(c: Vec, r: number, obstacles: Obstacle[], flyer = false): boolean {
  let hit = false;
  for (const o of obstacles) {
    if (!blocks(o, flyer)) continue;
    const qx = Math.max(o.x, Math.min(c.x, o.x + o.w));
    const qy = Math.max(o.y, Math.min(c.y, o.y + o.h));
    const dx = c.x - qx;
    const dy = c.y - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      c.x = qx + (dx / d) * r;
      c.y = qy + (dy / d) * r;
    } else {
      // Centro dentro del rectángulo: sale por el lado más cercano.
      const left = c.x - o.x;
      const right = o.x + o.w - c.x;
      const top = c.y - o.y;
      const bottom = o.y + o.h - c.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) c.x = o.x - r;
      else if (m === right) c.x = o.x + o.w + r;
      else if (m === top) c.y = o.y - r;
      else c.y = o.y + o.h + r;
    }
  }
  return hit;
}

/** Obstáculo (que para proyectiles) en el que está el punto, si hay. */
export function rockAt(x: number, y: number, obstacles: Obstacle[], pad = 0): Obstacle | null {
  for (const o of obstacles) {
    if (o.kind !== 'rock') continue;
    if (x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) return o;
  }
  return null;
}

/** ¿Está libre el punto para un círculo de radio r? */
export function isFree(x: number, y: number, r: number, obstacles: Obstacle[], flyer = false): boolean {
  for (const o of obstacles) {
    if (!blocks(o, flyer)) continue;
    const qx = Math.max(o.x, Math.min(x, o.x + o.w));
    const qy = Math.max(o.y, Math.min(y, o.y + o.h));
    if ((x - qx) ** 2 + (y - qy) ** 2 < r * r) return false;
  }
  return true;
}

/** ¿El segmento a→b cruza algún obstáculo (ensanchado `pad`)? */
export function segmentBlocked(ax: number, ay: number, bx: number, by: number, obstacles: Obstacle[], flyer: boolean, pad: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  for (const o of obstacles) {
    if (!blocks(o, flyer)) continue;
    // Prueba de bandas (slab) contra el rectángulo ensanchado.
    let t0 = 0;
    let t1 = 1;
    const x0 = o.x - pad;
    const x1 = o.x + o.w + pad;
    const y0 = o.y - pad;
    const y1 = o.y + o.h + pad;
    let ok = true;
    for (const [p, d, lo, hi] of [[ax, dx, x0, x1], [ay, dy, y0, y1]] as const) {
      if (Math.abs(d) < 1e-9) {
        if (p < lo || p > hi) { ok = false; break; }
      } else {
        let ta = (lo - p) / d;
        let tb = (hi - p) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) { ok = false; break; }
      }
    }
    if (ok) return true;
  }
  return false;
}

const CELL = 15;

/**
 * Mapa de distancias por cuadrícula (BFS) hacia un destino. Se cachea por
 * celda de destino; se rehace solo cuando el destino cambia de celda.
 */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private blocked: [Uint8Array, Uint8Array];
  private cache = new Map<string, Int32Array>();

  constructor(readonly W: number, readonly H: number, readonly obstacles: Obstacle[], pad = 10) {
    this.cols = Math.ceil(W / CELL);
    this.rows = Math.ceil(H / CELL);
    this.blocked = [this.mark(false, pad), this.mark(true, pad)];
  }

  private mark(flyer: boolean, pad: number): Uint8Array {
    const b = new Uint8Array(this.cols * this.rows);
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const x = (i + 0.5) * CELL;
        const y = (j + 0.5) * CELL;
        if (!isFree(x, y, pad, this.obstacles, flyer)) b[j * this.cols + i] = 1;
      }
    }
    return b;
  }

  private cellOf(x: number, y: number): number {
    const i = Math.max(0, Math.min(this.cols - 1, Math.floor(x / CELL)));
    const j = Math.max(0, Math.min(this.rows - 1, Math.floor(y / CELL)));
    return j * this.cols + i;
  }

  /** Distancias (en pasos) desde cada celda hasta el destino; -1 si no hay camino. */
  field(tx: number, ty: number, flyer: boolean): Int32Array {
    const goal = this.cellOf(tx, ty);
    const key = `${goal}:${flyer ? 1 : 0}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const blocked = this.blocked[flyer ? 1 : 0];
    const dist = new Int32Array(this.cols * this.rows).fill(-1);
    const queue = new Int32Array(this.cols * this.rows);
    let head = 0;
    let tail = 0;
    dist[goal] = 0;
    queue[tail++] = goal;
    while (head < tail) {
      const c = queue[head++];
      const ci = c % this.cols;
      const cj = (c - ci) / this.cols;
      for (const [di, dj] of DIRS4) {
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= this.cols || nj >= this.rows) continue;
        const n = nj * this.cols + ni;
        if (dist[n] >= 0 || blocked[n]) continue;
        dist[n] = dist[c] + 1;
        queue[tail++] = n;
      }
    }
    if (this.cache.size > 64) this.cache.clear();
    this.cache.set(key, dist);
    return dist;
  }

  /**
   * Dirección (unitaria) para ir de `from` a (tx, ty). Si hay línea directa,
   * recto; si no, hacia la celda vecina más cercana al destino.
   */
  dirTo(from: Vec, tx: number, ty: number, r: number, flyer: boolean): Vec {
    const dx = tx - from.x;
    const dy = ty - from.y;
    const d = Math.hypot(dx, dy) || 1;
    if (!this.obstacles.length || !segmentBlocked(from.x, from.y, tx, ty, this.obstacles, flyer, r * 0.9)) return { x: dx / d, y: dy / d };
    const f = this.field(tx, ty, flyer);
    const c = this.cellOf(from.x, from.y);
    const ci = c % this.cols;
    const cj = (c - ci) / this.cols;
    let best = -1;
    let bd = f[c] >= 0 ? f[c] : 1e9;
    for (const [di, dj] of DIRS8) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= this.cols || nj >= this.rows) continue;
      const n = nj * this.cols + ni;
      // Diagonal solo si las dos celdas de al lado están libres (no corta esquinas).
      if (di && dj && (f[cj * this.cols + ni] < 0 || f[nj * this.cols + ci] < 0)) continue;
      if (f[n] >= 0 && f[n] < bd) { bd = f[n]; best = n; }
    }
    if (best < 0) return { x: dx / d, y: dy / d };
    const bi = best % this.cols;
    const bx = (bi + 0.5) * CELL - from.x;
    const by = ((best - bi) / this.cols + 0.5) * CELL - from.y;
    const l = Math.hypot(bx, by) || 1;
    return { x: bx / l, y: by / l };
  }

  /** ¿Se puede llegar de a a b andando? (para validar diseños). */
  reachable(a: Vec, b: Vec, flyer = false): boolean {
    return this.field(b.x, b.y, flyer)[this.cellOf(a.x, a.y)] >= 0;
  }
}

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/** Pokémon que cruzan el agua. */
export const levitates = (types: readonly string[]) => types.includes('flying') || types.includes('ghost');
