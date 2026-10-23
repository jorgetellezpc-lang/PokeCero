import { TRAINER_ATLAS, type TrainerFrame } from '../data/trainerAtlas';

// ============================================================================
// Entrenador (sprites recortados de las hojas de concepto del usuario) y el
// lanzamiento de la Poké Ball antes de cada combate:
//
//   prepara → lanza → la bola vuela en arco → se abre con un destello →
//   haz de luz del color del Pokémon → el Pokémon aparece en blanco y toma color
//
// Todo se dibuja en un lienzo 2D ya colocado en coordenadas del mundo.
// ============================================================================

/** Altura del entrenador en unidades del mundo. */
export const TRAINER_H = 46;
/** Unidades del mundo por píxel del recorte. */
const K = TRAINER_H / 85;

let sheet: HTMLImageElement | null = null;
function img(): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  if (!sheet) {
    sheet = new Image();
    sheet.src = 'ui/trainer.webp';
  }
  return sheet.complete && sheet.naturalWidth ? sheet : null;
}
/** Empieza a cargar la hoja del entrenador. */
export const preloadTrainer = () => { img(); walkImg(); };

/** Dibuja un recorte con los pies en (x, y). */
function frame(ctx: CanvasRenderingContext2D, f: TrainerFrame, x: number, y: number, o: { flip?: boolean; alpha?: number; scale?: number } = {}): void {
  const im = img();
  if (!im) return;
  const [sx, sy, sw, sh] = TRAINER_ATLAS[f];
  const k = K * (o.scale ?? 1);
  const w = sw * k;
  const h = sh * k;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.translate(x, y);
  if (o.flip) ctx.scale(-1, 1);
  ctx.drawImage(im, sx, sy, sw, sh, -w / 2, -h, w, h);
  ctx.restore();
}

/** Sombra bajo los pies. */
export function trainerShadow(ctx: CanvasRenderingContext2D, x: number, y: number, alpha = 1): void {
  ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

type Dir = 'down' | 'up' | 'right' | 'left';

// Hoja de andar del entrenador (del usuario, limpiada: sin placas de sombra ni
// huecos en el pelo): 6 fotogramas × 4 filas (abajo, izquierda, derecha,
// arriba), celdas de 128 px. Ver public/ui/trainer-walk.webp.
const WALK_CELL = 128;
const WALK_ROW: Record<Dir, number> = { down: 0, left: 1, right: 2, up: 3 };
/** Línea de los pies (px desde arriba) de cada celda, para apoyarlos en el suelo. */
const WALK_FEET = [126, 126, 126, 126, 126, 126, 122, 122, 122, 122, 122, 122, 124, 122, 122, 121, 124, 124, 120, 119, 120, 121, 121, 121];
/** Unidades del mundo por píxel de la hoja de andar (el entrenador mide ~116 px). */
const KW = TRAINER_H / 116;

let walkSheet: HTMLImageElement | null = null;
function walkImg(): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  if (!walkSheet) walkSheet = Object.assign(new Image(), { src: 'ui/trainer-walk.webp' });
  return walkSheet.complete && walkSheet.naturalWidth ? walkSheet : null;
}

/** Fotograma de andar con los pies en (x, y). */
function walkFrame(ctx: CanvasRenderingContext2D, dir: Dir, i: number, x: number, y: number, alpha = 1): void {
  const im = walkImg();
  if (!im) return;
  const row = WALK_ROW[dir];
  const col = i % 6;
  const foot = WALK_FEET[row * 6 + col];
  const w = WALK_CELL * KW;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= alpha;
  ctx.drawImage(im, col * WALK_CELL, row * WALK_CELL, WALK_CELL, WALK_CELL, x - w / 2, y - foot * KW, w, w);
  ctx.restore();
}

/** El entrenador andando por el pueblo: mira hacia donde va y anima al moverse (6 pasos por dirección). */
export class Trainer {
  dir: Dir = 'up';
  moving = false;
  private t = 0;

  update(dt: number, moving: boolean, angle: number, speed: number): void {
    this.moving = moving;
    if (moving) {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      this.dir = Math.abs(c) > Math.abs(s) * 0.9 ? (c > 0 ? 'right' : 'left') : s > 0 ? 'down' : 'up';
      // Unos 10 pasos por segundo, más rápido cuanto más corre.
      this.t += dt * Math.max(8, Math.min(16, speed / 11));
    } else this.t = 0;
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, alpha = 1): void {
    walkFrame(ctx, this.dir, this.moving ? Math.floor(this.t) : 0, x, y, alpha);
  }
}

// --- lanzamiento ---------------------------------------------------------------

/** Tiempos del lanzamiento (segundos). */
export const THROW = {
  windup: 0.62,
  flight: 0.5,
  open: 0.22,
  appear: 0.6,
  linger: 0.3,
  get total() { return this.windup + this.flight + this.open + this.appear + this.linger; },
};

export interface ThrowState {
  t: number;
  /** Dónde está el entrenador (pies). */
  tx: number; ty: number;
  /** Dónde aparece el Pokémon. */
  px: number; py: number;
  /** Color del Pokémon (luz y chispas). */
  color: string;
}

/** Cuánto se ve ya el Pokémon (0 = dentro de la bola, 1 = del todo). */
export function appearOf(s: ThrowState): number {
  const t0 = THROW.windup + THROW.flight + THROW.open * 0.6;
  return Math.max(0, Math.min(1, (s.t - t0) / THROW.appear));
}

/** Dibuja el lanzamiento entero según su tiempo: entrenador, bola, destello y haz de luz. */
export function drawThrow(ctx: CanvasRenderingContext2D, s: ThrowState): void {
  const { t } = s;
  const T = THROW;
  // Entrenador (después se queda mirando: ver drawWatcher)
  trainerShadow(ctx, s.tx, s.ty);
  const flip = s.px < s.tx;
  const fi = Math.min(12, Math.floor((t / (T.windup + 0.15)) * 13));
  frame(ctx, `t${fi}` as TrainerFrame, s.tx, s.ty, { flip });

  // Bola en arco
  const tf = (t - T.windup) / T.flight;
  const hx = s.tx + (flip ? -16 : 16);
  const hy = s.ty - 30;
  if (tf >= 0 && tf < 1) {
    const x = hx + (s.px - hx) * tf;
    const y = hy + (s.py - 14 - hy) * tf - Math.sin(tf * Math.PI) * 46;
    // Estela
    for (let i = 1; i <= 6; i++) {
      const u = Math.max(0, tf - i * 0.035);
      const ex = hx + (s.px - hx) * u;
      const ey = hy + (s.py - 14 - hy) * u - Math.sin(u * Math.PI) * 46;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 - i * 0.07})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 4.5 - i * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ball(ctx, x, y, tf * 14);
  }

  // Apertura: las dos mitades se separan con un destello.
  const to = (t - T.windup - T.flight) / T.open;
  const bx = s.px;
  const by = s.py - 14;
  if (to >= 0 && to < 1.6) {
    const k = Math.min(1, to);
    const a = Math.max(0, 1 - (to - 0.6));
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    halves(ctx, bx, by, k);
    ctx.restore();
    glow(ctx, bx, by, 10 + k * 26, s.color, Math.min(1, a) * 0.9);
  }

  // Haz de luz en espiral y chispas del color del Pokémon.
  const ta = (t - T.windup - T.flight) / (T.open + T.appear);
  if (ta > 0 && ta < 1.3) {
    const a = Math.sin(Math.min(1, ta) * Math.PI) * (ta > 1 ? 1 - (ta - 1) / 0.3 : 1);
    beam(ctx, s.px, s.py, s.color, a, t);
  }
}

/** El entrenador, de espaldas, mirando el combate desde la entrada de la sala. */
export function drawWatcher(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  trainerShadow(ctx, x, y);
  // Respira: sube y baja un píxel de vez en cuando.
  walkFrame(ctx, 'up', 0, x, y - (Math.floor(time * 1.6) % 2));
}

function ball(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number): void {
  const im = img();
  if (!im) return;
  const [sx, sy, sw, sh] = TRAINER_ATLAS.ball;
  const d = 12;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, sx, sy, sw, sh, -d / 2, -d / 2, d, d * (sh / sw));
  ctx.restore();
}

/** Mitades de la bola separándose (k = 0..1). */
function halves(ctx: CanvasRenderingContext2D, x: number, y: number, k: number): void {
  const im = img();
  if (!im) return;
  const [sx, sy, sw, sh] = TRAINER_ATLAS.ball;
  const d = 13;
  const half = sh / 2;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // Arriba: se levanta y gira hacia atrás
  ctx.save();
  ctx.translate(x, y - k * 9);
  ctx.rotate(-k * 0.9);
  ctx.drawImage(im, sx, sy, sw, half, -d / 2, -d / 2, d, d / 2);
  ctx.restore();
  // Abajo: se queda
  ctx.drawImage(im, sx, sy + half, sw, half, x - d / 2, y + k * 2, d, d / 2);
  ctx.restore();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number): void {
  if (a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255, 255, 255, ${a})`);
  g.addColorStop(0.35, withAlpha(color, a * 0.8));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // Destellos en cruz
  ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
  ctx.fillRect(x - r * 0.9, y - 0.75, r * 1.8, 1.5);
  ctx.fillRect(x - 0.75, y - r * 0.9, 1.5, r * 1.8);
  ctx.restore();
}

/** Columna de luz con una espiral, anillo en el suelo y chispas. */
function beam(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, a: number, t: number): void {
  if (a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const H = 120;
  const g = ctx.createLinearGradient(x - 12, 0, x + 12, 0);
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(0.5, withAlpha(color, a * 0.75));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - 12, y - H, 24, H);
  ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.8})`;
  ctx.fillRect(x - 2, y - H, 4, H);
  // Espiral
  ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.9})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    const ang = u * Math.PI * 5 + t * 9;
    const px = x + Math.cos(ang) * (14 - u * 6);
    const py = y - 4 - u * (H - 10) + Math.sin(ang) * 3;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // Anillo en el suelo
  ctx.strokeStyle = withAlpha(color, a);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, 20 + Math.sin(t * 10) * 2, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Chispas
  ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
  for (let i = 0; i < 14; i++) {
    const u = ((i * 0.137 + t * 0.9) % 1);
    const sx = x + Math.sin(i * 7.3 + t * 3) * (10 + (i % 4) * 5);
    const sy = y - u * H * 0.8;
    const s = i % 3 === 0 ? 2.5 : 1.5;
    ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
  }
  ctx.restore();
}

function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
}
