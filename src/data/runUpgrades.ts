// Mejoras de estadística TEMPORALES (cartas de subida de nivel), solo durante
// una partida. Las de PokéSurvivor (js/systems/levelup.js). Required Notice:
// Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)
// Distintas de las mejoras permanentes compradas con oro. Valores PROVISIONALES.

import type { NeedStat } from './moves';

export type RunStatId = NeedStat | 'heal';

export interface RunStatUpgrade {
  id: RunStatId;
  name: string;
  description: string;
  /** Veces que se puede coger en una partida (sin tope si no se indica). */
  max?: number;
  icon: string;
}

export const RUN_STAT_UPGRADES: Record<RunStatId, RunStatUpgrade> = {
  hp: { id: 'hp', name: 'Vigor', description: '+20 de vida máxima (y la recupera).', icon: '♥' },
  atk: { id: 'atk', name: 'Potencia', description: '+10% de daño con todos los movimientos.', max: 40, icon: '✊' },
  spd: { id: 'spd', name: 'Carrera', description: '+7% de velocidad de movimiento.', max: 8, icon: '➤' },
  cd: { id: 'cd', name: 'Reflejos', description: '-8% de recarga en todos los movimientos.', max: 10, icon: '◷' },
  def: { id: 'def', name: 'Coraza', description: '+6% de reducción de daño recibido.', max: 12, icon: '⛨' },
  rgn: { id: 'rgn', name: 'Síntesis', description: '+0,9 de vida regenerada por segundo.', icon: '❦' },
  mag: { id: 'mag', name: 'Imán', description: '+30% de radio de recogida de experiencia.', max: 6, icon: '∪' },
  xp: { id: 'xp', name: 'Aprendizaje', description: '+12% de experiencia ganada.', max: 8, icon: '✎' },
  heal: { id: 'heal', name: 'Baya Zidra', description: 'Recupera el 45% de tu vida ahora mismo.', icon: '●' },
};

export const STAT_IDS = Object.keys(RUN_STAT_UPGRADES) as RunStatId[];
