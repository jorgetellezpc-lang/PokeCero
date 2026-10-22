import type { Obstacle } from '../data/layouts';
import type { GymDef } from '../data/types';
import { GUARD_R } from '../game/combat';
import { jumpHeight } from '../game/enemyAI';
import type { Beam, Enemy, Field, FloatText, Hazard, OwnedMove, Particle, Pickup, Player, Projectile, Ring, Slash } from '../game/entities';
import { Rng } from '../game/rng';
import type { World } from '../game/world';
import { drawShape, frameCount, isDirectional, shapeFor, spins } from './vfx';

// Piezas de dibujo 2D de cada elemento, en coordenadas del mundo. Las usan el
// dibujo 2D clásico (renderer.ts) y el 3D (scene3d.ts: capa del suelo y capa
// de efectos proyectada encima).
//
// `flat`: en el 2D clásico los círculos del suelo se aplastan para fingir
// perspectiva; en el 3D el suelo ya está inclinado y van redondos.

const sq = (flat: boolean, k: number) => (flat ? 1 : k);

export const PIXEL = 4; // tamaño de "píxel" del fondo en unidades de mundo

/** Agua: charcas con borde claro y ondas que se mueven. */
export function drawWater(ctx: CanvasRenderingContext2D, w: World): void {
  for (const o of w.obstacles) {
    if (o.kind !== 'water') continue;
    ctx.fillStyle = '#2f6fb0';
    ctx.fillRect(o.x - 2, o.y - 2, o.w + 4, o.h + 4);
    ctx.fillStyle = '#3f8fd8';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#2a64a0';
    ctx.fillRect(o.x, o.y, o.w, 4);
    ctx.fillStyle = 'rgba(200, 235, 255, 0.55)';
    for (let yy = o.y + 10; yy < o.y + o.h - 4; yy += 14) {
      const off = ((w.time * 14 + yy * 3) % 24) - 12;
      for (let xx = o.x + 8 + off; xx < o.x + o.w - 10; xx += 24) {
        if (xx > o.x + 2) ctx.fillRect(Math.round(xx), Math.round(yy), 8, 2);
      }
    }
  }
}

/** Roca: bloque pixel art con cara superior clara y sombra. */
export function drawRock(ctx: CanvasRenderingContext2D, o: Obstacle): void {
  const top = 8;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(o.x + 3, o.y + o.h - 2, o.w, 6);
  ctx.fillStyle = '#3d342c';
  ctx.fillRect(o.x - 2, o.y - top - 2, o.w + 4, o.h + top + 4);
  ctx.fillStyle = '#7a6e62';
  ctx.fillRect(o.x, o.y - top, o.w, o.h + top);
  ctx.fillStyle = '#a59784';
  ctx.fillRect(o.x, o.y - top, o.w, Math.min(o.h, 14));
  ctx.fillStyle = '#c4b6a0';
  ctx.fillRect(o.x + 3, o.y - top + 2, Math.max(4, o.w * 0.3), 3);
  ctx.fillStyle = '#5e5348';
  for (let xx = o.x + 10; xx < o.x + o.w - 6; xx += 22) ctx.fillRect(xx, o.y - top + 18, 3, Math.max(4, o.h - 20));
}

export function drawExit(ctx: CanvasRenderingContext2D, w: World): void {
  const { x, y, r } = w.exit;
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(x - r - 6, 0, (r + 6) * 2, y + 10);
  if (w.exitOpen) {
    const t = (Math.sin(w.time * 6) + 1) / 2;
    ctx.fillStyle = `rgba(120, 220, 255, ${0.5 + t * 0.4})`;
    ctx.fillRect(x - r, 2, r * 2, y + 6);
    drawExitArrow(ctx, w);
  } else {
    ctx.fillStyle = '#5a4a3a';
    for (let i = 0; i < 6; i++) ctx.fillRect(x - r + i * ((r * 2) / 6) + 2, 2, 4, y + 6);
  }
}

export function drawExitArrow(ctx: CanvasRenderingContext2D, w: World): void {
  const { x, y } = w.exit;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('▲', x, y + 26 + Math.sin(w.time * 6) * 3);
}

/** Ataque enemigo con aviso: zona que se rellena o franja. */
export function drawHazard(ctx: CanvasRenderingContext2D, h: Hazard, flat: boolean): void {
  const k = Math.min(1, h.t / h.delay);
  const e = sq(flat, 0.62);
  ctx.save();
  if (h.kind === 'zone') {
    ctx.globalAlpha = 0.18 + 0.2 * k;
    ctx.fillStyle = h.color;
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, h.r * k, h.r * k * e, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#ff4040';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, h.r, h.r * e, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);
    ctx.globalAlpha = 0.12 + 0.25 * k;
    ctx.fillStyle = '#ff4040';
    ctx.fillRect(0, -h.w / 2, h.len, h.w);
    ctx.globalAlpha = 0.5 + 0.4 * k;
    ctx.fillStyle = h.color;
    ctx.fillRect(0, -h.w / 2 * k, h.len * k, h.w * k);
  }
  ctx.restore();
}

/** Lo de los movimientos que va en el suelo (debajo de los Pokémon). */
export function drawGroundField(ctx: CanvasRenderingContext2D, f: Field, w: World, flat: boolean): void {
  ctx.save();
  const fadeIn = Math.min(1, f.t * 6);
  const e6 = sq(flat, 0.6);
  const e62 = sq(flat, 0.62);
  if (f.kind === 'vortex') {
    const a = Math.min(1, (f.life - f.t) * 2, fadeIn);
    ctx.globalAlpha = 0.22 * a;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.r, f.r * e6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.6 * a;
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const rr = f.r * (0.35 + k * 0.28);
      const a0 = w.time * (3 - k * 0.6) + k * 2;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, rr, rr * e6, 0, a0, a0 + 3.4);
      ctx.stroke();
    }
  } else if (f.kind === 'stunzone') {
    const k = Math.min(1, f.t / (f.delay ?? 0.45));
    ctx.globalAlpha = 0.15 + 0.25 * k;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.r * k, f.r * k * e6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.r, f.r * e6, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (f.kind === 'patch') {
    const a = Math.min(1, (f.life - f.t) * 2, fadeIn);
    ctx.globalAlpha = 0.32 * a;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.r, f.r * e62, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (f.kind === 'mine') {
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.r * 0.45, f.r * 0.45 * e62, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (f.kind === 'meteor') {
    const k = Math.max(0, Math.min(1, f.t / (f.fall ?? 0.5)));
    ctx.globalAlpha = 0.2 + k * 0.3;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.r * (0.4 + k * 0.6), f.r * (0.4 + k * 0.6) * e6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Lo que va por encima de los Pokémon: minas, meteoros cayendo, torretas, cargas. */
export function drawAirField(ctx: CanvasRenderingContext2D, f: Field, w: World): void {
  const type = f.move.def.type;
  const shape = shapeFor(f.move.def.id, type);
  if (f.kind === 'mine') {
    const armed = f.t >= (f.arm ?? 0.35);
    drawShape(ctx, shape, type, f.x, f.y - 4, { alpha: armed && Math.sin(w.time * 8 + f.x) > 0.3 ? 1 : 0.75 });
  } else if (f.kind === 'meteor' && f.t >= 0) {
    const k = Math.min(1, f.t / (f.fall ?? 0.5));
    drawShape(ctx, shape, type, f.x, f.y - (1 - k) * 160, { scale: 1.3, frame: w.time * 10, angle: w.time * 8 });
  } else if (f.kind === 'turret') {
    drawShape(ctx, shape, type, f.x, f.y - 14 + Math.sin(w.time * 5) * 2, { scale: 1.2, frame: w.time * 8 });
  } else if (f.kind === 'charge') {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w.player.x, w.player.y - 12, 6 + (1 - Math.min(1, f.t / (f.at ?? 0.75))) * 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** Aviso de que va a aparecer un enemigo. */
export function drawMarker(ctx: CanvasRenderingContext2D, m: World['markers'][number], time: number, flat: boolean): void {
  const pulse = (Math.sin(time * 14) + 1) / 2;
  const r = m.boss ? 30 : 11;
  const e = sq(flat, 0.62);
  ctx.strokeStyle = `rgba(255, 70, 70, ${0.5 + pulse * 0.5})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(m.x, m.y, r, r * e, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(m.x - r * 0.5, m.y - r * e * 0.48);
  ctx.lineTo(m.x + r * 0.5, m.y + r * e * 0.48);
  ctx.moveTo(m.x + r * 0.5, m.y - r * e * 0.48);
  ctx.lineTo(m.x - r * 0.5, m.y + r * e * 0.48);
  ctx.stroke();
}

export function drawPickupShadow(ctx: CanvasRenderingContext2D, g: Pickup, flat: boolean): void {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(g.x, g.y, 4, 4 * sq(flat, 0.4), 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPickup(ctx: CanvasRenderingContext2D, g: Pickup, time: number): void {
  const bob = Math.sin(time * 5 + g.x) * 1.5;
  const y = g.y - 4 + bob;
  if (g.kind === 'xp' || g.kind === 'xpBig') {
    const s = g.kind === 'xpBig' ? 5 : 3.2;
    ctx.fillStyle = g.kind === 'xpBig' ? '#ffd95e' : '#7fe0ff';
    ctx.beginPath();
    ctx.moveTo(g.x, y - s);
    ctx.lineTo(g.x + s * 0.8, y);
    ctx.lineTo(g.x, y + s);
    ctx.lineTo(g.x - s * 0.8, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(g.x - 1, y - s + 1, 1, 1);
  } else if (g.kind === 'coin') {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(g.x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(g.x - 0.5, y - 2, 1, 4);
  } else if (g.kind === 'heal') {
    drawShape(ctx, 'heart', 'fairy', g.x, y, { scale: 0.8 });
  } else if (g.kind === 'ticket') {
    ctx.fillStyle = '#f070b0';
    ctx.fillRect(g.x - 5, y - 3.5, 10, 7);
    ctx.fillStyle = '#ffd0e8';
    ctx.fillRect(g.x - 1, y - 3.5, 1, 7);
  } else if (g.kind === 'item') {
    const glow = 0.5 + Math.sin(time * 6) * 0.3;
    ctx.fillStyle = `rgba(255, 210, 63, ${glow})`;
    ctx.beginPath();
    ctx.arc(g.x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    drawShape(ctx, 'star', 'electric', g.x, y, { scale: 1, frame: time * 4 });
  }
}

/** Anillo en el suelo bajo un jefe. */
export function drawBossRing(ctx: CanvasRenderingContext2D, e: Enemy, flat: boolean): void {
  if (!e.boss) return;
  ctx.strokeStyle = e.boss.role === 'boss' ? 'rgba(255,80,60,0.75)' : 'rgba(255,200,60,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(e.x, e.y, e.r * 1.6, e.r * 1.6 * sq(flat, 0.375), 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** Montículo de tierra (jefe bajo tierra con Excavar). */
export function drawMound(ctx: CanvasRenderingContext2D, e: Enemy, flat: boolean): void {
  ctx.fillStyle = 'rgba(150, 110, 70, 0.8)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y, e.r * 1.1, e.r * 1.1 * sq(flat, 0.41), 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Escudo de defensa acumulada del jugador (potenciador). */
export function drawPlayerAura(ctx: CanvasRenderingContext2D, p: Player): void {
  if (p.buffs.def.n <= 0) return;
  ctx.strokeStyle = 'rgba(160, 200, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 12, p.r + 6, 0, Math.PI * 2);
  ctx.stroke();
}

/** Aviso de embestida, escudo y estados de un enemigo (encima de su cabeza). */
export function drawEnemyMarks(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const top = e.y - jumpHeight(e) - e.bodyH - 4;
  if (e.phase === 'aim' || e.phase === 'fuse') {
    ctx.fillStyle = '#ff4040';
    ctx.font = '700 15px Rajdhani, "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', e.x, top - 4);
  }
  if (e.shield > 0) {
    ctx.strokeStyle = 'rgba(159, 216, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y - jumpHeight(e) - e.bodyH * 0.5, e.r + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  let dx = -6;
  for (const [on, col] of [[e.burn > 0, '#ff9a4d'], [e.poison > 0, '#d47cf0'], [e.slow > 0, '#7fd0ff'], [e.stunT > 0, '#ffe14d']] as [boolean, string][]) {
    if (!on) continue;
    ctx.fillStyle = col;
    ctx.fillRect(e.x + dx, top + 4, 3, 3);
    dx += 4;
  }
}

/** Escudo de Pantalla Luz. */
export function drawGuardian(ctx: CanvasRenderingContext2D, g: { x: number; y: number }): void {
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#bfe8ff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(g.x, g.y, GUARD_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawOrb(ctx: CanvasRenderingContext2D, m: OwnedMove, o: { x: number; y: number }, time: number): void {
  const shape = shapeFor(m.def.id, m.def.type);
  drawShape(ctx, shape, m.def.type, o.x, o.y, { frame: time * 10, angle: spins(shape) ? time * 6 : m.angle + Math.PI / 2, scale: 0.9 });
}

export function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, time: number): void {
  const angle = Math.atan2(p.vy, p.vx);
  if (!p.friendly) {
    ctx.fillStyle = 'rgba(255, 60, 100, 0.35)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 3, 0, Math.PI * 2);
    ctx.fill();
    drawShape(ctx, shapeFor(null, p.element), p.element, p.x, p.y, { angle, frame: time * 10, scale: 0.85 });
    return;
  }
  const shape = p.move?.def.shape ?? shapeFor(p.move?.def.id ?? null, p.element);
  const scale = Math.max(0.6, Math.min(1.6, p.r / 6));
  const tier = p.tier ?? 0;
  // Estela (color del segundo tipo) y halo que crecen con las mejoras. Cortos
  // y translúcidos para no tapar enemigos ni avisos.
  if (p.trail || tier) {
    const k = 0.03 + tier * 0.01;
    ctx.save();
    ctx.globalAlpha = 0.35 + tier * 0.08;
    ctx.strokeStyle = p.trail ?? p.color;
    ctx.lineCap = 'round';
    ctx.lineWidth = p.r * (0.8 + tier * 0.15);
    ctx.beginPath();
    ctx.moveTo(p.x - p.vx * k, p.y - p.vy * k);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (tier >= 2) {
      ctx.globalAlpha = tier === 3 ? 0.35 : 0.2;
      ctx.fillStyle = tier === 3 ? '#ffe9a0' : p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (tier === 3 ? 1.9 : 1.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  const a = isDirectional(shape) ? angle : spins(shape) ? time * 10 : 0;
  drawShape(ctx, shape, p.element, p.x, p.y, { angle: a, frame: frameCount(shape) > 1 ? time * 12 : 0, scale });
}

export function drawSlash(ctx: CanvasRenderingContext2D, s: Slash): void {
  const k = Math.max(0, s.life / 0.18);
  ctx.save();
  ctx.globalAlpha = Math.min(1, k * 1.3);
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 6 * k + 2;
  ctx.lineCap = 'round';
  const half = Math.min(s.arc, Math.PI * 2) / 2;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.radius * (1.05 - k * 0.25), s.angle - half, s.angle + half);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.radius * (1.05 - k * 0.25), s.angle - half * 0.7, s.angle + half * 0.7);
  ctx.stroke();
  ctx.restore();
}

export function drawBeam(ctx: CanvasRenderingContext2D, b: Beam): void {
  const k = Math.max(0, b.life / 0.22);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  ctx.globalAlpha = Math.min(1, k * 1.5) * 0.55;
  ctx.fillStyle = b.color;
  ctx.fillRect(0, -b.w / 2, b.len, b.w);
  ctx.globalAlpha = Math.min(1, k * 1.5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, -b.w / 6, b.len, b.w / 3);
  ctx.restore();
}

export function drawRing(ctx: CanvasRenderingContext2D, r: Ring, flat: boolean): void {
  const k = 1 - r.life / r.maxLife;
  const rad = r.r + (r.maxR - r.r) * Math.min(1, k * 1.6);
  ctx.strokeStyle = r.color;
  ctx.globalAlpha = Math.max(0, r.life / r.maxLife);
  ctx.lineWidth = r.width;
  ctx.beginPath();
  ctx.ellipse(r.x, r.y, rad, rad * sq(flat, 0.75), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
  ctx.fillStyle = p.color;
  ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  ctx.globalAlpha = 1;
}

/** Barra de vida sobre un enemigo dañado (los jefes la llevan en la interfaz). */
export function drawEnemyBar(ctx: CanvasRenderingContext2D, e: Enemy): void {
  if (e.boss || e.hidden || (e.hp >= e.maxHp && e.shield <= 0)) return;
  const bw = Math.max(16, e.r * 2);
  const x = e.x - bw / 2;
  const y = e.y - jumpHeight(e) - e.bodyH - 6;
  ctx.fillStyle = '#1c1424';
  ctx.fillRect(x - 1, y - 1, bw + 2, 4);
  ctx.fillStyle = '#e04040';
  ctx.fillRect(x, y, bw * Math.max(0, e.hp / e.maxHp), 2);
  if (e.shield > 0) {
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(x, y - 2, bw * Math.min(1, e.shield / e.maxHp), 1);
  }
}

export function drawText(ctx: CanvasRenderingContext2D, t: FloatText): void {
  ctx.textAlign = 'center';
  ctx.globalAlpha = Math.min(1, t.life * 3);
  ctx.font = `700 ${Math.round(t.size * 1.35)}px Rajdhani, "Arial Narrow", sans-serif`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeText(t.text, t.x, t.y);
  ctx.fillStyle = t.color;
  ctx.fillText(t.text, t.x, t.y);
  ctx.globalAlpha = 1;
}

/** Respaldo si falta un sprite: bolita. */
export function fallback(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 10, 9, 0, Math.PI * 2);
  ctx.fill();
}

/** Fondo pixel art PROVISIONAL generado a partir del tema del gimnasio. */
export function buildBackground(gym: GymDef, W: number, H: number, border = true): HTMLCanvasElement {
  const cw = Math.ceil(W / PIXEL);
  const ch = Math.ceil(H / PIXEL);
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d')!;
  const rng = new Rng(gym.order * 977);
  const t = gym.theme;
  ctx.fillStyle = t.grass;
  ctx.fillRect(0, 0, cw, ch);
  for (let i = 0; i < cw * ch * 0.08; i++) {
    const x = rng.int(0, cw - 1);
    const y = rng.int(0, ch - 1);
    ctx.fillStyle = t.grassDark;
    ctx.fillRect(x, y, 1, 1);
    if (rng.next() < 0.4) ctx.fillRect(x + 1, y - 1, 1, 1);
  }
  const mid = cw / 2;
  for (let y = 0; y < ch; y++) {
    const wob = Math.round(Math.sin(y * 0.15) * 2);
    ctx.fillStyle = t.path;
    ctx.fillRect(mid - 5 + wob, y, 10, 1);
    if (rng.next() < 0.3) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(mid - 4 + wob + rng.int(0, 7), y, 1, 1);
    }
  }
  for (let i = 0; i < 24 * (H / 600); i++) {
    ctx.fillStyle = rng.pick(['#f8f8f8', '#f8d030', '#f87878']);
    ctx.fillRect(rng.int(4, cw - 5), rng.int(4, ch - 5), 1, 1);
  }
  if (!border) return c;
  const b = Math.ceil(14 / PIXEL);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (x < b || x >= cw - b || y < b || y >= ch - b) {
        ctx.fillStyle = (x + y) % 3 === 0 ? '#5c564e' : t.rock;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}
