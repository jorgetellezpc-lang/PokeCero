import { PERMANENT_UPGRADES, permanentUpgradeCost, type PermanentUpgradeDef } from '../../config/balance';
import { getMove } from '../../data/moves';
import { getSpecies, obtainablePokemon, sideOf } from '../../data/pokemon';
import { RARITY_COLOR, RARITY_NAME } from '../../meta/gacha';
import { buyUpgrade, canBuy, perksFor, upgradeLevel } from '../../meta/shop';
import { iconDataUrl } from '../../render/sprites';
import { h, img, pokeImg, toast, typeChip } from '../dom';
import type { MenuScreen } from './menu';

const STAT_ICON: Record<PermanentUpgradeDef['id'], string> = {
  hp: '♥', atk: '✊', spd: '➤', cd: '◷', def: '⛨', regen: '❦', magnet: '∪', xp: '✎', coins: '¤', crit: '✶',
};

export function renderPokemonTab(menu: MenuScreen): HTMLElement {
  const store = menu.app.store;
  const d = store.data;
  const sp = getSpecies(d.selectedPokemon);
  const perks = perksFor(store, sp.id);
  const side = sideOf(sp);

  const hero = h('button', { class: 'hero-card', 'data-testid': 'select-pokemon', onclick: () => openSelector(menu) },
    h('div', { class: 'hero-platform' }, pokeImg(sp.dex, 96, 'hero-sprite')),
    h('div', { class: 'hero-info' },
      h('div', { class: 'hero-name' }, sp.name, h('span', { class: 'dex-no' }, ` #${String(sp.dex).padStart(3, '0')}`)),
      h('div', { class: 'chips' }, ...sp.types.map(typeChip)),
      h('div', { class: 'hero-stats' },
        statLine('Vida', Math.round(sp.stats.hp + perks.hp)),
        statLine('Velocidad', Math.round(sp.stats.speed * perks.spdMul)),
        statLine('Ataque', `×${(sp.stats.pa * perks.atkMul).toFixed(2)}`),
        statLine('At. Esp.', `×${(sp.stats.sa * perks.atkMul).toFixed(2)}`),
        statLine('Defensa', sp.stats.df),
        statLine('Def. Esp.', sp.stats.sd),
      ),
      h('div', { class: 'hero-attack' }, `Empieza con ${getMove(sp.startingAttack).name} · Pega mejor con ataques ${side === 'special' ? 'especiales' : 'físicos'} · ${sp.learnset.length} movimientos posibles`),
      sp.evolution ? h('div', { class: 'hero-attack' }, `Evoluciona a ${getSpecies(sp.evolution.to).name} en Nv ${sp.evolution.level} (en partida)`) : null,
      h('div', { class: 'hint' }, 'Toca para cambiar de Pokémon'),
    ),
  );

  const rows = PERMANENT_UPGRADES.map((u) => {
    const lv = upgradeLevel(store, sp.id, u.id);
    const state = canBuy(store, sp.id, u.id);
    const cost = permanentUpgradeCost(u, lv);
    const pips = h('div', { class: 'pips' }, ...Array.from({ length: u.maxLevel }, (_, i) => h('span', { class: i < lv ? 'pip on' : 'pip' })));
    const btn = h('button', {
      class: `buy-btn ${state === 'ok' ? '' : 'disabled'}`,
      'data-testid': `buy-${u.id}`,
      onclick: () => {
        const r = buyUpgrade(store, sp.id, u.id);
        if (r === 'gold') toast('Oro insuficiente');
        else if (r === 'max') toast('Nivel máximo');
      },
    }, state === 'max' ? 'MÁX' : h('span', { class: 'price' }, img(iconDataUrl('coin', 2), 'res-icon'), String(cost)));
    return h('div', { class: 'upgrade-row' },
      h('div', { class: 'up-icon' }, STAT_ICON[u.id]),
      h('div', { class: 'up-body' },
        h('div', { class: 'up-name' }, `${u.name} `, h('span', { class: 'up-lv' }, `Nv ${lv}`)),
        h('div', { class: 'up-desc' }, `${u.description} por nivel`),
        pips,
      ),
      btn,
    );
  });

  return h('div', { class: 'tab tab-pokemon' },
    hero,
    h('h2', { class: 'section-title' }, `Mejoras de ${sp.name}`),
    h('p', { class: 'note' }, 'Se compran con oro, se conservan entre partidas y solo cuentan cuando juegas con este Pokémon. Valores provisionales.'),
    ...rows,
  );
}

function statLine(label: string, value: string | number): HTMLElement {
  return h('div', { class: 'stat' }, h('span', {}, label), h('b', {}, String(value)));
}

function openSelector(menu: MenuScreen): void {
  const store = menu.app.store;
  const close = () => overlay.remove();
  const all = obtainablePokemon();
  const list = all.map((p) => {
    const owned = store.data.unlockedPokemon.includes(p.id);
    const selected = store.data.selectedPokemon === p.id;
    return h('button', {
      class: `poke-slot ${owned ? '' : 'locked'} ${selected ? 'selected' : ''}`,
      style: `--rar:${RARITY_COLOR[p.rarity]}`,
      'data-testid': `pick-${p.id}`,
      title: owned ? `${p.name} · ${RARITY_NAME[p.rarity]}` : '???',
      onclick: () => {
        if (!owned) {
          toast('Consíguelo en el Gachapón');
          return;
        }
        store.update((d) => { d.selectedPokemon = p.id; });
        close();
      },
    },
      h('span', { class: 'slot-no' }, String(p.dex).padStart(3, '0')),
      pokeImg(p.dex, 48, 'slot-sprite', !owned),
      h('span', {}, owned ? p.name : '???'),
    );
  });
  const overlay = h('div', { class: 'modal-backdrop', onclick: (e: Event) => { if (e.target === overlay) close(); } },
    h('div', { class: 'modal' },
      h('h2', { class: 'section-title' }, 'Elige tu Pokémon'),
      h('p', { class: 'note' }, `${store.data.unlockedPokemon.length} / ${all.length} de Kanto obtenidos`),
      h('div', { class: 'poke-grid' }, ...list),
      h('button', { class: 'btn', onclick: close }, 'Cerrar'),
    ),
  );
  document.body.appendChild(overlay);
}
