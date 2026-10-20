import { BALANCE } from '../config/balance';
import { REGIONS } from '../data/regions';
import type { GymDef, RegionDef } from '../data/types';
import type { SaveStore } from './save';

// Recompensas y progreso del mapa. Los tickets por hito se registran con un
// identificador único ("gym:sala") para que no se puedan cobrar dos veces
// reiniciando o repitiendo el gimnasio.

export const rewardId = (gymId: string, room: number) => `${gymId}:${room}`;

/** Cobra los tickets del hito si existe y no se ha cobrado. Devuelve los tickets concedidos. */
export function claimMilestone(store: SaveStore, gymId: string, room: number): number {
  const amount = BALANCE.rewards.ticketsByRoom[room];
  if (!amount) return 0;
  const id = rewardId(gymId, room);
  if (store.data.claimedRewards.includes(id)) return 0;
  store.update((d) => {
    d.claimedRewards.push(id);
    d.tickets += amount;
  });
  return amount;
}

export function isClaimed(store: SaveStore, gymId: string, room: number): boolean {
  return store.data.claimedRewards.includes(rewardId(gymId, room));
}

export function awardMedal(store: SaveStore, region: RegionDef, gym: GymDef): boolean {
  const have = store.data.medals[region.id] ?? [];
  if (have.includes(gym.id)) return false;
  store.update((d) => {
    d.medals[region.id] = [...(d.medals[region.id] ?? []), gym.id];
  });
  return true;
}

export function hasMedal(store: SaveStore, regionId: string, gymId: string): boolean {
  return (store.data.medals[regionId] ?? []).includes(gymId);
}

export type GymStatus = 'completed' | 'available' | 'locked' | 'soon';

/** Un gimnasio está disponible si se tiene la medalla del anterior (orden 1 siempre). */
export function gymStatus(store: SaveStore, region: RegionDef, gym: GymDef): GymStatus {
  if (hasMedal(store, region.id, gym.id)) return 'completed';
  const prev = region.gyms.find((g) => g.order === gym.order - 1);
  const unlocked = !prev || hasMedal(store, region.id, prev.id);
  if (!unlocked) return 'locked';
  return gym.playable ? 'available' : 'soon';
}

/** Una región se desbloquea con las 8 medallas de la región requerida. */
export function regionUnlocked(store: SaveStore, region: RegionDef): boolean {
  if (!region.requires) return true;
  const req = REGIONS.find((r) => r.id === region.requires);
  if (!req) return false;
  return req.gyms.every((g) => hasMedal(store, req.id, g.id));
}

export function recordBestRoom(store: SaveStore, gymId: string, room: number): void {
  if ((store.data.bestRoom[gymId] ?? 0) >= room) return;
  store.update((d) => {
    d.bestRoom[gymId] = room;
  });
}

/** Ingresa el oro de la partida (se conserva tanto al ganar como al perder). PROVISIONAL. */
export function bankRunGold(store: SaveStore, gold: number): void {
  if (gold <= 0) return;
  store.update((d) => {
    d.gold += Math.floor(gold);
  });
}
