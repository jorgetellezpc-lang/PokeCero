import { BALANCE } from '../../config/balance';
import { getSpecies, obtainablePokemon } from '../../data/pokemon';
import { Rng } from '../../game/rng';
import { pull, RARITY_COLOR, RARITY_NAME, type PullResult } from '../../meta/gacha';
import { iconDataUrl } from '../../render/sprites';
import { animatedPokemon } from '../anim';
import { h, img, pokeImg, toast } from '../dom';
import type { MenuScreen } from './menu';

// Pestaña Gachapón: máquina con los iniciales alrededor, probabilidades,
// tiradas ×1 y ×10 y el resultado de la última tirada.

const rng = new Rng();
let lastResults: PullResult[] = [];

const MASCOTS = ['bulbasaur', 'charmander', 'squirtle', 'pikachu'];

/** Máquina de cápsulas (dibujada con CSS). */
function machine(): HTMLElement {
  const caps = ['#ff5a5a', '#4aa8ff', '#ffd23a', '#5fe08a', '#c47bff', '#ff9a3a', '#ffffff', '#ff5a5a', '#4aa8ff'];
  return h('div', { class: 'gm' },
    h('div', { class: 'gm-dome' }, ...caps.map((c, i) => h('span', { class: `cap c${i}`, style: `--cap:${c}` })), h('span', { class: 'gm-shine' })),
    h('div', { class: 'gm-body' }, h('span', { class: 'gm-ball' }), h('span', { class: 'gm-knob' }), h('span', { class: 'gm-out' })),
  );
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

  const results = lastResults.length
    ? h('section', { class: 'panel gacha-results-panel' },
      h('h3', { class: 'panel-title' }, lastResults.length > 1 ? 'Tus 10 tiradas' : 'Tu tirada'),
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

  const all = obtainablePokemon();
  const rows = [5, 4, 3, 2, 1].map((rar) => {
    const list = all.filter((p) => p.rarity === rar);
    const owned = list.filter((p) => d.unlockedPokemon.includes(p.id)).length;
    const rate = BALANCE.gacha.rates.find(([r]) => r === rar)?.[1] ?? 0;
    return h('div', { class: 'rarity-row', style: `--rar:${RARITY_COLOR[rar]}` },
      h('span', { class: 'rarity-name' }, RARITY_NAME[rar]),
      h('span', { class: 'rarity-owned' }, `${owned}/${list.length}`),
      h('b', {}, `${rate}%`),
    );
  });

  return h('div', { class: 'tab tab-gacha' },
    h('div', { class: 'gacha-stage' },
      h('div', { class: 'gacha-title' }, 'Gachapón de Kanto',
        h('button', { class: 'help-btn', 'aria-label': 'Cómo funciona', onclick: () => toast(`La ×10 garantiza una Épica · Legendaria segura a las ${BALANCE.gacha.pity} tiradas (llevas ${d.pity})`) }, '?')),
      h('div', { class: 'rays' }),
      ...MASCOTS.map((id, i) => h('span', { class: `mascot m${i}` }, animatedPokemon(getSpecies(id).dex, 84, { dir: i % 2 ? 7 : 1 }))),
      machine(),
    ),
    results,
    h('section', { class: 'panel rarity-panel' }, ...rows,
      h('div', { class: 'note' }, `Repetidos: se convierten en oro. Tickets: salas 20, 40 y 50 de cada gimnasio (una vez) y, a veces, los enemigos.`)),
    h('div', { class: 'gacha-buttons' },
      h('button', { class: `cta blue ${d.tickets >= 1 ? '' : 'disabled'}`, 'data-testid': 'gacha-pull', onclick: () => doPull(1) },
        h('span', { class: 'cta-main' }, 'Tirar ×1'), h('span', { class: 'cta-sub price' }, img(iconDataUrl('ticket', 2), 'res-icon'), '1')),
      h('button', { class: `cta ${d.tickets >= 10 ? '' : 'disabled'}`, 'data-testid': 'gacha-pull10', onclick: () => doPull(10) },
        h('span', { class: 'cta-main' }, 'Tirar ×10'), h('span', { class: 'cta-sub price' }, img(iconDataUrl('ticket', 2), 'res-icon'), '10')),
    ),
  );
}
