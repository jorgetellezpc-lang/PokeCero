import { BALANCE, PERMANENT_UPGRADES, permanentUpgradeCost, type PermanentUpgradeDef } from '../../config/balance';
import { ITEMS, ITEM_IDS } from '../../data/items';
import { ATTACK_UPGRADE, ATTACK_UPGRADES, EVO_KEY, attackStats, rawAttackNums, signatureFor } from '../../data/signatures';
import { getSpecies, obtainablePokemon, sideOf, type PokemonSpecies } from '../../data/pokemon';
import { TYPE_COLORS, TYPE_NAMES } from '../../data/typeColors';
import { passiveOf } from '../../game/abilities';
import { RARITY_COLOR, RARITY_NAME } from '../../meta/gacha';
import { buyUpgrade, canBuy, perksFor, upgradeLevel } from '../../meta/shop';
import { animatedPokemon } from '../anim';
import { h, pokeImg, toast, typeChip } from '../dom';
import { icon, type IconName } from '../icons';
import { uiImg, type MenuScreen } from './menu';

// Pestaña Pokémon: tu Pokémon en su escenario (animado), su ficha
// (estadísticas, habilidad y evolución) y, en pestañas, sus mejoras
// permanentes, sus movimientos, los objetos y su información.

type SubTab = 'stats' | 'moves' | 'items' | 'info';
let subTab: SubTab = 'stats';

/** Icono de cada mejora: recorte del diseño si lo hay; si no, icono dibujado. */
const UP_ICON: Record<PermanentUpgradeDef['id'], { img?: string; svg?: IconName; color: string }> = {
  hp: { img: 'u-heart', color: '#ff5a8a' }, atk: { img: 'u-sword', color: '#ffb02e' }, spd: { img: 'u-boot', color: '#3ab0ff' },
  cd: { img: 'u-bolt', color: '#ffd23a' }, def: { img: 'u-shield', color: '#8fa4ff' }, regen: { svg: 'leaf', color: '#4ad06a' },
  magnet: { svg: 'magnet', color: '#ff5a6a' }, xp: { svg: 'book', color: '#3ac8ff' }, coins: { img: 'u-bag', color: '#ffc83a' },
  crit: { img: 'u-burst', color: '#ff9a2a' },
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
  const line = evoLine(sp);

  // --- columna izquierda: nombre, escenario y línea evolutiva ---
  const head = h('div', { class: 'pk-head' },
    icon('pokeball', 54),
    h('div', { class: 'pk-head-text' },
      h('div', { class: 'hero-name' }, sp.name),
      h('div', { class: 'pk-sub' }, h('span', { class: 'dex-no' }, `#${String(sp.dex).padStart(3, '0')}`), ...sp.types.map(typeChip)),
    ),
    h('button', { class: 'pk-edit', 'aria-label': 'Cambiar Pokémon', 'data-testid': 'select-pokemon', onclick: () => openSelector(menu) }, '✎'),
  );
  const stage = h('div', { class: 'pk-stage', style: 'background-image:url(ui/stage.webp)' },
    animatedPokemon(sp.dex, 150, { cls: 'pk-sprite' }),
    owned.length > 1 ? h('button', { class: 'pk-arrow left', 'aria-label': 'Anterior', onclick: () => cycle(-1) }, icon('back', 22)) : null,
    owned.length > 1 ? h('button', { class: 'pk-arrow right', 'aria-label': 'Siguiente', onclick: () => cycle(1) }, icon('next', 22)) : null,
  );
  const evo = h('div', { class: 'pk-evo' }, ...line.map((p) => {
    const known = d.unlockedPokemon.includes(p.id) || p.id === sp.id;
    return h('button', {
      class: `pk-evo-slot ${p.id === sp.id ? 'on' : ''}`,
      onclick: () => { if (d.unlockedPokemon.includes(p.id)) store.update((x) => { x.selectedPokemon = p.id; }); else toast('Evoluciona en partida o consíguelo en el Gachapón'); },
    }, pokeImg(p.dex, 56, '', !known));
  }));

  // --- columna derecha: estadísticas, habilidad y evolución ---
  const stats = h('div', { class: 'pk-stats' },
    statRow('u-heart', 'Vida', Math.round(sp.stats.hp + perks.hp)),
    statRow('u-sword', side === 'special' ? 'At. Esp.' : 'Ataque', (atk * perks.atkMul).toFixed(2)),
    statRow('u-shield', 'Defensa', side === 'special' ? sp.stats.sd : sp.stats.df),
    statRow('u-boot', 'Velocidad', Math.round(sp.stats.speed * perks.spdMul)),
  );
  const ability = h('div', { class: 'pk-card', 'data-testid': 'hero-passive' },
    h('b', {}, `Habilidad: ${passive.name}`), h('small', {}, passive.description));
  const next = sp.evolution ? getSpecies(sp.evolution.to) : null;
  const evolution = h('div', { class: 'pk-card pk-evo-card' },
    h('div', {}, h('b', {}, 'Evolución'), h('small', {}, next ? `Evoluciona a ${next.name} en Nv ${sp.evolution!.level} (en partida).` : 'No evoluciona por nivel.')),
    next ? pokeImg(next.dex, 52) : null,
  );

  // --- pestañas ---
  const tabs: { id: SubTab; label: string; svg: IconName }[] = [
    { id: 'stats', label: 'Mejoras', svg: 'up' }, { id: 'moves', label: 'Ataque', svg: 'star' },
    { id: 'items', label: 'Objetos', svg: 'bag' }, { id: 'info', label: 'Información', svg: 'info' },
  ];
  const tabBar = h('div', { class: 'pk-tabs' }, ...tabs.map((t) => h('button', {
    class: `pk-tab ${subTab === t.id ? 'on' : ''}`, 'data-sub': t.id, onclick: () => { subTab = t.id; menu.render(); },
  }, icon(t.svg, 26), h('span', {}, t.label))));

  const body = subTab === 'stats' ? upgrades(menu, sp)
    : subTab === 'moves' ? moves(sp)
      : subTab === 'items' ? items()
        : info(sp);

  return h('div', { class: 'tab tab-poke2' },
    h('div', { class: 'pk-top' },
      h('div', { class: 'pk-left' }, head, stage, evo),
      h('div', { class: 'pk-right' }, stats, ability, evolution),
    ),
    tabBar,
    body,
  );
}

function statRow(img: string, label: string, value: string | number): HTMLElement {
  return h('div', { class: 'pk-stat' }, uiImg(img, 'pk-stat-ic'), h('span', {}, label), h('b', {}, String(value)));
}

function upgrades(menu: MenuScreen, sp: PokemonSpecies): HTMLElement {
  const store = menu.app.store;
  const rows = PERMANENT_UPGRADES.map((u) => {
    const lv = upgradeLevel(store, sp.id, u.id);
    const state = canBuy(store, sp.id, u.id);
    const cost = permanentUpgradeCost(u, lv);
    const ic = UP_ICON[u.id];
    const btn = h('button', {
      class: `buy-btn2 ${state === 'ok' ? '' : 'disabled'} ${state === 'max' ? 'max' : ''}`,
      'data-testid': `buy-${u.id}`,
      onclick: () => {
        const r = buyUpgrade(store, sp.id, u.id);
        if (r === 'gold') toast('Oro insuficiente');
        else if (r === 'max') toast('Nivel máximo');
        else menu.app.audio.sfx('confirm');
      },
    }, state === 'max' ? 'MÁX' : h('span', { class: 'price' }, uiImg('i-coin'), String(cost)));
    return h('div', { class: 'upgrade-row up2', style: `--c:${ic.color}` },
      h('div', { class: 'up2-icon' }, ic.img ? uiImg(ic.img) : icon(ic.svg!, 40)),
      h('div', { class: 'up2-body' },
        h('div', { class: 'up2-name' }, u.name, h('span', { class: 'up2-lv' }, `Nv ${lv}/${u.maxLevel}`)),
        h('div', { class: 'up2-desc' }, `${u.description} por nivel`),
        h('div', { class: 'up2-bar' }, ...Array.from({ length: u.maxLevel }, (_, i) => h('i', { class: i < lv ? 'on' : '' }))),
      ),
      btn,
    );
  });
  return h('section', { class: 'panel2 pk-body' },
    h('div', { class: 'pk-body-head' }, h('h3', {}, `Mejoras de ${sp.name}`),
      h('p', {}, 'Se compran con oro, se conservan entre partidas y solo cuentan cuando juegas con este Pokémon.')),
    ...rows,
  );
}

function moves(sp: PokemonSpecies): HTMLElement {
  const sig = signatureFor(sp);
  const raw = rawAttackNums(sig, [], false);
  const s = attackStats(sig, [], false);
  const A = BALANCE.attack;
  const colorA = TYPE_COLORS[sig.primary];
  const typeLine = sig.secondary ? `${TYPE_NAMES[sig.primary]} + ${TYPE_NAMES[sig.secondary]}` : TYPE_NAMES[sig.primary];
  const stat = (k: string, v: string) => h('div', { class: 'info-line' }, h('span', {}, k), h('b', {}, v));
  const next = sp.evolution ? getSpecies(sp.evolution.to) : null;
  const nextSig = next ? signatureFor(next) : null;
  const fits = ATTACK_UPGRADES.filter((u) => u.fits(sig, raw));
  return h('section', { class: 'panel2 pk-body', 'data-testid': 'signature-attack' },
    h('div', { class: 'pk-body-head' }, h('h3', {}, 'Ataque característico'),
      h('p', {}, 'Cada Pokémon tiene un único ataque que sale de sus tipos. Todas las cartas de ataque de la partida lo mejoran.')),
    h('div', { class: 'move-cell start', style: `--t:${colorA}` },
      h('b', {}, sig.name), h('small', {}, `${typeLine} · ${sig.cat === 'special' ? 'Especial' : 'Físico'}`), h('small', {}, sig.desc),
      sig.note ? h('small', {}, sig.note) : null),
    stat('Daño base', String(Math.round((s.dmg ?? 0) * 10) / 10)),
    stat('Ataques por segundo', (1 / s.cd).toFixed(1)),
    sig.kind === 'chain' ? stat('Saltos', String(s.count ?? 1)) : sig.kind === 'beam' ? null : stat('Proyectiles', String(s.count ?? 1)),
    h('div', { class: 'move-cell', style: '--t:#ffd23a' },
      h('b', {}, `Evoluciona a ${sig.evoName}`),
      h('small', {}, `En partida, desde el nivel ${A.evoLevel} con ${A.evoUpgrades} mejoras del ataque, entre ellas ${ATTACK_UPGRADE[EVO_KEY[sig.kind]].name}.`),
      h('small', {}, sig.evoText.replace(/^./, (c) => c.toUpperCase()))),
    nextSig && nextSig.name !== sig.name
      ? h('p', { class: 'note' }, `Al evolucionar a ${next!.name}, el ataque pasa a ser ${nextSig.name} y conserva las mejoras.`) : null,
    h('h4', { class: 'pk-h4' }, 'Mejoras posibles'),
    h('div', { class: 'move-grid' }, ...fits.map((u) => h('div', { class: 'move-cell', style: `--t:${colorA}` },
      h('b', {}, u.name), h('small', {}, u.text(sig, raw))))),
  );
}

function items(): HTMLElement {
  return h('section', { class: 'panel2 pk-body' },
    h('div', { class: 'pk-body-head' }, h('h3', {}, 'Objetos'),
      h('p', {}, 'Los sueltan los jefes durante la partida. Llevas uno: al encontrar otro, eliges con cuál quedarte.')),
    h('div', { class: 'move-grid' }, ...ITEM_IDS.map((id) => h('div', { class: 'move-cell', style: '--t:#ffd23a' }, h('b', {}, ITEMS[id].name), h('small', {}, ITEMS[id].desc)))),
  );
}

function info(sp: PokemonSpecies): HTMLElement {
  const row = (k: string, v: string) => h('div', { class: 'info-line' }, h('span', {}, k), h('b', {}, v));
  return h('section', { class: 'panel2 pk-body' },
    h('div', { class: 'pk-body-head' }, h('h3', {}, 'Información')),
    row('Pokédex', `#${String(sp.dex).padStart(3, '0')}`),
    row('Tipo', sp.types.map((t) => TYPE_NAMES[t]).join(' / ')),
    row('Rareza en el gachapón', RARITY_NAME[sp.rarity]),
    row('Pega mejor con', sideOf(sp) === 'special' ? 'Ataques especiales' : 'Ataques físicos'),
    row('Defensa / Def. Esp.', `${sp.stats.df} / ${sp.stats.sd}`),
    row('Total de estadísticas base', String(sp.bst)),
  );
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
