import { BALANCE } from '../../config/balance';
import { ITEMS, ITEM_IDS } from '../../data/items';
import { ATTACK_UPGRADE, ATTACK_UPGRADES, EVO_KEY, attackStats, rawAttackNums, signatureFor } from '../../data/signatures';
import { getSpecies, obtainablePokemon, PLAYABLE_BLURB, sideOf, type PokemonSpecies } from '../../data/pokemon';
import { TYPE_COLORS, TYPE_NAMES } from '../../data/typeColors';
import { passiveOf } from '../../game/abilities';
import { xpToNext } from '../../game/levels';
import { active, cardLabel, ownedOf, selectOwned, statsOf } from '../../meta/team';
import { CAPTURE_COST } from '../../meta/capture';
import { animatedPokemon } from '../anim';
import { h, pokeImg, toast } from '../dom';
import { icon } from '../icons';
import { typeGlyph } from '../typeGlyph';
import type { App } from '../app';
import { uiImg, type MenuScreen } from './menu';

// Pestaña Pokémon: calcada del diseño del usuario (selector, tu Pokémon sobre
// la roca, ficha con nivel, PS/Defensa/Velocidad, radar, mejoras y evolución).
// «Ver mejoras» abre las cartas permanentes en una hoja; al tocar tu Pokémon se abre su ficha
// completa (habilidad, ataque, objetos e información).

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
  const mon = active(store)!;
  const sp = getSpecies(mon.species);
  const stats = statsOf(mon);
  const side = sideOf(sp);

  // --- selector: los tuyos; los demás, con candado (se capturan en el laboratorio) ---
  const faces = PICKER.map(getSpecies).map((p, i) => {
    const own = ownedOf(store, p.id);
    return h('button', {
      class: `pk4-face ${p.id === mon.line ? 'on' : ''} ${own ? '' : 'locked'}`, style: at(40, FACE_Y[i] - 45, 130, FACE_Y[i] + 45),
      'data-testid': `pick-${p.id}`, 'aria-label': own ? p.name : `${p.name} (sin capturar)`, 'aria-pressed': String(p.id === mon.line),
      onclick: () => {
        if (!own) return toast(`${p.name}: captúralo en el laboratorio de Pueblo Paleta (reto 1 contra 1, ${CAPTURE_COST} tickets).`);
        if (p.id !== mon.line) { selectOwned(store, p.id); menu.app.audio.sfx('click'); }
      },
    }, uiImg(`pk-face-${p.id}`, 'pk4-face-img'), own ? null : h('span', { class: 'pk4-lock' }, icon('lock', 26)));
  });

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
  const toNext = mon.level >= BALANCE.levels.max ? 0 : xpToNext(mon.level);
  const color = TYPE_COLORS[sp.types[0]];
  const idCard = h('section', { class: 'pk4-card', style: at(482, 257, 826, 588) });
  const els: HTMLElement[] = [
    idCard,
    // 50 px de letra como en el diseño; los nombres largos se encogen para caber con la estrella.
    h('div', { class: 'pk4-name', style: `${at(505, 272, 805, 330)};--fs:${Math.min(50, (50 * 7.4) / sp.name.length)}` },
      h('span', { class: 'hero-name' }, sp.name), h('span', { class: 'pk4-star' }, '★')),
    h('div', { class: 'pk4-meta', style: at(505, 340, 745, 372) }, h('span', {}, `N.º ${String(sp.dex).padStart(3, '0')}`), h('span', {}, `Tipo ${TYPE_NAMES[sp.types[0]]}`)),
    h('span', { class: 'pk4-type', style: `${at(757, 336, 807, 386)};--t:${color}`, title: sp.types.map((t) => TYPE_NAMES[t]).join(' / ') }, typeGlyph(sp.types[0], 26)),
    h('div', { class: 'pk4-lv', style: at(505, 398, 805, 430), title: 'Nivel (1-100) y experiencia hasta el siguiente', 'data-testid': 'pk-level' },
      h('b', {}, `Nv. ${mon.level}`), h('small', {}, toNext ? `${Math.floor(mon.xp)} / ${toNext} EXP` : 'Nivel máximo')),
    h('div', { class: 'pk4-xp', style: at(505, 436, 805, 448) }, h('i', { style: `width:${toNext ? Math.min(100, (mon.xp / toNext) * 100) : 100}%` })),
    h('p', { class: 'pk4-blurb', style: at(505, 472, 812, 575) }, PLAYABLE_BLURB[sp.id] ?? ''),
  ];

  // --- PS, defensa y velocidad ---
  els.push(h('section', { class: 'pk4-card', style: at(482, 608, 826, 880) }));
  const def = side === 'special' ? sp.stats.sd : sp.stats.df;
  const vitals: [string, string, number, number, string][] = [
    ['u-heart', 'PS', stats.hp, Math.max(stats.hp, STAT_MAX.hp * 2), 'linear-gradient(90deg, #ff4a3a, #ff8a3a)'],
    ['u-shield', 'Defensa', def, STAT_MAX.df, 'linear-gradient(90deg, #2a7ff0, #5ab8ff)'],
    ['u-boot', 'Velocidad', stats.speed, STAT_MAX.speed, 'linear-gradient(90deg, #22b8ff, #6ae0ff)'],
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

  // --- mejoras permanentes (una carta por nivel) ---
  const n = (f: (c: (typeof mon.cards)[number]) => boolean) => mon.cards.filter(f).length;
  const TRAIN: { img: string; label: string; v: number }[] = [
    { img: 'u-sword', label: 'Ataque', v: n((c) => c.type === 'attack' || c.type === 'attackEvolution' || (c.type === 'stat' && (c.stat === 'atk' || c.stat === 'cd'))) },
    { img: 'u-heart', label: 'Vida', v: n((c) => c.type === 'stat' && (c.stat === 'hp' || c.stat === 'rgn')) },
    { img: 'u-shield', label: 'Defensa', v: n((c) => c.type === 'stat' && c.stat === 'def') },
    { img: 'u-burst', label: 'Habilidades', v: n((c) => c.type === 'ability') },
  ];
  const SLOT_X = [494, 573, 653, 732];
  els.push(h('section', { class: 'pk4-card', style: at(467, 920, 827, 1317) }),
    h('h3', { class: 'pk4-title', style: at(497, 940, 820, 990) }, 'Mejoras'),
    h('p', { class: 'pk4-desc', style: at(497, 996, 815, 1062) }, `${mon.cards.length} permanentes. Cada nivel, una más.`),
    ...TRAIN.map((t, i) => h('div', { class: 'pk4-slot', style: at(SLOT_X[i], 1081, SLOT_X[i] + 71, 1182), title: t.label },
      uiImg(t.img), h('b', {}, String(t.v)))),
    h('button', {
      class: 'pk4-train ready', style: at(488, 1203, 806, 1288), 'data-testid': 'train',
      onclick: () => openSheet(menu, `Mejoras de ${sp.name}`, () => cardList(mon.cards)),
    }, upArrow(), 'Ver mejoras'));

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

/** Flecha gruesa del botón de mejoras (como en el diseño). */
function upArrow(): HTMLElement {
  const box = h('span', { class: 'pk4-arrow' });
  box.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 3 12h6v10h6V12h6z" fill="currentColor"/></svg>';
  return box;
}

/** Quien abre una hoja: el menú o la pantalla del pueblo (la tienda). */
type Host = { app: App };

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
export function openSheet(menu: Host, title: string, body: () => HTMLElement): void {
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

/** Lista de las cartas permanentes, agrupadas y contadas. */
function cardList(cards: Parameters<typeof cardLabel>[0][]): HTMLElement {
  const groups = new Map<string, Map<string, { text: string; n: number }>>();
  for (const c of cards) {
    const l = cardLabel(c);
    const g = groups.get(l.group) ?? new Map();
    const e = g.get(l.name) ?? { text: l.text, n: 0 };
    e.n++;
    g.set(l.name, e);
    groups.set(l.group, g);
  }
  return h('section', { class: 'panel2 pk-body', 'data-testid': 'card-list' },
    h('div', { class: 'pk-body-head' }, h('h3', {}, 'Mejoras permanentes'),
      h('p', {}, 'Al subir de nivel en una ruta o un gimnasio eliges una carta. Se guardan si superas la ruta o el gimnasio; si caes, se pierden con la experiencia.')),
    cards.length ? null : h('p', { class: 'note' }, 'Aún no tiene ninguna. ¡Supera la Ruta 1 para conseguir las primeras!'),
    ...[...groups].map(([group, list]) => h('div', {},
      h('h4', { class: 'pk-h4' }, group),
      h('div', { class: 'move-grid' }, ...[...list].map(([name, e]) => h('div', { class: 'move-cell', style: '--t:#ffd23a' },
        h('b', {}, e.n > 1 ? `${name} ×${e.n}` : name), h('small', {}, e.text)))))),
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
      h('p', {}, 'Cada Pokémon tiene un único ataque que sale de sus tipos. Las cartas de ataque lo mejoran para siempre.')),
    h('div', { class: 'move-cell start', style: `--t:${colorA}` },
      h('b', {}, sig.name), h('small', {}, `${typeLine} · ${sig.cat === 'special' ? 'Especial' : 'Físico'}`), h('small', {}, sig.desc),
      sig.note ? h('small', {}, sig.note) : null),
    stat('Daño base', String(Math.round((s.dmg ?? 0) * 10) / 10)),
    stat('Ataques por segundo', (1 / s.cd).toFixed(1)),
    sig.kind === 'chain' ? stat('Saltos', String(s.count ?? 1)) : sig.kind === 'beam' ? null : stat('Proyectiles', String(s.count ?? 1)),
    h('div', { class: 'move-cell', style: '--t:#ffd23a' },
      h('b', {}, `Evoluciona a ${sig.evoName}`),
      h('small', {}, `Desde el nivel ${A.evoLevel}, con ${A.evoUpgrades} mejoras del ataque, entre ellas ${ATTACK_UPGRADE[EVO_KEY[sig.kind]].name}.`),
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
