import { h } from '../dom';
import { icon } from '../icons';
import { uiImg, type MenuScreen } from './menu';

// Pestaña Gachapón. Ya no reparte Pokémon: los 4 personajes elegibles están
// disponibles desde el principio (data/pokemon.ts, PLAYABLE_POKEMON). La
// pestaña sigue visible con tus tickets hasta decidir qué premiará; el sorteo
// antiguo (meta/gacha.ts) queda sin usar.

export function renderGachaTab(menu: MenuScreen): HTMLElement {
  const d = menu.app.store.data;
  return h('div', { class: 'tab tab-gacha2' },
    h('div', { class: 'gacha-head' }, icon('pokeball', 46), h('h2', {}, 'Gachapón')),
    h('p', { class: 'gacha-sub' }, 'Próximamente'),
    h('div', { class: 'gacha-art' }, h('img', { src: 'ui/gacha.webp', alt: '', draggable: 'false' })),
    h('section', { class: 'panel2', 'data-testid': 'gacha-soon' },
      h('h3', { class: 'panel2-title' }, 'En preparación'),
      h('p', { class: 'note' }, 'El gachapón ya no da Pokémon: Bulbasaur, Charmander, Squirtle y Pikachu se eligen desde el principio en la pestaña Pokémon. Guarda tus tickets: pronto podrás canjearlos aquí por recompensas.'),
    ),
    h('section', { class: 'panel2 ticket-row' },
      uiImg('i-ticket', 'ticket-big'),
      h('div', {}, h('b', {}, 'Tickets de gachapón'), h('div', { class: 'ticket-num' }, String(d.tickets)),
        h('small', {}, 'Se consiguen en las salas 20, 40 y 50 de cada gimnasio (una vez) y, a veces, de los enemigos.')),
    ),
  );
}
