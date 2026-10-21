import { BALANCE } from '../config/balance';
import { isRangedBehavior } from '../data/enemies';
import { TYPE_COLORS } from '../data/typeColors';
import { dirFromAngle } from '../render/animator';
import type { Enemy } from './entities';
import { clamp, dist } from './math';
import type { World } from './world';

// ============================================================================
// IA de los enemigos normales por PERSONALIDAD (no por especie). Basado en
// PokéSurvivor (js/entities/enemy.js). Required Notice: Copyright 2026 JPTER78
// (https://github.com/JPTER78/pokesurvivor)
// ============================================================================

const sp = () => BALANCE.ps.space;
const TOUCH_CD = 0.8;

/** Estados, empujones y recargas comunes a enemigos y jefes. Devuelve false si ha caído. */
export function tickCommon(w: World, e: Enemy, dt: number): boolean {
  e.anim.update(dt);
  e.flash = Math.max(0, e.flash - dt);
  e.touchCd = Math.max(0, e.touchCd - dt);
  for (const k in e.orbitCd) e.orbitCd[k] -= dt;
  if (e.slowT > 0 && (e.slowT -= dt) <= 0) e.slow = 0;
  if (e.shieldT > 0 && (e.shieldT -= dt) <= 0) e.shield = 0;
  if (e.burn > 0) {
    e.burnT -= dt;
    e.burnTick -= dt;
    if (e.burnTick <= 0) {
      e.burnTick = 0.5;
      w.hurtEnemyRaw(e, 1.6 * e.burn * (1 + w.player.level * 0.06) * BALANCE.ps.damage * 1.6, '#ff9a4d');
    }
    if (e.burnT <= 0) e.burn = 0;
  }
  if (e.poison > 0) {
    e.poisonT -= dt;
    e.poisonTick -= dt;
    if (e.poisonTick <= 0) {
      e.poisonTick = 0.6;
      w.hurtEnemyRaw(e, e.maxHp * 0.012 * e.poison + 1, '#d47cf0');
    }
    if (e.poisonT <= 0) e.poison = 0;
  }
  // Empujón (se frena rápido).
  e.x += e.kx * dt;
  e.y += e.ky * dt;
  const decay = Math.pow(0.0015, dt);
  e.kx *= decay;
  e.ky *= decay;
  const m = BALANCE.arena.margin;
  e.x = clamp(e.x, m + e.r, w.W - m - e.r);
  e.y = clamp(e.y, m + e.r, w.H - m - e.r);
  return e.hp > 0;
}

/** Daño por contacto con el jugador. */
function touch(w: World, e: Enemy, dmg = e.damage): void {
  const p = w.player;
  if (e.touchCd > 0 || dist(e, p) > e.r + p.r) return;
  e.touchCd = TOUCH_CD;
  if (!e.anim.busy()) e.anim.play('Attack', { speed: 1.4 });
  w.hurtPlayer(dmg, e.types[0], e.cat, e);
}

export function updateEnemy(w: World, e: Enemy, dt: number): void {
  if (!tickCommon(w, e, dt)) return;
  const p = w.player;
  if (e.stunT > 0) {
    e.stunT -= dt;
    e.anim.loop('Idle');
    return;
  }
  if (e.jump) {
    updateJump(w, e, dt);
    return;
  }
  const speed = e.speed * (1 - e.slow);
  let dx = p.x - e.x;
  let dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;

  // Corredor: va a donde VAS a estar.
  if (e.behavior === 'runner' && p.moving) {
    const lead = clamp(d / Math.max(60, speed), 0, 1.4);
    const ps = w.playerSpeed();
    const tx = p.x + Math.cos(p.moveAngle) * ps * lead;
    const ty = p.y + Math.sin(p.moveAngle) * ps * lead;
    const l = Math.hypot(tx - e.x, ty - e.y) || 1;
    dx = (tx - e.x) / l;
    dy = (ty - e.y) / l;
  }

  // Kamikaze: mecha y explosión.
  if (e.behavior === 'bomber') {
    if (e.phase === 'fuse') {
      e.pt -= dt;
      e.flash = Math.floor(e.pt * 10) % 2 ? 0.05 : 0;
      e.anim.loop('Idle');
      if (e.pt <= 0) {
        const r = 70 * sp();
        w.ring(e.x, e.y, 6, r, '#ff7b3d', 0.4, 5);
        w.burst(e.x, e.y - 8, '#ffb03d', 24);
        w.shake = Math.max(w.shake, 0.3);
        if (dist(e, p) < r + p.r) w.hurtPlayer(e.damage * 2.2, e.types[0], e.cat);
        e.hp = 0;
      }
      return;
    }
    if (d < e.r + p.r + 26 * sp()) {
      e.phase = 'fuse';
      e.pt = 1;
      e.anim.play('Charge', { speed: 1.2 });
      return;
    }
  }

  if (e.behavior === 'shielder' || e.behavior === 'jumper') {
    e.skillCd -= dt;
    if (e.skillCd <= 0) {
      if (e.behavior === 'shielder') {
        e.skillCd = 6;
        castShields(w, e);
      } else if (d < 250 * sp()) {
        e.skillCd = w.rng.range(5, 7);
        startJump(w, e);
        return;
      } else e.skillCd = 0.5;
    }
  }

  let vx = dx * speed;
  let vy = dy * speed;
  let animBase: 'Walk' | 'Idle' = 'Walk';

  if (e.behavior === 'charger') {
    e.pt -= dt;
    if (e.phase === 'walk') {
      if (d < 200 * sp() && e.pt <= 0) {
        e.phase = 'aim';
        e.pt = 0.55;
        e.anim.play('Charge', { speed: 1.6 });
      }
    } else if (e.phase === 'aim') {
      vx = vy = 0;
      animBase = 'Idle';
      if (e.pt <= 0) {
        // La dirección se fija al acabar de apuntar: la embestida se puede esquivar.
        e.phase = 'dash';
        e.pt = 0.42;
        e.dx = dx;
        e.dy = dy;
        e.anim.play('Attack', { speed: 1.4 });
        w.ring(e.x, e.y, e.r, e.r * 2.4, '#ff6b6b', 0.25, 2);
      }
    } else if (e.phase === 'dash') {
      vx = e.dx * speed * 3.4;
      vy = e.dy * speed * 3.4;
      if (e.pt <= 0) {
        e.phase = 'walk';
        e.pt = 1.1;
      }
    }
  } else if (isRangedBehavior(e.behavior)) {
    const range = e.def.range ?? 190 * sp();
    const keep = range * 0.82;
    if (d < keep * 0.75) {
      vx = -dx * speed * 0.8;
      vy = -dy * speed * 0.8;
    } else if (d < keep) {
      vx *= 0.1;
      vy *= 0.1;
      animBase = 'Idle';
    }
    e.shotCd -= dt;
    if (e.shotCd <= 0 && d < range) {
      e.shotCd = e.def.shotCd ?? 2;
      special(w, e, dx, dy);
    }
  }

  // Los que pegan cuerpo a cuerpo: daño al tocarte.
  if (!isRangedBehavior(e.behavior) || d < e.r + p.r) touch(w, e, e.phase === 'dash' ? e.damage * 1.2 : e.damage);

  e.x += vx * dt;
  e.y += vy * dt;
  const moving = Math.abs(vx) + Math.abs(vy) > 2;
  const face = e.phase === 'dash' ? Math.atan2(e.dy, e.dx) : moving ? Math.atan2(vy, vx) : Math.atan2(p.y - e.y, p.x - e.x);
  e.anim.dir = dirFromAngle(face);
  e.anim.loop(moving ? animBase : 'Idle', moving ? Math.max(0.6, speed / 60) : 1);
}

/** Lo que hace cada personalidad a distancia cuando le toca. */
function special(w: World, e: Enemy, dx: number, dy: number): void {
  const p = w.player;
  const col = TYPE_COLORS[e.types[0]] ?? '#ff7a9e';
  const angle = Math.atan2(dy, dx);
  switch (e.behavior) {
    case 'fan': {
      const n = e.def.fanN ?? 5;
      w.enemyShot(e, angle, n, n === 3 ? 0.6 : 0.9, 0.65);
      break;
    }
    case 'beamer':
      w.addHazard({ kind: 'beam', x: e.x, y: e.y, angle, len: 360 * sp(), w: 22 * sp() + 6, delay: 1, dmg: e.shotDmg * 1.05, element: e.types[0], cat: e.cat, color: col });
      e.anim.play('Charge', { speed: 1.2 });
      break;
    case 'zoner': {
      const n = w.rng.int(1, e.def.zones ?? 1);
      for (let i = 0; i < n; i++) {
        w.addHazard({
          kind: 'zone', x: p.x + (i ? w.rng.range(-70, 70) * sp() : 0), y: p.y + (i ? w.rng.range(-55, 55) * sp() : 0),
          r: 44 * sp(), delay: 1.2, dmg: e.shotDmg * 0.95, element: e.types[0], cat: e.cat, color: col,
        });
      }
      e.anim.play('Shoot');
      break;
    }
    case 'healer': {
      let healed = false;
      for (const o of w.enemies) {
        if (o === e || o.hp >= o.maxHp || dist(o, e) > 150 * sp()) continue;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (o.boss ? 0.04 : 0.15));
        w.text(o.x, o.y - o.bodyH - 6, '+', '#5fe08a', 12);
        healed = true;
      }
      if (healed) {
        w.ring(e.x, e.y, 6, 150 * sp(), '#5fe08a', 0.4, 3);
        e.anim.play('Charge');
      } else w.enemyShot(e, angle, 1, 0, 1);
      break;
    }
    case 'summoner': {
      const mine = w.enemies.filter((o) => o.summoned).length;
      if (mine < 4 && e.def.minion) {
        const def = w.minionDef(e.def.minion);
        for (let i = 0; i < 2; i++) w.queueSpawn(def, e, true);
        e.anim.play('Charge');
      } else w.enemyShot(e, angle, 1, 0, 1);
      break;
    }
    default:
      w.enemyShot(e, angle, 1, 0, 1);
  }
}

/** Escudo del 35% de vida a los 6 compañeros más cercanos. */
function castShields(w: World, e: Enemy): void {
  const allies = w.enemies.filter((o) => o !== e && o.hp > 0).sort((a, b) => dist(a, e) - dist(b, e)).slice(0, 6);
  for (const o of allies) {
    o.shield = o.maxHp * (o.boss ? 0.08 : 0.35);
    o.shieldT = 6;
  }
  e.shield = e.maxHp * 0.35;
  e.shieldT = 6;
  w.ring(e.x, e.y, 6, 120 * sp(), '#9fd8ff', 0.5, 3);
  e.anim.play('Charge');
}

/** Salto: avisa en el suelo dónde va a caer (donde estás ahora). */
export function startJump(w: World, e: Enemy, dmgMult = 1, radius = 60): void {
  const p = w.player;
  e.jump = { sx: e.x, sy: e.y, tx: p.x, ty: p.y, t: -0.5, dur: 0.65 };
  w.addHazard({ kind: 'zone', x: p.x, y: p.y, r: radius * sp(), delay: 1.15, dmg: e.damage * 1.25 * dmgMult, element: e.types[0], cat: e.cat, color: TYPE_COLORS[e.types[0]] });
  e.anim.play('Charge', { speed: 1.4 });
}

export function updateJump(w: World, e: Enemy, dt: number): void {
  const j = e.jump!;
  j.t += dt;
  if (j.t < 0) return;
  const k = Math.min(1, j.t / j.dur);
  e.x = j.sx + (j.tx - j.sx) * k;
  e.y = j.sy + (j.ty - j.sy) * k;
  if (k >= 1) {
    e.jump = null;
    e.anim.play('Attack', { speed: 1.4 });
  }
  void w;
}

/** Altura del salto para dibujar (0 en el suelo). */
export function jumpHeight(e: Enemy): number {
  const j = e.jump;
  if (!j || j.t < 0) return 0;
  const k = Math.min(1, j.t / j.dur);
  return Math.sin(k * Math.PI) * 60 * BALANCE.ps.space;
}
