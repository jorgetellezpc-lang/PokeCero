import metaRaw from '../data/ps/spriteMeta.json';
import { BALANCE } from '../config/balance';

// ============================================================================
// Sprites animados estilo Pokémon Mundo Misterioso (SpriteCollab, CC BY-NC 4.0;
// artistas en public/sprites/CREDITS.md). Animador basado en el de PokéSurvivor
// (js/core/sprites.js). Required Notice: Copyright 2026 JPTER78
// (https://github.com/JPTER78/pokesurvivor)
//
// Hoja = columnas (fotogramas) × filas (8 direcciones):
//   0 Abajo · 1 Abajo-dcha · 2 Dcha · 3 Arriba-dcha · 4 Arriba · 5 Arriba-izq · 6 Izq · 7 Abajo-izq
// Cada animación tiene su tamaño de fotograma y se alinea por el ancla a los
// pies (ax, ay), así el sprite no salta al cambiar de animación.
// ============================================================================

export type AnimName = 'Idle' | 'Walk' | 'Attack' | 'Shoot' | 'Charge' | 'Hurt' | 'Faint';

interface AnimMeta {
  w: number; h: number; n: number; r: number;
  /** Duración de cada fotograma en 1/60 s. */
  d: number[];
  ax: number; ay: number;
}
interface SpriteMeta { s: number; hv: number; a: Partial<Record<AnimName, AnimMeta>> }

const META = metaRaw as unknown as Record<string, SpriteMeta>;

/** Ruta base de las hojas. Se puede sustituir por un resolvedor (p. ej. data URLs). */
let resolveUrl = (dex: number, anim: AnimName) => `sprites/pokemon/${dex}/${anim}.png`;
export function setSpriteResolver(fn: (dex: number, anim: AnimName) => string): void {
  resolveUrl = fn;
}

export const PX = () => BALANCE.ps.spritePx;

export function spriteMeta(dex: number): SpriteMeta | null {
  return META[dex] ?? null;
}

/** ¿Flota en su sprite? (Zubat, Gastly…) */
export const hovers = (dex: number) => !!spriteMeta(dex)?.hv;

function animName(dex: number, anim: AnimName): AnimName {
  const m = spriteMeta(dex);
  if (!m) return anim;
  if (m.a[anim]) return anim;
  return m.a.Idle ? 'Idle' : 'Walk';
}

export function animMeta(dex: number, anim: AnimName): AnimMeta | null {
  return spriteMeta(dex)?.a[animName(dex, anim)] ?? null;
}

interface Sheet { img: HTMLImageElement; ready: boolean; failed: boolean }
const sheets = new Map<string, Sheet>();
const whites = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

function sheet(dex: number, anim: AnimName): Sheet | null {
  if (typeof Image === 'undefined') return null;
  const name = animName(dex, anim);
  const key = `${dex}/${name}`;
  let s = sheets.get(key);
  if (s) return s;
  const img = new Image();
  s = { img, ready: false, failed: false };
  const ss = s;
  img.onload = () => { ss.ready = true; };
  img.onerror = () => { ss.failed = true; };
  img.src = resolveUrl(dex, name);
  sheets.set(key, s);
  return s;
}

/** Versión blanca de una hoja (destello al recibir un golpe), hecha una vez. */
function white(img: HTMLImageElement): HTMLCanvasElement {
  let c = whites.get(img);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, c.width, c.height);
  whites.set(img, c);
  return c;
}

export const ANIMS: AnimName[] = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint'];

/** Precarga las hojas de esos Pokémon. */
export function preload(dexes: number[]): void {
  for (const d of dexes) for (const a of ANIMS) sheet(d, a);
}

/** Ángulo (atan2(dy, dx)) → fila de dirección 0..7. */
export function dirFromAngle(a: number): number {
  return ((Math.round((Math.PI / 2 - a) / (Math.PI / 4)) % 8) + 8) % 8;
}

/** Radio de colisión aproximado a partir del sprite. */
export function bodyRadius(dex: number, scale = 1): number {
  const m = animMeta(dex, 'Idle');
  const w = m ? m.w : 32;
  return Math.max(5, Math.min(26, w * 0.22)) * PX() * scale;
}

/** Alto visual aproximado (barras de vida y números). */
export function bodyHeight(dex: number, scale = 1): number {
  const m = animMeta(dex, 'Idle');
  return (m ? m.ay : 24) * PX() * scale;
}

/** Escala del Pokémon del jugador: los muy grandes se dibujan algo más pequeños. */
export function playerScale(dex: number): number {
  const m = animMeta(dex, 'Idle');
  const h = m ? Math.max(m.ay, m.w * 0.55) : 24;
  const BIG = 36;
  if (h <= BIG) return 1;
  return Math.round(((BIG + (h - BIG) * 0.4) / h) * 16) / 16;
}

/** Sombra elíptica bajo los pies, según el tamaño de sombra de PMD. */
export function drawShadow(ctx: CanvasRenderingContext2D, dex: number, x: number, y: number, scale = 1, flat = false): void {
  const s = spriteMeta(dex)?.s ?? 1;
  const rx = [5, 8, 12][Math.max(0, Math.min(2, s))] * PX() * scale;
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * (flat ? 0.75 : 0.42), 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Reproduce las animaciones de un Pokémon.
 *   loop(anim)  animación de fondo (Idle / Walk)
 *   play(anim)  animación de una vez (Attack, Shoot, Hurt…) que tapa a la de fondo
 */
export class Animator {
  base: AnimName = 'Idle';
  cur: AnimName = 'Idle';
  frame = 0;
  t = 0;
  speed = 1;
  once = false;
  hold = false;
  done = false;
  dir = 0;

  constructor(public dex: number, public scale = 1) {}

  loop(anim: AnimName, speed = 1): void {
    this.base = anim;
    if (!this.once && this.cur !== anim) this.start(anim, false);
    if (!this.once) this.speed = speed;
  }

  play(anim: AnimName, opts: { speed?: number; hold?: boolean } = {}): void {
    this.start(anim, true);
    this.speed = opts.speed ?? 1;
    this.hold = !!opts.hold;
  }

  busy(): boolean {
    return this.once && !this.done;
  }

  private start(anim: AnimName, once: boolean): void {
    this.cur = animName(this.dex, anim);
    this.frame = 0;
    this.t = 0;
    this.once = once;
    this.done = false;
  }

  update(dt: number): void {
    const m = animMeta(this.dex, this.cur);
    if (!m || this.done) return;
    this.t += dt * 60 * this.speed;
    while (this.t >= m.d[this.frame]) {
      this.t -= m.d[this.frame];
      this.frame++;
      if (this.frame >= m.n) {
        if (this.once) {
          if (this.hold) {
            this.frame = m.n - 1;
            this.done = true;
            return;
          }
          this.start(this.base, false);
          this.speed = 1;
          return;
        }
        this.frame = 0;
      }
    }
  }

  /**
   * Fotograma que toca ahora: hoja, recorte y ancla a los pies (para el 3D).
   * Mismas reglas que draw(): si la hoja aún no ha cargado, usa Idle.
   */
  frameInfo(): { img: HTMLImageElement; sx: number; sy: number; w: number; h: number; ax: number; ay: number; k: number } | null {
    let m = animMeta(this.dex, this.cur);
    let s = sheet(this.dex, this.cur);
    let frame = this.frame;
    if (s && !s.ready) {
      const idle = sheet(this.dex, 'Idle');
      if (idle?.ready) {
        s = idle;
        m = animMeta(this.dex, 'Idle');
        frame = 0;
      }
    }
    if (!m || !s || !s.ready) return null;
    const row = Math.min(this.dir, m.r - 1);
    return { img: s.img, sx: Math.min(frame, m.n - 1) * m.w, sy: row * m.h, w: m.w, h: m.h, ax: m.ax, ay: m.ay, k: PX() * this.scale };
  }

  /** Dibuja con los pies en (x, y). */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, opts: { flash?: boolean; softFlash?: boolean; alpha?: number } = {}): boolean {
    let m = animMeta(this.dex, this.cur);
    let s = sheet(this.dex, this.cur);
    let frame = this.frame;
    if (s && !s.ready) {
      const idle = sheet(this.dex, 'Idle');
      if (idle?.ready) {
        s = idle;
        m = animMeta(this.dex, 'Idle');
        frame = 0;
      }
    }
    if (!m || !s || !s.ready) return false;
    const k = PX() * this.scale;
    const row = Math.min(this.dir, m.r - 1);
    const alpha = opts.alpha ?? 1;
    if (alpha <= 0) return true;
    const sx = Math.min(frame, m.n - 1) * m.w;
    const sy = row * m.h;
    const dx = x - m.ax * k;
    const dy = y - m.ay * k;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * alpha;
    if (!opts.flash || opts.softFlash) ctx.drawImage(s.img, sx, sy, m.w, m.h, dx, dy, m.w * k, m.h * k);
    if (opts.flash) {
      if (opts.softFlash) ctx.globalAlpha = prev * alpha * 0.55;
      ctx.drawImage(white(s.img), sx, sy, m.w, m.h, dx, dy, m.w * k, m.h * k);
    }
    ctx.globalAlpha = prev;
    return true;
  }
}

/** Retrato estático (primer fotograma de Idle mirando abajo) como data URL, para la interfaz. */
export function portrait(dex: number, size = 64, silhouette = false): Promise<string> {
  return new Promise((resolve) => {
    const m = animMeta(dex, 'Idle');
    const s = sheet(dex, 'Idle');
    if (!m || !s) return resolve('');
    const draw = () => {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      const k = Math.max(1, Math.floor(size / Math.max(m.w, m.h)));
      const w = m.w * k;
      const h = m.h * k;
      ctx.drawImage(s.img, 0, 0, m.w, m.h, (size - w) / 2, (size - h) / 2 + (size - m.ay * k) * 0.15, w, h);
      if (silhouette) {
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(0, 0, size, size);
      }
      resolve(c.toDataURL());
    };
    if (s.ready) draw();
    else {
      s.img.addEventListener('load', draw, { once: true });
      s.img.addEventListener('error', () => resolve(''), { once: true });
    }
  });
}
