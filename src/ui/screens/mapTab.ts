import { BALANCE } from '../../config/balance';
import { BOSSES, tierCandidates } from '../../data/enemies';
import { REGIONS } from '../../data/regions';
import type { GymDef, RegionDef } from '../../data/types';
import { roomSequence } from '../../game/rooms';
import { gymStatus, isClaimed, type GymStatus } from '../../meta/rewards';
import { caveArt } from '../../render/art';
import { animatedPokemon } from '../anim';
import { TYPE_COLORS, TYPE_NAMES } from '../../data/typeColors';
import { h, pokeImg, toast, typeChip } from '../dom';
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
 * Mapa de Kanto (diseño del usuario, public/ui/map-kanto.webp, 853 × 1545).
 * Las etiquetas de las ciudades vienen dibujadas; encima solo hay zonas
 * táctiles en su sitio exacto y, en Plateada, sus puntos de progreso
 * redibujados. Coordenadas en píxeles de la ilustración.
 */
const MAP = { w: 853, h: 1545 };
const pct = (x: number, y: number, w: number, hh: number) =>
  `left:${(x / MAP.w) * 100}%;top:${(y / MAP.h) * 100}%;width:${(w / MAP.w) * 100}%;height:${(hh / MAP.h) * 100}%`;

interface MapLabel { pill: [number, number, number, number]; city: [number, number]; gym?: string; name?: string; note?: string }
const LABELS: MapLabel[] = [
  { pill: [145, 117, 345, 175], city: [170, 60], name: 'Meseta Añil', note: 'La Liga Pokémon: hacen falta las 8 medallas.' },
  { pill: [572, 230, 783, 292], city: [620, 320], gym: 'misty' },
  { pill: [92, 342, 338, 415], city: [210, 270], gym: 'brock' },
  { pill: [606, 415, 815, 477], city: [700, 550], name: 'Pueblo Lavanda', note: 'Pueblo Lavanda no tiene gimnasio.' },
  { pill: [378, 495, 588, 555], city: [470, 600], gym: 'sabrina' },
  { pill: [40, 578, 268, 640], city: [90, 650], gym: 'erika' },
  { pill: [606, 675, 823, 737], city: [690, 790], gym: 'surge' },
  { pill: [183, 740, 400, 802], city: [290, 840], gym: 'giovanni' },
  { pill: [422, 875, 640, 937], city: [520, 970], gym: 'koga' },
  { pill: [103, 1067, 322, 1128], city: [180, 1010], gym: 'blaine' },
  { pill: [572, 1123, 790, 1185], city: [640, 1210], name: 'Pueblo Paleta', note: 'Pueblo Paleta: aquí empezó tu aventura.' },
];
/** Centro de los 6 puntos dibujados bajo «Ciudad Plateada». */
const BROCK_DOTS = [184, 208, 232, 256, 280, 305].map((x) => [x, 393] as const);

const GYM_TEXT: Record<string, string> = {
  brock: 'Una ciudad en lo alto de la montaña, con un gimnasio de gran tradición.',
  misty: 'Ciudad junto al mar, con un gimnasio de piscinas y una líder experta en el agua.',
  surge: 'El gran puerto de Kanto. Su líder domina la electricidad.',
  erika: 'La ciudad más grande de la región, con un gimnasio lleno de plantas.',
  koga: 'Ciudad del sur con un gimnasio de trampas y venenos.',
  sabrina: 'En el centro de Kanto, sede de una líder con poderes psíquicos.',
  blaine: 'Isla volcánica con un gimnasio que arde.',
  giovanni: 'El último gimnasio de Kanto. Pocos lo han visto abierto.',
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
// Portada: mapa de la región y tarjeta del gimnasio elegido
// ----------------------------------------------------------------------------

/** Progreso de un gimnasio de 0 a 1 (mejor sala alcanzada; completado = 1). */
function progressOf(menu: MenuScreen, region: RegionDef, g: GymDef): number {
  const store = menu.app.store;
  if (gymStatus(store, region, g) === 'completed') return 1;
  const best = store.data.bestRoom[g.id] ?? 0;
  const rooms = roomSequence(store.data.settings.testMode);
  return rooms.filter((r) => r <= best).length / rooms.length;
}

function renderHome(menu: MenuScreen, region: RegionDef): HTMLElement {
  const store = menu.app.store;
  const gym = region.gyms.find((g) => g.id === menu.ui.selectedGym) ?? region.gyms[0];
  const select = (id: string) => { menu.ui.selectedGym = id; menu.app.audio.sfx('click'); menu.render(); };

  const hot = LABELS.map((l) => {
    const [x0, y0, x1, y1] = l.pill;
    const g = l.gym ? region.gyms.find((x) => x.id === l.gym) : undefined;
    return h('button', {
      class: `map2-hot ${g && g.id === gym.id ? 'on' : ''}`, style: pct(x0, y0, x1 - x0, y1 - y0),
      'data-gym': g?.id ?? '', 'aria-label': g ? g.city : l.name ?? '',
      onclick: () => (g ? select(g.id) : toast(l.note ?? '')),
    });
  });
  const lit = Math.round(progressOf(menu, region, region.gyms[0]) * BROCK_DOTS.length);
  const dots = BROCK_DOTS.map(([x, y], i) => h('i', { class: `map2-dot ${i < lit ? 'on' : ''}`, style: pct(x - 10, y - 10, 20, 20) }));

  // --- tarjeta del gimnasio elegido ---
  const st = gymStatus(store, region, gym);
  const canPlay = (st === 'available' || st === 'completed') && gym.playable;
  const label = LABELS.find((l) => l.gym === gym.id);
  const [cx, cy] = label?.city ?? [426, 700];
  const thumb = gym.id === 'brock'
    ? h('div', { class: 'map2-thumb', style: 'background-image:url(ui/city-plateada.webp)' })
    : h('div', { class: 'map2-thumb', style: `background-image:url(ui/map-kanto.webp);background-size:330%;background-position:${Math.max(0, Math.min(100, ((cx - 129) / (MAP.w - 258)) * 100))}% ${Math.max(0, Math.min(100, ((cy - 98) / (MAP.h - 197)) * 100))}%` });
  const pr = progressOf(menu, region, gym);
  const medal = h('div', { class: 'map2-medal' },
    gym.id === 'brock' ? h('img', { src: 'ui/medal-roca.webp', alt: '', class: 'map2-medal-ic' }) : h('span', { class: 'map2-medal-ic type', style: `--t:${TYPE_COLORS[gym.type]}` }, typeGlyph(gym.type, 26)),
    h('div', {}, h('b', {}, gym.badge),
      h('span', { class: 'map2-medal-dots' }, ...Array.from({ length: 5 }, (_, i) => h('i', { class: i < Math.round(pr * 5) ? 'on' : '' })))),
  );
  const enter = h('button', {
    class: `map2-enter ${canPlay ? '' : 'off'}`, 'data-testid': 'enter', 'aria-label': `Entrar: ${gym.city}`,
    onclick: () => (canPlay ? menu.go('gym', gym.id) : toast(st === 'locked' ? `Consigue antes la medalla de ${region.gyms[gym.order - 2]?.city ?? 'el gimnasio anterior'}.` : 'Este gimnasio aún está en desarrollo.')),
  }, h('span', {}, canPlay ? 'Entrar' : st === 'locked' ? 'Bloqueado' : 'Próximamente'), canPlay ? h('span', { class: 'map2-enter-arrow' }, '▶') : icon('lock', 20));
  const card = h('section', { class: 'map2-card', 'data-testid': 'gym-card', style: pct(22, 1293, 808, 237) },
    thumb,
    h('div', { class: 'map2-info' },
      h('h2', {}, gym.city),
      h('b', { class: 'map2-sub' }, `Gimnasio de ${TYPE_NAMES[gym.type]}`),
      h('p', {}, GYM_TEXT[gym.id] ?? ''),
    ),
    medal,
    enter,
  );

  return h('div', { class: 'tab map2' },
    h('h1', { class: 'sr-only' }, `Pokécero · ${region.name}`),
    h('div', { class: 'map2-art' },
      h('img', { class: 'map2-img', src: 'ui/map-kanto.webp', alt: `Mapa de ${region.name}`, draggable: 'false' }),
      ...dots,
      ...hot,
      card,
    ),
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
