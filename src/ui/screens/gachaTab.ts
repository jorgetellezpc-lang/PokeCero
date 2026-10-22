import { BALANCE } from '../../config/balance';
import { obtainablePokemon, type PokemonSpecies } from '../../data/pokemon';
import { Rng } from '../../game/rng';
import { pull, RARITY_COLOR, RARITY_NAME, type PullResult } from '../../meta/gacha';
import { animatedPokemon } from '../anim';
import { h, pokeImg, toast } from '../dom';
import { icon } from '../icons';
import { uiImg, type MenuScreen } from './menu';

// Pestaña Gachapón: ilustración del diseño, probabilidades con un Pokémon
// destacado por rareza, tiradas ×1 y ×10 y tus tickets.

const rng = new Rng();
let lastResults: PullResult[] = [];

/** Pokémon destacado de cada rareza: el más fuerte de esa rareza. */
function featured(list: PokemonSpecies[]): PokemonSpecies | undefined {
  return [...list].sort((a, b) => b.bst - a.bst)[0];
}

export function renderGachaTab(menu: MenuScreen): HTMLElement {
  const store = menu.app.store;
  const d = store.data;

  const doPull = (n: 1 | 10) => {
    const r = pull(store, rng, n);
    if (!r) {
      toast('Tickets insuficientes');
      return;
    }
    lastResults = r;
    menu.app.audio?.sfx(r.some((x) => x.rarity >= 4) ? 'legend' : 'level');
    menu.render();
  };

  const all = obtainablePokemon();
  const tiles = [1, 2, 3, 4, 5].map((rar) => {
    const list = all.filter((p) => p.rarity === rar);
    const rate = BALANCE.gacha.rates.find(([r]) => r === rar)?.[1] ?? 0;
    const f = featured(list);
    const owned = list.filter((p) => d.unlockedPokemon.includes(p.id)).length;
    return h('div', { class: `rar-tile r${rar}`, style: `--rar:${RARITY_COLOR[rar]}`, title: `${owned}/${list.length} obtenidos` },
      h('b', {}, RARITY_NAME[rar]), h('span', {}, `${rate}%`),
      h('span', { class: 'rar-mon' }, f ? pokeImg(f.dex, 52) : null),
    );
  });

  const results = lastResults.length
    ? h('section', { class: 'panel2 gacha-results-panel' },
      h('h3', { class: 'panel2-title' }, lastResults.length > 1 ? 'Tus 10 tiradas' : 'Tu tirada'),
      h('div', { class: `gacha-results ${lastResults.length > 1 ? 'multi' : ''}`, 'data-testid': 'gacha-result' },
        ...lastResults.map((r, i) => h('div', { class: `gacha-card r${r.rarity}`, style: `--rar:${RARITY_COLOR[r.rarity]};--i:${i}` },
          lastResults.length > 1 ? pokeImg(r.species.dex, 48, 'gacha-sprite') : animatedPokemon(r.species.dex, 110, { cls: 'gacha-sprite' }),
          h('b', {}, r.species.name),
          h('span', { class: 'rarity-tag' }, RARITY_NAME[r.rarity]),
          h('span', { class: 'gacha-new' }, r.isNew ? '¡Nuevo!' : `+${r.refund} oro`),
        ))),
      h('button', { class: 'link-btn', onclick: () => { lastResults = []; menu.render(); } }, 'Cerrar'),
    )
    : null;

  const balls = (n: number) => h('span', { class: 'balls' }, ...Array.from({ length: n }, () => icon('pokeball', 40)));

  return h('div', { class: 'tab tab-gacha2' },
    h('div', { class: 'gacha-head' },
      icon('pokeball', 46),
      h('h2', {}, 'Gachapón'),
      h('button', { class: 'see-rewards', onclick: () => openPool(menu) }, icon('guide', 20), 'Ver recompensas'),
    ),
    h('p', { class: 'gacha-sub' }, '¡Consigue nuevos Pokémon para tu equipo!'),
    h('div', { class: 'gacha-art' }, h('img', { src: 'ui/gacha.webp', alt: '', draggable: 'false' })),
    results,
    h('section', { class: 'panel2 odds' },
      h('div', { class: 'odds-head' }, h('h3', { class: 'panel2-title' }, 'Probabilidades'), h('small', {}, 'Pokémon destacados')),
      h('div', { class: 'rar-tiles' }, ...tiles),
      h('div', { class: 'pull-row' },
        h('button', { class: `pull-btn blue ${d.tickets >= 1 ? '' : 'disabled'}`, 'data-testid': 'gacha-pull', onclick: () => doPull(1) },
          h('span', { class: 'pull-top' }, balls(1), '×1'), h('span', { class: 'pull-cost' }, uiImg('i-ticket'), '1')),
        h('button', { class: `pull-btn gold ${d.tickets >= 10 ? '' : 'disabled'}`, 'data-testid': 'gacha-pull10', onclick: () => doPull(10) },
          h('span', { class: 'pull-top' }, balls(3), '×10'), h('span', { class: 'pull-cost' }, uiImg('i-ticket'), '10')),
      ),
    ),
    h('section', { class: 'panel2 ticket-row' },
      uiImg('i-ticket', 'ticket-big'),
      h('div', {}, h('b', {}, 'Tickets de gachapón'), h('div', { class: 'ticket-num' }, String(d.tickets)),
        h('small', {}, 'Se consiguen en las salas 20, 40 y 50 de cada gimnasio (una vez) y, a veces, de los enemigos.')),
    ),
  );
}

/** Lista de todo lo que puede salir, por rareza, con lo que ya tienes. */
function openPool(menu: MenuScreen): void {
  const d = menu.app.store.data;
  const close = () => overlay.remove();
  const all = obtainablePokemon();
  const blocks = [5, 4, 3, 2, 1].map((rar) => {
    const list = all.filter((p) => p.rarity === rar);
    return h('div', { class: 'tier-block' },
      h('b', { style: `color:${RARITY_COLOR[rar]}` }, `${RARITY_NAME[rar]} · ${list.filter((p) => d.unlockedPokemon.includes(p.id)).length}/${list.length}`),
      h('div', { class: 'tier-grid' }, ...list.map((p) => h('span', { class: 'enemy-slot', title: p.name }, pokeImg(p.dex, 40, '', !d.unlockedPokemon.includes(p.id))))),
    );
  });
  const overlay = h('div', { class: 'modal-backdrop', onclick: (e: Event) => { if (e.target === overlay) close(); } },
    h('div', { class: 'modal' },
      h('h2', { class: 'modal-title' }, 'Recompensas del gachapón'),
      h('p', { class: 'modal-text' }, `La tirada ×10 garantiza al menos una Épica. Si llevas ${BALANCE.gacha.pity} tiradas sin Legendaria, la siguiente lo es (llevas ${d.pity}). Los repetidos se convierten en oro.`),
      ...blocks,
      h('button', { class: 'cta small', onclick: close }, h('span', { class: 'cta-main' }, 'Cerrar')),
    ),
  );
  document.body.appendChild(overlay);
}
