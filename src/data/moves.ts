// ============================================================================
// Catálogo de movimientos, basado en el de PokéSurvivor (js/data/moves.js).
// Required Notice: Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)
// Licencia del original: PolyForm Noncommercial 1.0.0 (THIRD_PARTY_NOTICES.md).
//
// Los valores se escriben en las unidades de PokéSurvivor y se adaptan a la
// arena de Pokécero al crear la instancia (BALANCE.ps). Balance PROVISIONAL.
// ============================================================================

import { BALANCE } from '../config/balance';
import type { ElementType } from './types';

export type MoveKind =
  | 'projectile' | 'melee' | 'beam' | 'orbit' | 'nova' | 'aura' | 'buff'
  | 'boomerang' | 'chain' | 'mine' | 'meteor' | 'turret' | 'dash' | 'trail' | 'cone'
  | 'homing' | 'bounce' | 'charge' | 'spin' | 'quake' | 'vortex' | 'shove' | 'stun';

export type BuffStat = 'patk' | 'satk' | 'spd' | 'def' | 'regen';

/** Valores numéricos de un movimiento (base o ya mejorado). */
export interface MoveNums {
  cd: number;
  dmg?: number;
  speed?: number;
  count?: number;
  spread?: number;
  pierce?: number;
  life?: number;
  size?: number;
  radius?: number;
  arc?: number;
  width?: number;
  knock?: number;
  dur?: number;
  rate?: number;
  range?: number;
  charge?: number;
  pull?: number;
  stun?: number;
  bounce?: number;
  homing?: number;
  amount?: number;
  stacks?: number;
  burn?: number;
  poison?: number;
  slow?: number;
  drain?: number;
  hex?: number;
}

export interface MoveDef extends MoveNums {
  id: string;
  name: string;
  type: ElementType;
  kind: MoveKind;
  desc: string;
  stat?: BuffStat;
}

export type MoveMods = Partial<Record<keyof MoveNums, number>>;
export interface LadderStep { t: string; m: MoveMods }

// Escalera de mejoras por comportamiento (niveles 2..5).
const LADDERS: Record<MoveKind, LadderStep[]> = {
  projectile: [
    { t: '+1 proyectil', m: { count: 1, spread: 1.4 } },
    { t: '+45% daño', m: { dmg: 1.45 } },
    { t: '-25% recarga', m: { cd: 0.75 } },
    { t: '+1 proyectil y +1 perforación', m: { count: 1, pierce: 1, spread: 1.2 } },
  ],
  melee: [
    { t: '+40% daño', m: { dmg: 1.4 } },
    { t: '+25% alcance', m: { radius: 1.25 } },
    { t: '-25% recarga', m: { cd: 0.75 } },
    { t: 'Golpea en 360° y +50% daño', m: { arc: 9, dmg: 1.5 } },
  ],
  beam: [
    { t: '+45% daño', m: { dmg: 1.45 } },
    { t: '+30% alcance y grosor', m: { radius: 1.3, width: 1.3 } },
    { t: '-25% recarga', m: { cd: 0.75 } },
    { t: '+50% daño', m: { dmg: 1.5 } },
  ],
  orbit: [
    { t: '+1 orbe', m: { count: 1 } },
    { t: '+55% daño', m: { dmg: 1.55 } },
    { t: '+25% radio y gira más rápido', m: { radius: 1.25, speed: 1.35 } },
    { t: '+1 orbe y +55% daño', m: { count: 1, dmg: 1.55 } },
  ],
  nova: [
    { t: '+4 proyectiles', m: { count: 4 } },
    { t: '+40% daño', m: { dmg: 1.4 } },
    { t: '-25% recarga', m: { cd: 0.75 } },
    { t: '+4 proyectiles y +1 perforación', m: { count: 4, pierce: 1 } },
  ],
  aura: [
    { t: '+30% radio', m: { radius: 1.3 } },
    { t: '+45% daño', m: { dmg: 1.45 } },
    { t: 'Golpea un 40% más a menudo', m: { cd: 0.7 } },
    { t: '+30% radio y +50% daño', m: { radius: 1.3, dmg: 1.5 } },
  ],
  boomerang: [
    { t: '+1 bumerán', m: { count: 1 } },
    { t: '+45% daño', m: { dmg: 1.45 } },
    { t: '+30% alcance', m: { radius: 1.3 } },
    { t: '+1 bumerán y +40% daño', m: { count: 1, dmg: 1.4 } },
  ],
  chain: [
    { t: '+2 saltos', m: { count: 2 } },
    { t: '+45% daño', m: { dmg: 1.45 } },
    { t: '-25% recarga', m: { cd: 0.75 } },
    { t: '+2 saltos y +40% daño', m: { count: 2, dmg: 1.4 } },
  ],
  mine: [
    { t: '+1 mina', m: { count: 1 } },
    { t: '+50% daño', m: { dmg: 1.5 } },
    { t: '+30% radio de explosión', m: { radius: 1.3 } },
    { t: '+1 mina y -25% recarga', m: { count: 1, cd: 0.75 } },
  ],
  meteor: [
    { t: '+1 meteoro', m: { count: 1 } },
    { t: '+45% daño', m: { dmg: 1.45 } },
    { t: '+30% radio', m: { radius: 1.3 } },
    { t: '+2 meteoros y -20% recarga', m: { count: 2, cd: 0.8 } },
  ],
  turret: [
    { t: '+50% daño', m: { dmg: 1.5 } },
    { t: 'Dispara un 35% más rápido', m: { rate: 0.74 } },
    { t: '+1 a la vez', m: { count: 1 } },
    { t: '+50% duración y +40% daño', m: { dur: 1.5, dmg: 1.4 } },
  ],
  dash: [
    { t: '+40% daño', m: { dmg: 1.4 } },
    { t: '+30% distancia', m: { radius: 1.3 } },
    { t: '-25% recarga', m: { cd: 0.75 } },
    { t: '+60% daño y más ancho', m: { dmg: 1.6, width: 1.4 } },
  ],
  trail: [
    { t: '+40% daño', m: { dmg: 1.4 } },
    { t: '+40% duración', m: { dur: 1.4 } },
    { t: 'Charcos un 30% más grandes', m: { radius: 1.3 } },
    { t: '+50% daño y +30% radio', m: { dmg: 1.5, radius: 1.3 } },
  ],
  cone: [
    { t: '+3 disparos', m: { count: 3 } },
    { t: '+40% daño', m: { dmg: 1.4 } },
    { t: '+30% alcance', m: { life: 1.3 } },
    { t: '+3 disparos y +1 perforación', m: { count: 3, pierce: 1 } },
  ],
  homing: [
    { t: '+1 proyectil', m: { count: 1, spread: 1.3 } },
    { t: '+45% daño', m: { dmg: 1.45 } },
    { t: '-25% recarga', m: { cd: 0.75 } },
    { t: '+1 proyectil y +40% daño', m: { count: 1, dmg: 1.4 } },
  ],
  bounce: [
    { t: '+1 rebote', m: { bounce: 1 } },
    { t: '+45% daño', m: { dmg: 1.45 } },
    { t: '-25% recarga', m: { cd: 0.75 } },
    { t: '+1 proyectil y +1 rebote', m: { count: 1, bounce: 1, spread: 1.3 } },
  ],
  charge: [
    { t: '+45% daño', m: { dmg: 1.45 } },
    { t: '+30% alcance y grosor', m: { radius: 1.3, width: 1.3 } },
    { t: 'Carga más rápido y -20% recarga', m: { charge: 0.7, cd: 0.8 } },
    { t: '+50% daño', m: { dmg: 1.5 } },
  ],
  spin: [
    { t: '+40% daño', m: { dmg: 1.4 } },
    { t: '+25% radio', m: { radius: 1.25 } },
    { t: '+1 vuelta', m: { count: 1 } },
    { t: '-25% recarga y +30% daño', m: { cd: 0.75, dmg: 1.3 } },
  ],
  quake: [
    { t: '+2 ondas', m: { count: 2 } },
    { t: '+45% daño', m: { dmg: 1.45 } },
    { t: '+25% tamaño', m: { radius: 1.25 } },
    { t: '-25% recarga y +2 ondas', m: { cd: 0.75, count: 2 } },
  ],
  vortex: [
    { t: '+40% daño', m: { dmg: 1.4 } },
    { t: '+30% radio', m: { radius: 1.3 } },
    { t: '+50% duración', m: { dur: 1.5 } },
    { t: 'Atrae más fuerte y +40% daño', m: { pull: 1.4, dmg: 1.4 } },
  ],
  shove: [
    { t: '+40% daño', m: { dmg: 1.4 } },
    { t: '+25% radio', m: { radius: 1.25 } },
    { t: '-25% recarga', m: { cd: 0.75 } },
    { t: '+50% empuje y +40% daño', m: { knock: 1.5, dmg: 1.4 } },
  ],
  stun: [
    { t: '+40% daño', m: { dmg: 1.4 } },
    { t: '+25% radio', m: { radius: 1.25 } },
    { t: '+50% aturdimiento', m: { stun: 1.5 } },
    { t: '-25% recarga y +30% daño', m: { cd: 0.75, dmg: 1.3 } },
  ],
  buff: [
    { t: '+1 acumulación máxima', m: { stacks: 1 } },
    { t: '+40% potencia', m: { amount: 1.4 } },
    { t: '+50% duración', m: { dur: 1.5 } },
    { t: '+1 acumulación y +40% potencia', m: { stacks: 1, amount: 1.4 } },
  ],
};

const M = (id: string, name: string, type: ElementType, kind: MoveKind, desc: string, nums: MoveNums & { stat?: BuffStat }): MoveDef =>
  ({ id, name, type, kind, desc, ...nums });

const RAW: MoveDef[] = [
  // Normal (pool común)
  M('tackle', 'Placaje', 'normal', 'melee', 'Embiste en arco a todo lo que tengas delante.', { cd: 0.5, dmg: 13, radius: 48, arc: 1.7, knock: 90 }),
  M('quick-attack', 'Ataque Rápido', 'normal', 'dash', 'Cruzas como un rayo hacia el enemigo y golpeas todo el camino.', { cd: 0.75, dmg: 20, radius: 110, width: 34, knock: 40 }),
  M('swords-dance', 'Danza Espada', 'normal', 'buff', 'No hace daño: acumula ATAQUE (físico).', { cd: 0.85, stat: 'patk', amount: 0.13, dur: 7, stacks: 5 }),
  M('nasty-plot', 'Maquinación', 'normal', 'buff', 'No hace daño: acumula ATAQUE ESPECIAL.', { cd: 0.85, stat: 'satk', amount: 0.13, dur: 7, stacks: 5 }),
  M('agility', 'Agilidad', 'normal', 'buff', 'No hace daño: acumula VELOCIDAD.', { cd: 0.85, stat: 'spd', amount: 0.1, dur: 7, stacks: 5 }),
  M('harden', 'Fortaleza', 'normal', 'buff', 'No hace daño: acumula DEFENSA.', { cd: 0.85, stat: 'def', amount: 0.07, dur: 7, stacks: 5 }),
  M('body-slam', 'Golpe Cuerpo', 'normal', 'melee', 'Placaje con todo el peso: lento, corto y brutal.', { cd: 0.95, dmg: 30, radius: 46, arc: 2.2, knock: 140 }),
  M('hyper-voice', 'Vozarrón', 'normal', 'nova', 'Onda sonora que sale en todas direcciones.', { cd: 1.15, dmg: 12, speed: 260, count: 9, pierce: 1, life: 0.9, size: 7 }),
  M('substitute', 'Sustituto', 'normal', 'turret', 'Un muñeco que se queda disparando por ti.', { cd: 4, dmg: 14, rate: 0.4, dur: 6, count: 1, range: 280, speed: 320, size: 6 }),
  M('hyper-beam', 'Hiperrayo', 'normal', 'charge', 'Se carga un momento y suelta un rayo enorme que lo atraviesa todo.', { cd: 2.2, charge: 0.75, dmg: 58, radius: 300, width: 44 }),
  M('rapid-spin', 'Giro Rápido', 'normal', 'spin', 'Giras sobre ti mismo golpeando todo lo que te rodea varias veces.', { cd: 1, dmg: 9, count: 3, radius: 62 }),
  // Fuego
  M('ember', 'Ascuas', 'fire', 'projectile', 'Bola de fuego al enemigo más cercano.', { cd: 0.52, dmg: 18, speed: 310, count: 1, spread: 0.12, pierce: 0, life: 1.6, size: 7, burn: 1 }),
  M('flamethrower', 'Lanzallamas', 'fire', 'cone', 'Chorro de llamas en abanico corto que quema.', { cd: 0.7, dmg: 7, count: 7, arc: 0.9, speed: 380, life: 0.42, size: 6, pierce: 1, burn: 1 }),
  M('fire-spin', 'Giro Fuego', 'fire', 'orbit', 'Llamas que giran a tu alrededor. Defensa constante.', { cd: 0.3, dmg: 14, count: 3, radius: 62, speed: 2.4, size: 9, burn: 1 }),
  M('heat-wave', 'Onda Ígnea', 'fire', 'nova', 'Explota en llamas en todas las direcciones.', { cd: 1.25, dmg: 13, speed: 250, count: 10, pierce: 1, life: 1.1, size: 7, burn: 1 }),
  M('will-o-wisp', 'Fuego Fatuo', 'fire', 'turret', 'Deja una llama flotante que dispara sola y quema.', { cd: 3.5, dmg: 15, rate: 0.55, dur: 6, count: 1, range: 300, speed: 300, size: 7, burn: 1 }),
  M('flame-wheel', 'Rueda Fuego', 'fire', 'trail', 'Corres envuelto en fuego y dejas un rastro de llamas.', { cd: 0.28, dmg: 10, radius: 28, dur: 2.6, burn: 1 }),
  M('flame-charge', 'Nitrocarga', 'fire', 'dash', 'Te lanzas envuelto en llamas y quemas todo el camino.', { cd: 0.8, dmg: 19, radius: 115, width: 36, burn: 1 }),
  // Agua
  M('water-gun', 'Pistola Agua', 'water', 'projectile', 'Chorro perforante. Fiable a cualquier distancia.', { cd: 0.44, dmg: 14, speed: 350, count: 1, spread: 0.1, pierce: 1, life: 1.5, size: 6 }),
  M('bubble', 'Burbuja', 'water', 'nova', 'Burbujas en abanico que ralentizan a quien tocan.', { cd: 1, dmg: 9, speed: 210, count: 8, pierce: 0, life: 1.3, size: 8, slow: 0.45 }),
  M('hydro-pump', 'Hidrobomba', 'water', 'beam', 'Cañonazo de agua lento pero devastador.', { cd: 1.5, dmg: 29, radius: 250, width: 30 }),
  M('aqua-ring', 'Acua Aro', 'water', 'buff', 'No hace daño: acumula REGENERACIÓN de vida.', { cd: 0.9, stat: 'regen', amount: 1.6, dur: 8, stacks: 4 }),
  M('bubble-beam', 'Rayo Burbuja', 'water', 'cone', 'Chorro de burbujas en abanico corto que frena.', { cd: 0.65, dmg: 6, count: 7, arc: 1, speed: 340, life: 0.45, size: 6, slow: 0.3 }),
  M('whirlpool', 'Torbellino', 'water', 'vortex', 'Un remolino que arrastra a los enemigos a su centro y los va dañando.', { cd: 3, dmg: 8, radius: 72, dur: 2.6, pull: 150 }),
  // Planta
  M('vine-whip', 'Látigo Cepa', 'grass', 'melee', 'Látigos de largo alcance en arco amplio.', { cd: 0.62, dmg: 16, radius: 68, arc: 1.3, knock: 60 }),
  M('razor-leaf', 'Hoja Afilada', 'grass', 'boomerang', 'Dos hojas que van y vuelven cortando a la ida y a la vuelta.', { cd: 0.9, dmg: 10, speed: 330, count: 2, spread: 0.5, radius: 210, size: 6 }),
  M('leaf-storm', 'Tormenta Floral', 'grass', 'orbit', 'Un ciclón de hojas gira amplio a tu alrededor.', { cd: 0.26, dmg: 14, count: 4, radius: 74, speed: 2.6, size: 8 }),
  M('giga-drain', 'Hierba Lazo', 'grass', 'aura', 'Raíces que atrapan y machacan todo lo que tienes cerca.', { cd: 0.55, dmg: 9, radius: 76 }),
  M('seed-bomb', 'Bomba Germen', 'grass', 'bounce', 'Una semilla que rebota de enemigo en enemigo.', { cd: 0.6, dmg: 10, speed: 320, life: 1.6, size: 7, bounce: 3 }),
  M('energy-ball', 'Energibola', 'grass', 'homing', 'Una bola de energía que persigue al enemigo.', { cd: 0.62, dmg: 19, speed: 280, life: 2, size: 8, homing: 5 }),
  M('solar-beam', 'Rayo Solar', 'grass', 'charge', 'Absorbe luz un momento y la suelta en un rayo enorme.', { cd: 2.3, charge: 0.85, dmg: 62, radius: 290, width: 40 }),
  // Eléctrico
  M('thunder-shock', 'Impactrueno', 'electric', 'projectile', 'Descarga rapidísima que atraviesa varios enemigos.', { cd: 0.4, dmg: 13, speed: 480, count: 1, spread: 0.08, pierce: 2, life: 1.1, size: 5 }),
  M('discharge', 'Chispazo', 'electric', 'aura', 'Campo eléctrico permanente alrededor de ti.', { cd: 0.45, dmg: 8, radius: 70 }),
  M('thunderbolt', 'Rayo', 'electric', 'chain', 'Un rayo que salta de un enemigo a otro.', { cd: 0.95, dmg: 21, count: 4, radius: 140 }),
  M('thunder-wave', 'Onda Trueno', 'electric', 'stun', 'Una descarga que avisa en el suelo y deja paralizados a los que pilla.', { cd: 1.6, dmg: 22, radius: 58, stun: 1 }),
  M('electro-ball', 'Bola Voltio', 'electric', 'bounce', 'Una bola eléctrica que salta de enemigo en enemigo.', { cd: 0.62, dmg: 10, speed: 340, life: 1.6, size: 7, bounce: 3 }),
  // Psíquico
  M('confusion', 'Confusión', 'psychic', 'projectile', 'Onda que persigue sola a su objetivo.', { cd: 0.58, dmg: 13, speed: 280, count: 1, spread: 0.1, pierce: 0, life: 2.2, size: 8, homing: 2 }),
  M('psybeam', 'Psicorrayo', 'psychic', 'beam', 'Rayo psíquico ancho y contundente.', { cd: 1.15, dmg: 17, radius: 215, width: 40 }),
  M('psychic', 'Psíquico', 'psychic', 'nova', 'Estallido mental radial que busca enemigos.', { cd: 1.35, dmg: 10, speed: 230, count: 12, pierce: 1, life: 1.6, size: 7, homing: 1 }),
  M('psycho-cut', 'Psicocorte', 'psychic', 'boomerang', 'Cuchillas psíquicas que vuelven a ti.', { cd: 0.8, dmg: 9, speed: 360, count: 2, spread: 0.6, radius: 200, size: 7 }),
  M('extrasensory', 'Paranormal', 'psychic', 'shove', 'Una onda mental que daña y aparta a todos los que tienes cerca.', { cd: 1.2, dmg: 16, radius: 92, knock: 320 }),
  M('mist-ball', 'Bola Neblina', 'psychic', 'homing', 'Una bola de bruma que persigue al enemigo y le frena.', { cd: 0.55, dmg: 13, speed: 270, life: 2, size: 8, homing: 5, slow: 0.3 }),
  // Veneno
  M('sludge', 'Residuos', 'poison', 'projectile', 'Lodo tóxico que envenena al impactar.', { cd: 0.6, dmg: 17, speed: 290, count: 1, spread: 0.12, pierce: 0, life: 1.5, size: 8, poison: 1 }),
  M('poison-sting', 'Picotazo Veneno', 'poison', 'projectile', 'Aguijón rápido que envenena.', { cd: 0.34, dmg: 8, speed: 420, count: 1, spread: 0.08, pierce: 0, life: 1, size: 4, poison: 1 }),
  M('toxic', 'Tóxico', 'poison', 'trail', 'Vas dejando charcos de veneno que intoxican a quien los pisa.', { cd: 0.3, dmg: 6, radius: 26, dur: 3, poison: 1 }),
  M('toxic-spikes', 'Púas Tóxicas', 'poison', 'mine', 'Púas venenosas que envenenan mucho al estallar.', { cd: 1.1, dmg: 11, count: 2, radius: 56, dur: 8, poison: 2 }),
  M('acid-spray', 'Bomba Ácida', 'poison', 'bounce', 'Un chorro ácido que salta entre enemigos y los envenena.', { cd: 0.66, dmg: 8, speed: 310, life: 1.6, size: 7, bounce: 3, poison: 1 }),
  // Tierra
  M('mud-shot', 'Disparo Lodo', 'ground', 'nova', 'Salpica lodo alrededor y ralentiza.', { cd: 1.1, dmg: 11, speed: 200, count: 7, pierce: 0, life: 1, size: 9, slow: 0.4 }),
  M('bulldoze', 'Terratemblor', 'ground', 'aura', 'Sacude el suelo: daña y frena a lo cercano.', { cd: 0.7, dmg: 11, radius: 80, slow: 0.35 }),
  M('bonemerang', 'Huesomerang', 'ground', 'boomerang', 'Un hueso que va y vuelve golpeando fuerte.', { cd: 0.95, dmg: 16, speed: 300, count: 1, radius: 230, size: 8, knock: 40 }),
  M('spikes', 'Púas', 'ground', 'mine', 'Siembra púas que estallan al pisarlas.', { cd: 1.2, dmg: 18, count: 2, radius: 60, dur: 8 }),
  M('sand-tomb', 'Bucle Arena', 'ground', 'vortex', 'Un remolino de arena que atrapa y arrastra a los enemigos.', { cd: 3, dmg: 9, radius: 70, dur: 2.6, pull: 140 }),
  M('magnitude', 'Magnitud', 'ground', 'quake', 'El suelo revienta en línea delante de ti, onda tras onda.', { cd: 1.15, dmg: 18, count: 6, radius: 30 }),
  // Volador
  M('gust', 'Tornado', 'flying', 'orbit', 'Remolinos de viento que te escoltan.', { cd: 0.26, dmg: 13, count: 3, radius: 72, speed: 2.8, size: 8, knock: 40 }),
  M('wing-attack', 'Ataque Ala', 'flying', 'melee', 'Barrido de alas amplio que empuja.', { cd: 0.55, dmg: 14, radius: 58, arc: 1.9, knock: 70 }),
  M('aerial-ace', 'Golpe Aéreo', 'flying', 'dash', 'Te lanzas en picado y cortas todo lo que cruzas.', { cd: 0.75, dmg: 18, radius: 120, width: 40, knock: 60 }),
  M('whirlwind', 'Remolino', 'flying', 'shove', 'Un golpe de viento que barre a todos los que tienes cerca.', { cd: 1.1, dmg: 14, radius: 96, knock: 360 }),
  M('air-slash', 'Tajo Aéreo', 'flying', 'homing', 'Dos cuchillas de aire que buscan al enemigo.', { cd: 0.55, dmg: 9, count: 2, spread: 0.35, speed: 330, life: 1.6, size: 7, homing: 4 }),
  // Bicho
  M('bug-bite', 'Picadura', 'bug', 'melee', 'Mordisco rápido en arco corto.', { cd: 0.42, dmg: 11, radius: 44, arc: 1.6, knock: 40 }),
  M('string-shot', 'Disparo Demora', 'bug', 'mine', 'Telarañas en el suelo que frenan mucho al que las pisa.', { cd: 1.1, dmg: 14, count: 2, radius: 56, dur: 7, slow: 0.6 }),
  M('bug-buzz', 'Zumbido', 'bug', 'aura', 'Vibración constante que machaca lo cercano.', { cd: 0.45, dmg: 8, radius: 66 }),
  M('signal-beam', 'Rayo Señal', 'bug', 'bounce', 'Un destello que rebota entre los enemigos.', { cd: 0.6, dmg: 10, speed: 340, life: 1.6, size: 7, bounce: 3 }),
  M('u-turn', 'Ida y Vuelta', 'bug', 'dash', 'Cruzas entre los enemigos golpeando a todos los del camino.', { cd: 0.7, dmg: 17, radius: 120, width: 34 }),
  // Roca
  M('rock-throw', 'Lanzarrocas', 'rock', 'projectile', 'Pedrusco pesado que empuja al enemigo.', { cd: 0.7, dmg: 24, speed: 260, count: 1, spread: 0.12, pierce: 0, life: 1.4, size: 9, knock: 90 }),
  M('rock-slide', 'Avalancha', 'rock', 'meteor', 'Caen rocas del cielo sobre los enemigos cercanos.', { cd: 1.3, dmg: 21, count: 3, radius: 46, knock: 50 }),
  M('rock-tomb', 'Tumba Rocas', 'rock', 'stun', 'Caen rocas donde avisa el suelo y dejan atrapados a los que pilla.', { cd: 1.7, dmg: 31, radius: 56, stun: 0.9 }),
  M('ancient-power', 'Poder Pasado', 'rock', 'orbit', 'Rocas antiguas que giran a tu alrededor.', { cd: 0.28, dmg: 13, count: 3, radius: 70, speed: 2.6, size: 9 }),
  M('power-gem', 'Joya de Luz', 'rock', 'bounce', 'Un destello de gema que rebota de enemigo en enemigo.', { cd: 0.66, dmg: 11, speed: 320, life: 1.6, size: 8, bounce: 3 }),
  // Hielo
  M('ice-beam', 'Rayo Hielo', 'ice', 'beam', 'Rayo helado que congela casi del todo.', { cd: 1.1, dmg: 20, radius: 220, width: 30, slow: 0.7 }),
  M('powder-snow', 'Nieve Polvo', 'ice', 'aura', 'Ventisca a tu alrededor que ralentiza.', { cd: 0.55, dmg: 8, radius: 76, slow: 0.45 }),
  M('hail', 'Granizo', 'ice', 'meteor', 'Bolas de hielo caen sobre los enemigos y los frenan.', { cd: 1.2, dmg: 18, count: 4, radius: 40, slow: 0.4 }),
  M('ice-shard', 'Canto Helado', 'ice', 'homing', 'Esquirlas rapidísimas que persiguen al enemigo.', { cd: 0.32, dmg: 9, speed: 380, life: 1.5, size: 6, homing: 7 }),
  M('freeze-dry', 'Liofilización', 'ice', 'stun', 'Un frío repentino que avisa en el suelo y deja congelados a los que pilla.', { cd: 1.6, dmg: 24, radius: 60, stun: 1 }),
  // Lucha
  M('karate-chop', 'Golpe Kárate', 'fighting', 'melee', 'Golpe seco y potente al frente.', { cd: 0.5, dmg: 18, radius: 50, arc: 1.2, knock: 110 }),
  M('aura-sphere', 'Esfera Aural', 'fighting', 'projectile', 'Esfera de energía que nunca falla.', { cd: 0.62, dmg: 17, speed: 300, count: 1, spread: 0.1, pierce: 0, life: 2, size: 8, homing: 4 }),
  M('rolling-kick', 'Patada Giro', 'fighting', 'spin', 'Patadas en giro que golpean todo lo que tienes alrededor.', { cd: 0.95, dmg: 11, count: 3, radius: 60 }),
  M('vacuum-wave', 'Onda Vacío', 'fighting', 'shove', 'Una onda que daña y aparta a los enemigos.', { cd: 1.1, dmg: 17, radius: 88, knock: 330 }),
  M('dynamic-punch', 'Puño Dinámico', 'fighting', 'stun', 'Un puñetazo tremendo donde avisa el suelo: deja aturdidos a los que pilla.', { cd: 1.7, dmg: 33, radius: 54, stun: 0.9 }),
  // Fantasma
  M('lick', 'Lengüetazo', 'ghost', 'melee', 'Lametazo espectral que paraliza un poco.', { cd: 0.48, dmg: 12, radius: 48, arc: 1.8, slow: 0.4 }),
  M('shadow-ball', 'Bola Sombra', 'ghost', 'projectile', 'Esfera oscura que atraviesa a varios.', { cd: 0.66, dmg: 19, speed: 280, count: 1, spread: 0.1, pierce: 2, life: 1.6, size: 9 }),
  M('hex', 'Infortunio', 'ghost', 'chain', 'Maldición que salta entre enemigos. Mucho más daño si sufren un estado.', { cd: 0.9, dmg: 17, count: 4, radius: 150, hex: 1.7 }),
  M('shadow-sneak', 'Sombra Vil', 'ghost', 'homing', 'Una sombra que se escurre por el suelo hasta el enemigo.', { cd: 0.45, dmg: 14, speed: 300, life: 1.8, size: 7, homing: 6 }),
  M('ominous-wind', 'Viento Aciago', 'ghost', 'vortex', 'Un viento maldito que arremolina a los enemigos y los va dañando.', { cd: 3, dmg: 9, radius: 74, dur: 2.6, pull: 140 }),
  // Dragón
  M('dragon-rage', 'Furia Dragón', 'dragon', 'beam', 'Llamarada dracónica en línea recta.', { cd: 1, dmg: 24, radius: 230, width: 34 }),
  M('dragon-dance', 'Danza Dragón', 'dragon', 'buff', 'No hace daño: acumula ATAQUE (físico) más rápido.', { cd: 0.7, stat: 'patk', amount: 0.11, dur: 7, stacks: 5 }),
  M('dragon-breath', 'Dragoaliento', 'dragon', 'cone', 'Un aliento de dragón en abanico corto que frena.', { cd: 0.7, dmg: 7, count: 7, arc: 0.95, speed: 330, life: 0.5, size: 7, slow: 0.25 }),
  M('dragon-claw', 'Garra Dragón', 'dragon', 'melee', 'Un zarpazo de dragón en arco.', { cd: 0.52, dmg: 19, radius: 52, arc: 2, knock: 70 }),
  M('outrage', 'Enfado', 'dragon', 'spin', 'Una furia de golpes en giro que no deja a nadie en pie.', { cd: 1.1, dmg: 12, count: 4, radius: 64 }),
  // Hada
  M('fairy-wind', 'Viento Feérico', 'fairy', 'nova', 'Brisa mágica en todas direcciones.', { cd: 1, dmg: 11, speed: 230, count: 10, pierce: 0, life: 1.2, size: 7 }),
  M('dazzling-gleam', 'Brillo Mágico', 'fairy', 'aura', 'Destello a tu alrededor.', { cd: 0.5, dmg: 9, radius: 72 }),
  M('draining-kiss', 'Beso Drenaje', 'fairy', 'homing', 'Un beso que persigue al enemigo y te cura un poco al darle.', { cd: 0.55, dmg: 13, speed: 280, life: 2, size: 7, homing: 5, drain: 1 }),
  M('play-rough', 'Carantoña', 'fairy', 'melee', 'Un ataque juguetón pero muy fuerte en arco.', { cd: 0.6, dmg: 22, radius: 50, arc: 2, knock: 60 }),
  M('disarming-voice', 'Voz Cautivadora', 'fairy', 'shove', 'Un grito encantador que daña y aparta a los que tienes cerca.', { cd: 1.15, dmg: 15, radius: 94, knock: 300 }),
  // Acero
  M('metal-claw', 'Garra Metal', 'steel', 'melee', 'Zarpazo de acero en arco.', { cd: 0.5, dmg: 15, radius: 50, arc: 1.6, knock: 60 }),
  M('flash-cannon', 'Foco Resplandor', 'steel', 'beam', 'Rayo de luz metálica que perfora.', { cd: 1.05, dmg: 23, radius: 220, width: 30 }),
  M('meteor-mash', 'Puño Meteoro', 'steel', 'meteor', 'Dos meteoros de acero que aplastan donde caen.', { cd: 1.4, dmg: 34, count: 2, radius: 54, knock: 80 }),
  M('mirror-shot', 'Disparo Espejo', 'steel', 'bounce', 'Un destello metálico que rebota entre los enemigos.', { cd: 0.64, dmg: 10, speed: 340, life: 1.6, size: 7, bounce: 3 }),
  M('gyro-ball', 'Giro Bola', 'steel', 'spin', 'Giras como una bola de acero golpeando todo alrededor.', { cd: 1.05, dmg: 12, count: 3, radius: 60 }),
  // Siniestro
  M('bite', 'Mordisco', 'dark', 'melee', 'Dentellada rápida que hace retroceder.', { cd: 0.45, dmg: 14, radius: 46, arc: 1.5, knock: 70 }),
  M('dark-pulse', 'Pulso Umbrío', 'dark', 'nova', 'Onda de energía oscura en todas direcciones.', { cd: 1.15, dmg: 14, speed: 240, count: 10, pierce: 1, life: 1.1, size: 8 }),
  M('night-shade', 'Tinieblas', 'dark', 'aura', 'Una sombra te rodea y consume lo cercano.', { cd: 0.5, dmg: 9, radius: 72 }),
  M('sucker-punch', 'Golpe Bajo', 'dark', 'homing', 'Un golpe a traición que busca al enemigo.', { cd: 0.7, dmg: 22, speed: 330, life: 1.6, size: 7, homing: 6 }),
  M('night-slash', 'Tajo Umbrío', 'dark', 'spin', 'Cortes en giro que alcanzan a todo lo que te rodea.', { cd: 1, dmg: 11, count: 3, radius: 62 }),
];

// Cuerpo a cuerpo: +20 % de daño y +25 % de alcance y arco (arriesgan más).
for (const m of RAW) {
  if (m.kind !== 'melee') continue;
  m.dmg = Math.round(m.dmg! * 1.2);
  m.radius = Math.round(m.radius! * 1.25);
  if (m.arc) m.arc = Math.min(3, +(m.arc * 1.25).toFixed(2));
}
for (const m of RAW) {
  if (m.kind !== 'projectile' && m.kind !== 'homing' && m.kind !== 'bounce') continue;
  m.count ??= 1;
  m.spread ??= 0.12;
}

/** Movimientos físicos (pegan con el Ataque); el resto que hace daño, especiales. */
const PHYSICAL = new Set([
  'tackle', 'quick-attack', 'vine-whip', 'razor-leaf', 'wing-attack', 'body-slam', 'poison-sting', 'bulldoze',
  'bug-bite', 'string-shot', 'rock-throw', 'rock-slide', 'karate-chop', 'lick', 'metal-claw', 'bite', 'bonemerang',
  'psycho-cut', 'spikes', 'toxic-spikes', 'meteor-mash', 'substitute', 'aerial-ace', 'flame-wheel', 'rapid-spin',
  'flame-charge', 'seed-bomb', 'sand-tomb', 'magnitude', 'u-turn', 'rock-tomb', 'ice-shard', 'rolling-kick',
  'dynamic-punch', 'shadow-sneak', 'dragon-claw', 'outrage', 'play-rough', 'gyro-ball', 'sucker-punch', 'night-slash',
]);

export type MoveCategory = 'physical' | 'special' | null;
export const categoryOf = (m: MoveDef): MoveCategory => (m.kind === 'buff' ? null : PHYSICAL.has(m.id) ? 'physical' : 'special');

export const MOVES: Record<string, MoveDef> = Object.fromEntries(RAW.map((m) => [m.id, m]));
export const ALL_MOVES = RAW;
export const ladderOf = (m: MoveDef) => LADDERS[m.kind];
export const maxLevelOf = (m: MoveDef) => LADDERS[m.kind].length + 1;

export function getMove(id: string): MoveDef {
  const m = MOVES[id];
  if (!m) throw new Error(`Movimiento desconocido: ${id}`);
  return m;
}

const POOL: Partial<Record<ElementType, string[]>> = {};
for (const m of RAW) (POOL[m.type] ??= []).push(m.id);

/** Movimientos que puede aprender un Pokémon: los de sus tipos + los normales. */
export function poolFor(types: ElementType[]): string[] {
  const ids = new Set(POOL.normal);
  for (const t of types) for (const id of POOL[t] ?? []) ids.add(id);
  return [...ids];
}

const START: Partial<Record<ElementType, string>> = {
  fire: 'ember', water: 'water-gun', grass: 'vine-whip', electric: 'thunder-shock', psychic: 'confusion',
  poison: 'sludge', ground: 'mud-shot', flying: 'gust', bug: 'bug-bite', rock: 'rock-throw', ice: 'ice-beam',
  fighting: 'karate-chop', ghost: 'shadow-ball', dragon: 'dragon-rage', fairy: 'fairy-wind', steel: 'metal-claw',
  dark: 'bite', normal: 'tackle',
};

/** Movimiento inicial según el tipo principal. PROVISIONAL. */
export function startFor(types: ElementType[]): string {
  for (const t of types) if (START[t]) return START[t]!;
  return 'tackle';
}

const MULT: (keyof MoveNums)[] = ['dmg', 'cd', 'speed', 'radius', 'dur', 'amount', 'arc', 'width', 'spread', 'life', 'size', 'rate', 'pull', 'knock', 'stun', 'charge'];
const ADD: (keyof MoveNums)[] = ['count', 'pierce', 'stacks', 'bounce'];

export function applyMods(s: MoveNums, mods: MoveMods): void {
  for (const [k, v] of Object.entries(mods) as [keyof MoveNums, number][]) {
    if (MULT.includes(k)) {
      if (s[k] != null) s[k] = (s[k] as number) * v;
    } else if (ADD.includes(k)) {
      s[k] = ((s[k] as number) ?? 0) + v;
    } else {
      s[k] = v;
    }
  }
}

// ---------------- evolución de movimientos ----------------
// Un movimiento al nivel máximo evoluciona si en la partida se ha cogido su
// mejora de estadística asociada: sale una carta dorada.

export type NeedStat = 'hp' | 'atk' | 'spd' | 'cd' | 'def' | 'rgn' | 'mag' | 'xp';

const EVO: Record<string, [string, NeedStat]> = {
  'tackle': ['Derribo', 'hp'], 'quick-attack': ['Velocidad Extrema', 'spd'], 'body-slam': ['Gigaimpacto', 'atk'],
  'hyper-voice': ['Alboroto', 'cd'], 'ember': ['Llamarada', 'atk'], 'flamethrower': ['Sofoco', 'cd'],
  'fire-spin': ['Fuego Sagrado', 'rgn'], 'heat-wave': ['Erupción', 'hp'], 'water-gun': ['Escaldar', 'atk'],
  'bubble': ['Surf', 'spd'], 'hydro-pump': ['Hidrocañón', 'atk'], 'vine-whip': ['Latigazo', 'atk'],
  'razor-leaf': ['Lluevehojas', 'cd'], 'leaf-storm': ['Danza Pétalo', 'rgn'], 'giga-drain': ['Planta Feroz', 'hp'],
  'thunder-shock': ['Trueno', 'atk'], 'discharge': ['Campo Eléctrico', 'def'], 'thunderbolt': ['Electrocañón', 'cd'],
  'confusion': ['Psicocarga', 'cd'], 'psybeam': ['Premonición', 'atk'], 'psychic': ['Vasta Fuerza', 'mag'],
  'sludge': ['Bomba Lodo', 'atk'], 'poison-sting': ['Puya Nociva', 'spd'], 'toxic': ['Gas Venenoso', 'rgn'],
  'mud-shot': ['Tierra Viva', 'atk'], 'bulldoze': ['Terremoto', 'atk'], 'gust': ['Vendaval', 'spd'],
  'wing-attack': ['Pájaro Osado', 'atk'], 'bug-bite': ['Tijera X', 'atk'], 'string-shot': ['Red Viscosa', 'cd'],
  'bug-buzz': ['Enjambre', 'rgn'], 'rock-throw': ['Roca Afilada', 'atk'], 'rock-slide': ['Trampa Rocas', 'cd'],
  'ice-beam': ['Ventisca', 'atk'], 'powder-snow': ['Viento Hielo', 'spd'], 'karate-chop': ['A Bocajarro', 'atk'],
  'aura-sphere': ['Onda Certera', 'cd'], 'lick': ['Puño Sombra', 'atk'], 'shadow-ball': ['Golpe Fantasma', 'cd'],
  'dragon-rage': ['Cometa Draco', 'atk'], 'fairy-wind': ['Fuerza Lunar', 'atk'], 'dazzling-gleam': ['Campo de Niebla', 'rgn'],
  'metal-claw': ['Cabeza de Hierro', 'atk'], 'flash-cannon': ['Rayo Metálico', 'def'], 'bite': ['Triturar', 'atk'],
  'dark-pulse': ['Alarido', 'spd'], 'night-shade': ['Pesadilla', 'rgn'], 'bonemerang': ['Ataque Óseo', 'atk'],
  'psycho-cut': ['Psicocolmillo', 'cd'], 'spikes': ['Fisura', 'atk'], 'toxic-spikes': ['Lanza Mugre', 'rgn'],
  'hail': ['Alud', 'cd'], 'meteor-mash': ['Bomba Imán', 'atk'], 'will-o-wisp': ['Infierno', 'cd'],
  'substitute': ['Doble Equipo', 'def'], 'aerial-ace': ['Acróbata', 'spd'], 'flame-wheel': ['Envite Ígneo', 'spd'],
  'bubble-beam': ['Acua Cola', 'atk'], 'hex': ['Poltergeist', 'mag'], 'hyper-beam': ['Rayo Prisma', 'atk'],
  'rapid-spin': ['Triataque', 'spd'], 'flame-charge': ['Golpe Calor', 'spd'], 'whirlpool': ['Salmuera', 'rgn'],
  'seed-bomb': ['Mazazo', 'atk'], 'energy-ball': ['Gigadrenado', 'rgn'], 'solar-beam': ['Cuchilla Solar', 'cd'],
  'thunder-wave': ['Voltio Cruel', 'atk'], 'electro-ball': ['Chispa', 'spd'], 'extrasensory': ['Psicoonda', 'def'],
  'mist-ball': ['Resplandor', 'cd'], 'acid-spray': ['Onda Tóxica', 'rgn'], 'sand-tomb': ['Fuerza Equina', 'hp'],
  'magnitude': ['Taladradora', 'atk'], 'whirlwind': ['Huracán', 'spd'], 'air-slash': ['Ataque Aéreo', 'cd'],
  'signal-beam': ['Megacuerno', 'atk'], 'u-turn': ['Sanguijuela', 'rgn'], 'rock-tomb': ['Testarazo', 'hp'],
  'ancient-power': ['Tormenta de Diamantes', 'def'], 'power-gem': ['Rayo Meteórico', 'atk'], 'ice-shard': ['Carámbano', 'cd'],
  'freeze-dry': ['Frío Polar', 'atk'], 'rolling-kick': ['Patada Salto Alta', 'spd'], 'vacuum-wave': ['Puño Incremento', 'def'],
  'dynamic-punch': ['Megapuño', 'atk'], 'shadow-sneak': ['Garra Umbría', 'cd'], 'ominous-wind': ['Golpe Umbrío', 'mag'],
  'dragon-breath': ['Pulso Dragón', 'atk'], 'dragon-claw': ['Carga Dragón', 'atk'], 'outrage': ['Dracoflecha', 'hp'],
  'draining-kiss': ['Luz Lunar', 'rgn'], 'play-rough': ['Choque Anímico', 'atk'], 'disarming-voice': ['Encanto', 'def'],
  'mirror-shot': ['Metaláser', 'atk'], 'gyro-ball': ['Cuerpo Pesado', 'def'], 'sucker-punch': ['Juego Sucio', 'atk'],
  'night-slash': ['Lariat Oscuro', 'spd'],
};

const EVO_MODS: Partial<Record<MoveKind, LadderStep>> = {
  projectile: { t: '×1,8 daño, +2 proyectiles, +2 perforación y más grandes', m: { dmg: 1.8, count: 2, pierce: 2, size: 1.3, spread: 1.1 } },
  melee: { t: '×1,9 daño, más alcance y golpea en 360°', m: { dmg: 1.9, radius: 1.3, arc: 9 } },
  beam: { t: '×1,8 daño, rayo un 50% más grueso y más largo', m: { dmg: 1.8, width: 1.5, radius: 1.2, cd: 0.85 } },
  orbit: { t: '+2 orbes, ×1,7 daño y más radio', m: { count: 2, dmg: 1.7, radius: 1.15 } },
  nova: { t: '+6 proyectiles, ×1,6 daño y +1 perforación', m: { count: 6, dmg: 1.6, pierce: 1 } },
  aura: { t: '×1,8 daño y un 35% más de radio', m: { dmg: 1.8, radius: 1.35 } },
  boomerang: { t: '×1,8 daño, +1 bumerán y más alcance', m: { dmg: 1.8, count: 1, radius: 1.2, size: 1.2 } },
  chain: { t: '×1,7 daño y +3 saltos', m: { dmg: 1.7, count: 3, radius: 1.2 } },
  mine: { t: '×1,8 daño, +2 minas y explosión más grande', m: { dmg: 1.8, count: 2, radius: 1.25 } },
  meteor: { t: '×1,7 daño, +2 meteoros y más radio', m: { dmg: 1.7, count: 2, radius: 1.2 } },
  turret: { t: '×1,8 daño, +1 a la vez y dispara más rápido', m: { dmg: 1.8, count: 1, rate: 0.8 } },
  dash: { t: '×1,9 daño, más distancia y menos recarga', m: { dmg: 1.9, radius: 1.25, cd: 0.8 } },
  trail: { t: '×1,8 daño, charcos más grandes y duraderos', m: { dmg: 1.8, radius: 1.25, dur: 1.3 } },
  cone: { t: '×1,7 daño, +4 disparos y +1 perforación', m: { dmg: 1.7, count: 4, pierce: 1 } },
  homing: { t: '×1,8 daño, +2 proyectiles y más grandes', m: { dmg: 1.8, count: 2, size: 1.3, spread: 1.2 } },
  bounce: { t: '×1,8 daño, +2 rebotes y +1 proyectil', m: { dmg: 1.8, bounce: 2, count: 1, spread: 1.3 } },
  charge: { t: '×1,8 daño, rayo un 50% más grueso y carga más rápido', m: { dmg: 1.8, width: 1.5, charge: 0.7 } },
  spin: { t: '×1,8 daño, +1 vuelta y más radio', m: { dmg: 1.8, count: 1, radius: 1.2 } },
  quake: { t: '×1,8 daño, +3 ondas y ondas más grandes', m: { dmg: 1.8, count: 3, radius: 1.25 } },
  vortex: { t: '×1,8 daño, más radio y atrae más fuerte', m: { dmg: 1.8, radius: 1.3, pull: 1.4 } },
  shove: { t: '×1,8 daño, más radio y empuja más', m: { dmg: 1.8, radius: 1.25, knock: 1.4 } },
  stun: { t: '×1,8 daño, más radio y aturde más rato', m: { dmg: 1.8, radius: 1.3, stun: 1.4 } },
};

export interface MoveEvolution { name: string; needs: NeedStat; text: string }

export function evolutionOf(id: string): MoveEvolution | null {
  const e = EVO[id];
  const def = MOVES[id];
  if (!e || !def || !EVO_MODS[def.kind]) return null;
  return { name: e[0], needs: e[1], text: EVO_MODS[def.kind]!.t };
}

// ---------------- instancia de un movimiento en una partida ----------------

const SPATIAL: (keyof MoveNums)[] = ['radius', 'width', 'size', 'range', 'knock', 'pull'];

/** Estadísticas efectivas de un movimiento en Pokécero (nivel, evolución y escala de la arena). */
export function moveStats(def: MoveDef, level: number, evolved = false): MoveNums {
  const s: MoveNums = { ...def };
  const ladder = LADDERS[def.kind];
  for (let i = 0; i < level - 1 && i < ladder.length; i++) applyMods(s, ladder[i].m);
  if (evolved && EVO_MODS[def.kind]) applyMods(s, EVO_MODS[def.kind]!.m);
  const k = BALANCE.ps.space;
  for (const key of SPATIAL) if (s[key] != null) s[key] = (s[key] as number) * k;
  // En orbe `speed` es velocidad angular: no se escala.
  if (s.speed != null && def.kind !== 'orbit') s.speed *= BALANCE.ps.projectileSpeed;
  if (s.dmg != null) s.dmg *= BALANCE.ps.damage;
  return s;
}
