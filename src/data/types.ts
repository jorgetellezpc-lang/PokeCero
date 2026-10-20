// Tipos compartidos de datos del juego. Todo el contenido (Pokémon, enemigos,
// ataques, gimnasios) se define como datos que cumplen estas interfaces, para
// no duplicar lógica por especie.

export type ElementType =
  | 'normal' | 'fire' | 'water' | 'grass' | 'electric' | 'rock' | 'ground'
  | 'poison' | 'flying' | 'bug' | 'psychic' | 'fighting';

export type BodyShape =
  | 'biped' | 'quad' | 'mouse' | 'bird' | 'serpent' | 'blob' | 'rock' | 'bug' | 'bat' | 'turtle';

/**
 * Sprite de una especie. Si `image` está definido se usa ese archivo (arte
 * definitivo, ruta relativa a /public). Si no, se genera un placeholder pixel
 * art PROVISIONAL a partir de la forma y los colores.
 */
export interface SpriteSpec {
  shape: BodyShape;
  main: string;
  belly: string;
  accent: string;
  image?: string;
}

export interface PokemonBaseStats {
  /** Vida máxima base. */
  hp: number;
  /** Multiplicador de daño de todos los ataques (1 = neutro). */
  power: number;
  /** Reducción de daño recibido (0..1). */
  defense: number;
  /** Velocidad de movimiento en unidades de mundo por segundo. */
  speed: number;
}

export interface PokemonSpecies {
  id: string;
  name: string;
  types: ElementType[];
  /** Identificador de la línea evolutiva (para gachapón y selector). */
  line: string;
  stats: PokemonBaseStats;
  /** Ataque con el que empieza la partida. PROVISIONAL. */
  startingAttack: string;
  /** Ataques que puede aprender durante la partida (compatibilidad de mejoras). */
  learnset: string[];
  /** Evolución por nivel. Solo si la especie evoluciona dentro de una partida. */
  evolution?: { to: string; level: number };
  sprite: SpriteSpec;
  /** Forma base obtenible fuera de partida (selector / gachapón). */
  obtainable: boolean;
  rarity: 'common' | 'rare';
}

export type AttackKind = 'projectile' | 'orbit' | 'nova' | 'zone';

export interface AttackStats {
  damage: number;
  /** Segundos entre usos (no aplica a 'orbit'). */
  cooldown: number;
  /** Proyectiles / orbes / impactos por uso. */
  count: number;
  /** Radio del efecto (orbe, onda, zona) o del proyectil. */
  area: number;
  /** Velocidad del proyectil o velocidad angular del orbe (rad/s). */
  speed: number;
  /** Enemigos adicionales que atraviesa un proyectil. */
  pierce: number;
  /** Duración de la zona (s). */
  duration: number;
  /** Alcance máximo para buscar objetivo. */
  range: number;
}

/** Mejora de un ataque al subir de nivel ese ataque (valores relativos). */
export interface AttackLevelMod {
  desc: string;
  damagePct?: number;
  cooldownPct?: number;
  count?: number;
  areaPct?: number;
  pierce?: number;
}

export interface AttackDef {
  id: string;
  name: string;
  type: ElementType;
  kind: AttackKind;
  description: string;
  base: AttackStats;
  /** Niveles 2..N del ataque. */
  levels: AttackLevelMod[];
  color: string;
}

export type EnemyArchetype = 'melee' | 'ranged';

export interface EnemyProjectileSpec {
  speed: number;
  radius: number;
  count: number;
  /** Separación angular entre proyectiles (rad). */
  spread: number;
  color: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  types: ElementType[];
  archetype: EnemyArchetype;
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  /** Distancia a la que empieza a atacar. */
  attackRange: number;
  /** Distancia que intenta mantener (solo a distancia). */
  preferredDistance?: number;
  attackCooldown: number;
  /** Tiempo de preparación visible antes de golpear o disparar. */
  windup: number;
  projectile?: EnemyProjectileSpec;
  xp: number;
  gold: number;
  /** Primera sala en la que puede aparecer. */
  minRoom: number;
  /** Peso relativo en la composición de oleadas. */
  weight: number;
  sprite: SpriteSpec;
}

export type BossPatternId = 'charge' | 'throw' | 'ring' | 'rockfall' | 'summon';

export interface BossDef extends EnemyDef {
  role: 'miniboss' | 'boss';
  patterns: BossPatternId[];
  /** Fracción de vida en la que entra en fase 2 (más agresivo). */
  phase2At?: number;
  contactDamage: number;
  /** Enemigo invocado por el patrón 'summon'. */
  summonId?: string;
  title: string;
}

export interface GymDef {
  id: string;
  order: number;
  city: string;
  leader: string;
  type: ElementType;
  badge: string;
  /** Si el gimnasio tiene contenido jugable. */
  playable: boolean;
  /** Enemigos de oleadas normales (ids). */
  enemyPool: string[];
  /** Jefes por sala: { 20: id, 40: id, 50: id }. PROVISIONAL. */
  bosses: Record<number, string>;
  /** Posición en el mapa de la región (0..1). */
  mapPos: { x: number; y: number };
  theme: { grass: string; grassDark: string; path: string; rock: string };
}

export interface RegionDef {
  id: string;
  name: string;
  gyms: GymDef[];
  /** Región que hay que completar para desbloquear esta. */
  requires?: string;
  playable: boolean;
}
