import { guardianPositions, orbitPositions } from '../game/combat';
import { jumpHeight } from '../game/enemyAI';
import type { World } from '../game/world';
import { drawShadow } from './animator';
import {
  buildBackground, drawAirField, drawBeam, drawBossRing, drawEnemyBar, drawEnemyMarks, drawExit, drawGroundField,
  drawGuardian, drawHazard, drawMarker, drawMound, drawOrb, drawParticle, drawPickup, drawPickupShadow,
  drawPlayerAura, drawProjectile, drawRing, drawRock, drawSlash, drawSpotHint, drawText, drawWater, fallback,
} from './draw2d';

// Dibujo 2D clásico (vista cenital) del estado de World. Es el respaldo si el
// dispositivo no tiene WebGL; el normal es el 3D (scene3d.ts). No modifica la
// simulación.

export interface Viewport { ox: number; oy: number; scale: number; dpr: number }

export class Renderer {
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  private arenaImgs = new Map<string, HTMLImageElement>();
  showDamageNumbers = true;

  constructor(private ctx: CanvasRenderingContext2D) {}

  private background(w: World): HTMLCanvasElement {
    const key = `${w.gym.id}:${w.H}`;
    if (this.bg && this.bgKey === key) return this.bg;
    this.bg = buildBackground(w.gym, w.W, w.H);
    this.bgKey = key;
    return this.bg;
  }

  draw(w: World, vp: Viewport, cssW: number, cssH: number): void {
    const ctx = this.ctx;
    ctx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#141020';
    ctx.fillRect(0, 0, cssW, cssH);

    let sx = 0;
    let sy = 0;
    if (w.shake > 0) {
      sx = (Math.random() - 0.5) * 30 * w.shake;
      sy = (Math.random() - 0.5) * 30 * w.shake;
    }
    ctx.setTransform(vp.dpr * vp.scale, 0, 0, vp.dpr * vp.scale, vp.dpr * (vp.ox + sx), vp.dpr * (vp.oy + sy));
    ctx.imageSmoothingEnabled = false;
    const a = w.arena;
    if (a) {
      // Arena ilustrada: el dibujo es el suelo (y ya trae su salida).
      let img = this.arenaImgs.get(a.image);
      if (!img) {
        img = new Image();
        img.src = a.image;
        this.arenaImgs.set(a.image, img);
      }
      if (img.complete && img.naturalWidth) ctx.drawImage(img, -a.ox * a.s, -a.oy * a.s, a.imgW * a.s, a.imgH * a.s);
    } else {
      ctx.drawImage(this.background(w), 0, 0, w.W, w.H);
      drawExit(ctx, w);
      drawWater(ctx, w);
    }
    for (const f of w.fields) drawGroundField(ctx, f, w, false);
    for (const h of w.hazards) drawHazard(ctx, h, false);
    for (const m of w.markers) drawMarker(ctx, m, w.time, false);
    for (const g of w.pickups) {
      drawPickupShadow(ctx, g, false);
      drawPickup(ctx, g, w.time);
    }

    // Entidades ordenadas por profundidad (pies).
    type Drawable = { y: number; fn: () => void };
    const list: Drawable[] = [];
    for (const c of w.corpses) list.push({ y: c.y - 1, fn: () => { c.anim.draw(ctx, c.x, c.y, { alpha: Math.min(1, c.fade * 1.6) }); } });
    for (const e of w.enemies) {
      list.push({
        y: e.y,
        fn: () => {
          const lift = jumpHeight(e);
          drawShadow(ctx, e.def.dex, e.x, e.y, e.scale * (lift ? 0.7 : 1));
          drawBossRing(ctx, e, false);
          if (e.hidden) return drawMound(ctx, e, false);
          const x = e.x + (e.phase === 'aim' || e.phase === 'fuse' ? Math.sin(w.time * 60) * 1.2 : 0);
          if (!e.anim.draw(ctx, x, e.y - lift, { flash: e.flash > 0, softFlash: !!e.boss })) fallback(ctx, x, e.y - lift, '#a070c0');
          drawEnemyMarks(ctx, e);
        },
      });
    }
    list.push({
      y: w.player.y,
      fn: () => {
        const p = w.player;
        drawShadow(ctx, p.species.dex, p.x, p.y, p.anim.scale);
        const blink = p.invuln > 0 && w.phase === 'playing' && Math.floor(w.time * 20) % 2 === 0;
        if (!p.anim.draw(ctx, p.x, p.y, { flash: p.hitFlash > 0, softFlash: true, alpha: blink ? 0.45 : 1 })) fallback(ctx, p.x, p.y, '#f08030');
        drawPlayerAura(ctx, p);
      },
    });
    if (!w.arena) for (const o of w.obstacles) if (o.kind === 'rock') list.push({ y: o.y + o.h, fn: () => drawRock(ctx, o) });
    for (const o of w.obstacles) if (o.kind === 'house') list.push({ y: o.y + o.h, fn: () => drawHouse(ctx, o) });
    for (const sp of w.town?.spots ?? []) drawSpotHint(ctx, sp.x, sp.y, w.time);
    for (const n of w.npcs) list.push({ y: n.y, fn: () => { drawShadow(ctx, n.dex, n.x, n.y, n.anim.scale); if (!n.anim.draw(ctx, n.x, n.y)) fallback(ctx, n.x, n.y, '#c0c0c0'); } });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.fn();

    for (const f of w.fields) drawAirField(ctx, f, w);
    for (const g of guardianPositions(w)) drawGuardian(ctx, g);
    for (const m of w.player.moves) if (m.def.kind === 'orbit') for (const o of orbitPositions(w, m)) drawOrb(ctx, m, o, w.time);
    for (const p of w.projectiles) drawProjectile(ctx, p, w.time);
    for (const s of w.slashes) drawSlash(ctx, s);
    for (const b of w.beams) drawBeam(ctx, b);
    for (const r of w.rings) drawRing(ctx, r, false);
    for (const p of w.particles) drawParticle(ctx, p);
    for (const e of w.enemies) drawEnemyBar(ctx, e);
    if (this.showDamageNumbers) for (const t of w.texts) drawText(ctx, t);
  }
}

/** Casa de pueblo vista desde arriba (dibujo 2D de respaldo). */
function drawHouse(ctx: CanvasRenderingContext2D, o: { x: number; y: number; w: number; h: number; wall?: string; roof?: string }): void {
  ctx.fillStyle = o.wall ?? '#efe6d6';
  ctx.fillRect(o.x, o.y + o.h * 0.45, o.w, o.h * 0.55);
  ctx.fillStyle = o.roof ?? '#c84a3a';
  ctx.fillRect(o.x - 4, o.y, o.w + 8, o.h * 0.5);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(o.x - 4, o.y + o.h * 0.25, o.w + 8, o.h * 0.25);
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(o.x + o.w / 2 - 8, o.y + o.h - 22, 16, 22);
}
