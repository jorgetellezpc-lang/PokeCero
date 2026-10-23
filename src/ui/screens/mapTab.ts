import { BALANCE } from '../../config/balance';
import { BOSSES, tierCandidates } from '../../data/enemies';
import { REGIONS } from '../../data/regions';
import type { GymDef, RegionDef } from '../../data/types';
import { roomSequence } from '../../game/rooms';
import { TOWNS } from '../../data/adventure';
import { howToReach, isVisited } from '../../meta/adventure';
import { gymStatus, isClaimed, type GymStatus } from '../../meta/rewards';
import { caveArt } from '../../render/art';
import { animatedPokemon } from '../anim';
import { TYPE_COLORS, TYPE_NAMES } from '../../data/typeColors';
import { h, pokeImg, typeChip } from '../dom';
import { typeGlyph } from '../typeGlyph';
import { icon } from '../icons';
import type { MenuScreen } from './menu';

// Pestaña Mapa: la ilustración de la región con los gimnasios encima (y el
// botón Entrar), y la ficha de cada gimnasio. Las ilustraciones son las del
// diseño (public/ui); lo que va encima es la interfaz real del juego.

const STATUS_LABEL: Record<GymStatus, string> = {
  completed: 'Completado',
  available: 'Disponible',
  locked: 'Bloqueado',
  soon: 'Próximamente',
};

/**
 * Mapa de Kanto (diseño del usuario, public/ui/map-kanto.webp, 853 × 1290).
 * Los nombres de los lugares vienen dibujados; debajo de cada uno se pinta su
 * estado real (medallas en las ciudades con gimnasio, «Visitado» o candado en
 * el resto). Coordenadas en píxeles de la ilustración.
 */
const MAP = { w: 853, h: 1290 };
const pct = (x: number, y: number, w: number, hh: number) =>
  `left:${(x / MAP.w) * 100}%;top:${(y / MAP.h) * 100}%;width:${(w / MAP.w) * 100}%;height:${(hh / MAP.h) * 100}%`;

interface MapPlace {
  id: string;
  name: string;
  /** Etiqueta dibujada (zona táctil) y fila de estado bajo el nombre: [x0, y0, x1, y1]. */
  pill: [number, number, number, number];
  row: [number, number, number, number];
  /** Centro del lugar en la ilustración (miniatura de la tarjeta). */
  city: [number, number];
  /** Pueblo de la aventura (se puede entrar) y gimnasio, si los tiene. */
  town?: string;
  gym?: string;
  note?: string;
}
const PLACES: MapPlace[] = [
  { id: 'meseta', name: 'Meseta Añil', pill: [145, 117, 345, 175], row: [212, 144, 332, 170], city: [170, 60], note: 'La Liga Pokémon. Hacen falta las 8 medallas.' },
  { id: 'celeste', name: 'Ciudad Celeste', pill: [572, 230, 783, 292], row: [644, 264, 770, 288], city: [620, 320], gym: 'misty' },
  { id: 'plateada', name: 'Ciudad Plateada', pill: [92, 342, 338, 415], row: [172, 380, 320, 406], city: [210, 270], town: 'plateada', gym: 'brock' },
  { id: 'lavanda', name: 'Pueblo Lavanda', pill: [606, 415, 815, 477], row: [678, 446, 802, 470], city: [700, 550], note: 'Un pueblo tranquilo y misterioso.' },
  { id: 'azafran', name: 'Ciudad Azafrán', pill: [378, 495, 588, 555], row: [450, 525, 574, 549], city: [470, 600], gym: 'sabrina' },
  { id: 'azulona', name: 'Ciudad Azulona', pill: [40, 578, 268, 640], row: [116, 611, 254, 635], city: [90, 650], gym: 'erika' },
  { id: 'carmin', name: 'Ciudad Carmín', pill: [606, 675, 823, 737], row: [680, 708, 807, 732], city: [690, 790], gym: 'surge' },
  { id: 'verde', name: 'Ciudad Verde', pill: [183, 740, 400, 802], row: [257, 772, 384, 796], city: [290, 840], town: 'verde', gym: 'giovanni' },
  { id: 'fucsia', name: 'Ciudad Fucsia', pill: [422, 875, 640, 937], row: [497, 905, 624, 929], city: [520, 970], gym: 'koga' },
  { id: 'canela', name: 'Isla Canela', pill: [103, 1067, 322, 1128], row: [177, 1100, 305, 1124], city: [180, 1010], gym: 'blaine' },
  { id: 'paleta', name: 'Pueblo Paleta', pill: [572, 1123, 790, 1185], row: [646, 1154, 774, 1178], city: [640, 1120], town: 'paleta' },
];

const GYM_TEXT: Record<string, string> = {
  misty: 'Ciudad junto al mar, con un gimnasio de piscinas y una líder experta en el agua.',
  surge: 'El gran puerto de Kanto. Su líder domina la electricidad.',
  erika: 'La ciudad más grande de la región, con un gimnasio lleno de plantas.',
  koga: 'Ciudad del sur con un gimnasio de trampas y venenos.',
  sabrina: 'En el centro de Kanto, sede de una líder con poderes psíquicos.',
  blaine: 'Isla volcánica con un gimnasio que arde.',
};

export function renderMapTab(menu: MenuScreen): HTMLElement {
  const region = REGIONS[0];
  const store = menu.app.store;
  if (!menu.ui.selectedGym || !region.gyms.some((g) => g.id === menu.ui.selectedGym)) {
    const next = region.gyms.find((g) => gymStatus(store, region, g) === 'available') ?? region.gyms[0];
    menu.ui.selectedGym = next?.id;
  }
  const gym = region.gyms.find((g) => g.id === menu.ui.selectedGym);
  if (menu.ui.mapView === 'gym' && gym) return renderGym(menu, region, gym);
  return renderHome(menu, region);
}

// ----------------------------------------------------------------------------
// Portada: mapa de la región (deslizable) y tarjeta del lugar elegido
// ----------------------------------------------------------------------------

/** Progreso de un gimnasio de 0 a 1 (mejor sala alcanzada; completado = 1). */
function progressOf(menu: MenuScreen, region: RegionDef, g: GymDef): number {
  const store = menu.app.store;
  if (gymStatus(store, region, g) === 'completed') return 1;
  const best = store.data.bestRoom[g.id] ?? 0;
  const rooms = roomSequence(store.data.settings.testMode);
  return rooms.filter((r) => r <= best).length / rooms.length;
}

/** Lugar elegido en el mapa (por defecto, donde estás). */
let selectedPlace = '';

function renderHome(menu: MenuScreen, region: RegionDef): HTMLElement {
  const store = menu.app.store;
  const adv = store.data.adventure;
  if (!PLACES.some((p) => p.id === selectedPlace)) selectedPlace = adv.at;
  const place = PLACES.find((p) => p.id === selectedPlace) ?? PLACES[PLACES.length - 1];
  const gymOf = (p: MapPlace) => (p.gym ? region.gyms.find((g) => g.id === p.gym) : undefined);
  const visited = (p: MapPlace) => !!p.town && isVisited(store, p.town);

  // Estado bajo cada nombre: medallas solo donde hay gimnasio.
  const rows = PLACES.map((p) => {
    const g = gymOf(p);
    const [x0, y0, x1, y1] = p.row;
    const open = visited(p);
    const content: (HTMLElement | SVGSVGElement)[] = [];
    if (!open) content.push(icon('lock', 14));
    if (g) {
      const lit = Math.round(progressOf(menu, region, g) * 6);
      for (let i = 0; i < 6; i++) content.push(h('i', { class: `map3-dot ${i < lit ? 'on' : ''}` }));
    } else if (open) {
      content.push(h('span', { class: 'map3-visited' }, '✓ Visitado'));
    } else if (p.town) {
      content.push(h('span', { class: 'map3-soon' }, 'Sin visitar'));
    }
    return h('div', { class: 'map3-row', style: pct(x0 - 4, y0, x1 - x0 + 8, y1 - y0) }, ...content);
  });
  const hot = PLACES.map((p) => {
    const [x0, y0, x1, y1] = p.pill;
    return h('button', {
      class: `map3-hot ${p.id === place.id ? 'on' : ''} ${p.town && adv.at === p.town ? 'here' : ''}`, style: pct(x0, y0, x1 - x0, y1 - y0),
      'data-place': p.id, 'aria-label': p.name,
      onclick: () => { selectedPlace = p.id; menu.app.audio.sfx('click'); menu.render(); },
    });
  });

  // --- tarjeta del lugar elegido ---
  const g = gymOf(place);
  const town = place.town ? TOWNS[place.town] : undefined;
  const open = visited(place);
  const [cx, cy] = place.city;
  const thumb = place.id === 'plateada'
    ? h('div', { class: 'map3-thumb', style: 'background-image:url(ui/city-plateada.webp)' })
    : h('div', { class: 'map3-thumb', style: `background-image:url(ui/map-kanto.webp);background-size:330%;background-position:${Math.max(0, Math.min(100, ((cx - 129) / (MAP.w - 258)) * 100))}% ${Math.max(0, Math.min(100, ((cy - 98) / (MAP.h - 197)) * 100))}%` });
  const sub = g
    ? `${town ? 'Ciudad · ' : ''}Gimnasio de ${TYPE_NAMES[g.type]}${g.playable ? '' : town ? ' (cerrado)' : ''}`
    : town ? (town.id === 'paleta' ? 'Pueblo · Inicio de la aventura' : 'Pueblo') : 'Lugar';
  const desc = town ? (open ? town.blurb : howToReach(town.id)) : g ? GYM_TEXT[g.id] ?? '' : place.note ?? '';
  const side = g
    ? h('div', { class: 'map3-medal' },
      g.id === 'brock' ? h('img', { src: 'ui/medal-roca.webp', alt: '', class: 'map3-medal-ic' }) : h('span', { class: 'map3-medal-ic type', style: `--t:${TYPE_COLORS[g.type]}` }, typeGlyph(g.type, 22)),
      h('div', {}, h('b', {}, g.badge),
        h('span', { class: 'map3-medal-dots' }, ...Array.from({ length: 5 }, (_, i) => h('i', { class: i < Math.round(progressOf(menu, region, g) * 5) ? 'on' : '' })))))
    : h('div', { class: `map3-medal visit ${open ? 'on' : ''}` }, h('b', {}, open ? '✓ Visitado' : place.town ? 'Sin visitar' : 'Próximamente'));
  const enter = h('button', {
    class: `map3-enter ${open ? '' : 'off'}`, 'data-testid': 'enter', 'aria-label': `Entrar: ${place.name}`,
    onclick: () => { if (open && town) menu.app.showTown(town.id); },
  }, h('span', {}, open ? 'Entrar' : town ? 'Bloqueado' : 'Próximamente'), open ? h('span', { class: 'map3-enter-arrow' }, '▶') : icon('lock', 18));
  const card = h('section', { class: 'map3-card', 'data-testid': 'gym-card' },
    thumb,
    h('div', { class: 'map3-info' }, h('h2', {}, place.name), h('b', { class: 'map3-sub' }, sub), h('p', { 'data-testid': 'place-desc' }, desc), side),
    enter,
  );

  return h('div', { class: 'tab map3' },
    h('h1', { class: 'sr-only' }, `Pokécero · ${region.name}`),
    h('div', { class: 'map3-scroll' },
      h('div', { class: 'map3-art' },
        h('img', { class: 'map3-img', src: 'ui/map-kanto.webp', alt: `Mapa de ${region.name}`, draggable: 'false' }),
        ...rows, ...hot,
      ),
    ),
    card,
  );
}

// ----------------------------------------------------------------------------
// Ficha del gimnasio
// ----------------------------------------------------------------------------

function renderGym(menu: MenuScreen, region: RegionDef, gym: GymDef): HTMLElement {
  const store = menu.app.store;
  const st = gymStatus(store, region, gym);
  const test = store.data.settings.testMode;
  const rooms = roomSequence(test);
  const best = store.data.bestRoom[gym.id] ?? 0;
  const canPlay = (st === 'available' || st === 'completed') && gym.playable;
  const bossId = gym.bosses[BALANCE.rooms.bossRoom];
  const boss = bossId ? BOSSES[bossId] : null;
  const back = h('button', { class: 'back-btn2', 'aria-label': 'Volver', 'data-testid': 'back', onclick: () => menu.go('home') }, icon('back', 26));

  // Cabecera: la ilustración del gimnasio si existe (Brock); si no, una provisional.
  const hero = gym.id === 'brock'
    ? h('div', { class: 'gym-head art' },
      h('img', { src: 'ui/gym-brock.webp', alt: '', draggable: 'false' }),
      back,
      h('h2', { class: 'sr-only' }, `Gimnasio ${gym.order} · ${gym.city} · Líder: ${gym.leader} · ${STATUS_LABEL[st]}`),
    )
    : h('div', { class: 'gym-head', style: `--bg:url(${caveArt(gym.order * 13, gym.theme.rock)})` },
      back,
      h('div', { class: 'gym-head-text' },
        h('div', { class: 'gym-no' }, `Gimnasio ${gym.order}`),
        h('div', { class: 'gym-city' }, gym.city),
        h('div', { class: 'gym-leader' }, `Líder: ${gym.leader}`),
        h('div', { class: 'gym-chips' }, typeChip(gym.type), h('span', { class: `status ${st}` }, STATUS_LABEL[st])),
      ),
      boss ? animatedPokemon(boss.dex, 150, { cls: 'gym-boss', dir: 7 }) : icon('lock', 96, 'gym-boss lockbig'),
    );

  const entries = Object.entries(gym.bosses);
  const reachedIdx = entries.filter(([room]) => best >= Number(room)).length;
  const track = h('div', { class: 'track2' },
    h('div', { class: 'track2-line' }, ...entries.map((_, i) => h('i', { class: i < reachedIdx ? 'on' : '' }))),
    ...entries.map(([room, id]) => {
      const def = BOSSES[id];
      const tickets = BALANCE.rewards.ticketsByRoom[Number(room)] ?? 0;
      const claimed = isClaimed(store, gym.id, Number(room));
      return h('div', { class: `stop2 ${best >= Number(room) ? 'beaten' : ''}` },
        h('span', { class: 'stop2-room' }, `Sala ${room}`),
        h('span', { class: 'stop2-mon' }, pokeImg(def.dex, 84)),
        h('span', { class: 'stop2-name' }, def.name),
        h('span', { class: 'stop2-ped' }),
        h('span', { class: `stop2-reward ${claimed ? 'claimed' : ''}` }, h('small', {}, 'Recompensa'),
          h('b', {}, h('img', { src: 'ui/i-ticket.webp', alt: '', class: 'ui-ic' }), claimed ? 'Cobrado' : `+${tickets}`)),
      );
    }),
  );

  const info = h('div', { class: 'info4' },
    infoCell('g-map', test ? `${rooms.length} salas` : `${BALANCE.rooms.perGym} salas`, test ? 'Modo prueba' : 'Oleadas de enemigos'),
    infoCell('g-boss', 'Minibosses', 'Salas 20 y 40'),
    infoCell('g-crown', 'Jefe final', `Sala ${BALANCE.rooms.bossRoom}`),
    infoCell('g-best', 'Mejor sala', best ? String(best) : '—'),
  );

  // Posibles enemigos: los jefes y una muestra de los tramos de la Pokédex.
  const sample = entries.map(([, id]) => BOSSES[id].dex);
  for (let t = 0; t < 5 && sample.length < 7; t++) {
    const c = tierCandidates(t).filter((p) => p.types.includes(gym.type) || p.types.includes('ground'));
    const p = c[(gym.order * 7 + t * 3) % Math.max(1, c.length)];
    if (p && !sample.includes(p.dex)) sample.push(p.dex);
  }
  const enemies = h('div', { class: 'enemy-row' },
    ...sample.slice(0, 7).map((dex) => h('span', { class: 'enemy-slot' }, pokeImg(dex, 52))),
    h('button', { class: 'enemy-slot more', onclick: () => openEnemies() }, icon('next', 18), h('small', {}, 'Ver todos')),
  );

  return h('div', { class: 'tab tab-gym2', 'data-testid': 'gym-detail' },
    hero,
    gym.playable
      ? h('section', { class: 'panel2 tabbed' }, h('h3', { class: 'panel2-tab' }, 'Progreso del gimnasio'), track)
      : h('section', { class: 'panel2' }, h('p', { class: 'note center' }, st === 'locked' ? 'Consigue la medalla anterior para desbloquearlo.' : 'Este gimnasio aún está en desarrollo.')),
    gym.playable ? h('section', { class: 'panel2' }, h('h3', { class: 'panel2-title' }, 'Información del gimnasio'), info) : null,
    gym.playable ? h('section', { class: 'panel2' }, h('h3', { class: 'panel2-title' }, 'Posibles enemigos'), enemies) : null,
    canPlay
      ? h('div', { class: 'gym-foot', style: 'background-image:url(ui/gym-floor.webp)' },
        h('button', { class: 'cta', 'data-testid': 'play', onclick: () => menu.app.startRun(gym.id) },
          h('span', { class: 'cta-main' }, 'Comenzar'), h('span', { class: 'cta-sub' }, test ? `Modo prueba · ${rooms.length} salas` : `${rooms.length} salas`)))
      : null,
  );
}

function infoCell(img: string, title: string, sub: string): HTMLElement {
  return h('div', { class: 'info4-cell' }, h('img', { src: `ui/${img}.webp`, alt: '', class: 'info4-ic' }), h('b', {}, title), h('small', {}, sub));
}

function openEnemies(): void {
  const close = () => overlay.remove();
  const tiers = [0, 1, 2, 3, 4].map((t) => h('div', { class: 'tier-block' },
    h('b', {}, `Salas ${t * 10 + 1}–${t * 10 + 10}`),
    h('div', { class: 'tier-grid' }, ...tierCandidates(t).map((p) => h('span', { class: 'enemy-slot', title: p.name }, pokeImg(p.dex, 40)))),
  ));
  const overlay = h('div', { class: 'modal-backdrop', onclick: (e: Event) => { if (e.target === overlay) close(); } },
    h('div', { class: 'modal' },
      h('h2', { class: 'modal-title' }, 'Posibles enemigos'),
      h('p', { class: 'modal-text' }, 'En cada partida salen 7 Pokémon por tramo, sorteados entre estos (sin legendarios). Cuanto más avanzas, más fuertes.'),
      ...tiers,
      h('button', { class: 'cta small', onclick: close }, h('span', { class: 'cta-main' }, 'Cerrar')),
    ),
  );
  document.body.appendChild(overlay);
}
