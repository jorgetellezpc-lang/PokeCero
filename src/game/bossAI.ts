import { BALANCE } from '../config/balance';
import { TYPE_COLORS } from '../data/typeColors';
import { dirFromAngle } from '../render/animator';
import type { BossBrain, BossCast, Enemy } from './entities';
import { startJump, tickCommon, updateJump } from './enemyAI';
import { dist } from './math';
import type { World } from './world';

// ============================================================================
// Minibosses y jefes. IA basada en la de PokéSurvivor (js/entities/enemy.js):
// cada jefe tiene 4 ataques, 2 de cerca (Pisotón + Embestida o Salto) y 2 de
// lejos según su tipo, y alterna entre ir a por ti y pelear a distancia. Todo
// avisa en el suelo. Además, cada jefe tiene FASES (data/enemies.ts) que
// añaden ataques propios: Rodada, Magnitud, Avalancha, Tumba Rocas, Excavar y
// Tormenta Arena. En la última fase se enfurece.
// Required Notice: Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)
// ============================================================================

const sp = () => BALANCE.ps.space;

function hash(n: number, salt: number): number {
  let h = (n * 2654435761 + salt * 40503) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function brain(w: World, e: Enemy): BossBrain {
  const has = (...xs: string[]) => xs.some((x) => e.types.includes(x as never));
  const melee: BossCast['id'][] = ['slam', hash(e.def.dex, 3) < 0.5 ? 'dash' : 'leap'];
  const pref: BossCast['id'] = has('fire', 'ground', 'poison', 'rock', 'grass') ? 'rain'
    : has('electric', 'psychic', 'dragon', 'ice', 'steel') ? 'beam'
      : has('fairy', 'ghost', 'water', 'flying') ? 'nova' : 'volley';
  const others = (['rain', 'beam', 'nova', 'volley'] as BossCast['id'][]).filter((x) => x !== pref);
  const ranged = [pref, others[Math.floor(hash(e.def.dex, 9) * 3) % 3]];
  const far = e.behavior === 'ranged';
  return {
    melee, ranged, farLike: far ? 0.65 : 0.35, mode: far ? 'far' : 'close', modeT: w.rng.range(6, 8),
    cd: 1.6, cast: null, fury: false, side: w.rng.next() < 0.5 ? -1 : 1, phase: 0,
  };
}

export function updateBoss(w: World, e: Enemy, dt: number): void {
  if (!tickCommon(w, e, dt)) return;
  const p = w.player;
  e.ai ??= brain(w, e);
  const ai = e.ai;

  // Daño al tocar su cuerpo.
  if (e.touchCd <= 0 && dist(e, p) < e.r + p.r) {
    e.touchCd = 0.8;
    w.hurtPlayer(e.boss!.contactDamage, e.types[0], e.cat, e);
  }
  if (e.stunT > 0) {
    e.stunT -= dt;
    e.anim.loop('Idle');
    return;
  }
  if (e.jump) {
    updateJump(w, e, dt);
    if (!e.jump) {
      ai.cast = null;
      ai.cd = w.rng.range(1.4, 2) + 0.6;
    }
    return;
  }
  // Cambio de fase: aviso, breve pausa y estrena su ataque nuevo.
  const phases = e.boss!.phases;
  const next = phases[ai.phase + 1];
  if (next && e.hp < e.maxHp * next.at && !ai.cast) {
    ai.phase++;
    e.speed *= next.speed / phases[ai.phase - 1].speed;
    w.ring(e.x, e.y, e.r, e.r * 5, '#ffd23f', 0.6, 5);
    w.shake = Math.max(w.shake, 0.4);
    w.events.push({ type: 'bossPhase', name: next.name, phase: ai.phase + 1 });
    e.stunT = 0;
    ai.cd = 0.8;
    ai.forced = next.moves[next.moves.length - 1];
  }
  if (!ai.fury && e.hp < e.maxHp * e.boss!.phase2At) {
    ai.fury = true;
    w.ring(e.x, e.y, e.r, e.r * 5, '#ff4a4a', 0.6, 5);
    w.shake = Math.max(w.shake, 0.5);
    w.events.push({ type: 'bossEnraged', name: e.def.name });
  }

  let vx = 0;
  let vy = 0;
  let anim: 'Walk' | 'Idle' = 'Idle';
  if (ai.cast) {
    [vx, vy, anim] = cast(w, e, ai, dt);
  } else {
    [vx, vy, anim] = move(w, e, ai, dt);
  }
  e.x += vx * dt;
  e.y += vy * dt;
  const moving = Math.abs(vx) + Math.abs(vy) > 2;
  const face = moving ? Math.atan2(vy, vx) : Math.atan2(p.y - e.y, p.x - e.x);
  e.anim.dir = dirFromAngle(face);
  e.anim.loop(moving ? anim : 'Idle');
}

function move(w: World, e: Enemy, ai: BossBrain, dt: number): [number, number, 'Walk' | 'Idle'] {
  const p = w.player;
  const k = ai.fury ? 1.25 : 1;
  ai.modeT -= dt;
  ai.cd -= dt * k;
  if (ai.modeT <= 0) {
    ai.mode = ai.mode === 'far' ? 'close' : 'far';
    ai.modeT = (ai.mode === 'far') === (ai.farLike > 0.5) ? w.rng.range(7, 9) : w.rng.range(4, 5);
    ai.side = -ai.side;
  }
  const d = dist(e, p) || 1;
  const dx = (p.x - e.x) / d;
  const dy = (p.y - e.y) / d;
  const speed = e.speed * (1 - e.slow) * k;
  let vx = dx * speed * 1.1;
  let vy = dy * speed * 1.1;
  if (ai.mode === 'far') {
    if (d < 170 * sp()) {
      vx = -dx * speed;
      vy = -dy * speed;
    } else if (d < 300 * sp()) {
      vx = -dy * speed * 0.55 * ai.side;
      vy = dx * speed * 0.55 * ai.side;
    }
  }
  if (ai.cd <= 0) {
    let id: BossCast['id'] | null = null;
    const phase = e.boss!.phases[ai.phase];
    if (ai.forced) {
      id = ai.forced;
      ai.forced = undefined;
    } else if (phase && phase.moves.length && w.rng.next() < phase.signatureChance) {
      id = w.rng.pick(phase.moves);
    } else if (ai.mode === 'close') {
      const ok = ai.melee.filter((m) => (m === 'slam' ? d < 125 * sp() : d < 320 * sp()));
      id = ok.length && w.rng.next() < 0.8 ? w.rng.pick(ok) : d < 480 * sp() ? w.rng.pick(ai.ranged) : null;
    } else {
      id = d < 115 * sp() ? 'slam' : d < 430 * sp() ? w.rng.pick(ai.ranged) : null;
    }
    if (id) start(w, e, ai, id);
  }
  return [vx, vy, 'Walk'];
}

function start(w: World, e: Enemy, ai: BossBrain, id: BossCast['id']): void {
  const p = w.player;
  const f = ai.fury ? 0.8 : 1;
  const el = e.types[0];
  const col = TYPE_COLORS[el] ?? '#ff7a9e';
  const ang = Math.atan2(p.y - e.y, p.x - e.x);
  const c: BossCast = { id, t: 0, wind: 0.6 * f, after: 0.35, ang };
  ai.cast = c;
  const hz = { element: el, cat: e.cat, color: col };
  switch (id) {
    case 'slam':
      c.wind = 0.85 * f;
      w.addHazard({ kind: 'zone', x: e.x, y: e.y, r: 96 * sp() + e.r, delay: c.wind, dmg: e.damage * 1.3, ...hz });
      e.anim.play('Charge', { speed: 1.2 });
      break;
    case 'dash':
      c.wind = 0.75 * f;
      c.len = 330 * sp();
      c.dur = 0.32;
      w.addHazard({ kind: 'beam', x: e.x, y: e.y, angle: ang, len: c.len + e.r, w: e.r * 2 + 16, delay: c.wind + c.dur, dmg: e.damage * 1.2, ...hz });
      e.anim.play('Charge', { speed: 1.3 });
      break;
    case 'leap':
      startJump(w, e, 1, 82);
      ai.cast = null;
      ai.cd = w.rng.range(1.4, 2) + 0.6;
      break;
    case 'rain': {
      const n = ai.fury ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const a = i ? w.rng.range(0, Math.PI * 2) : 0;
        const dd = i ? w.rng.range(40, 120) * sp() : 0;
        w.addHazard({ kind: 'zone', x: p.x + Math.cos(a) * dd, y: p.y + Math.sin(a) * dd * 0.8, r: 50 * sp(), delay: 1.05 + i * 0.12, dmg: e.shotDmg * 1.15, ...hz });
      }
      c.wind = 0.5;
      e.anim.play('Shoot');
      break;
    }
    case 'beam': {
      const n = ai.fury ? 5 : 3;
      const spread = ai.fury ? 0.42 : 0.5;
      for (let i = 0; i < n; i++) {
        w.addHazard({ kind: 'beam', x: e.x, y: e.y, angle: ang + (i - (n - 1) / 2) * spread, len: 400 * sp(), w: 26 * sp() + 4, delay: 1, dmg: e.shotDmg * 1.2, ...hz });
      }
      c.wind = 1;
      c.after = 0.25;
      e.anim.play('Charge', { speed: 1.1 });
      break;
    }
    case 'volley':
    case 'nova':
      c.wind = (id === 'nova' ? 0.7 : 0.5) * f;
      e.anim.play('Charge', { speed: 1.4 });
      w.ring(e.x, e.y, e.r, e.r * 2.4, col, c.wind, 2);
      break;
    default:
      startSignature(w, e, c, f, hz);
      break;
  }
}

type HazardStyle = { element: Enemy['types'][number]; cat: Enemy['cat']; color: string };

/** Ataques propios de las fases. Todos avisan en el suelo antes de golpear. */
function startSignature(w: World, e: Enemy, c: BossCast, f: number, hz: HazardStyle): void {
  const p = w.player;
  const mg = BALANCE.arena.margin + 20;
  switch (c.id) {
    case 'rollout':
      // Rodada: tres embestidas seguidas, cada una apuntada de nuevo.
      c.n = 3;
      c.len = 260 * sp();
      c.dur = 0.3;
      c.wind = 0.55 * f;
      w.addHazard({ kind: 'beam', x: e.x, y: e.y, angle: c.ang, len: c.len + e.r, w: e.r * 2 + 12, delay: c.wind + c.dur, dmg: e.damage, ...hz });
      e.anim.play('Charge', { speed: 1.5 });
      break;
    case 'quake':
      // Magnitud: ondas de rocas que salen del jefe en 8 direcciones.
      for (let ring = 1; ring <= 3; ring++) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + (ring % 2) * (Math.PI / 8);
          const d = ring * 62 * sp() + e.r;
          w.addHazard({ kind: 'zone', x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, r: 26 * sp() + 6, delay: 0.8 + ring * 0.28, dmg: e.damage * 0.9, ...hz });
        }
      }
      w.addHazard({ kind: 'zone', x: e.x, y: e.y, r: e.r + 40 * sp(), delay: 0.8, dmg: e.damage, ...hz });
      c.wind = 1.4;
      c.after = 0.3;
      e.anim.play('Charge', { speed: 1.1 });
      break;
    case 'slide': {
      // Avalancha: una fila de rocas que avanza hacia donde estás.
      const n = 7;
      for (let i = 0; i < n; i++) {
        const d = e.r + (i + 1) * 46 * sp();
        w.addHazard({ kind: 'zone', x: e.x + Math.cos(c.ang) * d, y: e.y + Math.sin(c.ang) * d, r: 30 * sp() + 6, delay: 0.75 + i * 0.12, dmg: e.shotDmg * 1.1, ...hz });
      }
      c.wind = 0.6;
      e.anim.play('Shoot');
      break;
    }
    case 'tomb': {
      // Tumba Rocas: te rodea con rocas dejando un hueco; el centro también cae.
      const n = 10;
      const gap = Math.floor(w.rng.next() * n);
      const R = 92 * sp() + 20;
      for (let i = 0; i < n; i++) {
        if (i === gap || i === (gap + 1) % n) continue;
        const a = (i / n) * Math.PI * 2;
        w.addHazard({ kind: 'zone', x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R, r: 26 * sp() + 6, delay: 1.25, dmg: e.shotDmg * 1.2, ...hz });
      }
      w.addHazard({ kind: 'zone', x: p.x, y: p.y, r: 58 * sp() + 8, delay: 1.25, dmg: e.shotDmg * 1.3, ...hz });
      c.wind = 0.9;
      c.after = 0.5;
      e.anim.play('Charge', { speed: 1.2 });
      break;
    }
    case 'dig':
      // Excavar: se entierra, va bajo tierra hasta tu posición y sale de golpe.
      e.hidden = true;
      c.tx = p.x;
      c.ty = p.y;
      c.wind = 1.25 * f;
      c.after = 0.4;
      w.addHazard({ kind: 'zone', x: p.x, y: p.y, r: e.r + 34 * sp(), delay: c.wind, dmg: e.damage * 1.3, ...hz });
      w.burst(e.x, e.y, '#b08a5a', 16);
      break;
    case 'storm':
      // Tormenta Arena: rocas por toda la sala (y dos sobre ti).
      for (let i = 0; i < 10; i++) {
        const onYou = i < 2;
        const x = onYou ? p.x + w.rng.range(-30, 30) : w.rng.range(mg, w.W - mg);
        const y = onYou ? p.y + w.rng.range(-30, 30) : w.rng.range(mg + 40, w.H - mg);
        w.addHazard({ kind: 'zone', x, y, r: 34 * sp() + 6, delay: 0.9 + i * 0.1, dmg: e.shotDmg, ...hz });
      }
      c.wind = 0.8;
      c.after = 0.6;
      e.anim.play('Charge');
      break;
    default:
      break;
  }
}

function cast(w: World, e: Enemy, ai: BossBrain, dt: number): [number, number, 'Walk' | 'Idle'] {
  const p = w.player;
  const c = ai.cast!;
  c.t += dt;
  if (c.id === 'dig') {
    if (c.t < c.wind) {
      // Bajo tierra se desliza hasta el aviso.
      const d = Math.hypot(c.tx! - e.x, c.ty! - e.y);
      if (d > 4) {
        const speed = Math.max(d / Math.max(0.1, c.wind - c.t), 60);
        return [((c.tx! - e.x) / d) * speed, ((c.ty! - e.y) / d) * speed, 'Walk'];
      }
      return [0, 0, 'Idle'];
    }
    if (e.hidden) {
      e.hidden = false;
      w.burst(e.x, e.y, '#b08a5a', 24);
      w.shake = Math.max(w.shake, 0.3);
      e.anim.play('Attack', { speed: 1.4 });
    }
  }
  if (c.id === 'rollout' && c.t >= c.wind) {
    if (c.t >= c.wind + c.dur!) {
      if (--c.n! <= 0) return end(w, ai);
      // Siguiente vuelta: vuelve a apuntar.
      c.t = 0;
      c.wind = 0.35;
      c.ang = Math.atan2(p.y - e.y, p.x - e.x);
      w.addHazard({ kind: 'beam', x: e.x, y: e.y, angle: c.ang, len: c.len! + e.r, w: e.r * 2 + 12, delay: c.wind + c.dur!, dmg: e.damage, element: e.types[0], cat: e.cat, color: TYPE_COLORS[e.types[0]] ?? '#ff7a9e' });
      return [0, 0, 'Idle'];
    }
    const speed = c.len! / c.dur!;
    return [Math.cos(c.ang) * speed, Math.sin(c.ang) * speed, 'Walk'];
  }
  if (c.id === 'dash' && c.t >= c.wind) {
    if (!c.go) {
      c.go = true;
      e.anim.play('Attack', { speed: 1.6 });
    }
    if (c.t >= c.wind + c.dur!) return end(w, ai);
    const speed = c.len! / c.dur!;
    return [Math.cos(c.ang) * speed, Math.sin(c.ang) * speed, 'Walk'];
  }
  if (c.t >= c.wind && !c.fired) {
    c.fired = true;
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    if (c.id === 'volley') w.enemyShot(e, ang, ai.fury ? 9 : 7, 1.1, 0.8);
    else if (c.id === 'nova') {
      const n = ai.fury ? 18 : 14;
      w.enemyShot(e, ang, n, (Math.PI * 2 * (n - 1)) / n, 0.7);
    } else if (c.id === 'slam') e.anim.play('Attack', { speed: 1.4 });
  }
  if (c.t >= c.wind + c.after) return end(w, ai);
  return [0, 0, 'Idle'];
}

function end(w: World, ai: BossBrain): [number, number, 'Idle'] {
  ai.cast = null;
  ai.cd = w.rng.range(1.3, 2);
  if (ai.fury && w.rng.next() < 0.35) ai.cd = 0.3;
  return [0, 0, 'Idle'];
}
