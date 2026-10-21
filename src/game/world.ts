import { BALANCE } from '../config/balance';
import { ABILITIES, BASE_MODS } from '../data/abilities';
import { bossDefFor, castForTier, enemyFor, type BossDef, type EnemyDef } from '../data/enemies';
import { ITEMS, ITEM_IDS, type ItemId } from '../data/items';
import { evolutionOf, getMove, maxLevelOf, moveStats, type BuffStat, type MoveCategory } from '../data/moves';
import { DEX, getSpecies } from '../data/pokemon';
import { RUN_STAT_UPGRADES, type RunStatId } from '../data/runUpgrades';
import { typeMultiplier } from '../data/typeChart';
import type { ElementType, GymDef } from '../data/types';
import { Animator, bodyHeight, bodyRadius, hovers, playerScale } from '../render/animator';
import { recomputeMods } from './abilities';
import { updateBoss } from './bossAI';
import { updateCombat, updateFields, updateProjectiles } from './combat';
import { updateEnemy } from './enemyAI';
import type {
  Beam, Corpse, Enemy, Field, FloatText, Hazard, OwnedMove, Particle, Pickup, Player, Projectile, Ring, Slash, Vec,
} from './entities';
import { clamp, dist } from './math';
import { xpToNext } from './progression';
import { Rng } from './rng';
import { planRoom, scalingFor, tierForRoom, type RoomPlan, type RoomScaling } from './rooms';
import { generateChoices, type UpgradeChoice } from './upgradeGenerator';

// Simulación de una partida (run). Contiene todo el estado TEMPORAL: nivel,
// movimientos, cartas elegidas, objeto equipado, sala actual. No toca el
// guardado permanente: la pantalla de partida lee los eventos y decide qué
// recompensas persistir.

export type WorldPhase = 'playing' | 'levelup' | 'item' | 'dead' | 'victory';

export type WorldEvent =
  | { type: 'roomStart'; room: number; index: number; total: number; kind: RoomPlan['kind'] }
  | { type: 'roomCleared'; room: number; kind: RoomPlan['kind'] }
  | { type: 'playerHit'; damage: number }
  | { type: 'levelUp'; level: number }
  | { type: 'evolved'; from: string; to: string }
  | { type: 'moveEvolved'; from: string; to: string }
  | { type: 'bossSpawn'; name: string; title: string }
  | { type: 'bossEnraged'; name: string }
  | { type: 'bossPhase'; name: string; phase: number }
  | { type: 'bossDefeated'; room: number; role: BossDef['role'] }
  | { type: 'ticket'; amount: number }
  | { type: 'item'; id: ItemId }
  | { type: 'sfx'; name: string; kind?: string; element?: string }
  | { type: 'synergy'; name: string; description: string }
  | { type: 'victory' }
  | { type: 'defeat' };

/** Mejoras permanentes que recibe la partida (meta/shop.ts). */
export interface PermanentPerks {
  hp: number;
  atkMul: number;
  spdMul: number;
  cdMul: number;
  dmgReduce: number;
  regen: number;
  magnetMul: number;
  xpMul: number;
  coinMul: number;
  crit: number;
}

export const NO_PERKS: PermanentPerks = {
  hp: 0, atkMul: 1, spdMul: 1, cdMul: 1, dmgReduce: 0, regen: 0, magnetMul: 1, xpMul: 1, coinMul: 1, crit: 0,
};

export interface WorldOptions {
  speciesId: string;
  gym: GymDef;
  rooms: number[];
  perks?: PermanentPerks;
  xpMult?: number;
  /** La sala N escala como la sala N*factor (modo prueba). */
  scalingFactor?: number;
  seed?: number;
}

/** Defensa base → multiplicador del daño recibido (PokéSurvivor: suave, 0,78..1,25). */
export function guard(def: number): number {
  return clamp(Math.pow(75 / Math.max(5, def || 75), 0.35), 0.78, 1.25);
}

export class World {
  readonly W = BALANCE.arena.width;
  readonly H = BALANCE.arena.height;
  readonly rng: Rng;
  readonly gym: GymDef;
  readonly rooms: number[];
  readonly xpMult: number;
  readonly scalingFactor: number;
  readonly perks: PermanentPerks;
  /** Elenco de enemigos de la partida, por tramo. */
  readonly cast: EnemyDef[][];

  time = 0;
  phase: WorldPhase = 'playing';
  player: Player;
  enemies: Enemy[] = [];
  corpses: Corpse[] = [];
  projectiles: Projectile[] = [];
  /** Ráfaga: disparos repetidos pendientes. */
  volleys: { t: number; move: OwnedMove }[] = [];
  fields: Field[] = [];
  hazards: Hazard[] = [];
  pickups: Pickup[] = [];
  markers: { x: number; y: number; t: number; def: EnemyDef; boss: boolean; summoned: boolean }[] = [];
  texts: FloatText[] = [];
  particles: Particle[] = [];
  rings: Ring[] = [];
  slashes: Slash[] = [];
  beams: Beam[] = [];
  events: WorldEvent[] = [];

  roomIndex = 0;
  plan!: RoomPlan;
  scaling!: RoomScaling;
  pendingWaves: EnemyDef[][] = [];
  roomCleared = false;
  exitOpen = false;
  readonly exit: Vec & { r: number };

  kills = 0;
  runGold = 0;
  bonusGold = 0;
  ticketsFound = 0;
  pendingLevelUps = 0;
  choices: UpgradeChoice[] = [];
  pendingItem: ItemId | null = null;
  boss: Enemy | null = null;
  target: Enemy | null = null;
  private victoryTimer = -1;
  private nextId = 1;
  shake = 0;

  constructor(opts: WorldOptions) {
    this.rng = new Rng(opts.seed ?? (Date.now() & 0xffffffff));
    this.gym = opts.gym;
    this.rooms = opts.rooms;
    this.xpMult = opts.xpMult ?? 1;
    this.scalingFactor = opts.scalingFactor ?? 1;
    this.perks = opts.perks ?? NO_PERKS;
    this.exit = { x: this.W / 2, y: 30, r: 26 };
    const pick = <T>(list: T[], n: number): T[] => {
      const copy = [...list];
      const out: T[] = [];
      while (out.length < n && copy.length) out.push(copy.splice(Math.floor(this.rng.next() * copy.length), 1)[0]);
      return out;
    };
    this.cast = [0, 1, 2, 3, 4].map((t) => castForTier(t, pick));

    const species = getSpecies(opts.speciesId);
    const perk = this.perks;
    const buff = () => ({ n: 0, t: 0, amount: 0, max: 0 });
    this.player = {
      x: this.W / 2, y: this.H - 70, r: 10, species, anim: new Animator(species.dex, playerScale(species.dex)),
      hp: 1, maxHp: species.stats.hp + perk.hp, baseSpeed: species.stats.speed,
      atkMul: perk.atkMul, spdMul: perk.spdMul, cdMul: perk.cdMul, dmgReduce: perk.dmgReduce,
      regenFlat: perk.regen, magnet: BALANCE.player.magnet * perk.magnetMul, xpMul: perk.xpMul,
      coinMul: perk.coinMul, crit: perk.crit,
      buffs: { patk: buff(), satk: buff(), spd: buff(), def: buff(), regen: buff() },
      invuln: 0, level: 1, xp: 0, moves: [], statsTaken: {}, item: null, focusCd: 0,
      aim: -Math.PI / 2, moveAngle: -Math.PI / 2, moving: false, hitFlash: 0, lastPatch: null,
      abilities: {}, mods: { ...BASE_MODS }, synergies: [], sturdyLeft: 0, guardAngle: 0,
    };
    this.player.hp = this.player.maxHp;
    this.updatePlayerBody();
    this.addMove(species.startingAttack);
    recomputeMods(this.player);
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

  private updatePlayerBody(): void {
    const p = this.player;
    const sc = playerScale(p.species.dex);
    p.anim = Object.assign(new Animator(p.species.dex, sc), { dir: p.anim?.dir ?? 4 });
    p.r = Math.min(BALANCE.player.maxRadius, bodyRadius(p.species.dex, sc));
  }

  // --------------------------------------------------------------------------
  // Salas
  // --------------------------------------------------------------------------

  startRoom(index: number): void {
    this.roomIndex = index;
    const room = this.room;
    const effective = Math.max(1, Math.round(room * this.scalingFactor));
    this.plan = planRoom(this.gym, room, this.cast[tierForRoom(effective)], this.rng);
    this.scaling = scalingFor(effective);
    this.enemies = [];
    this.corpses = [];
    this.projectiles = [];
    this.volleys = [];
    this.fields = [];
    this.hazards = [];
    this.pickups = [];
    this.markers = [];
    this.rings = [];
    this.boss = null;
    this.target = null;
    this.roomCleared = false;
    this.exitOpen = false;
    const p = this.player;
    p.x = this.W / 2;
    p.y = this.H - 70;
    p.invuln = 1;
    p.lastPatch = null;
    p.sturdyLeft = p.mods.sturdy;
    this.pendingWaves = this.plan.waves.map((w) => [...w]);
    if (this.plan.bossId) {
      const def = bossDefFor(this.plan.bossId, tierForRoom(effective));
      this.markers.push({ x: this.W / 2, y: 170, t: BALANCE.rooms.spawnTelegraph * 1.6, def, boss: true, summoned: false });
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
    for (const def of now) this.queueSpawn(def);
  }

  /** Aviso en el suelo y, al terminar, aparece el enemigo. */
  queueSpawn(def: EnemyDef, near?: Vec, summoned = false): void {
    const m = BALANCE.arena.margin + 16;
    let x = 0;
    let y = 0;
    for (let i = 0; i < 30; i++) {
      if (near) {
        x = near.x + this.rng.range(-60, 60);
        y = near.y + this.rng.range(-45, 50);
      } else {
        x = this.rng.range(m, this.W - m);
        y = this.rng.range(m + 40, this.H * 0.72);
      }
      x = clamp(x, m, this.W - m);
      y = clamp(y, m, this.H - m);
      if (dist({ x, y }, this.player) >= (near ? 50 : BALANCE.rooms.minSpawnDistance)) break;
    }
    this.markers.push({ x, y, t: BALANCE.rooms.spawnTelegraph * (summoned ? 0.6 : 1), def, boss: false, summoned });
  }

  /** Definición de un Pokémon de la manada (invocaciones). */
  minionDef(dex: number): EnemyDef {
    const entry = DEX.find((d) => d.dex === dex) ?? DEX[0];
    return enemyFor(entry, tierForRoom(Math.max(1, Math.round(this.room * this.scalingFactor))), 'chase');
  }

  private spawnEnemy(mk: World['markers'][number]): void {
    const def = mk.def;
    const boss = 'role' in def ? (def as BossDef) : null;
    const s = this.scaling;
    const scale = boss ? Math.max(1, Math.min(2, Math.round((110 / bodyHeight(def.dex)) * 2) / 2)) : 1;
    const hp = def.hp * s.hpMult;
    const e: Enemy = {
      id: this.newId(), def, boss, behavior: def.behavior, types: def.types, cat: def.cat,
      anim: new Animator(def.dex, scale), scale,
      x: mk.x, y: mk.y, r: bodyRadius(def.dex, scale) * (boss ? 0.8 : 1), bodyH: bodyHeight(def.dex, scale),
      hp, maxHp: hp, damage: def.damage * s.damageMult, shotDmg: (def.shotDmg ?? def.damage) * s.damageMult,
      speed: def.speed * s.speedMult, flash: 0,
      slow: 0, slowT: 0, burn: 0, burnT: 0, burnTick: 0, poison: 0, poisonT: 0, poisonTick: 0, stunT: 0,
      shield: 0, shieldT: 0, kx: 0, ky: 0, touchCd: 0, hidden: false,
      phase: 'walk', pt: this.rng.range(0.3, 1.2), dx: 0, dy: 0,
      shotCd: def.shotCd ? this.rng.range(0.5, def.shotCd) : 0, skillCd: this.rng.range(1, 4),
      jump: null, side: this.rng.next() < 0.5 ? -1 : 1, ai: null, summoned: mk.summoned, orbitCd: {},
    };
    this.enemies.push(e);
    if (boss && mk.boss) {
      this.boss = e;
      this.events.push({ type: 'bossSpawn', name: boss.name, title: boss.title });
      this.events.push({ type: 'sfx', name: 'boss' });
    }
    this.burst(e.x, e.y - 6, '#ffffff', 6);
  }

  /** ¿Pasa por encima del terreno? (voladores que flotan y jefes) */
  flies(e: Enemy): boolean {
    return !!e.boss || hovers(e.def.dex);
  }

  private checkRoomProgress(): void {
    if (this.roomCleared || this.markers.length) return;
    if (this.plan.kind === 'normal') {
      if (this.pendingWaves.length && this.enemies.length <= 1) this.spawnNextWave();
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
    for (const g of this.pickups) g.pulled = true;
    this.projectiles = this.projectiles.filter((pr) => pr.friendly);
    this.hazards = [];
    this.events.push({ type: 'roomCleared', room: this.room, kind });
    if (this.isLastRoom) this.victoryTimer = 1.6;
    else this.exitOpen = true;
  }

  // --------------------------------------------------------------------------
  // Bucle
  // --------------------------------------------------------------------------

  update(dt: number, move: Vec): void {
    if (this.phase !== 'playing') return;
    this.time += dt;
    this.updatePlayer(dt, move);

    for (const mk of this.markers) mk.t -= dt;
    const ready = this.markers.filter((mk) => mk.t <= 0);
    if (ready.length) {
      this.markers = this.markers.filter((mk) => mk.t > 0);
      for (const mk of ready) this.spawnEnemy(mk);
    }

    this.pickTarget();
    updateCombat(this, dt);
    for (const e of this.enemies) {
      if (e.boss) updateBoss(this, e, dt);
      else updateEnemy(this, e, dt);
    }
    this.separateEnemies();
    updateProjectiles(this, dt);
    updateFields(this, dt);
    this.updateHazards(dt);
    this.removeDead();
    this.updatePickups(dt);
    this.updateEffects(dt);

    if (this.phase !== 'playing') return;
    this.checkRoomProgress();

    const p = this.player;
    if (this.exitOpen && dist(p, this.exit) < this.exit.r + p.r && this.pickups.length === 0) {
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
    if (this.pendingItem) {
      this.phase = 'item';
      return;
    }
    if (this.pendingLevelUps > 0) {
      this.phase = 'levelup';
      this.choices = this.makeChoices();
    }
  }

  private updatePlayer(dt: number, move: Vec): void {
    const p = this.player;
    p.anim.update(dt);
    const len = Math.hypot(move.x, move.y);
    const mag = Math.min(1, len);
    p.moving = mag > 0.05;
    if (p.moving) {
      const speed = this.playerSpeed();
      p.x += (move.x / len) * mag * speed * dt;
      p.y += (move.y / len) * mag * speed * dt;
      p.moveAngle = Math.atan2(move.y, move.x);
    }
    const m = BALANCE.arena.margin;
    p.x = clamp(p.x, m + p.r, this.W - m - p.r);
    p.y = clamp(p.y, m + p.r, this.H - m - p.r);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.focusCd = Math.max(0, p.focusCd - dt);
    p.guardAngle += dt * 3.2;
    // Potenciadores: caducan si no se renuevan.
    for (const b of Object.values(p.buffs)) {
      if (b.n > 0 && (b.t -= dt) <= 0) b.n = 0;
    }
    const regen = p.regenFlat + p.mods.regen + p.buffs.regen.n * p.buffs.regen.amount + (p.item === 'leftovers' ? p.maxHp * 0.015 : 0);
    if (regen > 0) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
    // Mira a su blanco si ataca; si no, hacia donde camina.
    if (this.target) p.aim = Math.atan2(this.target.y - p.y, this.target.x - p.x);
    else if (p.moving) p.aim = p.moveAngle;
    const face = this.target && !p.moving ? p.aim : p.moving ? p.moveAngle : p.aim;
    p.anim.dir = dirFromAngleSafe(face);
    p.anim.loop(p.moving ? 'Walk' : 'Idle', p.moving ? Math.max(0.8, this.playerSpeed() / 100) : 1);
  }

  playerSpeed(): number {
    const p = this.player;
    const item = p.item ? ITEMS[p.item].mods?.spd ?? 1 : 1;
    return p.baseSpeed * BALANCE.ps.playerSpeed * p.spdMul * item * (1 + p.buffs.spd.n * p.buffs.spd.amount);
  }

  /** Blanco del jugador: el jefe si está a tiro; si no, el enemigo más cercano. */
  private pickTarget(): void {
    const p = this.player;
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.enemies) {
      if (e.hidden) continue;
      const d = dist(e, p);
      if (d < bd) { bd = d; best = e; }
    }
    if (this.boss && this.boss.hp > 0 && !this.boss.hidden && dist(this.boss, p) < 300 && bd > 60) best = this.boss;
    this.target = best;
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
        const overlap = (a.r + b.r) * 0.85 - d;
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

  // --------------------------------------------------------------------------
  // Ataques enemigos con aviso (zonas y franjas)
  // --------------------------------------------------------------------------

  addHazard(h: Omit<Hazard, 't' | 'r' | 'angle' | 'len' | 'w'> & Partial<Pick<Hazard, 'r' | 'angle' | 'len' | 'w'>>): void {
    // Previsión: el aviso dura más (más tiempo para apartarse).
    this.hazards.push({ r: 0, angle: 0, len: 0, w: 0, t: 0, ...h, delay: h.delay * (1 + this.player.mods.foresight) });
  }

  private updateHazards(dt: number): void {
    const p = this.player;
    for (const h of this.hazards) {
      h.t += dt;
      if (h.t < h.delay) continue;
      let hit = false;
      if (h.kind === 'zone') hit = dist(h, p) < h.r + p.r * 0.5;
      else {
        const ca = Math.cos(h.angle);
        const sa = Math.sin(h.angle);
        const px = p.x - h.x;
        const py = p.y - h.y;
        const along = px * ca + py * sa;
        hit = along > -p.r && along < h.len + p.r && Math.abs(-px * sa + py * ca) < h.w / 2 + p.r * 0.5;
      }
      // Levitación: las zonas del suelo no te afectan.
      if (hit && !(h.kind === 'zone' && p.mods.levitate)) this.hurtPlayer(h.dmg, h.element, h.cat);
      if (h.kind === 'zone') this.ring(h.x, h.y, h.r * 0.3, h.r, h.color, 0.3, 3);
      this.burst(h.x, h.y, h.color, 6);
      this.shake = Math.max(this.shake, 0.12);
    }
    this.hazards = this.hazards.filter((h) => h.t < h.delay);
  }

  // --------------------------------------------------------------------------
  // Daño
  // --------------------------------------------------------------------------

  /** Daño de un golpe al jugador (tabla de tipos, defensas, objeto y potenciadores). */
  hurtPlayer(amount: number, element: ElementType, cat: 'physical' | 'special', attacker?: Enemy): void {
    const p = this.player;
    if (p.invuln > 0 || this.phase !== 'playing' || this.roomCleared) return;
    const M = p.mods;
    // Efectos de contacto (Electricidad Estática, Punto Tóxico…) aunque esquives.
    if (attacker && attacker.hp > 0) {
      if (M.contactStun && this.rng.next() < M.contactStun) attacker.stunT = Math.max(attacker.stunT, attacker.boss ? 0.35 : 1);
      if (M.contactPoison) { attacker.poison = Math.min(8, attacker.poison + M.contactPoison); attacker.poisonT = 4; }
    }
    if (M.dodge > 0 && this.rng.next() < Math.min(0.6, M.dodge)) {
      p.invuln = 0.25;
      this.text(p.x, p.y - 30, '¡Esquivado!', '#9fd8ff', 9);
      return;
    }
    const reduce = Math.min(BALANCE.player.maxDefense, p.dmgReduce + p.buffs.def.n * p.buffs.def.amount + (p.item === 'assaultvest' ? 0.2 : 0));
    const k = typeMultiplier(element, p.species.types) * guard(cat === 'special' ? p.species.stats.sd : p.species.stats.df);
    let raw = amount * k * (1 - reduce) * M.dmgTaken * M.enemyDmg;
    if (M.fullHpShield && p.hp >= p.maxHp - 0.5) raw *= 1 - M.fullHpShield;
    let dmg = Math.max(1, Math.round(raw));
    if (p.item === 'focussash' && p.focusCd <= 0 && dmg >= p.hp && p.hp > 1) {
      dmg = Math.ceil(p.hp - 1);
      p.focusCd = 60;
      this.text(p.x, p.y - 30, '¡Banda Focus!', '#ffd23f', 10);
    } else if (p.sturdyLeft > 0 && dmg >= p.hp && p.hp > 1) {
      dmg = Math.ceil(p.hp - 1);
      p.sturdyLeft--;
      this.text(p.x, p.y - 30, '¡Robustez!', '#ffd23f', 10);
    }
    p.hp -= dmg;
    p.invuln = BALANCE.player.invulnerability;
    p.hitFlash = 0.2;
    if (!p.anim.busy()) p.anim.play('Hurt');
    this.shake = Math.max(this.shake, 0.18);
    this.text(p.x, p.y - 28, `-${dmg}`, '#ff5050', 12);
    this.events.push({ type: 'playerHit', damage: dmg });
    if (attacker && p.item === 'rockyhelmet') this.hitEnemy(attacker, amount * 0.6, 'rock', null, attacker.x - p.x, attacker.y - p.y, 60);
    if (p.hp <= 0) {
      p.hp = 0;
      this.phase = 'dead';
      p.anim.play('Faint', { hold: true });
      this.burst(p.x, p.y - 10, '#ffffff', 20);
      this.events.push({ type: 'defeat' });
    }
  }

  /** Multiplicador de ataque del jugador para una categoría (lado físico/especial). */
  atkFor(cat: MoveCategory): number {
    const p = this.player;
    const st = p.species.stats;
    const side = cat === 'special' ? st.sa : st.pa;
    const buff = cat === 'special' ? p.buffs.satk : p.buffs.patk;
    const item = p.item ? ITEMS[p.item].mods?.atk ?? 1 : 1;
    return side * p.atkMul * item * (1 + buff.n * buff.amount);
  }

  /** Golpe del jugador a un enemigo. */
  hitEnemy(
    e: Enemy, base: number, element: ElementType, cat: MoveCategory, dx = 0, dy = 0, knock = 0,
    fx: { burn?: number; poison?: number; slow?: number; drain?: number; move?: OwnedMove | null; hex?: number } = {},
  ): void {
    if (e.hp <= 0 || e.hidden) return;
    const p = this.player;
    const M = p.mods;
    const typeK = typeMultiplier(element, e.types);
    const def = cat === 'special' ? e.def.sd : cat === 'physical' ? e.def.df : 75;
    const critChance = p.crit + M.crit;
    const crit = critChance > 0 && this.rng.next() < critChance;
    let dmg = base * typeK * guard(def) * (crit ? BALANCE.player.critMult + M.critMult : 1) * M.dmg;
    // Mismo tipo que el Pokémon (STAB) y Mar Llamas/Torrente/Espesura/Enjambre con poca vida.
    if (cat && p.species.types.includes(element)) {
      dmg *= 1 + M.stab;
      if (M.pinch && p.hp < p.maxHp / 3) dmg *= 1 + M.pinch;
    }
    if (fx.hex && (e.burn > 0 || e.poison > 0 || e.slow > 0)) dmg *= fx.hex;
    dmg = Math.max(1, Math.round(dmg));
    // El escudo absorbe primero.
    let taken = dmg;
    if (e.shield > 0) {
      const a = Math.min(e.shield, taken);
      e.shield -= a;
      taken -= a;
    }
    e.hp -= taken;
    e.flash = 0.09;
    if (!e.anim.busy() && e.phase !== 'dash' && !e.jump) e.anim.play('Hurt');
    if (knock > 0 && !e.boss) {
      const l = Math.hypot(dx, dy) || 1;
      e.kx += (dx / l) * knock * BALANCE.ps.space;
      e.ky += (dy / l) * knock * BALANCE.ps.space;
    }
    // Estados del movimiento + los de las habilidades (Cuerpo Llama, Punto Tóxico…).
    const burn = (fx.burn ?? 0) + (cat ? M.burnOnHit : 0);
    const poison = (fx.poison ?? 0) + (cat ? M.poisonOnHit : 0);
    const slow = Math.max(fx.slow ?? 0, cat ? M.slowOnHit : 0);
    if (burn) { e.burn = Math.min(8, e.burn + burn); e.burnT = 3; }
    if (poison) { e.poison = Math.min(8, e.poison + poison); e.poisonT = 4; }
    if (slow) { e.slow = Math.max(e.slow, slow); e.slowT = Math.max(e.slowT, 1.2); }
    if (cat && M.stunChance && e.hp > 0 && this.rng.next() < M.stunChance) e.stunT = Math.max(e.stunT, e.boss ? 0.3 : 0.8);
    // Golpe Certero: KO directo a un enemigo normal con poca vida.
    if (cat && M.execute && !e.boss && e.hp > 0 && e.hp < e.maxHp * M.executeAt && this.rng.next() < M.execute) {
      e.hp = 0;
      this.text(e.x, e.y - e.bodyH - 14, '¡KO!', '#ff6040', 11);
    }
    if (fx.drain) p.hp = Math.min(p.maxHp, p.hp + Math.min(4, dmg * 0.05));
    if (p.item === 'shellbell') p.hp = Math.min(p.maxHp, p.hp + dmg * 0.04);
    if (p.item === 'lifeorb') p.hp = Math.max(1, p.hp - 0.15);
    if (fx.move) fx.move.dealt += dmg;
    const color = crit ? '#ff9a3c' : typeK > 1.05 ? '#ffe14d' : typeK < 0.95 ? '#a3abb8' : '#ffffff';
    this.text(e.x + this.rng.range(-6, 6), e.y - e.bodyH - 4, taken < dmg && taken === 0 ? '0' : String(dmg), taken === 0 ? '#9fd8ff' : color, crit || typeK > 1.05 || e.boss ? 12 : 10);
    this.events.push({ type: 'sfx', name: 'hit' });
  }

  /** Daño de estado o de objeto que no pasa por tipos ni defensas. */
  hurtEnemyRaw(e: Enemy, dmg: number, color: string): void {
    if (e.hp <= 0 || e.hidden) return;
    e.hp -= dmg;
    e.flash = 0.05;
    this.text(e.x, e.y - e.bodyH - 4, String(Math.max(1, Math.round(dmg))), color, 9);
  }

  removeDead(): void {
    if (!this.enemies.some((e) => e.hp <= 0)) return;
    const alive: Enemy[] = [];
    const M = this.player.mods;
    const blasts: { x: number; y: number; dmg: number }[] = [];
    for (const e of this.enemies) {
      if (e.hp > 0) {
        alive.push(e);
        continue;
      }
      this.kills++;
      // Absorción y Detonación.
      if (M.killHeal) this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * M.killHeal);
      if (M.killExplode && !e.summoned) blasts.push({ x: e.x, y: e.y, dmg: e.maxHp * M.killExplode });
      this.runGold += e.def.gold;
      e.anim.play('Faint', { hold: true });
      this.corpses.push({ x: e.x, y: e.y, anim: e.anim, fade: 0.9, boss: !!e.boss });
      this.burst(e.x, e.y - e.bodyH * 0.5, e.boss ? '#ffd95e' : '#ffffff', e.boss ? 34 : 9);
      this.ring(e.x, e.y, e.r, e.r * (e.boss ? 6 : 2.6), e.boss ? '#ffd95e' : '#ffffff', e.boss ? 0.6 : 0.3, e.boss ? 6 : 3);
      this.events.push({ type: 'sfx', name: e.boss ? 'bossDown' : 'faint' });
      if (!e.summoned || e.boss) this.dropLoot(e);
      if (e.boss && e === this.boss) {
        this.boss = null;
        this.runGold += BALANCE.rewards.goldBossBonus[e.boss.role];
        this.shake = 0.5;
        this.events.push({ type: 'bossDefeated', room: this.room, role: e.boss.role });
        for (const o of this.enemies) if (o !== e && o.hp > 0) {
          o.hp = 0;
          this.corpses.push({ x: o.x, y: o.y, anim: o.anim, fade: 0.6, boss: false });
        }
        this.projectiles = this.projectiles.filter((pr) => pr.friendly);
        this.hazards = [];
        this.markers = [];
      }
    }
    this.enemies = alive.filter((e) => e.hp > 0);
    if (this.target && this.target.hp <= 0) this.target = null;
    // Las explosiones dañan a los demás; los que caigan se procesan en el siguiente fotograma.
    const r = M.killExplodeRadius;
    for (const b of blasts) {
      this.ring(b.x, b.y, 6, r, '#ff9a3c', 0.35, 4);
      this.burst(b.x, b.y - 6, '#ffb03d', 10);
      for (const o of this.enemies) {
        if (Math.hypot(o.x - b.x, o.y - b.y) > r + o.r) continue;
        this.hurtEnemyRaw(o, b.dmg, '#ffb03d');
        if (M.killExplodePoison) { o.poison = Math.min(8, o.poison + M.killExplodePoison); o.poisonT = 4; }
      }
    }
  }

  private dropLoot(e: Enemy): void {
    const xp = e.def.xp * (1 + BALANCE.experience.xpPerRoom * (this.room - 1));
    const pieces = e.boss ? 8 : 1;
    for (let i = 0; i < pieces; i++) {
      const spread = pieces > 1 ? 24 : 0;
      this.pickups.push({ kind: xp / pieces >= 20 ? 'xpBig' : 'xp', x: e.x + this.rng.range(-spread, spread), y: e.y + this.rng.range(-spread, spread), value: xp / pieces, pulled: false, t: 0 });
    }
    if (e.boss) {
      for (let i = 0; i < 6; i++) this.pickups.push({ kind: 'coin', x: e.x + this.rng.range(-36, 36), y: e.y + this.rng.range(-26, 26), value: 5, pulled: false, t: 0 });
      this.pickups.push({ kind: 'item', x: e.x, y: e.y - 14, value: 0, item: this.rollItem(), pulled: false, t: 0 });
    } else {
      if (this.rng.next() < BALANCE.enemies.berryDrop) this.pickups.push({ kind: 'heal', x: e.x + 6, y: e.y, value: 0.25, pulled: false, t: 0 });
      if (this.rng.next() < BALANCE.enemies.ticketDrop) this.pickups.push({ kind: 'ticket', x: e.x - 6, y: e.y, value: 1, pulled: false, t: 0 });
    }
  }

  private rollItem(): ItemId {
    const pool = ITEM_IDS.filter((i) => i !== this.player.item);
    return pool[Math.floor(this.rng.next() * pool.length)];
  }

  // --------------------------------------------------------------------------
  // Recogibles, experiencia, nivel y evolución
  // --------------------------------------------------------------------------

  private updatePickups(dt: number): void {
    const p = this.player;
    const keep: Pickup[] = [];
    for (const g of this.pickups) {
      g.t += dt;
      const d = dist(g, p);
      if (d < p.magnet && g.kind !== 'item') g.pulled = true;
      if (g.pulled) {
        const sp = (this.roomCleared ? 520 : 300) * dt;
        g.x += ((p.x - g.x) / (d || 1)) * Math.min(sp, d);
        g.y += ((p.y - g.y) / (d || 1)) * Math.min(sp, d);
      }
      if (dist(g, p) < p.r + 6) this.collect(g);
      else keep.push(g);
    }
    this.pickups = keep;
  }

  private collect(g: Pickup): void {
    const p = this.player;
    switch (g.kind) {
      case 'xp':
      case 'xpBig':
        this.addXp(g.value);
        this.events.push({ type: 'sfx', name: 'xp' });
        break;
      case 'coin':
        this.runGold += g.value;
        this.events.push({ type: 'sfx', name: 'coin' });
        break;
      case 'heal':
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * g.value);
        this.text(p.x, p.y - 30, '+vida', '#5fe08a', 10);
        break;
      case 'ticket':
        this.ticketsFound += g.value;
        this.events.push({ type: 'ticket', amount: g.value });
        break;
      case 'item':
        if (!p.item) this.equipItem(g.item!);
        else this.pendingItem = g.item!;
        break;
    }
  }

  equipItem(id: ItemId): void {
    const p = this.player;
    p.item = id;
    this.events.push({ type: 'item', id });
    this.text(p.x, p.y - 30, ITEMS[id].name, '#ffd23f', 10);
  }

  /** Respuesta a encontrar un objeto llevando otro: quedarse el nuevo o el que se lleva. */
  chooseItem(takeNew: boolean): void {
    if (this.phase !== 'item' || !this.pendingItem) return;
    if (takeNew) this.equipItem(this.pendingItem);
    this.pendingItem = null;
    this.phase = 'playing';
    this.player.invuln = Math.max(this.player.invuln, 0.5);
  }

  addXp(amount: number): void {
    const p = this.player;
    if (p.level >= BALANCE.experience.maxLevel) return;
    const item = p.item ? ITEMS[p.item].mods?.xp ?? 1 : 1;
    p.xp += amount * this.xpMult * p.xpMul * item;
    while (p.level < BALANCE.experience.maxLevel && p.xp >= xpToNext(p.level)) {
      p.xp -= xpToNext(p.level);
      p.level++;
      this.pendingLevelUps++;
      this.events.push({ type: 'levelUp', level: p.level });
      this.events.push({ type: 'sfx', name: 'level' });
      this.text(p.x, p.y - 36, '¡NIVEL!', '#7af0ff', 12);
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
    const hpBonus = p.species.stats.hp - from.stats.hp;
    p.maxHp += hpBonus;
    p.baseSpeed = p.species.stats.speed;
    p.hp = Math.min(p.maxHp, p.maxHp * ratio + p.maxHp * 0.25);
    this.updatePlayerBody();
    this.refreshMods();
    this.burst(p.x, p.y - 12, '#ffffff', 30);
    this.ring(p.x, p.y, 10, 80, '#ffffff', 0.6, 4);
    this.events.push({ type: 'evolved', from: from.name, to: p.species.name });
    this.events.push({ type: 'sfx', name: 'legend' });
  }

  private makeChoices(): UpgradeChoice[] {
    return generateChoices(this.player, this.rng);
  }

  /** Aplica la carta elegida. Devuelve false si la elección no es válida. */
  chooseUpgrade(index: number): boolean {
    if (this.phase !== 'levelup') return false;
    const choice = this.choices[index];
    if (!choice) return false;
    const p = this.player;
    const act = choice.action;
    switch (act.type) {
      case 'newMove':
        this.addMove(act.moveId);
        break;
      case 'moveUpgrade': {
        const m = p.moves.find((x) => x.def.id === act.moveId);
        if (m && m.level < maxLevelOf(m.def)) {
          m.level++;
          m.s = moveStats(m.def, m.level, m.evolved);
        }
        break;
      }
      case 'moveEvolution': {
        const m = p.moves.find((x) => x.def.id === act.moveId);
        const evo = evolutionOf(act.moveId);
        if (m && evo && !m.evolved) {
          const old = m.name;
          m.evolved = true;
          m.name = evo.name;
          m.s = moveStats(m.def, m.level, true);
          this.ring(p.x, p.y, 8, 120, '#ffd23f', 0.8, 6);
          this.burst(p.x, p.y - 12, '#ffe14d', 40);
          this.events.push({ type: 'moveEvolved', from: old, to: m.name });
          this.events.push({ type: 'sfx', name: 'legend' });
        }
        break;
      }
      case 'stat':
        this.applyStat(act.stat);
        p.statsTaken[act.stat] = (p.statsTaken[act.stat] ?? 0) + 1;
        break;
      case 'heal':
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * act.amount);
        break;
      case 'gold':
        this.bonusGold += act.amount;
        break;
      case 'ability': {
        const a = ABILITIES[act.abilityId];
        if (a && (p.abilities[a.id] ?? 0) < a.maxStacks) {
          p.abilities[a.id] = (p.abilities[a.id] ?? 0) + 1;
          if (a.id === 'robustez') p.sturdyLeft++;
        }
        break;
      }
    }
    this.refreshMods();
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

  private applyStat(id: RunStatId): void {
    const p = this.player;
    switch (id) {
      case 'hp': p.maxHp += 20; p.hp += 20; break;
      case 'atk': p.atkMul *= 1.1; break;
      case 'spd': p.spdMul *= 1.07; break;
      case 'cd': p.cdMul *= 0.92; break;
      case 'def': p.dmgReduce = Math.min(BALANCE.player.maxDefense, p.dmgReduce + 0.06); break;
      case 'rgn': p.regenFlat += 0.9; break;
      case 'mag': p.magnet *= 1.3; break;
      case 'xp': p.xpMul *= 1.12; break;
      case 'heal': p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.45); break;
    }
    void RUN_STAT_UPGRADES;
  }

  addMove(id: string): void {
    const p = this.player;
    if (p.moves.some((m) => m.def.id === id)) return;
    const def = getMove(id);
    p.moves.push({ def, level: 1, evolved: false, name: def.name, t: 0.3, angle: 0, s: moveStats(def, 1), dealt: 0 });
    if (p.mods) this.refreshMods();
  }

  /** Recalcula habilidades/sinergias y avisa de las sinergias nuevas. */
  refreshMods(): void {
    for (const syn of recomputeMods(this.player)) {
      this.events.push({ type: 'synergy', name: syn.name, description: syn.description });
      this.events.push({ type: 'sfx', name: 'legend' });
      this.ring(this.player.x, this.player.y, 8, 90, '#c58bff', 0.7, 5);
    }
  }

  addBuff(stat: BuffStat, amount: number, dur: number, max: number): void {
    const b = this.player.buffs[stat];
    b.amount = amount;
    b.max = max;
    b.n = Math.min(max, b.n + 1);
    b.t = dur;
  }

  // --------------------------------------------------------------------------
  // Efectos
  // --------------------------------------------------------------------------

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
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const s of this.slashes) s.life -= dt;
    this.slashes = this.slashes.filter((s) => s.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const c of this.corpses) {
      c.anim.update(dt);
      c.fade -= dt;
    }
    this.corpses = this.corpses.filter((c) => c.fade > 0);
    this.shake = Math.max(0, this.shake - dt);
  }

  text(x: number, y: number, text: string, color: string, size = 10): void {
    this.texts.push({ x, y, text, color, life: 0.7, size });
    if (this.texts.length > 60) this.texts.shift();
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

  ring(x: number, y: number, r: number, maxR: number, color: string, life = 0.3, width = 3): void {
    this.rings.push({ x, y, r, maxR, life, maxLife: life, color, width });
  }

  /** Disparo enemigo (uno o varios en abanico). */
  enemyShot(e: Enemy, angle: number, count: number, spread: number, k = 1): void {
    const sp = 190 * BALANCE.ps.projectileSpeed;
    for (let i = 0; i < count; i++) {
      const a = angle + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread);
      this.projectiles.push({
        id: this.newId(), x: e.x, y: e.y - e.bodyH * 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 5, dmg: e.shotDmg * k, friendly: false, element: e.types[0], cat: e.cat, pierce: 0, life: 2.8, t: 0,
        color: '#ff7a9e', hits: new Set(), homing: 0, boom: 0, back: false, bounce: 0,
        burn: 0, poison: 0, slow: 0, knock: 0, drain: 0, move: null, wallBounce: 0, shape: 'orb',
      });
    }
    if (!e.anim.busy()) e.anim.play('Shoot');
    this.ring(e.x, e.y - e.bodyH * 0.4, 4, 14, '#ff7a9e', 0.2, 2);
  }

  // --------------------------------------------------------------------------
  // Depuración (tests automáticos)
  // --------------------------------------------------------------------------

  debugKillAll(): void {
    this.markers = [];
    this.pendingWaves = [];
    for (const e of this.enemies) e.hp = 0;
    this.removeDead();
  }
}

function dirFromAngleSafe(a: number): number {
  return ((Math.round((Math.PI / 2 - a) / (Math.PI / 4)) % 8) + 8) % 8;
}
