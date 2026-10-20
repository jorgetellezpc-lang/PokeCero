import { BALANCE } from '../config/balance';

/** Experiencia necesaria para pasar del nivel `level` al siguiente. */
export function xpToNext(level: number): number {
  const { base, linear, power } = BALANCE.experience;
  return Math.round(base + linear * level + Math.pow(level, power));
}
