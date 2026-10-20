import { BALANCE } from '../config/balance';
import { getAttack } from '../data/attacks';
import { getEnemy } from '../data/enemies';
import { getSpecies } from '../data/pokemon';
import { RUN_STAT_UPGRADES } from '../data/runUpgrades';
import { typeMultiplier } from '../data/typeChart';
import type { BossDef, ElementType, GymDef } from '../data/types';
import { updateBoss } from './bossAI';
import { updateEnemy } from './enemyAI';
import type {
  Enemy, FloatText, Gem, Particle, Player, Projectile, Ring, SpawnMarker, Vec, Zone,
} from './entities';
import { clamp, dist } from './math';
import { xpToNext } from './progression';
import { Rng } from './rng';
import { planRoom, scalingFor, type RoomPlan, type RoomScaling } from './rooms';
import { generateChoices, type UpgradeChoice } from './upgradeGenerator';
import { updateAttacks } from './weapons';

// Simulación de una partida (run). Contiene todo el estado TEMPORAL: nivel,
// mejoras elegidas, sala actual. No toca el guardado permanente; la pantalla
// de partida lee los eventos y decide qué recompensas persistir.

export type WorldPhase = 'playing' | 'levelup' | 'dead' | 'victory';

export type WorldEvent =
  | { type: 'roomStart'; room: number; index: number; total: number; kind: RoomPlan['kind'] }
  | { type: 'roomCleared'; room: number; kind: RoomPlan['kind'] }
  | { type: 'playerHit'; damage: number }
  | { type: 'levelUp'; level: number }
  | { type: 'evolved'; from: string; to: string }
  | { type: 'bossSpawn'; name: string; title: string }
  | { type: 'bossDefeated'; room: number; role: BossDef['role'] }
  | { type: 'victory' }
  | { type: 'defeat' };

export interface PermanentBonuses { hp: number; power: number; defense: number; speed: number }

export interface WorldOptions {
  speciesId: string;
  gym: GymDef;
  rooms: number[];
  permanent?: PermanentBonuses;
  xpMult?: number;
  /** La sala N escala como la sala N*factor (modo prueba). */
  scalingFactor?: number;
  seed?: number;
}

export class World {
  readonly W = BALANCE.arena.width;
  readonly H = BALANCE.arena.height;
  readonly rng: Rng;
  readonly gym: GymDef;
  readonly rooms: number[];
  readonly xpMult: number;
  readonly scalingFactor: number;
  readonly permanent: PermanentBonuses;

  time = 0;
  phase: WorldPhase = 'playing';
  player: Player;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  gems: Gem[] = [];
  markers: SpawnMarker[] = [];
  texts: FloatText[] = [];
  particles: Particle[] = [];
  rings: Ring[] = [];
  events: WorldEvent[] = [];

  roomIndex = 0;
  plan!: RoomPlan;
  scaling!: RoomScaling;
  pendingWaves: string[][] = [];
  roomCleared = false;
  exitOpen = false;
  readonly exit: Vec & { r: number };

  kills = 0;
  runGold = 0;
  bonusGold = 0;
  pendingLevelUps = 0;
  choices: UpgradeChoice[] = [];
  boss: Enemy | null = null;
  private victoryTimer = -1;
  private nextId = 1;
  shake = 0;

  constructor(opts: WorldOptions) {
    this.rng = new Rng(opts.seed ?? (Date.now() & 0xffffffff));
    this.gym = opts.gym;
    this.rooms = opts.rooms;
    this.xpMult = opts.xpMult ?? 1;
    this.scalingFactor = opts.scalingFactor ?? 1;
    this.permanent = opts.permanent ?? { hp: 0, power: 0, defense: 0, speed: 0 };
    this.exit = { x: this.W / 2, y: 30, r: 26 };

    const species = getSpecies(opts.speciesId);
    this.player = {
      x: this.W / 2, y: this.H - 70, r: BALANCE.player.radius, species,
      hp: 1, maxHp: 1, speed: 0, power: 1, defense: 0, haste: 0, magnet: 0, regen: 0,
      invuln: 0, level: 1, xp: 0, attacks: [], statStacks: {}, facing: 1, moving: false,
      animTime: 0, hitFlash: 0,
    };
    this.recomputeStats();
    this.player.hp = this.player.maxHp;
    this.addAttack(species.startingAttack);
    this.startRoom(0);
  }

  get room(): number {
    return this.rooms[this.roomIndex];
  }

  get xpNeeded(): number {
    return xpToNext(this.player.level);
  }

  get isLastRoom(): boolean {
    return this.roomIndex === this.rooms.length - 1;
  }

  newId(): number {
    return this.nextId++;
  }

  // --------------------------------------------------------------------------
  // Salas
  // --------------------------------------------------------------------------

  startRoom(index: number): void {
    this.roomIndex = index;
    const room = this.room;
    this.plan = planRoom(this.gym, room, this.rng);
    const effective = Math.max(1, Math.round(room * this.scalingFactor));
    this.scaling = scalingFor(effective);
    this.enemies = [];
    this.projectiles = [];
    this.zones = [];
    this.gems = [];
    this.markers = [];
    this.rings = [];
    this.boss = null;
    this.roomCleared = false;
    this.exitOpen = false;
    this.player.x = this.W / 2;
    this.player.y = this.H - 70;
    this.player.invuln = 1;
    this.pendingWaves = this.plan.waves.map((w) => [...w]);
    if (this.plan.bossId) {
      this.markers.push({ x: this.W / 2, y: 170, t: BALANCE.rooms.spawnTelegraph * 1.6, enemyId: this.plan.bossId, boss: true });
    } else {
      this.spawnNextWave();
    }
    this.events.push({ type: 'roomStart', room, index, total: this.rooms.length, kind: this.plan.kind });
  }

  private spawnNextWave(): void {
    const wave = this.pendingWaves.shift();
    if (!wave) return;
    const free = Math.max(0, BALANCE.rooms.maxAlive - this.enemies.length);
    const now = wave.slice(0, free);
    const later = wave.slice(free);
    if (later.length) this.pendingWaves.unshift(later);
    for (const id of now) this.queueSpawn(id);
  }

  queueSpawn(enemyId: string, near?: Vec): void {
    const m = BALANCE.arena.margin + 16;
    let x = 0;
    let y = 0;
    for (let i = 0; i < 30; i++) {
      if (near) {
        x = near.x + this.rng.range(-70, 70);
        y = near.y + this.rng.range(-50, 60);
      } else {
        x = this.rng.range(m, this.W - m);
        y = this.rng.range(m + 40, this.H * 0.72);
      }
      x = clamp(x, m, this.W - m);
      y = clamp(y, m, this.H - m);
      if (dist({ x, y }, this.player) >= BALANCE.rooms.minSpawnDistance) break;
    }
    this.markers.push({ x, y, t: BALANCE.rooms.spawnTelegraph, enemyId, boss: false });
  }

  private spawnEnemy(mk: SpawnMarker): void {
    const def = getEnemy(mk.enemyId);
    const boss = 'role' in def ? (def as BossDef) : null;
    const s = this.scaling;
    const hp = def.hp * s.hpMult;
    const e: Enemy = {
      id: this.newId(), def, boss, x: mk.x, y: mk.y, r: def.radius,
      hp, maxHp: hp, damage: def.damage * s.damageMult, speed: def.speed * s.speedMult,
      state: 'move', stateTime: 0, attackTimer: boss ? 1.2 : this.rng.range(0.6, 1.4) * def.attackCooldown,
      aim: { x: 0, y: 1 }, struck: false, strafe: this.rng.next() < 0.5 ? -1 : 1, knock: { x: 0, y: 0 },
      hitFlash: 0, orbitCd: {}, facing: 1, animTime: this.rng.range(0, 1),
      pattern: null, patternIndex: 0, phase2: false,
      contact: boss ? boss.contactDamage * s.damageMult : 0, contactCd: 0,
    };
    this.enemies.push(e);
    if (boss && mk.boss) {
      this.boss = e;
      this.events.push({ type: 'bossSpawn', name: boss.name, title: boss.title });
    }
    this.burst(e.x, e.y, '#ffffff', 6);
  }

  private checkRoomProgress(): void {
    if (this.roomCleared) return;
    if (this.markers.length) return;
    if (this.plan.kind === 'normal') {
      const remaining = this.pendingWaves.length;
      if (remaining && this.enemies.length <= 1) this.spawnNextWave();
      if (this.enemies.length || this.pendingWaves.length || this.markers.length) return;
    } else if (this.enemies.length) {
      return;
    }
    this.clearRoom();
  }

  private clearRoom(): void {
    this.roomCleared = true;
    const kind = this.plan.kind;
    const p = this.player;
    const heal = kind === 'normal' ? BALANCE.rooms.healOnClear : BALANCE.rooms.healOnBossClear;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * heal);
    this.runGold += BALANCE.rewards.goldPerRoomClear;
    for (const g of this.gems) g.pulled = true;
    this.projectiles = this.projectiles.filter((pr) => pr.owner === 'player');
    this.zones = this.zones.filter((z) => z.owner === 'player');
    this.events.push({ type: 'roomCleared', room: this.room, kind });
    if (this.isLastRoom) {
      this.victoryTimer = 1.6;
    } else {
      this.exitOpen = true;
    }
  }

  // --------------------------------------------------------------------------
  // Bucle
  // --------------------------------------------------------------------------

  update(dt: number, move: Vec): void {
    if (this.phase !== 'playing') return;
    this.time += dt;
    const p = this.player;

    // Jugador
    const len = Math.hypot(move.x, move.y);
    const mag = Math.min(1, len);
    p.moving = mag > 0.05;
    if (p.moving) {
      p.x += (move.x / len) * mag * p.speed * dt;
      p.y += (move.y / len) * mag * p.speed * dt;
      if (Math.abs(move.x) > 0.1) p.facing = Math.sign(move.x);
      p.animTime += dt * (2 + mag * 6);
    }
    const m = BALANCE.arena.margin;
    p.x = clamp(p.x, m + p.r, this.W - m - p.r);
    p.y = clamp(p.y, m + p.r, this.H - m - p.r);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

    // Apariciones
    for (const mk of this.markers) mk.t -= dt;
    const ready = this.markers.filter((mk) => mk.t <= 0);
    if (ready.length) {
      this.markers = this.markers.filter((mk) => mk.t > 0);
      for (const mk of ready) this.spawnEnemy(mk);
    }

    updateAttacks(this, dt);

    for (const e of this.enemies) {
      if (e.boss) updateBoss(this, e, dt);
      else updateEnemy(this, e, dt);
    }
    this.separateEnemies();
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateGems(dt);
    this.updateEffects(dt);

    if (this.phase !== 'playing') return;

    this.checkRoomProgress();

    if (this.exitOpen && dist(p, this.exit) < this.exit.r + p.r && this.gems.length === 0) {
      this.startRoom(this.roomIndex + 1);
      return;
    }

    if (this.victoryTimer > 0) {
      this.victoryTimer -= dt;
      if (this.victoryTimer <= 0) {
        this.phase = 'victory';
        this.events.push({ type: 'victory' });
        return;
      }
    }

    if (this.pendingLevelUps > 0) {
      this.phase = 'levelup';
      this.choices = this.makeChoices();
    }
  }

  private separateEnemies(): void {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i];
        const b = es[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const overlap = a.r + b.r - d;
        if (overlap > 0) {
          const wa = a.boss ? 0.1 : 0.5;
          const wb = b.boss ? 0.1 : 0.5;
          a.x -= (dx / d) * overlap * wa;
          a.y -= (dy / d) * overlap * wa;
          b.x += (dx / d) * overlap * wb;
          b.y += (dy / d) * overlap * wb;
        }
      }
    }
  }

  private updateProjectiles(dt: number): void {
    const p = this.player;
    const out: Projectile[] = [];
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      let alive = pr.life > 0 && pr.x > -20 && pr.x < this.W + 20 && pr.y > -20 && pr.y < this.H + 20;
      if (alive && pr.owner === 'enemy') {
        if (dist(pr, p) < pr.r + p.r * 0.8) {
          this.hitPlayer(pr.damage);
          alive = false;
        }
      } else if (alive) {
        for (const e of this.enemies) {
          if (pr.hit.has(e.id) || e.hp <= 0) continue;
          if (dist(pr, e) < pr.r + e.r) {
            pr.hit.add(e.id);
            const len = Math.hypot(pr.vx, pr.vy) || 1;
            this.damageEnemy(e, pr.damage, pr.element, { x: (pr.vx / len) * 60, y: (pr.vy / len) * 60 });
            if (pr.pierce-- <= 0) {
              alive = false;
              break;
            }
          }
        }
      }
      if (alive) out.push(pr);
      else this.burst(pr.x, pr.y, pr.color, 3);
    }
    this.projectiles = out;
    this.removeDead();
  }

  private updateZones(dt: number): void {
    const p = this.player;
    for (const z of this.zones) {
      if (z.delay > 0) {
        z.delay -= dt;
        continue;
      }
      if (z.burst) {
        if (!z.fired) {
          z.fired = true;
          this.rings.push({ x: z.x, y: z.y, r: z.r * 0.4, maxR: z.r, life: 0.25, color: z.color });
          if (z.owner === 'enemy') {
            if (dist(z, p) < z.r + p.r * 0.6) this.hitPlayer(z.damage);
            this.shake = Math.max(this.shake, 0.15);
          } else {
            for (const e of this.enemies) if (dist(z, e) < z.r + e.r) this.damageEnemy(e, z.damage, z.element);
          }
        }
        z.life -= dt;
        continue;
      }
      z.life -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = z.tickEvery;
        for (const e of this.enemies) if (dist(z, e) < z.r + e.r) this.damageEnemy(e, z.damage, z.element);
      }
    }
    this.zones = this.zones.filter((z) => z.delay > 0 || z.life > 0);
    this.removeDead();
  }

  private updateGems(dt: number): void {
    const p = this.player;
    const keep: Gem[] = [];
    for (const g of this.gems) {
      const d = dist(g, p);
      if (d < p.magnet) g.pulled = true;
      if (g.pulled) {
        const sp = (this.roomCleared ? 520 : 300) * dt;
        g.x += ((p.x - g.x) / (d || 1)) * Math.min(sp, d);
        g.y += ((p.y - g.y) / (d || 1)) * Math.min(sp, d);
      }
      if (dist(g, p) < p.r + 4) this.addXp(g.value);
      else keep.push(g);
    }
    this.gems = keep;
  }

  private updateEffects(dt: number): void {
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 26 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const pa of this.particles) {
      pa.life -= dt;
      pa.x += pa.vx * dt;
      pa.y += pa.vy * dt;
      pa.vx *= 0.92;
      pa.vy *= 0.92;
    }
    this.particles = this.particles.filter((pa) => pa.life > 0);
    for (const r of this.rings) {
      r.life -= dt;
      r.r += (r.maxR - r.r) * Math.min(1, dt * 14);
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    this.shake = Math.max(0, this.shake - dt);
  }

  // --------------------------------------------------------------------------
  // Daño
  // --------------------------------------------------------------------------

  hitPlayer(amount: number): void {
    const p = this.player;
    if (p.invuln > 0 || this.phase !== 'playing' || this.roomCleared) return;
    const dmg = Math.max(1, Math.round(amount * (1 - p.defense)));
    p.hp -= dmg;
    p.invuln = BALANCE.player.invulnerability;
    p.hitFlash = 0.2;
    this.shake = Math.max(this.shake, 0.18);
    this.text(p.x, p.y - 16, `-${dmg}`, '#ff5050', 12);
    this.events.push({ type: 'playerHit', damage: dmg });
    if (p.hp <= 0) {
      p.hp = 0;
      this.phase = 'dead';
      this.burst(p.x, p.y, '#ffffff', 20);
      this.events.push({ type: 'defeat' });
    }
  }

  damageEnemy(e: Enemy, base: number, element: ElementType, knock?: Vec): void {
    if (e.hp <= 0) return;
    const mult = typeMultiplier(element, e.def.types);
    const dmg = Math.max(1, Math.round(base * this.player.power * mult));
    e.hp -= dmg;
    e.hitFlash = 0.12;
    if (knock && !e.boss) {
      e.knock.x += knock.x;
      e.knock.y += knock.y;
    }
    const color = mult > 1 ? '#ffd040' : mult < 1 ? '#a0a0a0' : '#ffffff';
    this.text(e.x + this.rng.range(-6, 6), e.y - e.r - 4, String(dmg), color, mult > 1 ? 12 : 10);
  }

  private removeDead(): void {
    if (!this.enemies.some((e) => e.hp <= 0)) return;
    const alive: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.hp > 0) {
        alive.push(e);
        continue;
      }
      this.kills++;
      this.runGold += e.def.gold;
      const xp = e.def.xp * (1 + BALANCE.experience.xpPerRoom * (this.room - 1));
      const pieces = e.boss ? 8 : 1;
      for (let i = 0; i < pieces; i++) {
        this.gems.push({ x: e.x + this.rng.range(-12, 12) * (pieces > 1 ? 2 : 0), y: e.y + this.rng.range(-12, 12) * (pieces > 1 ? 2 : 0), value: xp / pieces, pulled: false });
      }
      this.burst(e.x, e.y, e.def.sprite.main, e.boss ? 30 : 10);
      if (e.boss && e === this.boss) {
        this.boss = null;
        this.runGold += BALANCE.rewards.goldBossBonus[e.boss.role];
        this.shake = 0.4;
        this.events.push({ type: 'bossDefeated', room: this.room, role: e.boss.role });
        // Al caer el jefe desaparecen sus invocaciones y ataques.
        for (const o of this.enemies) if (o !== e && o.hp > 0) {
          o.hp = 0;
          this.burst(o.x, o.y, o.def.sprite.main, 6);
        }
        this.projectiles = this.projectiles.filter((pr) => pr.owner === 'player');
        this.zones = this.zones.filter((z) => z.owner === 'player');
        this.markers = [];
      }
    }
    this.enemies = alive.filter((e) => e.hp > 0);
  }

  // --------------------------------------------------------------------------
  // Experiencia, nivel y evolución
  // --------------------------------------------------------------------------

  addXp(amount: number): void {
    const p = this.player;
    if (p.level >= BALANCE.experience.maxLevel) return;
    p.xp += amount * this.xpMult;
    while (p.level < BALANCE.experience.maxLevel && p.xp >= xpToNext(p.level)) {
      p.xp -= xpToNext(p.level);
      p.level++;
      this.pendingLevelUps++;
      this.events.push({ type: 'levelUp', level: p.level });
      this.text(p.x, p.y - 24, '¡NIVEL!', '#7af0ff', 12);
      this.checkEvolution();
    }
    if (p.level >= BALANCE.experience.maxLevel) p.xp = 0;
  }

  private checkEvolution(): void {
    const p = this.player;
    const evo = p.species.evolution;
    if (!evo || p.level < evo.level) return;
    const from = p.species;
    const ratio = p.hp / p.maxHp;
    p.species = getSpecies(evo.to);
    this.recomputeStats();
    p.hp = Math.min(p.maxHp, p.maxHp * ratio + p.maxHp * 0.25);
    this.burst(p.x, p.y, '#ffffff', 30);
    this.rings.push({ x: p.x, y: p.y, r: 10, maxR: 80, life: 0.6, color: '#ffffff' });
    this.events.push({ type: 'evolved', from: from.name, to: p.species.name });
  }

  private makeChoices(): UpgradeChoice[] {
    const p = this.player;
    const attacks: Record<string, number> = {};
    for (const a of p.attacks) attacks[a.def.id] = a.level;
    return generateChoices({ species: p.species, attacks, statStacks: p.statStacks }, this.rng);
  }

  /** Aplica la carta elegida. Devuelve false si la elección no es válida. */
  chooseUpgrade(index: number): boolean {
    if (this.phase !== 'levelup') return false;
    const choice = this.choices[index];
    if (!choice) return false;
    const p = this.player;
    const act = choice.action;
    switch (act.type) {
      case 'newAttack':
        this.addAttack(act.attackId);
        break;
      case 'attackUpgrade': {
        const a = p.attacks.find((x) => x.def.id === act.attackId);
        if (a) a.level = act.toLevel;
        break;
      }
      case 'stat': {
        p.statStacks[act.stat] = (p.statStacks[act.stat] ?? 0) + 1;
        this.recomputeStats();
        break;
      }
      case 'heal':
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * act.amount);
        break;
      case 'gold':
        this.bonusGold += act.amount;
        break;
    }
    this.pendingLevelUps--;
    this.choices = [];
    if (this.pendingLevelUps > 0) {
      this.choices = this.makeChoices();
    } else {
      this.phase = 'playing';
      p.invuln = Math.max(p.invuln, 0.5);
    }
    return true;
  }

  addAttack(id: string): void {
    if (this.player.attacks.some((a) => a.def.id === id)) return;
    this.player.attacks.push({ def: getAttack(id), level: 1, timer: 0.3, angle: 0 });
  }

  recomputeStats(): void {
    const p = this.player;
    const b = p.species.stats;
    const perm = this.permanent;
    const st = (id: keyof typeof RUN_STAT_UPGRADES) => (p.statStacks[id] ?? 0) * RUN_STAT_UPGRADES[id].amount;
    const oldMax = p.maxHp;
    p.maxHp = Math.round(b.hp * (1 + perm.hp) * (1 + st('hp')));
    p.power = b.power * (1 + perm.power) * (1 + st('power'));
    p.speed = b.speed * (1 + perm.speed) * (1 + st('speed'));
    p.defense = Math.min(BALANCE.player.maxDefense, b.defense + perm.defense + st('defense'));
    p.haste = st('haste');
    p.magnet = BALANCE.player.magnet * (1 + st('magnet'));
    p.regen = st('regen');
    if (oldMax > 1 && p.maxHp > oldMax) p.hp += p.maxHp - oldMax;
    p.hp = Math.min(p.hp, p.maxHp);
  }

  // --------------------------------------------------------------------------
  // Efectos
  // --------------------------------------------------------------------------

  text(x: number, y: number, text: string, color: string, size = 10): void {
    this.texts.push({ x, y, text, color, life: 0.7, size });
  }

  burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(30, 130);
      const life = this.rng.range(0.25, 0.6);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, maxLife: life, color, size: this.rng.range(2, 4) });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  /** Dispara proyectiles enemigos en abanico hacia un ángulo. */
  enemyShot(from: Vec, angle: number, count: number, spread: number, speed: number, radius: number, damage: number, color: string, element: ElementType): void {
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * spread;
      this.projectiles.push({
        id: this.newId(), x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        r: radius, damage, owner: 'enemy', element, pierce: 0, life: 5, color, hit: new Set(),
      });
    }
  }

  // --------------------------------------------------------------------------
  // Utilidades de depuración (tests automáticos)
  // --------------------------------------------------------------------------

  debugKillAll(): void {
    this.markers = [];
    this.pendingWaves = [];
    for (const e of this.enemies) e.hp = 0;
    this.removeDead();
  }
}
