import { BALANCE } from '../config/balance';
import type { Enemy } from './entities';
import { angleTo, clamp, dirTo, dist } from './math';
import type { World } from './world';

// Comportamientos de enemigos normales por ARQUETIPO (no por especie). Cada
// especie solo aporta números en data/enemies.ts.

/** Duración de la embestida del ataque cuerpo a cuerpo. */
const STRIKE_TIME = 0.18;
const STRIKE_SPEED_MULT = 3.4;
const RECOVER_TIME = 0.25;

export function tickCommon(w: World, e: Enemy, dt: number): void {
  e.hitFlash = Math.max(0, e.hitFlash - dt);
  e.attackTimer -= dt;
  e.contactCd = Math.max(0, e.contactCd - dt);
  for (const k in e.orbitCd) e.orbitCd[k] -= dt;
  e.x += e.knock.x * dt;
  e.y += e.knock.y * dt;
  const decay = Math.exp(-8 * dt);
  e.knock.x *= decay;
  e.knock.y *= decay;
  e.animTime += dt * 6;
  const m = BALANCE.arena.margin;
  e.x = clamp(e.x, m + e.r, w.W - m - e.r);
  e.y = clamp(e.y, m + e.r, w.H - m - e.r);
}

export function updateEnemy(w: World, e: Enemy, dt: number): void {
  tickCommon(w, e, dt);
  if (e.def.archetype === 'ranged') updateRanged(w, e, dt);
  else updateMelee(w, e, dt);
}

function updateMelee(w: World, e: Enemy, dt: number): void {
  const p = w.player;
  const d = dist(e, p);
  switch (e.state) {
    case 'move': {
      const dir = dirTo(e, p);
      e.facing = dir.x >= 0 ? 1 : -1;
      if (d > e.r + p.r + 2) {
        e.x += dir.x * e.speed * dt;
        e.y += dir.y * e.speed * dt;
      }
      if (d <= e.def.attackRange + e.r + p.r && e.attackTimer <= 0) {
        e.state = 'windup';
        e.stateTime = e.def.windup;
        // La dirección se fija al empezar la preparación: el golpe es esquivable.
        e.aim = dir;
      }
      break;
    }
    case 'windup':
      e.stateTime -= dt;
      if (e.stateTime <= 0) {
        e.state = 'strike';
        e.stateTime = STRIKE_TIME;
        e.struck = false;
      }
      break;
    case 'strike':
      e.stateTime -= dt;
      e.x += e.aim.x * e.speed * STRIKE_SPEED_MULT * dt;
      e.y += e.aim.y * e.speed * STRIKE_SPEED_MULT * dt;
      // El daño solo se aplica si hay contacto real durante la embestida.
      if (!e.struck && dist(e, p) < e.r + p.r + 2) {
        e.struck = true;
        w.hitPlayer(e.damage);
      }
      if (e.stateTime <= 0) {
        e.state = 'recover';
        e.stateTime = RECOVER_TIME;
      }
      break;
    case 'recover':
      e.stateTime -= dt;
      if (e.stateTime <= 0) {
        e.state = 'move';
        e.attackTimer = e.def.attackCooldown;
      }
      break;
  }
}

function updateRanged(w: World, e: Enemy, dt: number): void {
  const p = w.player;
  const d = dist(e, p);
  const pd = e.def.preferredDistance ?? 160;
  switch (e.state) {
    case 'move': {
      const dir = dirTo(e, p);
      e.facing = dir.x >= 0 ? 1 : -1;
      let mx = 0;
      let my = 0;
      if (d > pd + 25) {
        mx = dir.x;
        my = dir.y;
      } else if (d < pd - 35) {
        mx = -dir.x;
        my = -dir.y;
      } else {
        // Desplazamiento lateral para no quedarse quieto.
        mx = -dir.y * e.strafe * 0.6;
        my = dir.x * e.strafe * 0.6;
        if (w.rng.next() < dt * 0.4) e.strafe *= -1;
      }
      const ox = e.x;
      const oy = e.y;
      e.x += mx * e.speed * dt;
      e.y += my * e.speed * dt;
      const m = BALANCE.arena.margin + e.r;
      if (e.x < m || e.x > w.W - m || e.y < m || e.y > w.H - m) {
        e.x = ox;
        e.y = oy;
        e.strafe *= -1;
      }
      if (e.attackTimer <= 0 && d <= e.def.attackRange) {
        e.state = 'windup';
        e.stateTime = e.def.windup;
      }
      break;
    }
    case 'windup':
      e.stateTime -= dt;
      if (e.stateTime <= 0) {
        const spec = e.def.projectile!;
        // El proyectil sale al final de la preparación, apuntando a donde está el jugador.
        w.enemyShot(e, angleTo(e, p), spec.count, spec.spread, spec.speed, spec.radius, e.damage, spec.color, e.def.types[0]);
        e.state = 'move';
        e.attackTimer = e.def.attackCooldown * w.rng.range(0.85, 1.15);
      }
      break;
    default:
      e.state = 'move';
  }
}
