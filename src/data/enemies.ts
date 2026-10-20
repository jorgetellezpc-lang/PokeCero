import type { BossDef, EnemyDef } from './types';

// Enemigos de oleadas normales. El tipo elemental y el arquetipo de combate son
// propiedades independientes. Valores base PROVISIONALES (sala 1); la sala
// los escala con la curva de dificultad (config/balance.ts).

export const ENEMIES: Record<string, EnemyDef> = {
  rattata: {
    id: 'rattata', name: 'Rattata', types: ['normal'], archetype: 'melee',
    hp: 16, damage: 7, speed: 78, radius: 10, attackRange: 18, attackCooldown: 1.2, windup: 0.35,
    xp: 2, gold: 1, minRoom: 1, weight: 4,
    sprite: { shape: 'mouse', main: '#a070c0', belly: '#e8d8b0', accent: '#a070c0' },
  },
  pidgey: {
    id: 'pidgey', name: 'Pidgey', types: ['normal', 'flying'], archetype: 'melee',
    hp: 14, damage: 6, speed: 88, radius: 10, attackRange: 18, attackCooldown: 1.1, windup: 0.3,
    xp: 2, gold: 1, minRoom: 1, weight: 3,
    sprite: { shape: 'bird', main: '#b08850', belly: '#f0d8a8', accent: '#e8a040' },
  },
  caterpie: {
    id: 'caterpie', name: 'Caterpie', types: ['bug'], archetype: 'melee',
    hp: 24, damage: 6, speed: 48, radius: 10, attackRange: 18, attackCooldown: 1.4, windup: 0.4,
    xp: 2, gold: 1, minRoom: 1, weight: 3,
    sprite: { shape: 'bug', main: '#78c850', belly: '#f0e070', accent: '#e83030' },
  },
  weedle: {
    id: 'weedle', name: 'Weedle', types: ['bug', 'poison'], archetype: 'ranged',
    hp: 14, damage: 6, speed: 46, radius: 10, attackRange: 230, preferredDistance: 170,
    attackCooldown: 2.4, windup: 0.6,
    projectile: { speed: 130, radius: 4, count: 1, spread: 0, color: '#c060e0' },
    xp: 3, gold: 1, minRoom: 2, weight: 3,
    sprite: { shape: 'bug', main: '#d0a040', belly: '#f0d8a0', accent: '#e0e0e0' },
  },
  oddish: {
    id: 'oddish', name: 'Oddish', types: ['grass', 'poison'], archetype: 'ranged',
    hp: 20, damage: 7, speed: 40, radius: 10, attackRange: 240, preferredDistance: 180,
    attackCooldown: 2.6, windup: 0.7,
    projectile: { speed: 120, radius: 5, count: 2, spread: 0.3, color: '#90e040' },
    xp: 3, gold: 2, minRoom: 6, weight: 2,
    sprite: { shape: 'blob', main: '#4060a8', belly: '#4060a8', accent: '#58b048' },
  },
  spearow: {
    id: 'spearow', name: 'Spearow', types: ['normal', 'flying'], archetype: 'melee',
    hp: 18, damage: 9, speed: 108, radius: 10, attackRange: 18, attackCooldown: 1.0, windup: 0.28,
    xp: 3, gold: 2, minRoom: 10, weight: 3,
    sprite: { shape: 'bird', main: '#a06040', belly: '#e8c898', accent: '#e05030' },
  },
  ekans: {
    id: 'ekans', name: 'Ekans', types: ['poison'], archetype: 'melee',
    hp: 30, damage: 10, speed: 70, radius: 11, attackRange: 22, attackCooldown: 1.3, windup: 0.4,
    xp: 4, gold: 2, minRoom: 14, weight: 3,
    sprite: { shape: 'serpent', main: '#a058a8', belly: '#e8d070', accent: '#e8d070' },
  },
  zubat: {
    id: 'zubat', name: 'Zubat', types: ['poison', 'flying'], archetype: 'ranged',
    hp: 18, damage: 8, speed: 70, radius: 10, attackRange: 220, preferredDistance: 150,
    attackCooldown: 2.0, windup: 0.5,
    projectile: { speed: 150, radius: 4, count: 3, spread: 0.25, color: '#80b0ff' },
    xp: 4, gold: 2, minRoom: 18, weight: 2,
    sprite: { shape: 'bat', main: '#5878c8', belly: '#a060c0', accent: '#a060c0' },
  },
  sandshrew: {
    id: 'sandshrew', name: 'Sandshrew', types: ['ground'], archetype: 'melee',
    hp: 46, damage: 12, speed: 52, radius: 12, attackRange: 22, attackCooldown: 1.5, windup: 0.5,
    xp: 5, gold: 3, minRoom: 22, weight: 2,
    sprite: { shape: 'quad', main: '#d8c068', belly: '#f0e8c0', accent: '#a08040' },
  },
  koffing: {
    id: 'koffing', name: 'Koffing', types: ['poison'], archetype: 'ranged',
    hp: 34, damage: 10, speed: 36, radius: 12, attackRange: 250, preferredDistance: 190,
    attackCooldown: 2.8, windup: 0.8,
    projectile: { speed: 100, radius: 7, count: 3, spread: 0.4, color: '#a8a050' },
    xp: 5, gold: 3, minRoom: 30, weight: 2,
    sprite: { shape: 'blob', main: '#9068a8', belly: '#e0d0a0', accent: '#9068a8' },
  },
  // Invocación de Sudowoodo (no aparece en oleadas normales: weight 0).
  geodude_mini: {
    id: 'geodude_mini', name: 'Geodude', types: ['rock', 'ground'], archetype: 'melee',
    hp: 22, damage: 8, speed: 62, radius: 10, attackRange: 18, attackCooldown: 1.3, windup: 0.4,
    xp: 2, gold: 1, minRoom: 999, weight: 0,
    sprite: { shape: 'rock', main: '#a09080', belly: '#c0b0a0', accent: '#a09080' },
  },
};

// Minibosses y jefe del gimnasio de Brock. Selección PROVISIONAL (ejemplo del
// blueprint): Geodude (20), Sudowoodo (40), Onix (50).
export const BOSSES: Record<string, BossDef> = {
  geodude_boss: {
    id: 'geodude_boss', name: 'Geodude', title: 'Miniboss', role: 'miniboss',
    types: ['rock', 'ground'], archetype: 'melee',
    hp: 220, damage: 12, contactDamage: 10, speed: 52, radius: 20, attackRange: 260,
    attackCooldown: 1.4, windup: 0.8,
    projectile: { speed: 150, radius: 6, count: 3, spread: 0.3, color: '#b0a080' },
    patterns: ['charge', 'throw'],
    xp: 30, gold: 0, minRoom: 999, weight: 0,
    sprite: { shape: 'rock', main: '#a09080', belly: '#c8b8a0', accent: '#a09080' },
  },
  sudowoodo_boss: {
    id: 'sudowoodo_boss', name: 'Sudowoodo', title: 'Miniboss', role: 'miniboss',
    types: ['rock'], archetype: 'ranged',
    hp: 420, damage: 14, contactDamage: 12, speed: 42, radius: 20, attackRange: 260,
    attackCooldown: 1.3, windup: 0.8,
    projectile: { speed: 130, radius: 6, count: 10, spread: 0, color: '#a07840' },
    patterns: ['ring', 'rockfall', 'summon'], summonId: 'geodude_mini',
    xp: 50, gold: 0, minRoom: 999, weight: 0,
    sprite: { shape: 'biped', main: '#a07840', belly: '#c09860', accent: '#40a040' },
  },
  onix_boss: {
    id: 'onix_boss', name: 'Onix', title: 'Jefe de gimnasio', role: 'boss',
    types: ['rock', 'ground'], archetype: 'melee',
    hp: 900, damage: 18, contactDamage: 14, speed: 48, radius: 28, attackRange: 300,
    attackCooldown: 1.1, windup: 0.8, phase2At: 0.5,
    projectile: { speed: 150, radius: 7, count: 12, spread: 0.28, color: '#909098' },
    patterns: ['charge', 'rockfall', 'ring', 'throw'],
    xp: 80, gold: 0, minRoom: 999, weight: 0,
    sprite: { shape: 'serpent', main: '#9098a8', belly: '#b8c0c8', accent: '#9098a8' },
  },
};

export function getEnemy(id: string): EnemyDef | BossDef {
  const e = ENEMIES[id] ?? BOSSES[id];
  if (!e) throw new Error(`Enemigo desconocido: ${id}`);
  return e;
}
