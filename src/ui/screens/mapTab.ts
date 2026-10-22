import { BALANCE } from '../../config/balance';
import { BOSSES } from '../../data/enemies';
import { REGIONS } from '../../data/regions';
import type { GymDef, RegionDef } from '../../data/types';
import { roomSequence } from '../../game/rooms';
import { gymStatus, isClaimed, regionUnlocked, type GymStatus } from '../../meta/rewards';
import { caveArt, islandArt } from '../../render/art';
import { iconDataUrl } from '../../render/sprites';
import { animatedPokemon } from '../anim';
import { h, img, pokeImg, TYPE_COLORS, typeChip } from '../dom';
import type { MenuScreen } from './menu';

// Pestaña Mapa en tres pantallas: portada de la región (isla y botón
// Entrar), mapa con los gimnasios y ficha del gimnasio (jefes, recompensas y
// Comenzar).

const STATUS_LABEL: Record<GymStatus, string> = {
  completed: 'Completado',
  available: 'Disponible',
  locked: 'Bloqueado',
  soon: 'Próximamente',
};

export function renderMapTab(menu: MenuScreen): HTMLElement {
  const region = REGIONS[Math.min(menu.ui.region, REGIONS.length - 1)];
  const store = menu.app.store;
  if (!menu.ui.selectedGym || !region.gyms.some((g) => g.id === menu.ui.selectedGym)) {
    const next = region.gyms.find((g) => gymStatus(store, region, g) === 'available') ?? region.gyms[0];
    menu.ui.selectedGym = next?.id;
  }
  const gym = region.gyms.find((g) => g.id === menu.ui.selectedGym);
  if (menu.ui.mapView === 'gym' && gym) return renderGym(menu, region, gym);
  if (menu.ui.mapView === 'map' && regionUnlocked(store, region) && region.gyms.length) return renderMap(menu, region);
  return renderHome(menu, region);
}

const islandFor = (region: RegionDef, tall: boolean) =>
  islandArt({ seed: region.id.length * 97 + region.name.charCodeAt(0), w: 120, h: tall ? 132 : 104, towns: region.gyms.map((g) => g.mapPos) });

// ----------------------------------------------------------------------------
// Portada de la región
// ----------------------------------------------------------------------------

function renderHome(menu: MenuScreen, region: RegionDef): HTMLElement {
  const store = menu.app.store;
  const unlocked = regionUnlocked(store, region);
  const medals = (store.data.medals[region.id] ?? []).length;
  const next = region.gyms.find((g) => gymStatus(store, region, g) === 'available') ?? region.gyms.find((g) => gymStatus(store, region, g) === 'completed');
  const step = (d: number) => {
    menu.ui.region = (menu.ui.region + d + REGIONS.length) % REGIONS.length;
    menu.ui.selectedGym = undefined;
    menu.render();
  };
  const req = REGIONS.find((r) => r.id === region.requires);
  return h('div', { class: 'tab tab-home' },
    h('h1', { class: 'logo', 'aria-label': 'Pokécero' }, 'POKÉCER', h('span', { class: 'logo-ball' })),
    h('div', { class: 'region-card' },
      h('button', { class: `island-btn ${unlocked ? '' : 'locked'}`, 'aria-label': `Ver el mapa de ${region.name}`, onclick: () => unlocked && menu.go('map') },
        img(islandFor(region, false), 'island-img'),
        unlocked ? null : h('div', { class: 'island-lock' }, img(iconDataUrl('lock', 3), 'lock-icon'), h('span', {}, `Consigue las 8 medallas de ${req?.name ?? ''}`)),
      ),
      h('div', { class: 'region-pill' }, h('span', { class: 'mini-ball' }),
        h('span', {}, h('b', {}, region.name), h('small', {}, unlocked ? `Medallas ${medals}/8` : 'Bloqueada'))),
      REGIONS.length > 1 ? h('button', { class: 'arrow left', 'aria-label': 'Región anterior', onclick: () => step(-1) }, '‹') : null,
      REGIONS.length > 1 ? h('button', { class: 'arrow right', 'aria-label': 'Región siguiente', onclick: () => step(1) }, '›') : null,
    ),
    h('div', { class: 'dots' }, ...REGIONS.map((_, i) => h('span', { class: i === menu.ui.region ? 'on' : '' }))),
    unlocked && next
      ? h('button', { class: 'cta', 'data-testid': 'enter', onclick: () => menu.go('gym', next.id) },
        h('span', { class: 'cta-main' }, 'Entrar'), h('span', { class: 'cta-sub' }, `${next.order}. ${next.city}`))
      : h('button', { class: 'cta disabled', disabled: true }, h('span', { class: 'cta-main' }, unlocked ? 'Próximamente' : 'Bloqueada')),
    unlocked && region.gyms.length ? h('button', { class: 'link-btn', 'data-testid': 'open-map', onclick: () => menu.go('map') }, `Ver el mapa de ${region.name}`) : null,
    unlocked && region.gyms.length
      ? h('section', { class: 'panel' },
        h('h3', { class: 'panel-title' }, `Medallas de ${region.name}`),
        h('div', { class: 'badge-row' }, ...[...region.gyms].sort((a, b) => a.order - b.order).map((g) => {
          const got = gymStatus(store, region, g) === 'completed';
          return h('span', { class: `badge-slot ${got ? 'got' : ''}`, title: g.badge, style: `--type:${TYPE_COLORS[g.type]}` },
            img(iconDataUrl('badge', 2, got ? { g: '#f8d030', w: '#fff8c0', d: '#c09020' } : undefined), 'badge-ico'));
        })),
      )
      : null,
  );
}

// ----------------------------------------------------------------------------
// Mapa de la región
// ----------------------------------------------------------------------------

function renderMap(menu: MenuScreen, region: RegionDef): HTMLElement {
  const store = menu.app.store;
  const medals = (store.data.medals[region.id] ?? []).length;
  const gyms = [...region.gyms].sort((a, b) => a.order - b.order);
  const path = gyms.map((g) => `${(g.mapPos.x * 100).toFixed(1)},${(g.mapPos.y * 100).toFixed(1)}`).join(' ');
  const nodes = gyms.map((g) => {
    const st = gymStatus(store, region, g);
    const open = st === 'available' || st === 'completed';
    const boss = g.bosses[BALANCE.rooms.bossRoom];
    const face = open && boss ? pokeImg(BOSSES[boss].dex, 40, 'pin-face') : img(iconDataUrl('lock', 2), 'pin-lock');
    return h('button', {
      class: `pin ${st}`,
      style: `left:${g.mapPos.x * 100}%;top:${g.mapPos.y * 100}%;--type:${TYPE_COLORS[g.type]}`,
      'data-gym': g.id,
      onclick: () => menu.go('gym', g.id),
    },
      h('span', { class: 'pin-head' }, face, h('span', { class: 'pin-no' }, String(g.order))),
      h('span', { class: 'pin-label' }, g.city.replace('Ciudad ', '')),
    );
  });
  return h('div', { class: 'tab tab-map' },
    subhead(menu, 'home', region.name, `Medallas ${medals}/8`),
    h('div', { class: 'map-board' },
      img(islandFor(region, true), 'map-img'),
      svgPath(path),
      ...nodes,
    ),
    h('p', { class: 'note center' }, 'Toca un gimnasio para ver sus jefes y recompensas.'),
  );
}

function svgPath(points: string): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'map-path');
  const line = document.createElementNS(ns, 'polyline');
  line.setAttribute('points', points);
  svg.appendChild(line);
  return svg;
}

function subhead(menu: MenuScreen, back: 'home' | 'map', title: string, sub: string): HTMLElement {
  return h('div', { class: 'subhead' },
    h('button', { class: 'back-btn', 'aria-label': 'Volver', 'data-testid': 'back', onclick: () => menu.go(back) }, '‹'),
    h('div', {}, h('div', { class: 'subhead-title' }, title), h('div', { class: 'subhead-sub' }, sub)),
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

  const hero = h('div', { class: 'gym-hero', style: `--bg:url(${caveArt(gym.order * 13, gym.theme.rock)})` },
    h('div', { class: 'gym-hero-text' },
      h('div', { class: 'gym-no' }, `Gimnasio ${gym.order}`),
      h('div', { class: 'gym-city' }, gym.city),
      h('div', { class: 'gym-leader' }, `Líder: ${gym.leader}`),
      h('div', { class: 'gym-chips' }, typeChip(gym.type), h('span', { class: `status ${st}` }, STATUS_LABEL[st])),
    ),
    boss ? animatedPokemon(boss.dex, 150, { cls: 'gym-boss', dir: 7 }) : img(iconDataUrl('lock', 4), 'gym-boss lockbig'),
  );

  // Recorrido: los tres jefes del gimnasio, con los ya superados tachados.
  const stops = Object.entries(gym.bosses).map(([room, id]) => {
    const def = BOSSES[id];
    const beaten = best > Number(room) || (Number(room) === BALANCE.rooms.bossRoom && st === 'completed');
    return h('div', { class: `stop ${beaten ? 'beaten' : ''}` },
      h('span', { class: 'stop-mark' }, beaten ? '✕' : String(room)),
      h('span', { class: 'stop-face' }, pokeImg(def.dex, 48)),
      h('b', {}, `Sala ${room}`),
      h('small', {}, def.name),
    );
  });
  const reached = Math.min(1, best / BALANCE.rooms.perGym);

  const rewardEntries = Object.entries(BALANCE.rewards.ticketsByRoom);
  const total = rewardEntries.reduce((a, [, n]) => a + n, 0);
  const rewards = rewardEntries.map(([room, n]) => h('span', { class: `reward-chip ${isClaimed(store, gym.id, Number(room)) ? 'claimed' : ''}` },
    `Sala ${room}: `, isClaimed(store, gym.id, Number(room)) ? 'cobrado' : `+${n}`));

  return h('div', { class: 'tab tab-gym', 'data-testid': 'gym-detail' },
    subhead(menu, 'map', `Gimnasio ${gym.order}`, gym.city),
    hero,
    gym.playable
      ? h('section', { class: 'panel' },
        h('h3', { class: 'panel-title' }, 'Progreso del gimnasio'),
        h('div', { class: 'track' }, h('div', { class: 'track-line' }, h('span', { style: `width:${reached * 100}%` })), ...stops),
        h('div', { class: 'note center' }, best ? `Mejor sala: ${best} de ${BALANCE.rooms.perGym}` : `${BALANCE.rooms.perGym} salas · minibosses en la 20 y la 40 · jefe en la 50`),
      )
      : h('section', { class: 'panel' }, h('p', { class: 'note center' }, st === 'locked' ? 'Consigue la medalla anterior para desbloquearlo.' : 'Este gimnasio aún está en desarrollo.')),
    gym.playable
      ? h('section', { class: 'panel' },
        h('h3', { class: 'panel-title' }, 'Recompensas'),
        h('div', { class: 'reward-total' }, img(iconDataUrl('ticket', 3), 'reward-icon'), h('b', {}, `+${total}`), h('small', {}, `(${rewardEntries.map(([, n]) => n).join(' + ')})`), h('span', { class: 'medal-reward' }, img(iconDataUrl('badge', 2), 'res-icon'), gym.badge)),
        h('div', { class: 'reward-chips' }, ...rewards),
      )
      : null,
    canPlay
      ? h('button', { class: 'cta', 'data-testid': 'play', onclick: () => menu.app.startRun(gym.id) },
        h('span', { class: 'cta-main' }, 'Comenzar'), h('span', { class: 'cta-sub' }, test ? `Modo prueba · ${rooms.length} salas` : `${rooms.length} salas`))
      : null,
  );
}
