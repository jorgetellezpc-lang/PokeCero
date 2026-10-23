import type { Spot, TownDef } from '../data/adventure';
import type { World } from '../game/world';
import { drawShadow } from './animator';
import { fallback } from './draw2d';
import { buildTownArt, type TownArt } from './townArt';
import { preloadTrainer, Trainer, trainerShadow } from './trainer';

// ============================================================================
// Pueblo en pixel art (lienzo 2D): la cámara sigue a tu Pokémon y amplía el
// dibujo un número entero de píxeles de pantalla, para que se vea nítido.
// Los Pokémon (sprites de PMD) y los objetos de pie se ordenan por sus pies.
// ============================================================================

/** Unidades del mundo que se ven a lo ancho, como mínimo. */
const VIEW_W = 270;

export class TownView {
  private readonly ctx: CanvasRenderingContext2D;
  readonly art: TownArt;
  private cssW = 0;
  /** Píxeles de pantalla por unidad del mundo. */
  private px = 1;
  camX = 0;
  camY = 0;
  /** En el pueblo vas tú, el entrenador (tu Pokémon va en su Poké Ball). */
  readonly trainer = new Trainer();
  private lastT = -1;

  constructor(private readonly canvas: HTMLCanvasElement, readonly town: TownDef) {
    this.ctx = canvas.getContext('2d')!;
    this.art = buildTownArt(town);
    preloadTrainer();
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.cssW = cssW;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    // Escala entera en píxeles reales: cada píxel del dibujo mide lo mismo.
    this.px = Math.max(1, Math.floor((cssW * dpr) / VIEW_W));
  }

  /** Tamaño visible en unidades del mundo. */
  get view(): { w: number; h: number } {
    return { w: this.canvas.width / this.px, h: this.canvas.height / this.px };
  }

  draw(w: World, near: Spot | null): void {
    if (!this.cssW) return;
    const ctx = this.ctx;
    const { w: vw, h: vh } = this.view;
    const p = w.player;
    const dt = this.lastT < 0 ? 0 : Math.max(0, w.time - this.lastT);
    this.lastT = w.time;
    this.trainer.update(dt, p.moving, p.moveAngle, w.playerSpeed());
    // Cámara centrada en el Pokémon (un poco por debajo del centro), sin salirse del pueblo.
    const tx = Math.max(0, Math.min(this.town.W - vw, p.x - vw / 2));
    const ty = Math.max(0, Math.min(this.town.H - vh, p.y - vh * 0.55));
    this.camX += (tx - this.camX) * 0.2;
    this.camY += (ty - this.camY) * 0.2;
    if (Math.abs(tx - this.camX) > 400 || Math.abs(ty - this.camY) > 400) { this.camX = tx; this.camY = ty; }
    const cx = Math.round(this.camX * this.px) / this.px;
    const cy = Math.round(this.camY * this.px) / this.px;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2f6a26';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(this.px, 0, 0, this.px, -cx * this.px, -cy * this.px);

    // Suelo (solo lo visible)
    const sx = Math.max(0, Math.floor(cx));
    const sy = Math.max(0, Math.floor(cy));
    const sw = Math.min(this.town.W - sx, Math.ceil(vw) + 2);
    const sh = Math.min(this.town.H - sy, Math.ceil(vh) + 2);
    ctx.drawImage(this.art.ground, sx, sy, sw, sh, sx, sy, sw, sh);

    // Destellos del agua
    ctx.fillStyle = 'rgba(232, 248, 255, 0.85)';
    const tick = Math.floor(w.time * 3);
    for (const o of this.art.water) {
      if (o.y > cy + vh || o.y + o.h < cy) continue;
      const n = Math.round((o.w * o.h) / 700);
      for (let i = 0; i < n; i++) {
        const hx = frac(Math.sin((i + 1) * 12.9898 + tick * 78.233) * 43758.5453);
        const hy = frac(Math.sin((i + 1) * 39.3468 + tick * 11.135) * 24634.6345);
        const x = Math.floor(o.x + 4 + hx * (o.w - 8));
        const y = Math.floor(o.y + 10 + hy * (o.h - 14));
        if (y < cy - 4 || y > cy + vh + 4) continue;
        ctx.fillRect(x, y, 3, 1);
        ctx.fillRect(x + 1, y - 1, 1, 1);
      }
    }

    // Puntos con los que interactuar: un destello que sube y baja.
    for (const s of this.town.spots) {
      if (s.y < cy - 20 || s.y > cy + vh + 20) continue;
      const on = s === near;
      const bob = Math.round(Math.sin(w.time * 4 + s.x) * 2);
      const y = s.y - (on ? 46 : 38) + bob;
      ctx.fillStyle = on ? '#ffd23a' : 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(s.x - 1, y - 3, 2, 7);
      ctx.fillRect(s.x - 3, y - 1, 6, 3);
      if (on) {
        ctx.fillStyle = '#1f1b2a';
        ctx.fillRect(s.x - 1, y + 5, 2, 1);
      }
    }

    // Objetos de pie y Pokémon, ordenados por sus pies.
    type D = { base: number; fn: () => void };
    const list: D[] = [];
    const top = cy - 10;
    const bottom = cy + vh + 140;
    for (const s of this.art.sprites) {
      if (s.base < top || s.base > bottom || s.x > cx + vw || s.x + s.img.width < cx) continue;
      list.push({ base: s.base, fn: () => ctx.drawImage(s.img, s.x, s.y) });
    }
    for (const n of w.npcs) {
      list.push({ base: n.y, fn: () => { drawShadow(ctx, n.dex, n.x, n.y, n.anim.scale); if (!n.anim.draw(ctx, n.x, n.y)) fallback(ctx, n.x, n.y, '#c0c0c0'); } });
    }
    list.push({
      base: p.y,
      fn: () => {
        trainerShadow(ctx, p.x, p.y);
        this.trainer.draw(ctx, p.x, p.y);
      },
    });
    list.sort((a, b) => a.base - b.base);
    for (const d of list) d.fn();
    // Tu silueta a través de tejados y copas, para no perderte de vista.
    if (this.art.sprites.some((s) => s.base > p.y && s.base < p.y + 60 && p.x > s.x && p.x < s.x + s.img.width && p.y > s.y)) {
      this.trainer.draw(ctx, p.x, p.y, 0.4);
    }
  }

  /** Minimapa redondo centrado en tu Pokémon. */
  drawMini(mctx: CanvasRenderingContext2D, size: number, w: World): void {
    const s = size;
    const scale = 0.25;
    const zoom = s / 120;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, s, s);
    mctx.save();
    mctx.beginPath();
    mctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
    mctx.clip();
    mctx.fillStyle = '#2f6a26';
    mctx.fillRect(0, 0, s, s);
    mctx.imageSmoothingEnabled = false;
    const k = zoom * 1.4;
    const px = w.player.x * scale * k;
    const py = w.player.y * scale * k;
    mctx.drawImage(this.art.mini, s / 2 - px, s / 2 - py, this.art.mini.width * k, this.art.mini.height * k);
    // Salida y gimnasio
    for (const sp of this.town.spots) {
      if (sp.kind !== 'exit' && sp.kind !== 'gym' && sp.kind !== 'center' && sp.kind !== 'shop') continue;
      const x = s / 2 + (sp.x - w.player.x) * scale * k;
      const y = s / 2 + (sp.y - w.player.y) * scale * k;
      mctx.fillStyle = sp.kind === 'center' ? '#ff5a4a' : sp.kind === 'shop' ? '#4a8aff' : sp.kind === 'gym' ? '#ffd23a' : '#ffffff';
      mctx.fillRect(Math.round(x - 2.5 * zoom), Math.round(y - 2.5 * zoom), Math.round(5 * zoom), Math.round(5 * zoom));
    }
    mctx.restore();
    // Tú, en el centro
    mctx.fillStyle = '#1f1b2a';
    mctx.beginPath();
    mctx.arc(s / 2, s / 2, 5 * zoom, 0, Math.PI * 2);
    mctx.fill();
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.arc(s / 2, s / 2, 3.2 * zoom, 0, Math.PI * 2);
    mctx.fill();
  }
}

const frac = (v: number) => v - Math.floor(v);
