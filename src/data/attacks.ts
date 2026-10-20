import type { AttackDef, AttackLevelMod } from './types';

// Ataques disponibles durante una partida. Valores PROVISIONALES.
// Cuatro comportamientos reutilizables (kind): proyectil, orbe, onda y zona.

const std = (extra: AttackLevelMod): AttackLevelMod[] => [
  { desc: '+25% daño', damagePct: 0.25 },
  extra,
  { desc: '-15% tiempo de recarga', cooldownPct: 0.15 },
  { desc: '+35% daño', damagePct: 0.35 },
];

export const ATTACKS: Record<string, AttackDef> = {
  ascuas: {
    id: 'ascuas', name: 'Ascuas', type: 'fire', kind: 'projectile', color: '#ff7a2a',
    description: 'Dispara llamas al enemigo más cercano.',
    base: { damage: 9, cooldown: 0.9, count: 1, area: 5, speed: 260, pierce: 0, duration: 0, range: 340 },
    levels: std({ desc: '+1 proyectil', count: 1 }),
  },
  lanzallamas: {
    id: 'lanzallamas', name: 'Lanzallamas', type: 'fire', kind: 'projectile', color: '#ffb02a',
    description: 'Gran llamarada que atraviesa enemigos.',
    base: { damage: 16, cooldown: 2.2, count: 1, area: 9, speed: 220, pierce: 3, duration: 0, range: 320 },
    levels: std({ desc: '+2 perforación y +20% tamaño', pierce: 2, areaPct: 0.2 }),
  },
  giro_fuego: {
    id: 'giro_fuego', name: 'Giro Fuego', type: 'fire', kind: 'orbit', color: '#ff4a1a',
    description: 'Bolas de fuego que giran a tu alrededor.',
    base: { damage: 6, cooldown: 0, count: 2, area: 8, speed: 3.2, pierce: 0, duration: 0, range: 42 },
    levels: std({ desc: '+1 bola de fuego', count: 1 }),
  },
  aranazo: {
    id: 'aranazo', name: 'Arañazo', type: 'normal', kind: 'nova', color: '#f2f2f2',
    description: 'Golpe en área a tu alrededor que empuja.',
    base: { damage: 11, cooldown: 1.6, count: 1, area: 44, speed: 0, pierce: 0, duration: 0, range: 50 },
    levels: std({ desc: '+25% área', areaPct: 0.25 }),
  },
  placaje: {
    id: 'placaje', name: 'Placaje', type: 'normal', kind: 'nova', color: '#e8d8b0',
    description: 'Embestida en área a tu alrededor.',
    base: { damage: 10, cooldown: 1.5, count: 1, area: 42, speed: 0, pierce: 0, duration: 0, range: 48 },
    levels: std({ desc: '+25% área', areaPct: 0.25 }),
  },
  ataque_rapido: {
    id: 'ataque_rapido', name: 'Ataque Rápido', type: 'normal', kind: 'projectile', color: '#ffffff',
    description: 'Ráfaga veloz de golpes al enemigo más cercano.',
    base: { damage: 6, cooldown: 0.5, count: 1, area: 4, speed: 380, pierce: 0, duration: 0, range: 260 },
    levels: std({ desc: '+1 proyectil', count: 1 }),
  },
  pistola_agua: {
    id: 'pistola_agua', name: 'Pistola Agua', type: 'water', kind: 'projectile', color: '#4ab0ff',
    description: 'Chorro de agua al enemigo más cercano.',
    base: { damage: 9, cooldown: 0.9, count: 1, area: 5, speed: 260, pierce: 0, duration: 0, range: 340 },
    levels: std({ desc: '+1 proyectil', count: 1 }),
  },
  burbuja: {
    id: 'burbuja', name: 'Burbuja', type: 'water', kind: 'orbit', color: '#9adcff',
    description: 'Burbujas que orbitan y golpean al contacto.',
    base: { damage: 5, cooldown: 0, count: 3, area: 7, speed: 2.6, pierce: 0, duration: 0, range: 46 },
    levels: std({ desc: '+1 burbuja', count: 1 }),
  },
  hidrobomba: {
    id: 'hidrobomba', name: 'Hidrobomba', type: 'water', kind: 'zone', color: '#2a7aff',
    description: 'Géiser que estalla bajo un enemigo.',
    base: { damage: 22, cooldown: 2.6, count: 1, area: 34, speed: 0, pierce: 0, duration: 0, range: 320 },
    levels: std({ desc: '+1 géiser', count: 1 }),
  },
  hoja_afilada: {
    id: 'hoja_afilada', name: 'Hoja Afilada', type: 'grass', kind: 'projectile', color: '#6adf4a',
    description: 'Hojas que atraviesan a un enemigo.',
    base: { damage: 8, cooldown: 1.0, count: 1, area: 5, speed: 280, pierce: 1, duration: 0, range: 340 },
    levels: std({ desc: '+1 hoja', count: 1 }),
  },
  latigo_cepa: {
    id: 'latigo_cepa', name: 'Látigo Cepa', type: 'grass', kind: 'nova', color: '#3aa02a',
    description: 'Latigazo en área a tu alrededor.',
    base: { damage: 12, cooldown: 1.7, count: 1, area: 50, speed: 0, pierce: 0, duration: 0, range: 56 },
    levels: std({ desc: '+25% área', areaPct: 0.25 }),
  },
  polvo_veneno: {
    id: 'polvo_veneno', name: 'Polvo Veneno', type: 'poison', kind: 'zone', color: '#b45adf',
    description: 'Nube tóxica que daña con el tiempo.',
    base: { damage: 4, cooldown: 3.0, count: 1, area: 38, speed: 0, pierce: 0, duration: 3, range: 300 },
    levels: std({ desc: '+30% área', areaPct: 0.3 }),
  },
  impactrueno: {
    id: 'impactrueno', name: 'Impactrueno', type: 'electric', kind: 'projectile', color: '#ffe23a',
    description: 'Descarga eléctrica muy rápida.',
    base: { damage: 8, cooldown: 0.75, count: 1, area: 5, speed: 420, pierce: 0, duration: 0, range: 360 },
    levels: std({ desc: '+1 descarga', count: 1 }),
  },
  rayo: {
    id: 'rayo', name: 'Rayo', type: 'electric', kind: 'zone', color: '#fff27a',
    description: 'Un rayo cae sobre un enemigo cercano.',
    base: { damage: 20, cooldown: 2.2, count: 1, area: 28, speed: 0, pierce: 0, duration: 0, range: 320 },
    levels: std({ desc: '+1 rayo', count: 1 }),
  },
  chispa: {
    id: 'chispa', name: 'Chispa', type: 'electric', kind: 'orbit', color: '#ffd000',
    description: 'Chispas que giran a tu alrededor.',
    base: { damage: 6, cooldown: 0, count: 2, area: 7, speed: 3.6, pierce: 0, duration: 0, range: 40 },
    levels: std({ desc: '+1 chispa', count: 1 }),
  },
};

export function getAttack(id: string): AttackDef {
  const a = ATTACKS[id];
  if (!a) throw new Error(`Ataque desconocido: ${id}`);
  return a;
}

export const ATTACK_MAX_LEVEL = (def: AttackDef) => def.levels.length + 1;
