// Objetos equipables (uno por partida), de PokéSurvivor (js/data/items.js).
// Required Notice: Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)
// Los sueltan los minibosses y jefes y, a veces, los enemigos normales. Solo
// se lleva uno; al encontrar otro se elige con cuál quedarse.

export type ItemId =
  | 'leftovers' | 'choiceband' | 'quickclaw' | 'focussash' | 'shellbell' | 'amuletcoin'
  | 'luckyegg' | 'lifeorb' | 'choicescarf' | 'rockyhelmet' | 'assaultvest';

export interface ItemDef {
  id: ItemId;
  name: string;
  desc: string;
  /** Modificadores que aplica mientras se lleva. */
  mods?: { atk?: number; cd?: number; xp?: number; spd?: number; coins?: number; def?: number; regenPct?: number };
}

export const ITEMS: Record<ItemId, ItemDef> = {
  leftovers: { id: 'leftovers', name: 'Restos', desc: 'Recuperas un 1,5% de tu vida por segundo.', mods: { regenPct: 0.015 } },
  // En Pokécero todos los ataques actúan a la vez: la Cinta no tiene contrapartida de "no cambiar de movimiento".
  choiceband: { id: 'choiceband', name: 'Cinta Elección', desc: '+40% de daño, pero -15% de velocidad.', mods: { atk: 1.4, spd: 0.85 } },
  quickclaw: { id: 'quickclaw', name: 'Garra Rápida', desc: '-20% de recarga en todos tus movimientos.', mods: { cd: 0.8 } },
  focussash: { id: 'focussash', name: 'Banda Focus', desc: 'Un golpe que te dejaría KO te deja con 1 de vida (cada 60 s).' },
  shellbell: { id: 'shellbell', name: 'Cascabel Concha', desc: 'Recuperas vida con el daño que haces.' },
  amuletcoin: { id: 'amuletcoin', name: 'Moneda Amuleto', desc: '+50% de oro al acabar la partida.', mods: { coins: 1.5 } },
  luckyegg: { id: 'luckyegg', name: 'Huevo Suerte', desc: '+30% de experiencia.', mods: { xp: 1.3 } },
  lifeorb: { id: 'lifeorb', name: 'Vidasfera', desc: '+30% de daño, pero cada golpe que das te quita un poco de vida.', mods: { atk: 1.3 } },
  choicescarf: { id: 'choicescarf', name: 'Pañuelo Elección', desc: '+35% de velocidad.', mods: { spd: 1.35 } },
  rockyhelmet: { id: 'rockyhelmet', name: 'Casco Dentado', desc: 'Los que te golpean cuerpo a cuerpo reciben daño.' },
  assaultvest: { id: 'assaultvest', name: 'Chaleco Asalto', desc: '+20% de reducción de daño recibido.', mods: { def: 0.2 } },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
