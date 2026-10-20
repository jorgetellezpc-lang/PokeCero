import { BALANCE } from '../config/balance';
import type { Enemy } from './entities';
import { tickCommon } from './enemyAI';
import { angleTo, dirTo, dist } from './math';
import type { World } from './world';

// Minibosses y jefes: patrones reutilizables (embestida, lanzamiento,
// anillo, desprendimiento, invocación) con aviso visual previo. Cada jefe
// elige qué patrones usa en data/enemies.ts.

const CHARGE_TIME = 0.75;
const CHARGE_SPEED = 330;
const RECOVER = 0.55;

export function updateBoss(w: World, e: Enemy, dt: number): void {
  tickCommon(w, e, dt);
  const b = e.boss!;
  const p = w.player;

  if (!e.phase2 && b.phase2At && e.hp / e.maxHp <= b.phase2At) {
    e.phase2 = true;
    e.speed *= 1.25;
    w.text(e.x, e.y - e.r - 12, '¡Enfurecido!', '#ff6040', 12);
    w.shake = 0.3;
  }

  // Daño por contacto con el cuerpo del jefe.
  if (e.contactCd <= 0 && dist(e, p) < e.r + p.r - 2) {
    w.hitPlayer(e.contact);
    e.contactCd = 0.8;
  }

  const extra = e.phase2 ? 1 : 0;
  switch (e.state) {
    case 'move': {
      const dir = dirTo(e, p);
      e.facing = dir.x >= 0 ? 1 : -1;
      const d = dist(e, p);
      const keep = b.archetype === 'ranged' ? 150 : 0;
      const sign = d > keep + 20 ? 1 : d < keep - 20 ? -1 : 0;
      e.x += dir.x * e.speed * sign * dt;
      e.y += dir.y * e.speed * sign * dt;
      if (e.attackTimer <= 0) {
        e.pattern = b.patterns[e.patternIndex % b.patterns.length];
        e.patternIndex++;
        if (e.pattern === 'summon' && w.enemies.length > 4) {
          e.pattern = b.patterns[e.patternIndex % b.patterns.length];
          e.patternIndex++;
        }
        e.state = 'windup';
        e.stateTime = b.windup * (e.phase2 ? 0.75 : 1);
        e.aim = dir;
      }
      break;
    }
    case 'windup':
      e.stateTime -= dt;
      // Durante la preparación de la embestida sigue apuntando, pero se
      // bloquea en el último tramo para que se pueda esquivar.
      if (e.pattern === 'charge' && e.stateTime > 0.3) e.aim = dirTo(e, p);
      if (e.stateTime <= 0) execute(w, e, extra);
      break;
    case 'strike': {
      e.stateTime -= dt;
      e.x += e.aim.x * CHARGE_SPEED * dt;
      e.y += e.aim.y * CHARGE_SPEED * dt;
      if (!e.struck && dist(e, p) < e.r + p.r) {
        e.struck = true;
        w.hitPlayer(e.damage);
      }
      const m = BALANCE.arena.margin + e.r + 1;
      const hitWall = e.x <= m || e.x >= w.W - m || e.y <= m || e.y >= w.H - m;
      if (hitWall) w.shake = Math.max(w.shake, 0.2);
      if (e.stateTime <= 0 || hitWall) toRecover(e);
      break;
    }
    case 'recover':
      e.stateTime -= dt;
      if (e.stateTime <= 0) {
        e.state = 'move';
        e.attackTimer = b.attackCooldown * (e.phase2 ? 0.7 : 1);
      }
      break;
  }
}

function toRecover(e: Enemy): void {
  e.state = 'recover';
  e.stateTime = RECOVER;
}

function execute(w: World, e: Enemy, extra: number): void {
  const b = e.boss!;
  const p = w.player;
  const spec = b.projectile!;
  const el = b.types[0];
  switch (e.pattern) {
    case 'charge':
      e.state = 'strike';
      e.stateTime = CHARGE_TIME;
      e.struck = false;
      return;
    case 'throw':
      w.enemyShot(e, angleTo(e, p), 3 + extra * 2, 0.28, spec.speed, spec.radius, e.damage, spec.color, el);
      break;
    case 'ring': {
      const n = spec.count + extra * 4;
      const off = w.rng.range(0, Math.PI * 2);
      for (let i = 0; i < n; i++) {
        w.enemyShot(e, off + (i / n) * Math.PI * 2, 1, 0, spec.speed * 0.85, spec.radius, e.damage * 0.8, spec.color, el);
      }
      break;
    }
    case 'rockfall': {
      const n = 3 + extra * 2;
      for (let i = 0; i < n; i++) {
        const x = i === 0 ? p.x : p.x + w.rng.range(-100, 100);
        const y = i === 0 ? p.y : p.y + w.rng.range(-100, 100);
        w.zones.push({
          x, y, r: 30, owner: 'enemy', element: el, damage: e.damage, delay: 1.0 + i * 0.12,
          life: 0.25, tick: 0, tickEvery: 0, color: '#a08060', burst: true, fired: false,
        });
      }
      break;
    }
    case 'summon':
      if (b.summonId) for (let i = 0; i < 2 + extra; i++) w.queueSpawn(b.summonId, e);
      break;
  }
  toRecover(e);
}
