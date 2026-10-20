import type { GymDef, SpriteSpec } from '../data/types';
import type { Enemy } from '../game/entities';
import { Rng } from '../game/rng';
import { orbitPositions } from '../game/weapons';
import type { World } from '../game/world';
import { getSprite } from './sprites';

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
      sx = (Math.random() - 0.5) * 6 * w.shake * 10;
      sy = (Math.random() - 0.5) * 6 * w.shake * 10;
    }
    ctx.setTransform(vp.dpr * vp.scale, 0, 0, vp.dpr * vp.scale, vp.dpr * (vp.ox + sx), vp.dpr * (vp.oy + sy));
    ctx.drawImage(this.background(w), 0, 0, w.W, w.H);

    this.drawExit(w);
    this.drawZones(w);
    this.drawMarkers(w);
    this.drawGems(w);

    // Entidades ordenadas por profundidad (y).
    type Drawable = { y: number; fn: () => void };
    const list: Drawable[] = [];
    for (const e of w.enemies) list.push({ y: e.y, fn: () => this.drawEnemy(w, e) });
    list.push({ y: w.player.y, fn: () => this.drawPlayer(w) });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.fn();

    this.drawOrbits(w);
    this.drawProjectiles(w);
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

  private drawZones(w: World): void {
    const ctx = this.ctx;
    for (const z of w.zones) {
      if (z.delay > 0) {
        // Aviso: círculo que se rellena hasta el impacto.
        const warn = z.owner === 'enemy';
        ctx.strokeStyle = warn ? 'rgba(255,60,60,0.9)' : z.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = warn ? 'rgba(255,60,60,0.25)' : hexA(z.color, 0.2);
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r * Math.max(0.1, 1 - z.delay), 0, Math.PI * 2);
        ctx.fill();
      } else if (!z.burst) {
        ctx.fillStyle = hexA(z.color, 0.3 + Math.sin(w.time * 10) * 0.05);
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = hexA(z.color, 0.6);
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
        ctx.fill();
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
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.x - r * 0.5, m.y - r * 0.5);
      ctx.lineTo(m.x + r * 0.5, m.y + r * 0.5);
      ctx.moveTo(m.x + r * 0.5, m.y - r * 0.5);
      ctx.lineTo(m.x - r * 0.5, m.y + r * 0.5);
      ctx.stroke();
    }
  }

  private drawGems(w: World): void {
    const ctx = this.ctx;
    for (const g of w.gems) {
      const big = g.value > 6;
      const s = big ? 4 : 3;
      ctx.fillStyle = big ? '#7af0ff' : '#5ab0ff';
      ctx.beginPath();
      ctx.moveTo(g.x, g.y - s);
      ctx.lineTo(g.x + s, g.y);
      ctx.lineTo(g.x, g.y + s);
      ctx.lineTo(g.x - s, g.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(g.x - 1, g.y - s + 1, 1, 1);
    }
  }

  private drawSprite(spec: SpriteSpec, x: number, y: number, size: number, facing: number, flash: boolean, alpha = 1): void {
    const ctx = this.ctx;
    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.42, size * 0.32, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    const img = getSprite(spec, flash ? 'flash' : 'normal');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  private drawPlayer(w: World): void {
    const p = w.player;
    if (w.phase === 'dead') return;
    const size = p.r * 2.8;
    const bob = p.moving ? Math.abs(Math.sin(p.animTime)) * -2 : Math.sin(w.time * 3) * 0.6;
    const blink = p.invuln > 0 && Math.floor(w.time * 20) % 2 === 0;
    this.drawSprite(p.species.sprite, p.x, p.y + bob, size, p.facing, p.hitFlash > 0, blink ? 0.4 : 1);
  }

  private drawEnemy(w: World, e: Enemy): void {
    const ctx = this.ctx;
    const size = e.r * 2.7;
    let x = e.x;
    const bob = Math.abs(Math.sin(e.animTime)) * -1.5;
    if (e.state === 'windup') x += Math.sin(w.time * 60) * 1.2;

    // Avisos de ataque
    if (e.state === 'windup') {
      if (e.boss) this.drawBossTelegraph(w, e);
      else if (e.def.archetype === 'ranged') {
        const k = 1 - e.stateTime / e.def.windup;
        ctx.fillStyle = hexA(e.def.projectile!.color, 0.4 + k * 0.5);
        ctx.beginPath();
        ctx.arc(e.x, e.y - e.r - 6, 2 + k * 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ff4040';
        ctx.font = 'bold 12px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', e.x, e.y - e.r - 4);
      }
    }
    if (e.boss) {
      // Aura que identifica a minibosses y jefes.
      ctx.strokeStyle = e.boss.role === 'boss' ? 'rgba(255,80,60,0.7)' : 'rgba(255,200,60,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + size * 0.42, size * 0.42, size * 0.14, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.drawSprite(e.def.sprite, x, e.y + bob, size, e.facing, e.hitFlash > 0);
  }

  private drawBossTelegraph(w: World, e: Enemy): void {
    const ctx = this.ctx;
    const k = 1 - Math.max(0, e.stateTime) / e.boss!.windup;
    if (e.pattern === 'charge') {
      const len = 260;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.atan2(e.aim.y, e.aim.x));
      ctx.fillStyle = `rgba(255, 50, 50, ${0.15 + k * 0.3})`;
      ctx.fillRect(0, -e.r, len, e.r * 2);
      ctx.restore();
    } else {
      ctx.strokeStyle = `rgba(255, 220, 80, ${0.4 + k * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 6 + Math.sin(w.time * 30) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawOrbits(w: World): void {
    const ctx = this.ctx;
    for (const a of w.player.attacks) {
      if (a.def.kind !== 'orbit') continue;
      for (const o of orbitPositions(w, a)) {
        ctx.fillStyle = hexA(a.def.color, 0.35);
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = a.def.color;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawProjectiles(w: World): void {
    const ctx = this.ctx;
    for (const p of w.projectiles) {
      if (p.owner === 'enemy') {
        ctx.fillStyle = '#1c1424';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(p.x - p.r * 0.4, p.y - p.r * 0.4, Math.max(1, p.r * 0.5), Math.max(1, p.r * 0.5));
    }
  }

  private drawRings(w: World): void {
    const ctx = this.ctx;
    for (const r of w.rings) {
      ctx.strokeStyle = hexA(r.color, Math.min(1, r.life * 4));
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
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
      if (e.boss || e.hp >= e.maxHp) continue;
      const bw = e.r * 2;
      const x = e.x - bw / 2;
      const y = e.y - e.r * 1.4 - 4;
      ctx.fillStyle = '#1c1424';
      ctx.fillRect(x - 1, y - 1, bw + 2, 4);
      ctx.fillStyle = '#e04040';
      ctx.fillRect(x, y, bw * Math.max(0, e.hp / e.maxHp), 2);
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

function hexA(hex: string, a: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
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
  // Matas de hierba
  for (let i = 0; i < cw * ch * 0.08; i++) {
    const x = rng.int(0, cw - 1);
    const y = rng.int(0, ch - 1);
    ctx.fillStyle = t.grassDark;
    ctx.fillRect(x, y, 1, 1);
    if (rng.next() < 0.4) ctx.fillRect(x + 1, y - 1, 1, 1);
  }
  // Camino central
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
  // Flores
  for (let i = 0; i < 24; i++) {
    const x = rng.int(4, cw - 5);
    const y = rng.int(4, ch - 5);
    ctx.fillStyle = rng.pick(['#f8f8f8', '#f8d030', '#f87878']);
    ctx.fillRect(x, y, 1, 1);
  }
  // Borde de rocas
  const border = Math.ceil(14 / PIXEL);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (x < border || x >= cw - border || y < border || y >= ch - border) {
        ctx.fillStyle = (x + y) % 3 === 0 ? '#5c564e' : t.rock;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  for (let i = 0; i < 40; i++) {
    const side = rng.int(0, 3);
    const x = side === 0 ? rng.int(0, border) : side === 1 ? rng.int(cw - border - 1, cw - 1) : rng.int(0, cw - 1);
    const y = side === 2 ? rng.int(0, border) : side === 3 ? rng.int(ch - border - 1, ch - 1) : rng.int(0, ch - 1);
    ctx.fillStyle = '#b0a898';
    ctx.fillRect(x, y, 2, 1);
  }
  return c;
}
