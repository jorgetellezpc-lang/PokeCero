import { PERMANENT_UPGRADES, permanentUpgradeCost, type PermanentUpgradeDef } from '../../config/balance';
import { getMove } from '../../data/moves';
import { getSpecies, obtainablePokemon, sideOf, type PokemonSpecies } from '../../data/pokemon';
import { passiveOf } from '../../game/abilities';
import { RARITY_COLOR, RARITY_NAME } from '../../meta/gacha';
import { buyUpgrade, canBuy, perksFor, upgradeLevel } from '../../meta/shop';
import { iconDataUrl } from '../../render/sprites';
import { animatedPokemon } from '../anim';
import { h, img, pokeImg, toast, typeChip } from '../dom';
import type { MenuScreen } from './menu';

// Pestaña Pokémon: tu Pokémon en grande (animado), su línea evolutiva, sus
// estadísticas y las mejoras permanentes que se compran con oro.

const STAT_ICON: Record<PermanentUpgradeDef['id'], { icon: string; color: string }> = {
  hp: { icon: '♥', color: '#ff5a8a' }, atk: { icon: '⚔', color: '#ffb02e' }, spd: { icon: '➤', color: '#3ad0a0' },
  cd: { icon: '◷', color: '#4aa8ff' }, def: { icon: '⛨', color: '#8fa4ff' }, regen: { icon: '❦', color: '#6ad04a' },
  magnet: { icon: '∪', color: '#c47bff' }, xp: { icon: '✎', color: '#5fd8ff' }, coins: { icon: '¤', color: '#ffd23f' },
  crit: { icon: '✶', color: '#ff7a4a' },
};

/** Línea evolutiva (desde la forma base, siguiendo las evoluciones por nivel). */
function evoLine(sp: PokemonSpecies): PokemonSpecies[] {
  const out: PokemonSpecies[] = [];
  for (let s: PokemonSpecies | undefined = getSpecies(sp.line); s && out.length < 4; s = s.evolution ? getSpecies(s.evolution.to) : undefined) out.push(s);
  return out.some((s) => s.id === sp.id) ? out : [sp];
}

export function renderPokemonTab(menu: MenuScreen): HTMLElement {
  const store = menu.app.store;
  const d = store.data;
  const sp = getSpecies(d.selectedPokemon);
  const perks = perksFor(store, sp.id);
  const side = sideOf(sp);
  const passive = passiveOf(sp);
  const owned = d.unlockedPokemon.map(getSpecies).sort((a, b) => a.dex - b.dex);
  const cycle = (k: number) => {
    const i = owned.findIndex((p) => p.id === sp.id);
    const next = owned[(i + k + owned.length) % owned.length];
    store.update((x) => { x.selectedPokemon = next.id; });
  };
  const atk = side === 'special' ? sp.stats.sa : sp.stats.pa;

  const head = h('div', { class: 'poke-head' },
    h('span', { class: 'play-tile' }, '▶'),
    h('div', { class: 'poke-head-text' },
      h('div', { class: 'hero-name' }, sp.name, h('span', { class: 'dex-no' }, ` #${String(sp.dex).padStart(3, '0')}`)),
      h('div', { class: 'chips' }, ...sp.types.map(typeChip)),
    ),
  );

  const stage = h('div', { class: 'poke-stage' },
    owned.length > 1 ? h('button', { class: 'arrow left', 'aria-label': 'Anterior', onclick: () => cycle(-1) }, '‹') : null,
    h('div', { class: 'stage-platform' }),
    animatedPokemon(sp.dex, 170, { cls: 'stage-sprite' }),
    owned.length > 1 ? h('button', { class: 'arrow right', 'aria-label': 'Siguiente', onclick: () => cycle(1) }, '›') : null,
  );

  const line = evoLine(sp);
  const evo = line.length > 1
    ? h('div', { class: 'evo-row' }, ...line.map((p) => h('span', { class: `evo-slot ${p.id === sp.id ? 'on' : ''}` }, pokeImg(p.dex, 44, '', !d.unlockedPokemon.includes(p.id) && p.id !== sp.id))))
    : null;

  const stats = h('div', { class: 'stat-boxes' },
    statBox('⚔', side === 'special' ? 'At. Esp.' : 'Ataque', Math.round(atk * 100 * perks.atkMul), '#ffb02e'),
    statBox('♥', 'Vida', Math.round(sp.stats.hp + perks.hp), '#ff5a8a'),
    statBox('➤', 'Velocidad', Math.round(sp.stats.speed * perks.spdMul), '#3ad0a0'),
  );

  const rows = PERMANENT_UPGRADES.map((u) => {
    const lv = upgradeLevel(store, sp.id, u.id);
    const state = canBuy(store, sp.id, u.id);
    const cost = permanentUpgradeCost(u, lv);
    const ic = STAT_ICON[u.id];
    const btn = h('button', {
      class: `buy-btn ${state === 'ok' ? '' : 'disabled'} ${state === 'max' ? 'max' : ''}`,
      'data-testid': `buy-${u.id}`,
      onclick: () => {
        const r = buyUpgrade(store, sp.id, u.id);
        if (r === 'gold') toast('Oro insuficiente');
        else if (r === 'max') toast('Nivel máximo');
        else menu.app.audio.sfx('confirm');
      },
    }, state === 'max' ? 'MÁX' : h('span', { class: 'price' }, h('span', { class: 'up-arrow' }, '⇧'), img(iconDataUrl('coin', 2), 'res-icon'), String(cost)));
    return h('div', { class: 'upgrade-row', style: `--c:${ic.color}` },
      h('div', { class: 'up-icon' }, ic.icon),
      h('div', { class: 'up-body' },
        h('div', { class: 'up-name' }, u.name),
        h('div', { class: 'up-lv' }, `Nv ${lv}/${u.maxLevel}`),
        h('div', { class: 'up-desc' }, `${u.description} por nivel`),
        h('div', { class: 'pips' }, ...Array.from({ length: u.maxLevel }, (_, i) => h('span', { class: i < lv ? 'pip on' : 'pip' }))),
      ),
      btn,
    );
  });

  return h('div', { class: 'tab tab-pokemon' },
    h('section', { class: 'panel hero-panel' },
      head,
      stage,
      evo,
      stats,
      h('div', { class: 'passive', 'data-testid': 'hero-passive' }, h('b', {}, passive.name), ` — ${passive.description}`),
      h('div', { class: 'note center' }, `Empieza con ${getMove(sp.startingAttack).name} · ${sp.learnset.length} movimientos posibles${sp.evolution ? ` · Evoluciona a ${getSpecies(sp.evolution.to).name} en Nv ${sp.evolution.level}` : ''}`),
      h('button', { class: 'cta', 'data-testid': 'select-pokemon', onclick: () => openSelector(menu) }, h('span', { class: 'cta-main' }, 'Cambiar Pokémon')),
    ),
    h('div', { class: 'section-card' },
      h('span', { class: 'section-ico' }, '⬆'),
      h('div', {}, h('div', { class: 'section-card-title' }, 'Mejoras permanentes'), h('div', { class: 'section-card-sub' }, `De ${sp.name}. Se compran con oro y se conservan entre partidas.`)),
    ),
    ...rows,
  );
}

function statBox(icon: string, label: string, value: number, color: string): HTMLElement {
  return h('div', { class: 'stat-box', style: `--c:${color}` }, h('span', { class: 'stat-ico' }, icon), h('small', {}, label), h('b', {}, String(value)));
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
      h('h2', { class: 'modal-title' }, 'Elige tu Pokémon'),
      h('p', { class: 'note center' }, `${store.data.unlockedPokemon.length} / ${all.length} de Kanto obtenidos`),
      h('div', { class: 'poke-grid' }, ...list),
      h('button', { class: 'cta small', onclick: close }, h('span', { class: 'cta-main' }, 'Cerrar')),
    ),
  );
  document.body.appendChild(overlay);
}
