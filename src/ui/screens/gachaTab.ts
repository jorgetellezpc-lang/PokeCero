import { BALANCE } from '../../config/balance';
import { obtainablePokemon } from '../../data/pokemon';
import { pull, type GachaResult } from '../../meta/gacha';
import { Rng } from '../../game/rng';
import { iconDataUrl, spriteDataUrl } from '../../render/sprites';
import { h, img, toast } from '../dom';
import type { MenuScreen } from './menu';

const rng = new Rng();
let lastResult: GachaResult | null = null;

export function renderGachaTab(menu: MenuScreen): HTMLElement {
  const store = menu.app.store;
  const d = store.data;
  const cost = BALANCE.gacha.cost;
  const can = d.tickets >= cost;

  let result: HTMLElement | null = null;
  if (lastResult && lastResult.ok) {
    const r = lastResult;
    result = h('div', { class: 'gacha-result', 'data-testid': 'gacha-result' },
      img(spriteDataUrl(r.species.sprite, 'normal', 6), 'gacha-sprite'),
      h('b', {}, r.duplicate ? `${r.species.name} (repetido)` : `¡${r.species.name}!`),
      h('div', { class: 'note' }, r.duplicate ? `Ya lo tenías: +${r.goldGiven} de oro` : 'Nuevo Pokémon desbloqueado'),
    );
  }

  const pool = obtainablePokemon().map((p) => {
    const owned = d.unlockedPokemon.includes(p.id);
    return h('div', { class: `pool-item ${owned ? 'owned' : ''}` },
      img(spriteDataUrl(p.sprite, owned ? 'normal' : 'shadow', 3), 'pool-sprite'),
      h('span', {}, owned ? p.name : '???'),
      h('span', { class: `rarity ${p.rarity}` }, p.rarity === 'rare' ? 'Raro' : 'Común'),
    );
  });

  return h('div', { class: 'tab tab-gacha' },
    h('h2', { class: 'section-title' }, 'Gachapón'),
    h('div', { class: 'gacha-machine' }, img(iconDataUrl('gacha', 8), 'machine')),
    result,
    h('button', {
      class: `btn btn-play ${can ? '' : 'disabled'}`,
      'data-testid': 'gacha-pull',
      onclick: () => {
        const r = pull(store, rng);
        if (!r.ok) {
          toast('Tickets insuficientes');
          return;
        }
        lastResult = r;
        menu.render();
      },
    }, 'Tirar ', h('span', { class: 'price' }, img(iconDataUrl('ticket', 2), 'res-icon'), String(cost))),
    h('p', { class: 'note' }, `Los tickets se consiguen en las salas 20, 40 y 50 de cada gimnasio (una sola vez). Probabilidades provisionales: común ${BALANCE.gacha.rarityWeights.common}%, raro ${BALANCE.gacha.rarityWeights.rare}%. Si sale repetido recibes ${BALANCE.gacha.duplicateGold} de oro.`),
    h('div', { class: 'pool' }, ...pool),
  );
}
