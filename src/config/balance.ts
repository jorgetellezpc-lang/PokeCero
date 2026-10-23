// ============================================================================
// PARÁMETROS DE BALANCE — TODOS PROVISIONALES
// ----------------------------------------------------------------------------
// Este archivo centraliza los números que el blueprint deja pendientes
// (sección 21). Muchos vienen de PokéSurvivor y se han adaptado a la arena
// vertical por salas de Pokécero. NO son decisiones de diseño definitivas.
// ============================================================================

export const BALANCE = {
  /** Límites de rendimiento (móvil). PROVISIONAL. */
  perf: { maxProjectiles: 360 },
  /**
   * Adaptación de los números de PokéSurvivor (mundo abierto, horizontal) a la
   * arena vertical de Pokécero.
   */
  ps: {
    /** Unidades de mundo por píxel de arte de los sprites. */
    spritePx: 1.4,
    /** Escala de radios, alcances y tamaños de los movimientos. */
    space: 0.7,
    /** Escala de la velocidad de los proyectiles. */
    projectileSpeed: 0.8,
    /** Escala del daño de los movimientos (aquí todos los ataques actúan a la vez). */
    damage: 0.5,
    /** Escala de la velocidad de los enemigos. */
    enemySpeed: 0.8,
    /** Escala de la velocidad del jugador (velocidad de juego de la especie × esto). */
    playerSpeed: 1,
  },

  /** Tamaño lógico de la arena (unidades de mundo). La pantalla escala esto. */
  /**
   * Cámara 3D (estilo Archero). PROVISIONAL.
   * viewWidth: ancho de sala que se ve a la altura del jugador; elevation:
   * inclinación en grados (90 = cenital); lead: cuánto se adelanta hacia arriba.
   */
  camera: { viewWidth: 300, elevation: 52, fov: 46, lead: 60, follow: 6, arenaViewWidth: 215, arenaLook: 34 },
  /** Sala: más alta que la pantalla; la cámara sigue al jugador (estilo Archero). */
  arena: { width: 360, height: 840, margin: 14 },

  /** Aventura: en los pueblos anda el entrenador, 1,5 veces más rápido que su Pokémon. */
  adventure: { trainerSpeed: 1.5 },

  player: {
    /** Radio de colisión máximo (los Pokémon grandes chocan como uno normal). */
    maxRadius: 13,
    /** Invulnerabilidad tras recibir daño (s). */
    invulnerability: 0.6,
    /** Radio base de atracción de experiencia. */
    magnet: 55,
    /** Reducción de daño máxima total. */
    maxDefense: 0.7,
    /** Multiplicador de daño de un golpe crítico. */
    critMult: 1.5,
  },

  /**
   * Nivel permanente de cada Pokémon (game/levels.ts). Curva de experiencia
   * «media rápida» (n³). PROVISIONAL.
   */
  levels: {
    max: 100,
    /** Nivel con el que empieza el inicial. */
    start: 5,
    /** Crecimiento de vida, daño y regeneración por nivel (igual para ti y para los enemigos). */
    statPerLevel: 0.08,
    /** Experiencia por derrota = (8 + total de estadísticas/20) × nivel / 7 × esto. */
    xpYield: 0.8,
    minibossXp: 4,
    bossXp: 8,
    /** Nivel de los enemigos respecto al tuyo (se adaptan). */
    enemyOffset: { normal: -1, strong: 1, miniboss: 1, boss: 2, mega: 3 },
  },

  rooms: {
    perGym: 50,
    minibossRooms: [20, 40],
    bossRoom: 50,
    /** Salas que se juegan en "modo prueba" (gimnasio corto). Usa números reales de sala. */
    testModeRooms: [1, 4, 8, 20, 24, 40, 44, 50],
    /** Multiplicador de XP en modo prueba para poder ver la evolución en una partida corta. */
    testModeXpMult: 1,
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
    maxAlive: 12,
  },

  /**
   * Curva de dificultad. `d` va de 1 (sala 1) a 10 (sala 50). Los enemigos
   * cambian de tramo (más vida, daño y Pokémon más fuertes) cada
   * `enemies.roomsPerTier` salas; esto es la rampa dentro del tramo.
   */
  difficulty: {
    countBase: 4,
    countPerLevel: 1.1,
    hpPerRoom: 0.1,
    damagePerRoom: 0.03,
    speedPerRoom: 0.003,
    /** Sub-oleadas por sala según dificultad: d < 3 → 1, d < 7 → 2, resto → 3. */
    subWaveThresholds: [3, 7],
    /** Primera sala que garantiza al menos un enemigo que ataca a distancia. */
    guaranteedRangedFrom: 2,
  },

  /** Vida y daño de los jefes como múltiplo de los del tramo de la sala. */
  bosses: {
    miniboss: { hp: 20, damage: 1.5 },
    boss: { hp: 55, damage: 2.0 },
    /** Reto de captura 1v1 (meta/capture.ts): muy difícil. */
    mega: { hp: 40, damage: 2.4 },
  },

  /** Captura de los otros iniciales. PROVISIONAL. */
  capture: {
    /** Tickets por intento. */
    cost: 10,
    /** El tramo de fuerza del reto sube con tu nivel (1 tramo cada tantos niveles). */
    levelsPerTier: 12,
  },

  enemies: {
    /** Pokémon distintos por tramo en cada partida (el "elenco"). */
    castSize: 7,
    /** Salas por tramo de enemigos (tramo 0: salas 1-10, tramo 1: 11-20…). */
    roomsPerTier: 10,
    /** Probabilidad de que un enemigo suelte un ticket del gachapón. */
    ticketDrop: 1 / 200,
    /** Probabilidad de que un enemigo suelte una baya (cura). */
    berryDrop: 0.03,
    /** Probabilidad de que un enemigo salga shiny (los sprites shiny aún no están incluidos). */
    shinyRate: 0,
  },

  /** Ataque característico por tipos (src/data/signatures.ts). PROVISIONAL. */
  attack: {
    /**
     * Multiplicador de daño del ataque. Antes se sumaban hasta 4 movimientos a
     * la vez; ahora hay uno solo y concentra ese daño.
     */
    power: 1.8,
    /** Evolución del ataque: nivel mínimo, mejoras cogidas y la mejora clave de su comportamiento. */
    evoLevel: 22,
    evoUpgrades: 5,
    /** Daño de la explosión, de la zona (por tic de 0,5 s) y de cada fragmento, sobre el golpe. */
    explodeK: 0.5,
    zoneK: 0.3,
    zoneLife: 2.2,
    splitK: 0.45,
    /** Segundos de aturdimiento al electrocutar (a los jefes, ×0,35). */
    shockStun: 0.6,
    /** Topes de los efectos que se acumulan. */
    caps: { slow: 0.6, shock: 0.4, crit: 0.45, burn: 4, poison: 4, count: 7, pierce: 6, bounce: 6, split: 3, explode: 60 },
  },
  upgrades: {
    /** Cartas por subida de nivel (blueprint: exactamente 3). */
    choices: 3,
    /** Un único ataque por Pokémon: todas las cartas lo mejoran a él. */
    maxAttacks: 1,
    /** Pesos de cada tipo de carta. `attackKey`: la mejora que falta para evolucionar el ataque. */
    weights: { attack: 9, attackKey: 16, evolution: 40, stat: 4, statFull: 4, ability: 9 },
    /** Curación de la carta de reserva (solo si no hay suficientes opciones). */
    fallbackHeal: 0.35,
    fallbackGold: 25,
  },

  rewards: {
    /** Tickets por hito del gimnasio. Se cobran UNA sola vez por hito. */
    ticketsByRoom: { 20: 5, 40: 5, 50: 10 } as Record<number, number>,
    goldPerRoomClear: 4,
    goldBossBonus: { miniboss: 40, boss: 120 },
    /** Tickets de bienvenida para poder probar el gachapón. */
    starterTickets: 10,
    /** Oro de bienvenida (PokéSurvivor da 500 a una cuenta nueva). */
    starterGold: 500,
  },

  /** Gachapón (PokéSurvivor): 1 ticket por tirada, ×10 garantiza una Épica o mejor. */
  gacha: {
    rates: [[1, 45], [2, 30], [3, 17], [4, 6.5], [5, 1.5]] as [number, number][],
    /** A las N tiradas sin Legendaria, la siguiente lo es. */
    pity: 70,
    /** Oro que devuelve un repetido según rareza. */
    refund: { 1: 15, 2: 30, 3: 60, 4: 120, 5: 300 } as Record<number, number>,
  },
} as const;
