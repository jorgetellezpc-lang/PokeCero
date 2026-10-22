import { BALANCE } from '../config/balance';
import { categoryOf, type MoveNums } from '../data/moves';
import { TYPE_COLORS } from '../data/typeColors';
import type { AnimName } from '../render/animator';
import type { Enemy, Field, OwnedMove, Projectile } from './entities';
import { dist } from './math';
import { isFree, rockAt } from './obstacles';
import type { World } from './world';

// ============================================================================
// Ejecución de los movimientos del jugador y sus colisiones. Basado en
// PokéSurvivor (js/systems/combat.js y js/entities/projectile.js).
// Required Notice: Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)
//
// Diferencia de diseño: en PokéSurvivor solo se lanza el movimiento ACTIVO; en
// Pokécero se lanzan TODOS los que tienes a la vez (máx. BALANCE.upgrades.maxAttacks).
// ============================================================================

const TARGETED = new Set(['melee', 'beam', 'projectile', 'boomerang', 'chain', 'meteor', 'dash', 'cone',
  'homing', 'bounce', 'charge', 'spin', 'quake', 'vortex', 'shove', 'stun']);
const QSTEP = 34;
const ORBIT_REHIT = 0.34;

const CAST_ANIM: Record<string, AnimName> = {
  melee: 'Attack', beam: 'Shoot', projectile: 'Shoot', nova: 'Attack', aura: 'Charge', buff: 'Charge',
  orbit: 'Charge', boomerang: 'Shoot', chain: 'Shoot', mine: 'Charge', meteor: 'Charge', turret: 'Charge',
  dash: 'Attack', trail: 'Walk', cone: 'Shoot', homing: 'Shoot', bounce: 'Shoot', charge: 'Charge',
  spin: 'Attack', quake: 'Attack', vortex: 'Charge', shove: 'Attack', stun: 'Charge',
};

const sp = () => BALANCE.ps.space;
const color = (m: OwnedMove) => TYPE_COLORS[m.def.type];

/** Hasta dónde llega un movimiento (para esperar a tener blanco). */
function reach(m: OwnedMove): number {
  const s = m.s;
  switch (m.def.kind) {
    case 'melee': return s.radius! + 30 * sp();
    case 'beam': return s.radius! + 20 * sp();
    case 'boomerang': return s.radius! + 40 * sp();
    case 'chain': return 280 * sp();
    case 'meteor': return 340 * sp();
    case 'dash': return s.radius! + 60 * sp();
    case 'cone': return s.speed! * s.life! + 30 * sp();
    case 'spin': case 'shove': case 'charge': return s.radius! + 20 * sp();
    case 'quake': return (s.count ?? 1) * QSTEP * sp() + s.radius!;
    case 'vortex': case 'stun': return 300 * sp();
    default: return 520 * sp();
  }
}

function inArc(px: number, py: number, x: number, y: number, aim: number, half: number): boolean {
  const a = Math.atan2(y - py, x - px);
  return Math.abs((((a - aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI)) <= half;
}

function segDist2(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - cx;
  const qy = ay + dy * t - cy;
  return qx * qx + qy * qy;
}

/** Golpe de un movimiento a un enemigo (daño ya multiplicado por el ataque del jugador). */
function hit(w: World, m: OwnedMove, e: Enemy, dmg: number, dx: number, dy: number, knock = m.s.knock ?? 0, k = 1, direct = true): void {
  w.hitEnemy(e, dmg * k, m.def.type, categoryOf(m.def), dx, dy, knock / sp(), fxOf(m));
  if (direct) impact(w, m, e, e.x, e.y, dmg * k);
}

const fxOf = (m: OwnedMove) => {
  const s = m.s;
  return { burn: s.burn, poison: s.poison, slow: s.slow, drain: s.drain, move: m, hex: s.hex, crit: s.crit, shock: s.shock };
};

/** Color secundario del ataque (estela, explosiones): el del tipo que aporta su efecto. */
const accent = (m: OwnedMove) => TYPE_COLORS[m.def.trail ?? m.def.type];

/**
 * Efectos al impactar del ataque característico: explosión en área y zona
 * persistente. Los golpes de la explosión y de la zona no los repiten.
 */
function impact(w: World, m: OwnedMove, from: Enemy, x: number, y: number, dmg: number): void {
  const s = m.s;
  const A = BALANCE.attack;
  if (s.explode) {
    const r = s.explode;
    w.ring(x, y, 4, r, accent(m), 0.28, 3);
    w.burst(x, y - 6, color(m), 6);
    for (const e of w.enemies) {
      if (e === from || e.hp <= 0 || dist(e, { x, y }) > r + e.r) continue;
      w.hitEnemy(e, dmg * A.explodeK, m.def.type, categoryOf(m.def), e.x - x, e.y - y, 0, { ...fxOf(m), drain: 0, shock: 0 });
    }
  }
  if (s.zone) {
    const mine = w.fields.filter((f) => f.kind === 'patch' && f.move === m && !f.gone);
    // Sin amontonar: una zona nueva solo si no hay otra muy cerca, y como mucho 6.
    if (mine.some((f) => dist(f, { x, y }) < s.zone! * 0.7)) return;
    for (const f of mine.slice(0, Math.max(0, mine.length - 5))) f.gone = true;
    w.fields.push({ kind: 'patch', move: m, color: accent(m), x, y, t: 0, life: A.zoneLife, r: s.zone, dmg: dmg * A.zoneK, tick: 0.2 });
  }
}

const power = (w: World, m: OwnedMove) => (m.s.dmg ?? 0) * w.atkFor(categoryOf(m.def));

/**
 * Movimientos que actúan aunque te muevas (orbes, auras y rastros, como los
 * elementos giratorios de Archero). El resto solo se lanza estando QUIETO:
 * moverte es esquivar y pararte es atacar.
 */
export const ALWAYS_ON = new Set(['orbit', 'aura', 'trail']);

export const firesWhileMoving = (m: OwnedMove) => ALWAYS_ON.has(m.def.kind);

export function updateCombat(w: World, dt: number): void {
  const p = w.player;
  const cdItem = p.item === 'quickclaw' ? 0.8 : 1;
  // Ráfaga: repite la última andanada poco después (si sigues quieto).
  if (w.volleys.length) {
    for (const v of w.volleys) if ((v.t -= dt) <= 0 && !p.moving) fireProjectiles(w, v.move, false);
    w.volleys = w.volleys.filter((v) => v.t > 0);
  }
  for (const m of p.moves) {
    if (m.def.kind === 'orbit') {
      orbit(w, m, dt);
      continue;
    }
    m.t -= dt;
    if (m.t > 0) continue;
    // La recarga sigue corriendo al moverse: al pararte, el primer ataque sale al instante.
    if (p.moving && !firesWhileMoving(m)) {
      m.t = 0;
      continue;
    }
    if (TARGETED.has(m.def.kind) && !(w.target && dist(w.target, p) <= reach(m))) {
      m.t = 0.05;
      continue;
    }
    m.t = Math.max(0.05, m.s.cd * p.cdMul * cdItem);
    castAnim(w, m);
    run(w, m);
  }
}

function castAnim(w: World, m: OwnedMove): void {
  w.events.push({ type: 'sfx', name: 'shot', kind: m.def.kind, element: m.def.type });
  const a = w.player.anim;
  if (a.busy()) return;
  const anim = CAST_ANIM[m.def.kind] ?? 'Attack';
  if (anim === 'Walk') return;
  a.play(anim, { speed: Math.max(1, 1 / Math.max(0.2, m.s.cd)) });
}

function run(w: World, m: OwnedMove): void {
  switch (m.def.kind) {
    case 'projectile': case 'homing': case 'bounce': fireProjectiles(w, m); break;
    case 'melee': melee(w, m); break;
    case 'beam': beam(w, m); break;
    case 'nova': nova(w, m); break;
    case 'aura': aura(w, m); break;
    case 'buff': buff(w, m); break;
    case 'boomerang': boomerang(w, m); break;
    case 'chain': chain(w, m); break;
    case 'mine': mines(w, m); break;
    case 'meteor': meteors(w, m); break;
    case 'turret': turret(w, m); break;
    case 'dash': dash(w, m); break;
    case 'trail': trail(w, m); break;
    case 'cone': cone(w, m); break;
    case 'charge': field(w, m, 'charge', { at: m.s.charge ?? 0.75 }); w.ring(w.player.x, w.player.y, w.player.r * 3.2, w.player.r * 0.8, color(m), m.s.charge ?? 0.75, 2); break;
    case 'spin': field(w, m, 'spin', { n: Math.max(1, m.s.count ?? 1), next: 0, a: w.player.aim }); break;
    case 'quake': field(w, m, 'quake', { ca: Math.cos(w.player.aim), sa: Math.sin(w.player.aim), i: 0, n: Math.max(1, m.s.count ?? 1), next: 0 }); w.shake = Math.max(w.shake, 0.1); break;
    case 'vortex': vortex(w, m); break;
    case 'shove': shove(w, m); break;
    case 'stun': stunZone(w, m); break;
    default: break;
  }
}

function spawnProjectile(w: World, m: OwnedMove, x: number, y: number, a: number, speed: number, extra: Partial<Projectile> = {}): void {
  const s = m.s;
  w.projectiles.push({
    id: w.newId(), x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: s.size ?? 6,
    dmg: power(w, m), friendly: true, element: m.def.type, cat: categoryOf(m.def), pierce: s.pierce ?? 0,
    life: s.life ?? 1.5, t: 0, color: color(m), hits: new Set(), homing: s.homing ?? 0, boom: 0, back: false,
    bounce: s.bounce ?? 0, burn: s.burn ?? 0, poison: s.poison ?? 0, slow: s.slow ?? 0, knock: s.knock ?? 0,
    drain: s.drain ?? 0, move: m, wallBounce: 0, shape: m.def.shape ?? m.def.type,
    wobble: s.wobble, trail: m.def.trail ? TYPE_COLORS[m.def.trail] : undefined, tier: tierOf(w, m), ...extra,
  });
}

/** Nivel visual del ataque (0-3): crece con las mejoras y es máximo al evolucionar. */
function tierOf(w: World, m: OwnedMove): number {
  if (!m.def.id.startsWith('sig:')) return 0;
  const A = w.player.attack;
  return A.evolved ? 3 : Math.min(2, Math.floor(A.ups.length / 3));
}

/** Direcciones extra de las habilidades (Abanico, Flancos, Retaguardia). */
export function extraAngles(M: { diagonal: number; side: number; rear: number }): number[] {
  const out: number[] = [];
  for (let j = 0; j < M.diagonal; j++) { const a = Math.PI / 4 - j * (Math.PI / 12); out.push(a, -a); }
  for (let j = 0; j < M.side; j++) { const a = Math.PI / 2 + j * (Math.PI / 9); out.push(a, -a); }
  for (let j = 0; j < M.rear; j++) out.push(Math.PI + (j === 0 ? 0 : Math.ceil(j / 2) * (j % 2 ? 1 : -1) * 0.25));
  return out;
}

function fireProjectiles(w: World, m: OwnedMove, first = true): void {
  const p = w.player;
  const M = p.mods;
  const s = m.s;
  const n = Math.max(1, s.count ?? 1);
  const spread = s.spread ?? 0;
  const speed = s.speed ?? 300;
  const extra: Partial<Projectile> = {
    dmg: power(w, m) * M.projDmg, pierce: (s.pierce ?? 0) + M.pierce, bounce: (s.bounce ?? 0) + M.ricochet,
    wallBounce: M.wallBounce,
  };
  // Disparo frontal: proyectiles PARALELOS separados (Doble Disparo).
  const lanes = 1 + M.front;
  const ca = Math.cos(p.aim + Math.PI / 2);
  const sa = Math.sin(p.aim + Math.PI / 2);
  // Siempre uno recto al blanco y el resto alternando a los lados (0, +s, -s,
  // +2s…). Con el abanico simétrico de PokéSurvivor, 2 proyectiles salían a
  // ambos lados y fallaban a los enemigos pequeños.
  for (let i = 0; i < n; i++) {
    const off = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1) * spread * 1.2;
    const a = p.aim + off + w.rng.range(-0.03, 0.03);
    for (let l = 0; l < lanes; l++) {
      const d = (l - (lanes - 1) / 2) * 9;
      spawnProjectile(w, m, p.x + ca * d, p.y - 12 + sa * d, a, speed, extra);
    }
  }
  for (const off of extraAngles(M)) spawnProjectile(w, m, p.x, p.y - 12, p.aim + off, speed, extra);
  if (first) for (let k = 1; k <= M.multishot; k++) w.volleys.push({ t: 0.13 * k, move: m });
}

function nova(w: World, m: OwnedMove): void {
  const p = w.player;
  const n = Math.max(3, m.s.count ?? 8);
  for (let i = 0; i < n; i++) spawnProjectile(w, m, p.x, p.y - 12, (i / n) * Math.PI * 2 + w.rng.range(-0.06, 0.06), m.s.speed ?? 240);
  w.ring(p.x, p.y, p.r, p.r * 4, color(m), 0.3, 3);
}

function melee(w: World, m: OwnedMove): void {
  const p = w.player;
  const s = m.s;
  const half = Math.min(s.arc ?? 1.6, Math.PI * 2) / 2;
  w.slashes.push({ x: p.x, y: p.y - 10, angle: p.aim, radius: s.radius!, arc: s.arc ?? 1.6, life: 0.18, color: color(m) });
  for (const e of w.enemies) {
    if (dist(e, p) > s.radius! + e.r || !inArc(p.x, p.y, e.x, e.y, p.aim, half)) continue;
    hit(w, m, e, power(w, m), e.x - p.x, e.y - p.y);
  }
}

function beamHit(w: World, m: OwnedMove, len: number, width: number, k = 1): void {
  const p = w.player;
  const ca = Math.cos(p.aim);
  const sa = Math.sin(p.aim);
  w.beams.push({ x: p.x, y: p.y - 12, angle: p.aim, len, w: width, life: 0.22, color: color(m) });
  w.shake = Math.max(w.shake, 0.08);
  for (const e of w.enemies) {
    const px = e.x - p.x;
    const py = e.y - p.y;
    const along = px * ca + py * sa;
    if (along < -e.r || along > len + e.r) continue;
    if (Math.abs(-px * sa + py * ca) <= width / 2 + e.r) hit(w, m, e, power(w, m) * k, ca, sa, 0);
  }
}

function beam(w: World, m: OwnedMove): void {
  beamHit(w, m, m.s.radius!, m.s.width ?? 30);
}

function aura(w: World, m: OwnedMove): void {
  const p = w.player;
  w.ring(p.x, p.y, m.s.radius! * 0.5, m.s.radius!, color(m), 0.28, 2);
  for (const e of w.enemies) if (dist(e, p) < m.s.radius! + e.r) hit(w, m, e, power(w, m), e.x - p.x, e.y - p.y, 0);
}

function buff(w: World, m: OwnedMove): void {
  const p = w.player;
  w.addBuff(m.def.stat!, m.s.amount ?? 0.1, m.s.dur ?? 7, Math.round(m.s.stacks ?? 5));
  w.ring(p.x, p.y, p.r * 2.4, p.r * 1.1, color(m), 0.35, 2.5);
}

function boomerang(w: World, m: OwnedMove): void {
  const p = w.player;
  const s = m.s;
  const n = Math.max(1, s.count ?? 1);
  const spread = s.spread ?? 0.5;
  const out = s.radius! / (s.speed ?? 300);
  for (let i = 0; i < n; i++) {
    // Una hoja recta al blanco y el resto alternando a los lados, con la mitad
    // de abanico que en PokéSurvivor: en la arena estrecha, dos hojas abiertas
    // rodeaban al enemigo sin tocarlo.
    const a = p.aim + (i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1) * spread * 0.5);
    spawnProjectile(w, m, p.x, p.y - 10, a, s.speed ?? 300, { life: out * 4 + 1.5, pierce: 999, boom: out });
  }
}

function chain(w: World, m: OwnedMove): void {
  const p = w.player;
  let cur: Enemy | null = w.target && w.target.hp > 0 ? w.target : null;
  if (!cur) return;
  let fx = p.x;
  let fy = p.y - 12;
  let k = 1;
  const done = new Set<number>();
  const n = Math.max(1, m.s.count ?? 1);
  for (let i = 0; i < n && cur; i++) {
    done.add(cur.id);
    const tx: number = cur.x;
    const ty: number = cur.y - cur.bodyH * 0.5;
    w.beams.push({ x: fx, y: fy, angle: Math.atan2(ty - fy, tx - fx), len: Math.hypot(tx - fx, ty - fy), w: 6, life: 0.18, color: color(m) });
    hit(w, m, cur, power(w, m), tx - fx, ty - fy, 0, k);
    k *= 0.85;
    fx = tx;
    fy = ty;
    let best: Enemy | null = null;
    let bd = m.s.radius! * m.s.radius!;
    for (const e of w.enemies) {
      if (done.has(e.id) || e.hp <= 0) continue;
      const d = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    cur = best;
  }
}

function field(w: World, m: OwnedMove, kind: Field['kind'], extra: Partial<Field>): Field {
  const p = w.player;
  const f: Field = { kind, move: m, color: color(m), x: p.x, y: p.y, t: 0, life: 0, r: m.s.radius ?? 30, dmg: power(w, m), ...extra };
  w.fields.push(f);
  return f;
}

function mines(w: World, m: OwnedMove): void {
  const p = w.player;
  const n = Math.max(1, m.s.count ?? 1);
  for (let i = 0; i < n; i++) {
    const a = w.rng.range(0, Math.PI * 2);
    const d = n === 1 ? 0 : w.rng.range(18, 46) * sp();
    field(w, m, 'mine', { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.8, arm: 0.35, life: m.s.dur ?? 7 });
  }
  const mine = w.fields.filter((f) => f.kind === 'mine' && f.move === m);
  for (const f of mine.slice(0, Math.max(0, mine.length - (4 + n * 2)))) f.gone = true;
}

function meteors(w: World, m: OwnedMove): void {
  const p = w.player;
  const n = Math.max(1, m.s.count ?? 1);
  const near = w.enemies.filter((e) => dist(e, p) < reach(m));
  for (let i = near.length - 1; i > 0; i--) {
    const j = Math.floor(w.rng.next() * (i + 1));
    [near[i], near[j]] = [near[j], near[i]];
  }
  for (let i = 0; i < n; i++) {
    const e = near[i];
    const x = e ? e.x + w.rng.range(-8, 8) : p.x + w.rng.range(-100, 100);
    const y = e ? e.y + w.rng.range(-6, 6) : p.y + w.rng.range(-80, 80);
    field(w, m, 'meteor', { x, y, t: -i * 0.09, fall: 0.5 });
  }
}

function turret(w: World, m: OwnedMove): void {
  const p = w.player;
  const a = p.aim + Math.PI + w.rng.range(-0.6, 0.6);
  field(w, m, 'turret', { x: p.x + Math.cos(a) * 26 * sp(), y: p.y + Math.sin(a) * 20 * sp(), life: m.s.dur ?? 6, shotT: 0.3 });
  const mine = w.fields.filter((f) => f.kind === 'turret' && f.move === m && !f.gone);
  for (const f of mine.slice(0, Math.max(0, mine.length - Math.max(1, m.s.count ?? 1)))) f.gone = true;
}

function dash(w: World, m: OwnedMove): void {
  const p = w.player;
  const ca = Math.cos(p.aim);
  const sa = Math.sin(p.aim);
  const sx = p.x;
  const sy = p.y;
  const mg = BALANCE.arena.margin + p.r;
  let len = 0;
  for (let d = 8; d <= m.s.radius!; d += 8) {
    const x = sx + ca * d;
    const y = sy + sa * d;
    if (x < mg || x > w.W - mg || y < mg || y > w.H - mg) break;
    // Se para al llegar a una roca o muro (no la atraviesa).
    if (w.obstacles.length && !isFree(x, y, w.footR(p.r), w.obstacles, p.mods.levitate)) break;
    len = d;
  }
  p.x = sx + ca * len;
  p.y = sy + sa * len;
  p.invuln = Math.max(p.invuln, 0.3);
  w.beams.push({ x: sx, y: sy - 10, angle: p.aim, len, w: (m.s.width ?? 34) * 0.6, life: 0.2, color: color(m) });
  w.slashes.push({ x: p.x, y: p.y - 10, angle: p.aim, radius: 34 * sp(), arc: 2.2, life: 0.18, color: color(m) });
  const wd = m.s.width ?? 34;
  for (const e of w.enemies) {
    if (segDist2(sx, sy, p.x, p.y, e.x, e.y) <= (wd / 2 + e.r) ** 2) hit(w, m, e, power(w, m), ca, sa);
  }
  w.shake = Math.max(w.shake, 0.12);
}

function trail(w: World, m: OwnedMove): void {
  const p = w.player;
  const last = p.lastPatch;
  if (last && dist(last, p) < m.s.radius! * 0.9) return;
  const f = field(w, m, 'patch', { life: m.s.dur ?? 3, tick: 0 });
  p.lastPatch = f;
  const mine = w.fields.filter((o) => o.kind === 'patch' && o.move === m && !o.gone);
  for (const o of mine.slice(0, Math.max(0, mine.length - 18))) o.gone = true;
}

function cone(w: World, m: OwnedMove): void {
  const p = w.player;
  const n = Math.max(2, m.s.count ?? 5);
  const arc = m.s.arc ?? 0.9;
  for (let i = 0; i < n; i++) {
    const a = p.aim + (i / (n - 1) - 0.5) * arc + w.rng.range(-0.05, 0.05);
    spawnProjectile(w, m, p.x, p.y - 12, a, (m.s.speed ?? 340) * w.rng.range(0.85, 1.1), { life: (m.s.life ?? 0.45) * w.rng.range(0.85, 1.05) });
  }
}

function vortex(w: World, m: OwnedMove): void {
  const p = w.player;
  const tg = w.target;
  const x = tg ? tg.x : p.x + Math.cos(p.aim) * 90;
  const y = tg ? tg.y : p.y + Math.sin(p.aim) * 70;
  field(w, m, 'vortex', { x, y, life: m.s.dur ?? 2.6, tick: 0.15, pull: m.s.pull ?? 140 });
  const mine = w.fields.filter((f) => f.kind === 'vortex' && f.move === m && !f.gone);
  for (const f of mine.slice(0, Math.max(0, mine.length - 2))) f.gone = true;
}

function shove(w: World, m: OwnedMove): void {
  const p = w.player;
  w.ring(p.x, p.y, p.r, m.s.radius!, color(m), 0.35, 4);
  w.shake = Math.max(w.shake, 0.1);
  for (const e of w.enemies) if (dist(e, p) < m.s.radius! + e.r) hit(w, m, e, power(w, m), e.x - p.x, e.y - p.y, m.s.knock ?? 300 * sp());
}

function stunZone(w: World, m: OwnedMove): void {
  const tg = w.target;
  if (!tg) return;
  field(w, m, 'stunzone', { x: tg.x, y: tg.y, delay: 0.45, life: 0 });
}

function blast(w: World, f: Field, r: number, k = 1): void {
  // Las zonas del ataque (Rastro elemental) no vuelven a estallar ni a dejar zona.
  const direct = !f.move.def.id.startsWith('sig:');
  for (const e of w.enemies) if (dist(e, f) < r + e.r) hit(w, f.move, e, f.dmg * k, e.x - f.x, e.y - f.y, f.move.s.knock ?? 0, 1, direct);
}

// ---------------------------------------------------------------------------
// Orbes
// ---------------------------------------------------------------------------

/** Posiciones de los orbes de un movimiento 'orbit' (también para dibujar). */
export function orbitPositions(w: World, m: OwnedMove): { x: number; y: number; r: number }[] {
  const s: MoveNums = m.s;
  const n = Math.max(1, s.count ?? 3);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = m.angle + (i / n) * Math.PI * 2;
    out.push({ x: w.player.x + Math.cos(a) * s.radius!, y: w.player.y - 8 + Math.sin(a) * s.radius! * 0.7, r: s.size ?? 8 });
  }
  return out;
}

function orbit(w: World, m: OwnedMove, dt: number): void {
  m.angle += (m.s.speed ?? 2.4) * dt;
  for (const o of orbitPositions(w, m)) {
    for (const e of w.enemies) {
      if (e.hp <= 0 || (e.orbitCd[m.def.id] ?? 0) > 0) continue;
      if (Math.hypot(o.x - e.x, o.y - (e.y - e.bodyH * 0.4)) < o.r + e.r) {
        e.orbitCd[m.def.id] = ORBIT_REHIT;
        hit(w, m, e, power(w, m), e.x - w.player.x, e.y - w.player.y);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Proyectiles (los del jugador y los enemigos)
// ---------------------------------------------------------------------------

function nearestEnemy(w: World, x: number, y: number, range: number, skip?: Set<number>): Enemy | null {
  let best: Enemy | null = null;
  let bd = range * range;
  for (const e of w.enemies) {
    if (e.hp <= 0 || skip?.has(e.id)) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

const WOBBLE_W = 13;

export function updateProjectiles(w: World, dt: number): void {
  const p = w.player;
  const keep: Projectile[] = [];
  const spawned: Projectile[] = [];
  for (const pr of w.projectiles) {
    pr.t += dt;
    if (pr.friendly && pr.boom) {
      if (!pr.back && pr.t >= pr.boom) {
        pr.back = true;
        pr.hits = new Set();
      }
      if (pr.back) {
        const d = Math.hypot(p.x - pr.x, p.y - 12 - pr.y) || 1;
        // Velocidad fija de vuelta: con la del momento, al girar se frenaba
        // hasta quedarse quieta en el aire.
        const speed = pr.move?.s.speed ?? 300;
        const k = Math.min(1, dt * 7);
        pr.vx += ((p.x - pr.x) / d * speed * 1.1 - pr.vx) * k;
        pr.vy += ((p.y - 12 - pr.y) / d * speed * 1.1 - pr.vy) * k;
        if (d < p.r + 6) pr.life = 0;
      }
    } else if (pr.friendly && pr.homing > 0) {
      const tg = nearestEnemy(w, pr.x, pr.y, 240 * sp(), pr.hits);
      if (tg) {
        const d = Math.hypot(tg.x - pr.x, tg.y - tg.bodyH * 0.4 - pr.y) || 1;
        const speed = Math.hypot(pr.vx, pr.vy) || 300;
        const k = Math.min(1, dt * pr.homing);
        pr.vx += ((tg.x - pr.x) / d * speed - pr.vx) * k;
        pr.vy += ((tg.y - tg.bodyH * 0.4 - pr.y) / d * speed - pr.vy) * k;
      }
    }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    // Trayectoria ondulante: vaivén lateral alrededor del rumbo.
    if (pr.wobble) {
      const l = Math.hypot(pr.vx, pr.vy) || 1;
      const side = pr.wobble * WOBBLE_W * Math.cos(pr.t * WOBBLE_W) * dt;
      pr.x += (-pr.vy / l) * side;
      pr.y += (pr.vx / l) * side;
    }
    // Rebote en las paredes (Rebote Muro).
    if (pr.friendly && pr.wallBounce > 0) {
      const mg = BALANCE.arena.margin;
      if ((pr.x < mg && pr.vx < 0) || (pr.x > w.W - mg && pr.vx > 0)) { pr.vx = -pr.vx; pr.wallBounce--; pr.hits.clear(); pr.t = Math.max(0, pr.t - 0.4); }
      else if ((pr.y < mg && pr.vy < 0) || (pr.y > w.H - mg && pr.vy > 0)) { pr.vy = -pr.vy; pr.wallBounce--; pr.hits.clear(); pr.t = Math.max(0, pr.t - 0.4); }
    }
    let alive = pr.t < pr.life && pr.x > -30 && pr.x < w.W + 30 && pr.y > -30 && pr.y < w.H + 30;
    // Las rocas paran los proyectiles (los tuyos rebotan con Rebote Muro). El agua no.
    const rock = alive && w.obstacles.length ? rockAt(pr.x, pr.y, w.obstacles) : null;
    if (rock) {
      const px = pr.x - pr.vx * dt;
      const py = pr.y - pr.vy * dt;
      if (pr.friendly && pr.wallBounce > 0) {
        if (px <= rock.x || px >= rock.x + rock.w) pr.vx = -pr.vx;
        else pr.vy = -pr.vy;
        pr.x = px;
        pr.y = py;
        pr.wallBounce--;
        pr.hits.clear();
        pr.t = Math.max(0, pr.t - 0.4);
      } else {
        w.burst(px, py, pr.friendly ? pr.color : '#c8b8a0', 4);
        alive = false;
      }
    }
    if (alive && !pr.friendly && blockedByGuardian(w, pr)) {
      w.burst(pr.x, pr.y, '#bfe8ff', 6);
      alive = false;
    } else if (alive && !pr.friendly) {
      if (Math.hypot(pr.x - p.x, pr.y - (p.y - 10)) < pr.r + p.r * 0.8) {
        w.hurtPlayer(pr.dmg, pr.element, pr.cat === 'special' ? 'special' : 'physical');
        w.burst(pr.x, pr.y, pr.color, 7);
        alive = false;
      }
    } else if (alive) {
      for (const e of w.enemies) {
        if (pr.hits.has(e.id) || e.hp <= 0 || e.hidden) continue;
        if (Math.hypot(pr.x - e.x, pr.y - (e.y - e.bodyH * 0.4)) < pr.r + e.r) {
          pr.hits.add(e.id);
          const l = Math.hypot(pr.vx, pr.vy) || 1;
          const ms = pr.move?.s;
          w.hitEnemy(e, pr.dmg, pr.element, pr.cat, pr.vx / l, pr.vy / l, pr.knock / sp(), {
            burn: pr.burn, poison: pr.poison, slow: pr.slow, drain: pr.drain, move: pr.move,
            hex: ms?.hex, crit: ms?.crit, shock: pr.frag ? 0 : ms?.shock,
          });
          w.burst(pr.x, pr.y, pr.color, 3);
          if (pr.move && !pr.frag) {
            impact(w, pr.move, e, e.x, e.y, pr.dmg);
            // División: al primer impacto salen fragmentos en abanico hacia delante.
            if (ms?.split && pr.hits.size === 1) {
              const n = Math.round(ms.split) + 1;
              const a0 = Math.atan2(pr.vy, pr.vx);
              const speed = Math.hypot(pr.vx, pr.vy) || 300;
              for (let i = 0; i < n; i++) {
                const a = a0 + (i / (n - 1) - 0.5) * 1.1;
                spawned.push({
                  ...pr, id: w.newId(), vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: pr.r * 0.7,
                  dmg: pr.dmg * BALANCE.attack.splitK, pierce: 0, bounce: 0, homing: 0, life: 0.5, t: 0,
                  hits: new Set(pr.hits), frag: true, wobble: 0, boom: 0, back: false,
                });
              }
            }
          }
          // Rebote: sale hacia el enemigo más cercano que aún no ha tocado.
          if (pr.bounce > 0) {
            const next = nearestEnemy(w, e.x, e.y, 220 * sp(), pr.hits);
            if (next) {
              pr.bounce--;
              const speed = Math.hypot(pr.vx, pr.vy) || 300;
              const d = Math.hypot(next.x - e.x, next.y - e.y) || 1;
              pr.vx = ((next.x - e.x) / d) * speed;
              pr.vy = ((next.y - e.y) / d) * speed;
              pr.t = Math.max(0, pr.t - 0.5);
              break;
            }
          }
          if (pr.pierce-- <= 0) {
            alive = false;
            break;
          }
        }
      }
    }
    if (alive) keep.push(pr);
  }
  keep.push(...spawned);
  // Tope de proyectiles (rendimiento en móvil): desaparecen antes los tuyos más viejos.
  const cap = BALANCE.perf.maxProjectiles;
  if (keep.length > cap) {
    const old = keep.filter((x) => x.friendly).sort((a, b) => b.t - a.t).slice(0, keep.length - cap);
    const drop = new Set(old);
    w.projectiles = keep.filter((x) => !drop.has(x));
  } else w.projectiles = keep;
}

/** Posiciones de los escudos de Pantalla Luz alrededor del jugador. */
export function guardianPositions(w: World): { x: number; y: number }[] {
  const p = w.player;
  const n = p.mods.guardians;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = p.guardAngle + (i / n) * Math.PI * 2;
    out.push({ x: p.x + Math.cos(a) * GUARD_DIST, y: p.y - 10 + Math.sin(a) * GUARD_DIST });
  }
  return out;
}
export const GUARD_DIST = 30;
export const GUARD_R = 8;

function blockedByGuardian(w: World, pr: Projectile): boolean {
  if (!w.player.mods.guardians) return false;
  return guardianPositions(w).some((g) => Math.hypot(pr.x - g.x, pr.y - g.y) < pr.r + GUARD_R);
}

// ---------------------------------------------------------------------------
// Campos: minas, meteoros, torretas, charcos, cargas, giros, terremotos,
// remolinos y zonas de aturdimiento.
// ---------------------------------------------------------------------------

export function updateFields(w: World, dt: number): void {
  const p = w.player;
  const keep: Field[] = [];
  for (const f of w.fields) {
    f.t += dt;
    const m = f.move;
    let remove = !!f.gone || (f.life > 0 && f.t >= f.life && f.kind !== 'mine');
    if (!remove) {
      switch (f.kind) {
        case 'mine': {
          const armed = f.t >= (f.arm ?? 0.35);
          const trig = armed && w.enemies.some((e) => dist(e, f) < 14 + e.r);
          if (trig || f.t >= f.life) {
            w.ring(f.x, f.y, 4, f.r, f.color, 0.3, 4);
            w.burst(f.x, f.y - 6, f.color, 10);
            blast(w, f, f.r, trig ? 1 : 0.5);
            remove = true;
          }
          break;
        }
        case 'meteor':
          if (f.t >= (f.fall ?? 0.5)) {
            w.ring(f.x, f.y, 4, f.r, f.color, 0.35, 4);
            w.burst(f.x, f.y - 6, f.color, 12);
            w.shake = Math.max(w.shake, 0.12);
            blast(w, f, f.r);
            remove = true;
          }
          break;
        case 'turret': {
          f.shotT = (f.shotT ?? 0) - dt;
          if (f.shotT <= 0) {
            const tg = nearestEnemy(w, f.x, f.y, m.s.range ?? 200);
            f.shotT = tg ? m.s.rate ?? 0.6 : 0.15;
            if (tg) spawnProjectile(w, m, f.x, f.y - 10, Math.atan2(tg.y - f.y, tg.x - f.x), m.s.speed ?? 260, { dmg: f.dmg, life: 1.4, pierce: m.s.pierce ?? 0 });
          }
          break;
        }
        case 'patch':
          f.tick = (f.tick ?? 0) - dt;
          if (f.tick <= 0) {
            f.tick = 0.5;
            blast(w, f, f.r);
          }
          break;
        case 'charge':
          f.x = p.x;
          f.y = p.y;
          // Moverse cancela la carga (hay que estar quieto para atacar).
          if (p.moving) {
            remove = true;
            break;
          }
          if (f.t >= (f.at ?? 0.75)) {
            beamHit(w, m, m.s.radius!, m.s.width ?? 40);
            w.shake = Math.max(w.shake, 0.25);
            remove = true;
          }
          break;
        case 'spin':
          f.next = (f.next ?? 0) - dt;
          if (f.next <= 0) {
            f.next = 0.13;
            w.slashes.push({ x: p.x, y: p.y - 10, angle: f.a ?? 0, radius: m.s.radius!, arc: 3.6, life: 0.14, color: f.color });
            f.a = (f.a ?? 0) + 2.2;
            for (const e of w.enemies) if (dist(e, p) < m.s.radius! + e.r) hit(w, m, e, power(w, m), e.x - p.x, e.y - p.y, 40 * sp());
            f.n = (f.n ?? 1) - 1;
            if (f.n <= 0) remove = true;
          }
          break;
        case 'quake':
          f.next = (f.next ?? 0) - dt;
          while (f.next <= 0 && (f.i ?? 0) < (f.n ?? 1)) {
            f.next += 0.07;
            f.i = (f.i ?? 0) + 1;
            const x = f.x + (f.ca ?? 0) * f.i * QSTEP * sp();
            const y = f.y + (f.sa ?? 0) * f.i * QSTEP * sp();
            if (x < 0 || x > w.W || y < 0 || y > w.H) {
              f.i = f.n;
              break;
            }
            w.ring(x, y, 4, m.s.radius!, f.color, 0.3, 3);
            w.burst(x, y - 4, f.color, 6);
            blast(w, { ...f, x, y }, m.s.radius!);
          }
          if ((f.i ?? 0) >= (f.n ?? 1)) remove = true;
          break;
        case 'vortex':
          for (const e of w.enemies) {
            const dx = f.x - e.x;
            const dy = f.y - e.y;
            const d = Math.hypot(dx, dy);
            if (d < 4 || d > f.r * 1.4) continue;
            const k = Math.min(d, (f.pull ?? 140) * sp() * dt * (e.boss ? 0.25 : 1));
            e.x += (dx / d) * k;
            e.y += (dy / d) * k;
          }
          f.tick = (f.tick ?? 0) - dt;
          if (f.tick <= 0) {
            f.tick = 0.4;
            blast(w, f, f.r);
          }
          break;
        case 'stunzone':
          if (f.t >= (f.delay ?? 0.45)) {
            w.ring(f.x, f.y, 4, f.r, f.color, 0.35, 4);
            w.burst(f.x, f.y - 6, f.color, 12);
            for (const e of w.enemies) {
              if (dist(e, f) >= f.r + e.r) continue;
              hit(w, m, e, f.dmg, e.x - f.x, e.y - f.y, 0);
              if (e.hp > 0) e.stunT = Math.max(e.stunT, (m.s.stun ?? 1) * (e.boss ? 0.35 : 1));
            }
            remove = true;
          }
          break;
      }
    }
    if (!remove) keep.push(f);
  }
  w.fields = keep;
}
