import { BALANCE } from '../../config/balance';
import { obtainablePokemon } from '../../data/pokemon';
import { Rng } from '../../game/rng';
import { pull, RARITY_COLOR, RARITY_NAME, type PullResult } from '../../meta/gacha';
import { iconDataUrl } from '../../render/sprites';
import { h, img, pokeImg, toast } from '../dom';
import type { MenuScreen } from './menu';

const rng = new Rng();
let lastResults: PullResult[] = [];

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
    ? h('div', { class: `gacha-results ${lastResults.length > 1 ? 'multi' : ''}`, 'data-testid': 'gacha-result' },
      ...lastResults.map((r) => h('div', { class: 'gacha-card', style: `--rar:${RARITY_COLOR[r.rarity]}` },
        pokeImg(r.species.dex, lastResults.length > 1 ? 48 : 96, 'gacha-sprite'),
        h('b', {}, r.species.name),
        h('span', { class: 'rarity-tag' }, RARITY_NAME[r.rarity]),
        h('span', { class: 'note' }, r.isNew ? '¡Nuevo!' : `Repetido: +${r.refund} oro`),
      )))
    : null;

  const all = obtainablePokemon();
  const byRarity = [5, 4, 3, 2, 1].map((rar) => {
    const list = all.filter((p) => p.rarity === rar);
    const owned = list.filter((p) => d.unlockedPokemon.includes(p.id)).length;
    const rate = BALANCE.gacha.rates.find(([r]) => r === rar)?.[1] ?? 0;
    return h('div', { class: 'rarity-row', style: `--rar:${RARITY_COLOR[rar]}` },
      h('span', { class: 'rarity-tag' }, RARITY_NAME[rar]),
      h('span', {}, `${rate}%`),
      h('span', { class: 'note' }, `${owned}/${list.length}`),
    );
  });

  return h('div', { class: 'tab tab-gacha' },
    h('h2', { class: 'section-title' }, 'Gachapón de Kanto'),
    h('div', { class: 'gacha-machine' }, img(iconDataUrl('gacha', 8), 'machine')),
    results,
    h('div', { class: 'gacha-buttons' },
      h('button', { class: `btn btn-play ${d.tickets >= 1 ? '' : 'disabled'}`, 'data-testid': 'gacha-pull', onclick: () => doPull(1) },
        'Tirar ×1 ', h('span', { class: 'price' }, img(iconDataUrl('ticket', 2), 'res-icon'), '1')),
      h('button', { class: `btn btn-play ${d.tickets >= 10 ? '' : 'disabled'}`, 'data-testid': 'gacha-pull10', onclick: () => doPull(10) },
        'Tirar ×10 ', h('span', { class: 'price' }, img(iconDataUrl('ticket', 2), 'res-icon'), '10')),
    ),
    h('p', { class: 'note' }, `La ×10 garantiza al menos una Épica. A las ${BALANCE.gacha.pity} tiradas sin Legendaria, la siguiente lo es (llevas ${d.pity}). Los repetidos dan oro. Tickets: salas 20, 40 y 50 de cada gimnasio (una vez) y, a veces, los enemigos.`),
    h('div', { class: 'rarity-table' }, ...byRarity),
  );
}
