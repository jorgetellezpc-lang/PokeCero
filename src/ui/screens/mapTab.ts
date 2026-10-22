import { BALANCE } from '../../config/balance';
import { BOSSES, tierCandidates } from '../../data/enemies';
import { REGIONS } from '../../data/regions';
import type { GymDef, RegionDef } from '../../data/types';
import { roomSequence } from '../../game/rooms';
import { gymStatus, isClaimed, type GymStatus } from '../../meta/rewards';
import { caveArt } from '../../render/art';
import { animatedPokemon } from '../anim';
import { h, pokeImg, typeChip } from '../dom';
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

/** Tamaño de la ilustración de la región (px) y dónde va cada cosa en ella. */
const ART = { w: 941, h: 1375 };
const PINS: Record<string, [number, number]> = {
  brock: [301, 530], misty: [752, 425], surge: [647, 769], erika: [560, 470],
  koga: [503, 933], sabrina: [691, 570], blaine: [181, 862], giovanni: [369, 709],
};
const box = (x: number, y: number, w: number, h: number) =>
  `left:${(x / ART.w) * 100}%;top:${(y / ART.h) * 100}%;width:${(w / ART.w) * 100}%;height:${(h / ART.h) * 100}%`;
const at = (x: number, y: number) => `left:${(x / ART.w) * 100}%;top:${(y / ART.h) * 100}%`;

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
// Portada: mapa de la región
// ----------------------------------------------------------------------------

function renderHome(menu: MenuScreen, region: RegionDef): HTMLElement {
  const store = menu.app.store;
  const medals = (store.data.medals[region.id] ?? []).length;
  const next = region.gyms.find((g) => gymStatus(store, region, g) === 'available') ?? region.gyms.find((g) => gymStatus(store, region, g) === 'completed');

  const pins = region.gyms.map((g) => {
    const st = gymStatus(store, region, g);
    const [x, y] = PINS[g.id] ?? [g.mapPos.x * ART.w, g.mapPos.y * ART.h];
    const open = st === 'available' || st === 'completed';
    const city = g.id === 'brock' ? g.city : g.city.replace('Ciudad ', '');
    if (open) {
      const best = store.data.bestRoom[g.id] ?? 0;
      const rooms = roomSequence(store.data.settings.testMode);
      const done = rooms.filter((r) => r <= best).length;
      const boss = g.bosses[BALANCE.rooms.bossRoom];
      return h('button', { class: `gpin open ${st} ${g.id === 'brock' ? 'baked' : ''}`, style: at(x, y), 'data-gym': g.id, onclick: () => menu.go('gym', g.id) },
        // El retrato de Brock ya está en la ilustración; para los demás, su jefe.
        h('span', { class: 'gpin-face' }, g.id !== 'brock' && boss ? pokeImg(BOSSES[boss].dex, 64) : null),
        h('span', { class: 'gpin-name' }, city),
        h('span', { class: 'gpin-dots' }, ...rooms.map((_, i) => h('i', { class: i < done ? 'on' : '' }))),
      );
    }
    return h('button', { class: 'gpin locked', style: at(x, y), 'data-gym': g.id, onclick: () => menu.go('gym', g.id) },
      icon('lock', 30), h('span', {}, city));
  });

  return h('div', { class: 'tab tab-home' },
    h('div', { class: 'home-stage' },
      h('div', { class: 'home-art' },
        h('img', { class: 'home-img', src: 'ui/home-kanto.webp', alt: '', draggable: 'false' }),
        h('h1', { class: 'sr-only' }, 'Pokécero'),
        ...pins,
        next
          ? h('button', { class: 'cta home-cta', style: box(245, 1110, 452, 140), 'data-testid': 'enter', onclick: () => menu.go('gym', next.id) },
            h('span', { class: 'cta-main' }, 'Entrar'), h('span', { class: 'cta-sub' }, `${next.order}. ${next.city}`), h('span', { class: 'cta-arrow' }, '▶'))
          : null,
      ),
      // Fuera de la ilustración: así no se corta si la pantalla es estrecha
      // (tapa el letrero dibujado, que queda en el mismo sitio).
      h('div', { class: 'region-pill2' },
        icon('pokeball', 54),
        h('span', { class: 'rp-text' }, h('b', {}, region.name), h('small', {}, `Medallas ${medals}/8`),
          h('span', { class: 'rp-bar' }, ...region.gyms.map((_, i) => h('i', { class: i < medals ? 'on' : '' })))),
      ),
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
        h('span', { class: 'stop2-mon' }, animatedPokemon(def.dex, 96, { dir: 0 })),
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
