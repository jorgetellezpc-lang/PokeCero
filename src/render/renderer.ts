import type { GymDef } from '../data/types';
import type { Enemy } from '../game/entities';
import { jumpHeight } from '../game/enemyAI';
import { GUARD_R, guardianPositions, orbitPositions } from '../game/combat';
import { Rng } from '../game/rng';
import type { World } from '../game/world';
import { drawShadow } from './animator';
import { drawShape, frameCount, isDirectional, shapeFor, spins } from './vfx';

// Dibuja el estado de World en un canvas. No modifica la simulación.

export interface Viewport { ox: number; oy: number; scale: number; dpr: number }

const PIXEL = 4; // tamaño de "píxel" del fondo en unidades de mundo

export class Renderer {
  private bg: HTMLCanvasElement | null = null;
  private bgGym = '';
  showDamageNumbers = true;

  constructor(private ctx: CanvasRenderingContext2D) {}

  private background(w: World): HTMLCanvasElement {
    if (this.bg && this.bgGym === w.gym.id) return this.bg;
    this.bg = buildBackground(w.gym, w.W, w.H);
    this.bgGym = w.gym.id;
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
    ctx.drawImage(this.background(w), 0, 0, w.W, w.H);

    this.drawExit(w);
    this.drawGroundFields(w);
    this.drawHazards(w);
    this.drawMarkers(w);
    this.drawPickups(w);

    // Entidades ordenadas por profundidad (pies).
    type Drawable = { y: number; fn: () => void };
    const list: Drawable[] = [];
    for (const c of w.corpses) list.push({ y: c.y - 1, fn: () => { c.anim.draw(ctx, c.x, c.y, { alpha: Math.min(1, c.fade * 1.6) }); } });
    for (const e of w.enemies) list.push({ y: e.y, fn: () => this.drawEnemy(w, e) });
    list.push({ y: w.player.y, fn: () => this.drawPlayer(w) });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.fn();

    this.drawAirFields(w);
    this.drawOrbits(w);
    this.drawProjectiles(w);
    this.drawSlashes(w);
    this.drawBeams(w);
    this.drawRings(w);
    this.drawParticles(w);
    this.drawEnemyBars(w);
    if (this.showDamageNumbers) this.drawTexts(w);
  }

  private drawExit(w: World): void {
    const ctx = this.ctx;
    const { x, y, r } = w.exit;
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(x - r - 6, 0, (r + 6) * 2, y + 10);
    if (w.exitOpen) {
      const t = (Math.sin(w.time * 6) + 1) / 2;
      ctx.fillStyle = `rgba(120, 220, 255, ${0.5 + t * 0.4})`;
      ctx.fillRect(x - r, 2, r * 2, y + 6);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▲', x, y + 26 + Math.sin(w.time * 6) * 3);
    } else {
      ctx.fillStyle = '#5a4a3a';
      for (let i = 0; i < 6; i++) ctx.fillRect(x - r + i * ((r * 2) / 6) + 2, 2, 4, y + 6);
    }
  }

  /** Ataques enemigos con aviso: zonas que se rellenan y franjas. */
  private drawHazards(w: World): void {
    const ctx = this.ctx;
    for (const h of w.hazards) {
      const k = Math.min(1, h.t / h.delay);
      ctx.save();
      if (h.kind === 'zone') {
        ctx.globalAlpha = 0.18 + 0.2 * k;
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r * k, h.r * k * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#ff4040';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r, h.r * 0.62, 0, 0, Math.PI * 2);
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
  }

  /** Lo de los movimientos que va en el suelo (debajo de los Pokémon). */
  private drawGroundFields(w: World): void {
    const ctx = this.ctx;
    for (const f of w.fields) {
      ctx.save();
      const fadeIn = Math.min(1, f.t * 6);
      if (f.kind === 'vortex') {
        const a = Math.min(1, (f.life - f.t) * 2, fadeIn);
        ctx.globalAlpha = 0.22 * a;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.6 * a;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const rr = f.r * (0.35 + k * 0.28);
          const a0 = w.time * (3 - k * 0.6) + k * 2;
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, rr, rr * 0.6, 0, a0, a0 + 3.4);
          ctx.stroke();
        }
      } else if (f.kind === 'stunzone') {
        const k = Math.min(1, f.t / (f.delay ?? 0.45));
        ctx.globalAlpha = 0.15 + 0.25 * k;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r * k, f.r * k * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.kind === 'patch') {
        const a = Math.min(1, (f.life - f.t) * 2, fadeIn);
        ctx.globalAlpha = 0.32 * a;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.kind === 'mine') {
        const armed = f.t >= (f.arm ?? 0.35);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r * 0.45, f.r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        drawShape(ctx, shapeFor(f.move.def.id, f.move.def.type), f.move.def.type, f.x, f.y - 4, { alpha: armed && Math.sin(w.time * 8 + f.x) > 0.3 ? 1 : 0.75 });
      } else if (f.kind === 'meteor') {
        const k = Math.max(0, Math.min(1, f.t / (f.fall ?? 0.5)));
        ctx.globalAlpha = 0.2 + k * 0.3;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r * (0.4 + k * 0.6), f.r * (0.4 + k * 0.6) * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** Lo que va por encima: meteoros cayendo, torretas, cargas. */
  private drawAirFields(w: World): void {
    const ctx = this.ctx;
    for (const f of w.fields) {
      const type = f.move.def.type;
      const shape = shapeFor(f.move.def.id, type);
      if (f.kind === 'meteor' && f.t >= 0) {
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
  }

  private drawMarkers(w: World): void {
    const ctx = this.ctx;
    for (const m of w.markers) {
      const pulse = (Math.sin(w.time * 14) + 1) / 2;
      const r = m.boss ? 30 : 11;
      ctx.strokeStyle = `rgba(255, 70, 70, ${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, r, r * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.x - r * 0.5, m.y - r * 0.3);
      ctx.lineTo(m.x + r * 0.5, m.y + r * 0.3);
      ctx.moveTo(m.x + r * 0.5, m.y - r * 0.3);
      ctx.lineTo(m.x - r * 0.5, m.y + r * 0.3);
      ctx.stroke();
    }
  }

  private drawPickups(w: World): void {
    const ctx = this.ctx;
    for (const g of w.pickups) {
      const bob = Math.sin(w.time * 5 + g.x) * 1.5;
      const y = g.y - 4 + bob;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, 4, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
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
        const glow = 0.5 + Math.sin(w.time * 6) * 0.3;
        ctx.fillStyle = `rgba(255, 210, 63, ${glow})`;
        ctx.beginPath();
        ctx.arc(g.x, y, 9, 0, Math.PI * 2);
        ctx.fill();
        drawShape(ctx, 'star', 'electric', g.x, y, { scale: 1, frame: w.time * 4 });
      }
    }
  }

  private drawPlayer(w: World): void {
    const ctx = this.ctx;
    const p = w.player;
    drawShadow(ctx, p.species.dex, p.x, p.y, p.anim.scale);
    const blink = p.invuln > 0 && w.phase === 'playing' && Math.floor(w.time * 20) % 2 === 0;
    const ok = p.anim.draw(ctx, p.x, p.y, { flash: p.hitFlash > 0, softFlash: true, alpha: blink ? 0.45 : 1 });
    if (!ok) fallback(ctx, p.x, p.y, '#f08030');
    // Escudo de defensa acumulada (potenciador).
    if (p.buffs.def.n > 0) {
      ctx.strokeStyle = 'rgba(160, 200, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 12, p.r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawEnemy(w: World, e: Enemy): void {
    const ctx = this.ctx;
    const lift = jumpHeight(e);
    drawShadow(ctx, e.def.dex, e.x, e.y, e.scale * (lift ? 0.7 : 1));
    if (e.boss) {
      ctx.strokeStyle = e.boss.role === 'boss' ? 'rgba(255,80,60,0.75)' : 'rgba(255,200,60,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.r * 1.6, e.r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    let x = e.x;
    if (e.phase === 'aim' || e.phase === 'fuse') x += Math.sin(w.time * 60) * 1.2;
    if (e.hidden) {
      // Bajo tierra: solo se ve el montículo que avanza.
      ctx.fillStyle = 'rgba(150, 110, 70, 0.8)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.r * 1.1, e.r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const ok = e.anim.draw(ctx, x, e.y - lift, { flash: e.flash > 0, softFlash: !!e.boss });
    if (!ok) fallback(ctx, x, e.y - lift, '#a070c0');
    const top = e.y - lift - e.bodyH - 4;
    // Aviso de embestida o de explosión.
    if (e.phase === 'aim' || e.phase === 'fuse') {
      ctx.fillStyle = '#ff4040';
      ctx.font = 'bold 12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', e.x, top - 4);
    }
    // Escudo y estados.
    if (e.shield > 0) {
      ctx.strokeStyle = 'rgba(159, 216, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y - e.bodyH * 0.5, e.r + 6, 0, Math.PI * 2);
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

  private drawOrbits(w: World): void {
    // Pantalla Luz: escudos que paran proyectiles enemigos.
    const ctx = this.ctx;
    for (const g of guardianPositions(w)) {
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
    for (const m of w.player.moves) {
      if (m.def.kind !== 'orbit') continue;
      const shape = shapeFor(m.def.id, m.def.type);
      for (const o of orbitPositions(w, m)) {
        drawShape(this.ctx, shape, m.def.type, o.x, o.y, { frame: w.time * 10, angle: spins(shape) ? w.time * 6 : m.angle + Math.PI / 2, scale: 0.9 });
      }
    }
  }

  private drawProjectiles(w: World): void {
    const ctx = this.ctx;
    for (const p of w.projectiles) {
      const angle = Math.atan2(p.vy, p.vx);
      if (!p.friendly) {
        ctx.fillStyle = 'rgba(255, 60, 100, 0.35)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 3, 0, Math.PI * 2);
        ctx.fill();
        drawShape(ctx, shapeFor(null, p.element), p.element, p.x, p.y, { angle, frame: w.time * 10, scale: 0.85 });
        continue;
      }
      const shape = shapeFor(p.move?.def.id ?? null, p.element);
      const scale = Math.max(0.6, Math.min(1.6, p.r / 6));
      const a = isDirectional(shape) ? angle : spins(shape) ? w.time * 10 : 0;
      drawShape(ctx, shape, p.element, p.x, p.y, { angle: a, frame: frameCount(shape) > 1 ? w.time * 12 : 0, scale });
    }
  }

  private drawSlashes(w: World): void {
    const ctx = this.ctx;
    for (const s of w.slashes) {
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
    void w;
  }

  private drawBeams(w: World): void {
    const ctx = this.ctx;
    for (const b of w.beams) {
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
    void w;
  }

  private drawRings(w: World): void {
    const ctx = this.ctx;
    for (const r of w.rings) {
      const k = 1 - r.life / r.maxLife;
      const rad = r.r + (r.maxR - r.r) * Math.min(1, k * 1.6);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.max(0, r.life / r.maxLife);
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rad, rad * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawParticles(w: World): void {
    const ctx = this.ctx;
    for (const p of w.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawEnemyBars(w: World): void {
    const ctx = this.ctx;
    for (const e of w.enemies) {
      if (e.boss || (e.hp >= e.maxHp && e.shield <= 0)) continue;
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
  }

  private drawTexts(w: World): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    for (const t of w.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 3);
      ctx.font = `${t.size}px "Press Start 2P", monospace`;
      ctx.fillStyle = '#1c1424';
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

/** Respaldo si falta un sprite: bolita. */
function fallback(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 10, 9, 0, Math.PI * 2);
  ctx.fill();
}

/** Fondo pixel art PROVISIONAL generado a partir del tema del gimnasio. */
function buildBackground(gym: GymDef, W: number, H: number): HTMLCanvasElement {
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
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = rng.pick(['#f8f8f8', '#f8d030', '#f87878']);
    ctx.fillRect(rng.int(4, cw - 5), rng.int(4, ch - 5), 1, 1);
  }
  const border = Math.ceil(14 / PIXEL);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (x < border || x >= cw - border || y < border || y >= ch - border) {
        ctx.fillStyle = (x + y) % 3 === 0 ? '#5c564e' : t.rock;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}
