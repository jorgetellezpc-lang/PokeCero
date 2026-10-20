import { PERMANENT_UPGRADES, permanentUpgradeCost } from '../../config/balance';
import { getAttack } from '../../data/attacks';
import { POKEMON, getSpecies, obtainablePokemon } from '../../data/pokemon';
import { iconDataUrl, spriteDataUrl } from '../../render/sprites';
import { buyUpgrade, canBuy, permanentBonuses, upgradeLevel } from '../../meta/shop';
import { h, img, toast, typeChip } from '../dom';
import type { MenuScreen } from './menu';

const STAT_ICON: Record<string, string> = { hp: '♥', power: '⚔', defense: '⛨', speed: '➤' };

export function renderPokemonTab(menu: MenuScreen): HTMLElement {
  const store = menu.app.store;
  const d = store.data;
  const sp = getSpecies(d.selectedPokemon);
  const bonus = permanentBonuses(store);

  const hero = h('button', { class: 'hero-card', 'data-testid': 'select-pokemon', onclick: () => openSelector(menu) },
    h('div', { class: 'hero-platform' }, img(spriteDataUrl(sp.sprite, 'normal', 8), 'hero-sprite')),
    h('div', { class: 'hero-info' },
      h('div', { class: 'hero-name' }, sp.name),
      h('div', { class: 'chips' }, ...sp.types.map(typeChip)),
      h('div', { class: 'hero-stats' },
        statLine('Vida', Math.round(sp.stats.hp * (1 + bonus.hp))),
        statLine('Poder', `x${(sp.stats.power * (1 + bonus.power)).toFixed(2)}`),
        statLine('Defensa', `${Math.round((sp.stats.defense + bonus.defense) * 100)}%`),
        statLine('Velocidad', Math.round(sp.stats.speed * (1 + bonus.speed))),
      ),
      h('div', { class: 'hero-attack' }, `Ataque inicial: ${getAttack(sp.startingAttack).name}`),
      sp.evolution ? h('div', { class: 'hero-attack' }, `Evoluciona a ${getSpecies(sp.evolution.to).name} en Nv ${sp.evolution.level} (en partida)`) : null,
      h('div', { class: 'hint' }, 'Toca para cambiar de Pokémon'),
    ),
  );

  const rows = PERMANENT_UPGRADES.map((u) => {
    const lv = upgradeLevel(store, u.id);
    const state = canBuy(store, u.id);
    const cost = permanentUpgradeCost(u, lv);
    const pips = h('div', { class: 'pips' }, ...Array.from({ length: u.maxLevel }, (_, i) => h('span', { class: i < lv ? 'pip on' : 'pip' })));
    const btn = h('button', {
      class: `buy-btn ${state === 'ok' ? '' : 'disabled'}`,
      'data-testid': `buy-${u.id}`,
      onclick: () => {
        const r = buyUpgrade(store, u.id);
        if (r === 'gold') toast('Oro insuficiente');
        else if (r === 'max') toast('Nivel máximo');
      },
    }, state === 'max' ? 'MÁX' : h('span', { class: 'price' }, img(iconDataUrl('coin', 2), 'res-icon'), String(cost)));
    return h('div', { class: 'upgrade-row' },
      h('div', { class: 'up-icon' }, STAT_ICON[u.id]),
      h('div', { class: 'up-body' },
        h('div', { class: 'up-name' }, `${u.name} `, h('span', { class: 'up-lv' }, `Nv ${lv}`)),
        h('div', { class: 'up-desc' }, u.description),
        pips,
      ),
      btn,
    );
  });

  return h('div', { class: 'tab tab-pokemon' },
    hero,
    h('h2', { class: 'section-title' }, 'Mejoras permanentes'),
    h('p', { class: 'note' }, 'Se compran con oro y se conservan entre partidas. Valores provisionales; por ahora se aplican a todos los Pokémon.'),
    ...rows,
  );
}

function statLine(label: string, value: string | number): HTMLElement {
  return h('div', { class: 'stat' }, h('span', {}, label), h('b', {}, String(value)));
}

function openSelector(menu: MenuScreen): void {
  const store = menu.app.store;
  const close = () => overlay.remove();
  const list = obtainablePokemon().map((p) => {
    const owned = store.data.unlockedPokemon.includes(p.id);
    const selected = store.data.selectedPokemon === p.id;
    return h('button', {
      class: `poke-slot ${owned ? '' : 'locked'} ${selected ? 'selected' : ''}`,
      'data-testid': `pick-${p.id}`,
      onclick: () => {
        if (!owned) {
          toast('Consíguelo en el Gachapón');
          return;
        }
        store.update((d) => { d.selectedPokemon = p.id; });
        close();
      },
    },
      img(spriteDataUrl(p.sprite, owned ? 'normal' : 'shadow', 4), 'slot-sprite'),
      h('span', {}, owned ? p.name : '???'),
    );
  });
  const overlay = h('div', { class: 'modal-backdrop', onclick: (e: Event) => { if (e.target === overlay) close(); } },
    h('div', { class: 'modal' },
      h('h2', { class: 'section-title' }, 'Elige tu Pokémon'),
      h('div', { class: 'poke-grid' }, ...list),
      h('p', { class: 'note' }, `${store.data.unlockedPokemon.length} / ${obtainablePokemon().length} obtenidos · ${Object.keys(POKEMON).length} especies en datos`),
      h('button', { class: 'btn', onclick: close }, 'Cerrar'),
    ),
  );
  document.body.appendChild(overlay);
}
