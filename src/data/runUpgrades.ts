// Mejoras de estadística de las cartas de subida de nivel. Son PERMANENTES (se
// guardan con el Pokémon), así que valen poco cada una y se acumulan durante
// todo el juego. Basadas en las de PokéSurvivor (js/systems/levelup.js).
// Required Notice: Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)
// Valores PROVISIONALES.

import type { NeedStat } from './moves';

export type RunStatId = NeedStat | 'heal';

export interface RunStatUpgrade {
  id: RunStatId;
  name: string;
  description: string;
  /** Veces que se puede coger en total (sin tope si no se indica). */
  max?: number;
  icon: string;
}

export const RUN_STAT_UPGRADES: Record<RunStatId, RunStatUpgrade> = {
  hp: { id: 'hp', name: 'Vigor', description: '+6% de vida máxima.', max: 30, icon: '♥' },
  atk: { id: 'atk', name: 'Potencia', description: '+5% de daño.', max: 40, icon: '✊' },
  spd: { id: 'spd', name: 'Carrera', description: '+3% de velocidad de movimiento.', max: 10, icon: '➤' },
  cd: { id: 'cd', name: 'Reflejos', description: '-3% de recarga del ataque.', max: 15, icon: '◷' },
  def: { id: 'def', name: 'Coraza', description: '+3% de reducción de daño recibido.', max: 15, icon: '⛨' },
  rgn: { id: 'rgn', name: 'Síntesis', description: 'Regenera un 0,4% de tu vida por segundo.', max: 10, icon: '❦' },
  mag: { id: 'mag', name: 'Imán', description: '+15% de radio de recogida de experiencia.', max: 6, icon: '∪' },
  xp: { id: 'xp', name: 'Aprendizaje', description: '+6% de experiencia ganada.', max: 10, icon: '✎' },
  heal: { id: 'heal', name: 'Baya Zidra', description: 'Recupera el 45% de tu vida ahora mismo.', icon: '●' },
};

export const STAT_IDS = Object.keys(RUN_STAT_UPGRADES) as RunStatId[];
