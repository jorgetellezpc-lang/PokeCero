// ============================================================================
// PARÁMETROS DE BALANCE — TODOS PROVISIONALES
// ----------------------------------------------------------------------------
// Este archivo centraliza los números que el blueprint deja pendientes
// (sección 21). Son valores de prototipo para que el juego sea jugable, NO
// decisiones de diseño definitivas. Ajusta aquí sin tocar la lógica.
// ============================================================================

export const BALANCE = {
  /** Tamaño lógico de la arena (unidades de mundo). La pantalla escala esto. */
  arena: { width: 360, height: 600, margin: 14 },

  player: {
    radius: 11,
    /** Invulnerabilidad tras recibir daño (s). */
    invulnerability: 0.6,
    /** Radio base de atracción de gemas de experiencia. */
    magnet: 46,
    /** Reducción de daño máxima total. */
    maxDefense: 0.6,
  },

  experience: {
    /** Nivel temporal máximo de una partida (blueprint: 36). Configurable. */
    maxLevel: 36,
    /** XP necesaria para pasar del nivel L al L+1: base + linear*L + L^power. PROVISIONAL. */
    base: 5,
    linear: 2,
    power: 1.35,
    /** La XP de cada enemigo crece con la sala: xp * (1 + xpPerRoom * (sala-1)). */
    xpPerRoom: 0.06,
  },

  rooms: {
    perGym: 50,
    minibossRooms: [20, 40],
    bossRoom: 50,
    /** Salas que se juegan en "modo prueba" (gimnasio corto). Usa números reales de sala. */
    testModeRooms: [1, 4, 8, 20, 24, 40, 44, 50],
    /** Multiplicador de XP en modo prueba para poder ver la evolución en una partida corta. */
    testModeXpMult: 2.5,
    /** En modo prueba la sala N escala como la sala N*factor (el jugador llega menos mejorado). */
    testModeScalingFactor: 0.5,
    /** Curación al completar una sala normal / de jefe (fracción de vida máxima). */
    healOnClear: 0.08,
    healOnBossClear: 0.3,
    /** Aviso visual antes de que aparezca un enemigo (s). */
    spawnTelegraph: 0.9,
    /** Distancia mínima al jugador para que aparezca un enemigo. */
    minSpawnDistance: 120,
    /** Máximo de enemigos vivos a la vez (para no saturar la pantalla móvil). */
    maxAlive: 10,
  },

  /**
   * Curva de dificultad PROVISIONAL. `d` va de 1 (sala 1) a 10 (sala 50).
   * Todos los escalados se derivan de aquí.
   */
  difficulty: {
    countBase: 3,
    countPerLevel: 1.0,
    hpPerRoom: 0.09,
    damagePerRoom: 0.03,
    speedPerRoom: 0.004,
    rangedShareBase: 0.15,
    rangedSharePerLevel: 0.035,
    rangedShareMax: 0.45,
    /** Sub-oleadas por sala según dificultad: d < 3 → 1, d < 7 → 2, resto → 3. */
    subWaveThresholds: [3, 7],
    /** Primera sala que garantiza al menos un enemigo a distancia. */
    guaranteedRangedFrom: 2,
    /** Escalado extra de vida de jefes respecto a enemigos normales de la misma sala. */
    bossHpPerRoom: 0.05,
  },

  upgrades: {
    /** Cartas por subida de nivel (blueprint: exactamente 3). */
    choices: 3,
    /** Máximo de ataques simultáneos. PENDIENTE de diseño. */
    maxAttacks: 4,
    /** Peso relativo de cada familia al generar cartas. PENDIENTE de diseño. */
    familyWeights: { newAttack: 3, attackUpgrade: 4, stat: 3 },
    /** Curación de la carta de reserva (solo si no hay suficientes opciones). */
    fallbackHeal: 0.35,
    fallbackGold: 25,
  },

  /** Tipos: multiplicadores simplificados (no la tabla oficial completa). */
  typeChart: { strong: 1.25, weak: 0.8 },

  rewards: {
    /** Tickets por hito del gimnasio. Se cobran UNA sola vez por hito. */
    ticketsByRoom: { 20: 5, 40: 5, 50: 10 } as Record<number, number>,
    goldPerRoomClear: 4,
    goldBossBonus: { miniboss: 40, boss: 120 },
    /** Tickets de bienvenida para poder probar el gachapón. */
    starterTickets: 10,
  },

  gacha: {
    cost: 10,
    rarityWeights: { common: 75, rare: 25 },
    /** Oro que se recibe si sale un Pokémon ya obtenido. */
    duplicateGold: 150,
  },
} as const;

/** Mejoras permanentes compradas con oro (sección Pokémon). PROVISIONAL: globales. */
export interface PermanentUpgradeDef {
  id: 'hp' | 'power' | 'defense' | 'speed';
  name: string;
  description: string;
  /** Bonificación por nivel (fracción). */
  perLevel: number;
  maxLevel: number;
  /** Coste del nivel n (0-indexado): base * (n+1)^growth. */
  costBase: number;
  costGrowth: number;
}

export const PERMANENT_UPGRADES: PermanentUpgradeDef[] = [
  { id: 'hp', name: 'Vitalidad', description: '+6% de vida máxima', perLevel: 0.06, maxLevel: 10, costBase: 60, costGrowth: 1.45 },
  { id: 'power', name: 'Fuerza', description: '+5% de daño de todos los ataques', perLevel: 0.05, maxLevel: 10, costBase: 70, costGrowth: 1.45 },
  { id: 'defense', name: 'Resistencia', description: '+2% de reducción de daño', perLevel: 0.02, maxLevel: 10, costBase: 60, costGrowth: 1.45 },
  { id: 'speed', name: 'Agilidad', description: '+3% de velocidad de movimiento', perLevel: 0.03, maxLevel: 10, costBase: 50, costGrowth: 1.45 },
];

export function permanentUpgradeCost(def: PermanentUpgradeDef, currentLevel: number): number {
  return Math.round(def.costBase * Math.pow(currentLevel + 1, def.costGrowth));
}
