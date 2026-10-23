import { BALANCE, PERMANENT_UPGRADES, permanentUpgradeCost, type PermanentUpgradeDef } from '../../config/balance';
import { ITEMS, ITEM_IDS } from '../../data/items';
import { ATTACK_UPGRADE, ATTACK_UPGRADES, EVO_KEY, attackStats, rawAttackNums, signatureFor } from '../../data/signatures';
import { getSpecies, obtainablePokemon, PLAYABLE_BLURB, sideOf, type PokemonSpecies } from '../../data/pokemon';
import { TYPE_COLORS, TYPE_NAMES } from '../../data/typeColors';
import { passiveOf } from '../../game/abilities';
import { buyUpgrade, canBuy, perksFor, upgradeLevel } from '../../meta/shop';
import { animatedPokemon } from '../anim';
import { h, pokeImg, toast } from '../dom';
import { icon, type IconName } from '../icons';
import { typeGlyph } from '../typeGlyph';
import { uiImg, type MenuScreen } from './menu';

// Pestaña Pokémon: calcada del diseño del usuario (selector, tu Pokémon sobre
// la roca, ficha, PS/Defensa/Velocidad, radar, entrenamiento y evolución).
// Entrenar abre las mejoras en una hoja; al tocar tu Pokémon se abre su ficha
// completa (habilidad, ataque, objetos e información).

/** Icono de cada mejora: recorte del diseño si lo hay; si no, icono dibujado. */
const UP_ICON: Record<PermanentUpgradeDef['id'], { img?: string; svg?: IconName; color: string }> = {
  hp: { img: 'u-heart', color: '#ff5a8a' }, atk: { img: 'u-sword', color: '#ffb02e' }, spd: { img: 'u-boot', color: '#3ab0ff' },
  cd: { img: 'u-bolt', color: '#ffd23a' }, def: { img: 'u-shield', color: '#8fa4ff' }, regen: { svg: 'leaf', color: '#4ad06a' },
  magnet: { svg: 'magnet', color: '#ff5a6a' }, xp: { svg: 'book', color: '#3ac8ff' }, coins: { img: 'u-bag', color: '#ffc83a' },
  crit: { img: 'u-burst', color: '#ff9a2a' },
};

/**
 * Lienzo del diseño (853 × 1844 px, la captura entera del usuario; abajo va la barra de navegación). Todo se coloca
 * en sus coordenadas exactas, en % del lienzo, y las letras en cqi (1 px del
 * diseño = 100cqi / 853), así queda idéntico a cualquier ancho.
 */
const CW = 853;
const CH = 1844;
const at = (x0: number, y0: number, x1: number, y1: number) =>
  `left:${(x0 / CW) * 100}%;top:${(y0 / CH) * 100}%;width:${((x1 - x0) / CW) * 100}%;height:${((y1 - y0) / CH) * 100}%`;
/** Orden del selector, como en el diseño. */
const PICKER = ['pikachu', 'charmander', 'bulbasaur', 'squirtle'];
const FACE_Y = [293, 408, 515, 622];

export function renderPokemonTab(menu: MenuScreen): HTMLElement {
  const store = menu.app.store;
  const d = store.data;
  const sp = getSpecies(d.selectedPokemon);
  const perks = perksFor(store, sp.id);
  const side = sideOf(sp);

  // --- selector ---
  const faces = PICKER.map(getSpecies).map((p, i) => h('button', {
    class: `pk4-face ${p.id === sp.id ? 'on' : ''}`, style: at(40, FACE_Y[i] - 45, 130, FACE_Y[i] + 45),
    'data-testid': `pick-${p.id}`, 'aria-label': p.name, 'aria-pressed': String(p.id === sp.id),
    onclick: () => { if (p.id !== sp.id) { store.update((x) => { x.selectedPokemon = p.id; }); menu.app.audio.sfx('click'); } },
  }, uiImg(`pk-face-${p.id}`, 'pk4-face-img')));

  // --- tu Pokémon (ilustración 3D si la hay; si no, su sprite) sobre la roca. Al tocarlo, su ficha completa. ---
  const passive = passiveOf(sp);
  const openFicha = () => openSheet(menu, sp.name, () => h('div', {},
    h('p', { class: 'pk3-passive', 'data-testid': 'hero-passive' }, h('b', {}, `Habilidad: ${passive.name}. `), passive.description),
    moves(sp), items(), info(sp)));
  const hero = h('button', {
    class: 'pk4-hero', style: at(150, 540, 440, 852), 'data-testid': 'pk-hero', 'aria-label': `Ficha de ${sp.name}`, onclick: openFicha,
  }, HERO_ART.has(sp.id)
    ? h('img', { class: 'pk4-hero-art', src: `ui/pk-3d-${sp.id}.webp`, alt: sp.name, draggable: 'false' })
    : animatedPokemon(sp.dex, 190, { cls: 'pk4-hero-sprite' }));

  // --- ficha ---
  const ups = PERMANENT_UPGRADES.map((u) => upgradeLevel(store, sp.id, u.id));
  const trained = ups.reduce((a, b) => a + b, 0);
  const trainMax = PERMANENT_UPGRADES.reduce((a, u) => a + u.maxLevel, 0);
  const color = TYPE_COLORS[sp.types[0]];
  const idCard = h('section', { class: 'pk4-card', style: at(482, 257, 826, 588) });
  const els: HTMLElement[] = [
    idCard,
    // 50 px de letra como en el diseño; los nombres largos se encogen para caber con la estrella.
    h('div', { class: 'pk4-name', style: `${at(505, 272, 805, 330)};--fs:${Math.min(50, (50 * 7.4) / sp.name.length)}` },
      h('span', { class: 'hero-name' }, sp.name), h('span', { class: 'pk4-star' }, '★')),
    h('div', { class: 'pk4-meta', style: at(505, 340, 745, 372) }, h('span', {}, `N.º ${String(sp.dex).padStart(3, '0')}`), h('span', {}, `Tipo ${TYPE_NAMES[sp.types[0]]}`)),
    h('span', { class: 'pk4-type', style: `${at(757, 336, 807, 386)};--t:${color}`, title: sp.types.map((t) => TYPE_NAMES[t]).join(' / ') }, typeGlyph(sp.types[0], 26)),
    h('div', { class: 'pk4-lv', style: at(505, 398, 805, 430), title: 'Nivel de entrenamiento (mejoras compradas con oro)' },
      h('b', {}, `Nv. ${trained}`), h('small', {}, `${trained} / ${trainMax}`)),
    h('div', { class: 'pk4-xp', style: at(505, 436, 805, 448) }, h('i', { style: `width:${(trained / trainMax) * 100}%` })),
    h('p', { class: 'pk4-blurb', style: at(505, 472, 812, 575) }, PLAYABLE_BLURB[sp.id] ?? ''),
  ];

  // --- PS, defensa y velocidad ---
  els.push(h('section', { class: 'pk4-card', style: at(482, 608, 826, 880) }));
  const def = side === 'special' ? sp.stats.sd : sp.stats.df;
  const vitals: [string, string, number, number, string][] = [
    ['u-heart', 'PS', Math.round(sp.stats.hp + perks.hp), STAT_MAX.hp, 'linear-gradient(90deg, #ff4a3a, #ff8a3a)'],
    ['u-shield', 'Defensa', def, STAT_MAX.df, 'linear-gradient(90deg, #2a7ff0, #5ab8ff)'],
    ['u-boot', 'Velocidad', Math.round(sp.stats.speed * perks.spdMul), STAT_MAX.speed, 'linear-gradient(90deg, #22b8ff, #6ae0ff)'],
  ];
  vitals.forEach(([img, label, v, max, grad], i) => {
    const y = 656 + i * 80;
    els.push(
      h('span', { class: 'pk4-vic', style: at(502, y - 28, 558, y + 28) }, uiImg(img)),
      h('span', { class: 'pk4-vlabel', style: at(581, y - 20, 760, y + 4) }, label),
      h('div', { class: 'pk4-bar', style: at(581, y + 9, 740, y + 21) }, h('i', { style: `width:${Math.min(100, (v / max) * 100)}%;background:${grad}` })),
      h('b', { class: 'pk4-vval', style: at(745, y - 6, 805, y + 26) }, String(v)),
    );
  });

  // --- estadísticas ---
  els.push(h('section', { class: 'pk4-card', style: at(27, 920, 457, 1317) }),
    h('h3', { class: 'pk4-title', style: at(58, 940, 430, 990) }, 'Estadísticas'),
    radarChart(sp));

  // --- entrenamiento ---
  const TRAIN: { id: PermanentUpgradeDef['id']; img: string; label: string }[] = [
    { id: 'hp', img: 'u-heart', label: 'Vida' }, { id: 'atk', img: 'u-sword', label: 'Ataque' },
    { id: 'def', img: 'u-shield', label: 'Defensa' }, { id: 'spd', img: 'u-boot', label: 'Velocidad' },
  ];
  const canTrain = PERMANENT_UPGRADES.some((u) => canBuy(store, sp.id, u.id) === 'ok');
  const SLOT_X = [494, 573, 653, 732];
  els.push(h('section', { class: 'pk4-card', style: at(467, 920, 827, 1317) }),
    h('h3', { class: 'pk4-title', style: at(497, 940, 820, 990) }, 'Entrenamiento'),
    h('p', { class: 'pk4-desc', style: at(497, 996, 815, 1062) }, 'Mejora sus atributos con el oro de tus partidas.'),
    ...TRAIN.map((t, i) => h('div', { class: 'pk4-slot', style: at(SLOT_X[i], 1081, SLOT_X[i] + 71, 1182), title: t.label },
      uiImg(t.img), h('b', {}, String(upgradeLevel(store, sp.id, t.id))))),
    h('button', {
      class: `pk4-train ${canTrain ? 'ready' : ''}`, style: at(488, 1203, 806, 1288), 'data-testid': 'train',
      onclick: () => openSheet(menu, `Entrenar a ${sp.name}`, () => upgrades(menu, sp)),
    }, upArrow(), 'Entrenar'));

  // --- evolución ---
  const chain: PokemonSpecies[] = [sp];
  for (let s = sp; s.evolution; ) { s = getSpecies(s.evolution.to); chain.push(s); }
  els.push(h('section', { class: 'pk4-card', style: at(27, 1327, 827, 1562) }),
    h('div', { class: 'pk4-ball', style: at(574, 1376, 718, 1520) }, icon('pokeball', 144)),
    h('h3', { class: 'pk4-title big', style: at(60, 1345, 600, 1400) }, 'Evolución'),
    chain.length > 1
      ? h('div', { class: 'pk4-chain', style: at(56, 1405, 800, 1545) }, ...chain.flatMap((p, i) => [
        i ? h('span', { class: 'pk4-chain-arrow' }, h('small', {}, `Nv ${chain[i - 1].evolution!.level}`), '›') : null,
        h('div', { class: 'pk4-chain-step' }, pokeImg(p.dex, 64), h('span', {}, p.name)),
      ]).filter(Boolean) as HTMLElement[])
      : h('p', { class: 'pk4-desc big', style: at(60, 1410, 600, 1450) }, `${sp.name} no evoluciona.`));

  return h('div', { class: 'tab pk4' },
    h('div', { class: 'pk4-canvas', style: 'background-image:url(ui/pk-bg.webp)' },
      h('nav', { class: 'pk4-picker', style: at(25, 235, 145, 672), 'aria-label': 'Elige tu Pokémon', 'data-testid': 'pokemon-selector' }),
      ...faces, hero, ...els),
  );
}

/** Flecha gruesa del botón Entrenar (como en el diseño). */
function upArrow(): HTMLElement {
  const box = h('span', { class: 'pk4-arrow' });
  box.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 3 12h6v10h6V12h6z" fill="currentColor"/></svg>';
  return box;
}

/** Pokémon con ilustración 3D grande (recortada del diseño); el resto usa su sprite animado. */
const HERO_ART = new Set(['pikachu']);

/** Máximos de Kanto para escalar barras y radar. */
const STAT_MAX = (() => {
  const all = obtainablePokemon();
  const max = (f: (p: PokemonSpecies) => number) => Math.max(...all.map(f));
  return { hp: max((p) => p.stats.hp), pa: max((p) => p.stats.pa), sa: max((p) => p.stats.sa), df: max((p) => p.stats.df), sd: max((p) => p.stats.sd), speed: max((p) => p.stats.speed) };
})();

/** Radar de 6 estadísticas (respecto al máximo de Kanto), dibujado en las coordenadas del diseño. */
function radarChart(sp: PokemonSpecies): HTMLElement {
  const st = sp.stats;
  const axes: [string, number][] = [
    ['PS', st.hp / STAT_MAX.hp], ['Ataque', st.pa / STAT_MAX.pa], ['Defensa', st.df / STAT_MAX.df],
    ['Velocidad', st.speed / STAT_MAX.speed], ['Def. Esp.', st.sd / STAT_MAX.sd], ['At. Esp.', st.sa / STAT_MAX.sa],
  ];
  const CX = 236;
  const CY = 1150;
  const R = 112;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
    return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
  };
  const ring = (k: number) => axes.map((_, i) => pt(i, R * k).map((v) => v.toFixed(1)).join(',')).join(' ');
  const shape = axes.map(([, v], i) => pt(i, R * (0.18 + 0.82 * Math.min(1, v))).map((x) => x.toFixed(1)).join(',')).join(' ');
  const LBL: [number, number, string][] = [[237, 1022, 'middle'], [385, 1100, 'middle'], [385, 1231, 'middle'], [240, 1290, 'middle'], [92, 1231, 'middle'], [88, 1100, 'middle']];
  const labels = axes.map(([name], i) => `<text x="${LBL[i][0]}" y="${LBL[i][1]}" text-anchor="${LBL[i][2]}">${name}</text>`).join('');
  const spokes = axes.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('');
  const dots = shape.split(' ').map((p) => { const [x, y] = p.split(','); return `<circle cx="${x}" cy="${y}" r="4"/>`; }).join('');
  const box = h('div', { class: 'pk4-radar', style: at(27, 990, 457, 1310) });
  box.innerHTML = `<svg viewBox="27 990 430 320" role="img" aria-label="Estadísticas de ${sp.name}">
    <circle class="halo" cx="${CX}" cy="${CY}" r="${R * 1.28}"/>
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
