import { BALANCE, PERMANENT_UPGRADES, permanentUpgradeCost, type PermanentUpgradeDef } from '../../config/balance';
import { ITEMS, ITEM_IDS } from '../../data/items';
import { ATTACK_UPGRADE, ATTACK_UPGRADES, EVO_KEY, attackStats, rawAttackNums, signatureFor } from '../../data/signatures';
import { getSpecies, obtainablePokemon, PLAYABLE_BLURB, playablePokemon, sideOf, type PokemonSpecies } from '../../data/pokemon';
import { TYPE_COLORS, TYPE_NAMES } from '../../data/typeColors';
import { passiveOf } from '../../game/abilities';
import { buyUpgrade, canBuy, perksFor, upgradeLevel } from '../../meta/shop';
import { animatedPokemon } from '../anim';
import { h, pokeImg, toast } from '../dom';
import { icon, type IconName } from '../icons';
import { typeGlyph } from '../typeGlyph';
import { uiImg, type MenuScreen } from './menu';

// Pestaña Pokémon (diseño del usuario): escenario a pantalla completa con el
// selector de los 4 elegibles a la izquierda, tu Pokémon en el centro y su
// ficha a la derecha; debajo, estadísticas en radar, entrenamiento (mejoras
// permanentes), evolución y el ataque. Entrenar, Ataque, Objetos e
// Información se abren en una hoja. Se adapta a cualquier ancho (menu.css).

/** Icono de cada mejora: recorte del diseño si lo hay; si no, icono dibujado. */
const UP_ICON: Record<PermanentUpgradeDef['id'], { img?: string; svg?: IconName; color: string }> = {
  hp: { img: 'u-heart', color: '#ff5a8a' }, atk: { img: 'u-sword', color: '#ffb02e' }, spd: { img: 'u-boot', color: '#3ab0ff' },
  cd: { img: 'u-bolt', color: '#ffd23a' }, def: { img: 'u-shield', color: '#8fa4ff' }, regen: { svg: 'leaf', color: '#4ad06a' },
  magnet: { svg: 'magnet', color: '#ff5a6a' }, xp: { svg: 'book', color: '#3ac8ff' }, coins: { img: 'u-bag', color: '#ffc83a' },
  crit: { img: 'u-burst', color: '#ff9a2a' },
};

export function renderPokemonTab(menu: MenuScreen): HTMLElement {
  const store = menu.app.store;
  const d = store.data;
  const sp = getSpecies(d.selectedPokemon);
  const perks = perksFor(store, sp.id);
  const side = sideOf(sp);
  const color = TYPE_COLORS[sp.types[0]];

  // --- selector lateral: los 4 elegibles ---
  const picker = h('nav', { class: 'pk3-picker', 'aria-label': 'Elige tu Pokémon', 'data-testid': 'pokemon-selector' },
    ...playablePokemon().map((p) => h('button', {
      class: `pk3-face ${p.id === sp.id ? 'on' : ''}`, 'data-testid': `pick-${p.id}`, 'aria-label': p.name, 'aria-pressed': String(p.id === sp.id),
      onclick: () => { if (p.id !== sp.id) { store.update((x) => { x.selectedPokemon = p.id; }); menu.app.audio.sfx('click'); } },
    }, uiImg(`pk-face-${p.id}`, 'pk3-face-img'))));

  // --- tu Pokémon en el escenario (ilustración 3D si la hay; si no, su sprite animado) ---
  const hero = HERO_ART.has(sp.id)
    ? h('img', { class: 'pk3-hero-art', src: `ui/pk-3d-${sp.id}.webp`, alt: sp.name, draggable: 'false' })
    : animatedPokemon(sp.dex, 190, { cls: 'pk3-hero-sprite' });
  const stage = h('div', { class: 'pk3-stage' }, h('div', { class: 'pk3-ground' }), hero);

  // --- ficha: nombre, nº, tipo, entrenamiento y descripción ---
  const ups = PERMANENT_UPGRADES.map((u) => upgradeLevel(store, sp.id, u.id));
  const trained = ups.reduce((a, b) => a + b, 0);
  const trainMax = PERMANENT_UPGRADES.reduce((a, u) => a + u.maxLevel, 0);
  const idCard = h('section', { class: 'pk3-card pk3-id' },
    h('div', { class: 'pk3-name' }, h('span', { class: 'hero-name' }, sp.name), h('span', { class: 'pk3-star', title: 'Tu Pokémon' }, '★')),
    h('div', { class: 'pk3-meta' },
      h('span', {}, `N.º ${String(sp.dex).padStart(3, '0')}`),
      h('span', {}, `Tipo ${sp.types.map((t) => TYPE_NAMES[t]).join(' / ')}`),
      h('span', { class: 'pk3-type', style: `--t:${color}` }, typeGlyph(sp.types[0]))),
    h('div', { class: 'pk3-lv', title: 'Nivel de entrenamiento (mejoras compradas)' }, h('b', {}, `Nv. ${trained}`), h('small', {}, `${trained} / ${trainMax}`)),
    h('div', { class: 'pk3-xp' }, h('i', { style: `width:${(trained / trainMax) * 100}%` })),
    h('p', { class: 'pk3-blurb' }, PLAYABLE_BLURB[sp.id] ?? ''),
  );

  // --- vida, defensa y velocidad (con las mejoras compradas) ---
  const def = side === 'special' ? sp.stats.sd : sp.stats.df;
  const vitals = h('section', { class: 'pk3-card pk3-vitals' },
    vital('u-heart', 'PS', Math.round(sp.stats.hp + perks.hp), STAT_MAX.hp, 'var(--pk3-red)'),
    vital('u-shield', 'Defensa', def, STAT_MAX.df, 'var(--pk3-blue)'),
    vital('u-boot', 'Velocidad', Math.round(sp.stats.speed * perks.spdMul), STAT_MAX.speed, 'var(--pk3-cyan)'),
  );

  // --- estadísticas (radar) y entrenamiento ---
  const radar = h('section', { class: 'pk3-card pk3-radar' }, h('h3', {}, 'Estadísticas'), radarChart(sp));
  const TRAIN: { id: PermanentUpgradeDef['id']; img: string; label: string }[] = [
    { id: 'hp', img: 'u-heart', label: 'Vida' }, { id: 'atk', img: 'u-sword', label: 'Ataque' },
    { id: 'def', img: 'u-shield', label: 'Defensa' }, { id: 'spd', img: 'u-boot', label: 'Velocidad' },
  ];
  const canTrain = PERMANENT_UPGRADES.some((u) => canBuy(store, sp.id, u.id) === 'ok');
  const training = h('section', { class: 'pk3-card pk3-train' },
    h('h3', {}, 'Entrenamiento'),
    h('p', {}, 'Mejora sus atributos con oro. Se conservan entre partidas.'),
    h('div', { class: 'pk3-train-row' }, ...TRAIN.map((t) => h('div', { class: 'pk3-train-slot', title: t.label },
      uiImg(t.img), h('b', {}, String(upgradeLevel(store, sp.id, t.id)))))),
    h('button', { class: `pk3-train-btn ${canTrain ? 'ready' : ''}`, 'data-testid': 'train', onclick: () => openSheet(menu, `Entrenar a ${sp.name}`, () => upgrades(menu, sp)) },
      icon('up', 26), 'Entrenar'),
  );

  // --- evolución ---
  const chain: PokemonSpecies[] = [sp];
  for (let s = sp; s.evolution; ) { s = getSpecies(s.evolution.to); chain.push(s); }
  const evolution = h('section', { class: 'pk3-card pk3-evo' },
    h('h3', {}, 'Evolución'),
    chain.length > 1
      ? h('div', { class: 'pk3-evo-chain' }, ...chain.flatMap((p, i) => [
        i ? h('span', { class: 'pk3-evo-arrow' }, h('small', {}, `Nv ${chain[i - 1].evolution!.level}`), '›') : null,
        h('div', { class: 'pk3-evo-step' }, pokeImg(p.dex, 56), h('span', {}, p.name)),
      ]).filter(Boolean) as HTMLElement[])
      : h('p', {}, `${sp.name} no evoluciona.`),
    chain.length > 1 ? h('p', { class: 'note' }, 'Evoluciona durante la partida al llegar a ese nivel.') : null,
    h('div', { class: 'pk3-evo-ball' }, icon('pokeball', 120)),
  );

  // --- ataque, habilidad, objetos e información (detalle en hojas) ---
  const sig = signatureFor(sp);
  const passive = passiveOf(sp);
  const more = h('section', { class: 'pk3-card pk3-more' },
    h('div', { class: 'pk3-more-head' },
      h('div', {}, h('h3', {}, sig.name), h('small', {}, `Ataque característico · ${sig.desc}`)),
      h('span', { class: 'pk3-type big', style: `--t:${TYPE_COLORS[sig.primary]}` }, typeGlyph(sig.primary))),
    h('p', { class: 'pk3-passive', 'data-testid': 'hero-passive' }, h('b', {}, `Habilidad: ${passive.name}. `), passive.description),
    h('div', { class: 'pk3-more-btns' },
      h('button', { 'data-sub': 'moves', onclick: () => openSheet(menu, 'Ataque', () => moves(sp)) }, icon('star', 22), 'Ataque'),
      h('button', { 'data-sub': 'items', onclick: () => openSheet(menu, 'Objetos', () => items()) }, icon('bag', 22), 'Objetos'),
      h('button', { 'data-sub': 'info', onclick: () => openSheet(menu, 'Información', () => info(sp)) }, icon('info', 22), 'Información'),
    ),
  );

  return h('div', { class: 'tab pk3', style: `--pk:${color}` },
    h('div', { class: 'pk3-hero' }, picker, stage, h('div', { class: 'pk3-side' }, idCard, vitals)),
    h('div', { class: 'pk3-grid' }, radar, training),
    evolution,
    more,
  );
}

/** Pokémon con ilustración 3D grande (recortada del diseño); el resto usa su sprite animado. */
const HERO_ART = new Set(['pikachu']);

/** Máximos de Kanto para escalar barras y radar. */
const STAT_MAX = (() => {
  const all = obtainablePokemon();
  const max = (f: (p: PokemonSpecies) => number) => Math.max(...all.map(f));
  return { hp: max((p) => p.stats.hp), pa: max((p) => p.stats.pa), sa: max((p) => p.stats.sa), df: max((p) => p.stats.df), sd: max((p) => p.stats.sd), speed: max((p) => p.stats.speed) };
})();

function vital(img: string, label: string, value: number, max: number, color: string): HTMLElement {
  return h('div', { class: 'pk3-vital' }, uiImg(img, 'pk3-vital-ic'),
    h('div', { class: 'pk3-vital-body' }, h('span', {}, label), h('div', { class: 'pk3-bar' }, h('i', { style: `width:${Math.min(100, (value / max) * 100)}%;background:${color}` }))),
    h('b', {}, String(value)));
}

/** Radar de 6 estadísticas (respecto al máximo de Kanto). */
function radarChart(sp: PokemonSpecies): HTMLElement {
  const st = sp.stats;
  const axes: [string, number][] = [
    ['PS', st.hp / STAT_MAX.hp], ['Ataque', st.pa / STAT_MAX.pa], ['Defensa', st.df / STAT_MAX.df],
    ['Velocidad', st.speed / STAT_MAX.speed], ['Def. Esp.', st.sd / STAT_MAX.sd], ['At. Esp.', st.sa / STAT_MAX.sa],
  ];
  const C = 100;
  const R = 62;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
    return [C + Math.cos(a) * r, C + Math.sin(a) * r];
  };
  const ring = (k: number) => axes.map((_, i) => pt(i, R * k).map((v) => v.toFixed(1)).join(',')).join(' ');
  // Un mínimo para que ninguna punta quede pegada al centro.
  const shape = axes.map(([, v], i) => pt(i, R * (0.18 + 0.82 * Math.min(1, v))).map((x) => x.toFixed(1)).join(',')).join(' ');
  const labels = axes.map(([name], i) => {
    const [x, y] = pt(i, R + 22);
    const anchor = Math.abs(x - C) < 4 ? 'middle' : x > C ? 'start' : 'end';
    return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}">${name}</text>`;
  }).join('');
  const spokes = axes.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('');
  const dots = shape.split(' ').map((p) => { const [x, y] = p.split(','); return `<circle cx="${x}" cy="${y}" r="3"/>`; }).join('');
  const box = h('div', { class: 'pk3-radar-svg' });
  box.innerHTML = `<svg viewBox="-50 4 300 196" role="img" aria-label="Estadísticas de ${sp.name}">
    <g class="grid">${[1, 0.66, 0.33].map((k) => `<polygon points="${ring(k)}"/>`).join('')}${spokes}</g>
    <polygon class="shape" points="${shape}"/><g class="dots">${dots}</g><g class="lbl">${labels}</g></svg>`;
  return box;
}

/** Hoja a pantalla completa con un apartado (entrenar, ataque, objetos, información). */
function openSheet(menu: MenuScreen, title: string, body: () => HTMLElement): void {
  const close = () => { overlay.remove(); unsub(); };
  const content = h('div', { class: 'pk3-sheet-body' }, body());
  // Si compras algo, se rehace el contenido sin cerrar la hoja.
  const unsub = menu.app.store.subscribe(() => content.replaceChildren(body()));
  const overlay = h('div', { class: 'modal-backdrop pk3-sheet-bg', 'data-testid': 'pk-sheet', onclick: (e: Event) => { if (e.target === overlay) close(); } },
    h('div', { class: 'modal pk3-sheet' },
      h('div', { class: 'pk3-sheet-head' }, h('h2', { class: 'modal-title' }, title),
        h('button', { class: 'pk3-sheet-x', 'aria-label': 'Cerrar', 'data-testid': 'sheet-close', onclick: close }, '✕')),
      content,
    ),
  );
  document.body.appendChild(overlay);
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
    row('Pega mejor con', sideOf(sp) === 'special' ? 'Ataques especiales' : 'Ataques físicos'),
    row('Defensa / Def. Esp.', `${sp.stats.df} / ${sp.stats.sd}`),
    row('Total de estadísticas base', String(sp.bst)),
  );
}
