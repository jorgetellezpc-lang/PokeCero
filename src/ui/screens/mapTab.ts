import { BALANCE } from '../../config/balance';
import { BOSSES } from '../../data/enemies';
import { REGIONS } from '../../data/regions';
import type { GymDef, RegionDef } from '../../data/types';
import { gymStatus, isClaimed, regionUnlocked, type GymStatus } from '../../meta/rewards';
import { iconDataUrl } from '../../render/sprites';
import { roomSequence } from '../../game/rooms';
import { h, img, TYPE_COLORS, typeChip } from '../dom';
import type { MenuScreen } from './menu';

const STATUS_LABEL: Record<GymStatus, string> = {
  completed: 'Completado',
  available: 'Disponible',
  locked: 'Bloqueado',
  soon: 'Próximamente',
};

export function renderMapTab(menu: MenuScreen): HTMLElement {
  const store = menu.app.store;
  const parts: HTMLElement[] = [];
  for (const region of REGIONS) {
    if (!regionUnlocked(store, region)) {
      parts.push(h('div', { class: 'region-locked' },
        img(iconDataUrl('lock', 3), 'lock-icon'),
        h('div', {}, h('b', {}, region.name), h('div', { class: 'note' }, `Consigue las 8 medallas de ${REGIONS.find((r) => r.id === region.requires)?.name} para desbloquear esta región.`)),
      ));
      continue;
    }
    parts.push(renderRegion(menu, region));
  }
  return h('div', { class: 'tab tab-map' }, ...parts);
}

function renderRegion(menu: MenuScreen, region: RegionDef): HTMLElement {
  const store = menu.app.store;
  const medals = (store.data.medals[region.id] ?? []).length;
  if (!menu.ui.selectedGym || !region.gyms.some((g) => g.id === menu.ui.selectedGym)) {
    const firstOpen = region.gyms.find((g) => gymStatus(store, region, g) === 'available') ?? region.gyms[0];
    menu.ui.selectedGym = firstOpen.id;
  }
  const selected = region.gyms.find((g) => g.id === menu.ui.selectedGym)!;

  const nodes = region.gyms.map((g) => {
    const st = gymStatus(store, region, g);
    return h('button', {
      class: `map-node ${st} ${g.id === selected.id ? 'selected' : ''}`,
      style: `left:${g.mapPos.x * 100}%;top:${g.mapPos.y * 100}%;--type:${TYPE_COLORS[g.type]}`,
      'data-gym': g.id,
      onclick: () => { menu.ui.selectedGym = g.id; menu.render(); },
    },
      img(iconDataUrl(st === 'locked' || st === 'soon' ? 'lock' : 'badge', 2, st === 'completed' ? { g: '#f8d030', w: '#fff8c0', d: '#c09020' } : undefined), 'node-icon'),
      h('span', { class: 'node-label' }, g.city.replace('Ciudad ', '')),
    );
  });

  return h('section', { class: 'region' },
    h('div', { class: 'region-head' }, h('h2', { class: 'section-title' }, region.name), h('span', { class: 'medal-count' }, `Medallas ${medals}/8`)),
    h('div', { class: 'map-board' }, h('div', { class: 'map-land' }), ...nodes),
    renderGymDetail(menu, region, selected),
  );
}

function renderGymDetail(menu: MenuScreen, region: RegionDef, gym: GymDef): HTMLElement {
  const store = menu.app.store;
  const st = gymStatus(store, region, gym);
  const test = store.data.settings.testMode;
  const rooms = roomSequence(test);
  const best = store.data.bestRoom[gym.id] ?? 0;

  const rewards = Object.entries(BALANCE.rewards.ticketsByRoom).map(([room, n]) => {
    const claimed = isClaimed(store, gym.id, Number(room));
    const bossId = gym.bosses[Number(room)];
    const bossName = bossId ? BOSSES[bossId]?.name ?? '' : '';
    return h('div', { class: `reward ${claimed ? 'claimed' : ''}` },
      h('span', {}, `Sala ${room}${bossName ? ` · ${bossName}` : ''}`),
      h('span', { class: 'price' }, img(iconDataUrl('ticket', 2), 'res-icon'), claimed ? 'Cobrado' : `+${n}`),
    );
  });

  const canPlay = st === 'available' || st === 'completed';
  return h('div', { class: 'gym-detail', 'data-testid': 'gym-detail' },
    h('div', { class: 'gym-title' },
      h('div', {}, h('b', {}, `Gimnasio ${gym.order} · ${gym.city}`), h('div', { class: 'note' }, `Líder: ${gym.leader} · ${gym.badge}`)),
      typeChip(gym.type),
    ),
    h('div', { class: `status ${st}` }, STATUS_LABEL[st]),
    gym.playable ? h('div', { class: 'note' },
      `${rooms.length} salas${test ? ' (modo prueba)' : ''} · Minibosses en salas 20 y 40 · Jefe en sala 50`,
      best ? ` · Mejor sala: ${best}` : '',
    ) : h('div', { class: 'note' }, st === 'locked' ? 'Consigue la medalla anterior para desbloquearlo.' : 'Contenido en desarrollo.'),
    gym.playable ? h('div', { class: 'rewards' }, ...rewards) : null,
    canPlay && gym.playable
      ? h('button', { class: 'btn btn-play', 'data-testid': 'play', onclick: () => menu.app.startRun(gym.id) }, '¡Entrar!')
      : null,
  );
}
