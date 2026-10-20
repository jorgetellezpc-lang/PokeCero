// Mejoras de estadística TEMPORALES (familia C), solo durante una partida.
// Distintas de las mejoras permanentes compradas con oro. Valores PROVISIONALES.

export type RunStatId = 'hp' | 'power' | 'speed' | 'defense' | 'haste' | 'magnet' | 'regen';

export interface RunStatUpgrade {
  id: RunStatId;
  name: string;
  /** Texto del efecto; {v} se sustituye por el valor. */
  effect: string;
  amount: number;
  maxStacks: number;
  format: (v: number) => string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const RUN_STAT_UPGRADES: Record<RunStatId, RunStatUpgrade> = {
  hp: { id: 'hp', name: 'Baya Zidra', effect: '+{v} vida máxima y cura esa cantidad', amount: 0.15, maxStacks: 6, format: pct },
  power: { id: 'power', name: 'Proteína', effect: '+{v} daño de todos los ataques', amount: 0.12, maxStacks: 6, format: pct },
  speed: { id: 'speed', name: 'Carburante', effect: '+{v} velocidad de movimiento', amount: 0.08, maxStacks: 4, format: pct },
  defense: { id: 'defense', name: 'Hierro', effect: '+{v} reducción de daño', amount: 0.05, maxStacks: 5, format: pct },
  haste: { id: 'haste', name: 'Garra Rápida', effect: '+{v} velocidad de ataque', amount: 0.12, maxStacks: 5, format: pct },
  magnet: { id: 'magnet', name: 'Amuleto', effect: '+{v} radio de recogida de experiencia', amount: 0.4, maxStacks: 3, format: pct },
  regen: { id: 'regen', name: 'Restos', effect: '+{v} vida por segundo', amount: 0.6, maxStacks: 3, format: (v) => v.toFixed(1) },
};
