import type { AttackDef, AttackStats } from '../data/types';
import type { Enemy, OwnedAttack } from './entities';
import { angleTo, dist } from './math';
import type { World } from './world';

// Ataques del jugador (estilo survivor: automáticos). Cada ataque usa uno de
// cuatro comportamientos reutilizables según `kind`.

const ORBIT_HIT_COOLDOWN = 0.45;
const NOVA_KNOCKBACK = 160;

/** Estadísticas efectivas de un ataque en un nivel concreto. */
export function attackStats(def: AttackDef, level: number): AttackStats {
  const s = { ...def.base };
  let dmg = 0;
  let cd = 0;
  let area = 0;
  for (let i = 0; i < level - 1 && i < def.levels.length; i++) {
    const m = def.levels[i];
    dmg += m.damagePct ?? 0;
    cd += m.cooldownPct ?? 0;
    area += m.areaPct ?? 0;
    s.count += m.count ?? 0;
    s.pierce += m.pierce ?? 0;
  }
  s.damage *= 1 + dmg;
  s.cooldown *= 1 - cd;
  s.area *= 1 + area;
  return s;
}

export function updateAttacks(w: World, dt: number): void {
  for (const a of w.player.attacks) {
    const s = attackStats(a.def, a.level);
    const cooldown = s.cooldown / (1 + w.player.haste);
    switch (a.def.kind) {
      case 'projectile':
        a.timer -= dt;
        if (a.timer <= 0 && fireProjectile(w, a, s)) a.timer = cooldown;
        break;
      case 'orbit':
        updateOrbit(w, a, s, dt);
        break;
      case 'nova':
        a.timer -= dt;
        if (a.timer <= 0 && fireNova(w, a, s)) a.timer = cooldown;
        break;
      case 'zone':
        a.timer -= dt;
        if (a.timer <= 0 && fireZone(w, a, s)) a.timer = cooldown;
        break;
    }
  }
}

function targetsInRange(w: World, range: number): Enemy[] {
  const p = w.player;
  return w.enemies
    .filter((e) => e.hp > 0 && dist(e, p) <= range + e.r)
    .sort((a, b) => dist(a, p) - dist(b, p));
}

function fireProjectile(w: World, a: OwnedAttack, s: AttackStats): boolean {
  const targets = targetsInRange(w, s.range);
  if (!targets.length) return false;
  const p = w.player;
  const base = angleTo(p, targets[0]);
  for (let i = 0; i < s.count; i++) {
    const ang = base + (i - (s.count - 1) / 2) * 0.16;
    w.projectiles.push({
      id: w.newId(), x: p.x, y: p.y, vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
      r: s.area, damage: s.damage, owner: 'player', element: a.def.type, pierce: s.pierce,
      life: (s.range + 40) / s.speed, color: a.def.color, hit: new Set(),
    });
  }
  return true;
}

/** Posiciones actuales de los orbes de un ataque 'orbit' (también usado al dibujar). */
export function orbitPositions(w: World, a: OwnedAttack): { x: number; y: number; r: number }[] {
  const s = attackStats(a.def, a.level);
  const out = [];
  for (let i = 0; i < s.count; i++) {
    const ang = a.angle + (i / s.count) * Math.PI * 2;
    out.push({ x: w.player.x + Math.cos(ang) * s.range, y: w.player.y + Math.sin(ang) * s.range, r: s.area });
  }
  return out;
}

function updateOrbit(w: World, a: OwnedAttack, s: AttackStats, dt: number): void {
  a.angle += s.speed * (1 + w.player.haste * 0.5) * dt;
  for (const o of orbitPositions(w, a)) {
    for (const e of w.enemies) {
      if (e.hp <= 0 || (e.orbitCd[a.def.id] ?? 0) > 0) continue;
      if (dist(o, e) < o.r + e.r) {
        e.orbitCd[a.def.id] = ORBIT_HIT_COOLDOWN;
        const len = Math.hypot(e.x - w.player.x, e.y - w.player.y) || 1;
        w.damageEnemy(e, s.damage, a.def.type, { x: ((e.x - w.player.x) / len) * 80, y: ((e.y - w.player.y) / len) * 80 });
      }
    }
  }
}

function fireNova(w: World, a: OwnedAttack, s: AttackStats): boolean {
  const p = w.player;
  const inRange = w.enemies.filter((e) => e.hp > 0 && dist(e, p) < s.area + e.r);
  if (!inRange.length) return false;
  for (const e of inRange) {
    const len = dist(e, p) || 1;
    w.damageEnemy(e, s.damage, a.def.type, { x: ((e.x - p.x) / len) * NOVA_KNOCKBACK, y: ((e.y - p.y) / len) * NOVA_KNOCKBACK });
  }
  w.rings.push({ x: p.x, y: p.y, r: 8, maxR: s.area, life: 0.25, color: a.def.color });
  return true;
}

function fireZone(w: World, a: OwnedAttack, s: AttackStats): boolean {
  const targets = targetsInRange(w, s.range);
  if (!targets.length) return false;
  for (let i = 0; i < s.count; i++) {
    const t = targets[i % targets.length];
    const ox = i >= targets.length ? w.rng.range(-30, 30) : 0;
    const oy = i >= targets.length ? w.rng.range(-30, 30) : 0;
    const burst = s.duration <= 0;
    w.zones.push({
      x: t.x + ox, y: t.y + oy, r: s.area, owner: 'player', element: a.def.type, damage: s.damage,
      delay: burst ? 0.3 : 0.15, life: burst ? 0.2 : s.duration, tick: 0, tickEvery: 0.5,
      color: a.def.color, burst, fired: false,
    });
  }
  return true;
}
