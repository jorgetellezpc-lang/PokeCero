import { BALANCE } from '../../config/balance';
import type { GraphicsQuality, Settings } from '../../meta/save';
import { h, toast } from '../dom';
import { icon, type IconName } from '../icons';
import type { MenuScreen } from './menu';

// Pestaña Ajustes: lista de opciones con iconos, guía, créditos y borrar progreso.

type BoolSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
type NumSetting = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];

const GRAPHICS: { id: GraphicsQuality; label: string }[] = [
  { id: 'auto', label: 'Automática' }, { id: 'high', label: 'Alta' }, { id: 'medium', label: 'Media' }, { id: 'low', label: 'Baja' },
];

export function renderSettingsTab(menu: MenuScreen): HTMLElement {
  const store = menu.app.store;
  const s = store.data.settings;

  const row = (ic: IconName, label: string, control: HTMLElement | null, desc?: string, extra: Record<string, unknown> = {}) =>
    h('label', { class: 'set-row', ...extra as Record<string, string> },
      h('span', { class: 'set-ico' }, icon(ic, 22)),
      h('span', { class: 'set-text' }, h('b', {}, label), desc ? h('small', {}, desc) : null),
      control,
    );

  const toggle = (key: BoolSetting) => h('input', {
    type: 'checkbox', class: 'switch', 'data-setting': key, checked: s[key],
    onchange: (e: Event) => {
      const v = (e.target as HTMLInputElement).checked;
      store.update((d) => { d.settings[key] = v; });
    },
  });

  const slider = (key: NumSetting) => h('input', {
    type: 'range', min: 0, max: 100, step: 5, value: Math.round(s[key] * 100), class: 'slider', 'data-setting': key,
    style: `--v:${Math.round(s[key] * 100)}%`,
    oninput: (e: Event) => { const el = e.target as HTMLInputElement; el.style.setProperty('--v', `${el.value}%`); },
    onchange: (e: Event) => {
      const v = Number((e.target as HTMLInputElement).value) / 100;
      store.update((d) => { d.settings[key] = v; });
      menu.app.audio.sfx('click');
    },
  });

  const gfx = GRAPHICS.find((g) => g.id === s.graphics) ?? GRAPHICS[0];
  const gfxBtn = h('button', {
    class: 'set-value', 'data-setting': 'graphics',
    onclick: (e: Event) => {
      e.preventDefault();
      const i = GRAPHICS.findIndex((g) => g.id === gfx.id);
      store.update((d) => { d.settings.graphics = GRAPHICS[(i + 1) % GRAPHICS.length].id; });
    },
  }, gfx.label, h('span', { class: 'chev' }, '›'));

  let resetArmed = false;
  const resetBtn = h('button', {
    class: 'danger-btn',
    onclick: () => {
      if (!resetArmed) {
        resetArmed = true;
        resetBtn.textContent = '¿Seguro? Toca otra vez para borrar todo';
        return;
      }
      store.reset();
      toast('Progreso borrado');
    },
  }, icon('reset', 22), ' Restablecer progreso');

  return h('div', { class: 'tab tab-settings' },
    h('h2', { class: 'page-title' }, icon('gear', 30), ' Ajustes'),
    h('section', { class: 'set-list' },
      row('music', 'Música', slider('music')),
      row('sound', 'Efectos de sonido', slider('sfx')),
      row('vibrate', 'Vibración', toggle('vibration'), 'Al recibir daño, si el móvil lo permite'),
      row('numbers', 'Números de daño', toggle('damageNumbers')),
      row('quality', 'Vista de la cámara', h('input', {
        type: 'range', min: 70, max: 140, step: 5, value: Math.round(s.zoom * 100), class: 'slider', 'data-setting': 'zoom',
        style: `--v:${((s.zoom * 100 - 70) / 70) * 100}%`,
        oninput: (e: Event) => { const el = e.target as HTMLInputElement; el.style.setProperty('--v', `${((Number(el.value) - 70) / 70) * 100}%`); },
        onchange: (e: Event) => { const v = Number((e.target as HTMLInputElement).value) / 100; store.update((d) => { d.settings.zoom = v; }); },
      }), `${s.zoom < 0.95 ? 'Más lejos' : s.zoom > 1.05 ? 'Más cerca' : 'Normal'} · ${Math.round(s.zoom * 100)} %`),
      row('quality', 'Calidad gráfica', gfxBtn, s.graphics === 'auto' ? 'Se ajusta sola si el móvil va justo' : 'Fija para el escenario 3D'),
      row('flag', 'Modo prueba', toggle('testMode'), `Gimnasio corto de ${BALANCE.rooms.testModeRooms.length} salas con más experiencia`),
    ),
    h('section', { class: 'set-list' },
      linkRow('guide', 'Guía del juego', () => openInfo('Guía del juego', GUIDE)),
      linkRow('info', 'Créditos', () => openInfo('Créditos', CREDITS)),
    ),
    resetBtn,
    h('p', { class: 'note center' }, 'El progreso se guarda en este navegador. Restablecerlo borra oro, tickets, medallas, Pokémon y mejoras.'),
    h('p', { class: 'note center version' }, 'Pokécero · prototipo v0.4'),
  );
}

function linkRow(ic: IconName, label: string, onclick: () => void): HTMLElement {
  return h('button', { class: 'set-row link', onclick },
    h('span', { class: 'set-ico' }, icon(ic, 22)), h('span', { class: 'set-text' }, h('b', {}, label)), h('span', { class: 'chev' }, '›'));
}

const GUIDE = [
  'Muévete arrastrando el dedo por cualquier parte de la pantalla. Al soltarlo y quedarte quieto, tu Pokémon ataca solo al enemigo más cercano.',
  'Derrota a todos los enemigos de la sala y sube por la puerta del fondo para pasar a la siguiente.',
  'Cada Pokémon tiene un único ataque que sale de sus tipos. Al subir de nivel eliges 1 de 3 cartas: mejoras de ese ataque, estadísticas y habilidades. Algunas habilidades juntas activan sinergias.',
  'Con nivel suficiente y las mejoras clave, el ataque EVOLUCIONA (carta dorada). Si tu Pokémon evoluciona, su ataque se transforma y conserva las mejoras.',
  'Cada gimnasio tiene 50 salas, con minibosses en la 20 y la 40 y el líder en la 50. Los jefes cambian de fase al perder vida.',
  'Puedes jugar con Bulbasaur, Charmander, Squirtle o Pikachu, todos disponibles desde el principio; evolucionan durante la partida. El resto de Pokémon de Kanto son tus enemigos.',
  'El oro sirve para mejoras permanentes de cada Pokémon. Guarda los tickets: pronto se canjearán en el gachapón. Al morir conservas el oro y los tickets.',
];

const CREDITS = [
  'Movimientos, enemigos, jefes, cartas, objetos, gachapón, efectos y música basados en PokéSurvivor © 2026 JPTER78 (github.com/JPTER78/pokesurvivor), licencia PolyForm Noncommercial 1.0.0.',
  'Sprites de PMD SpriteCollab (CC BY-NC 4.0); artistas en sprites/CREDITS.md. Datos de PokeAPI. Escenario 3D con Three.js (MIT).',
  'Pokémon es propiedad de Nintendo, Creatures Inc. y GAME FREAK. Proyecto de fan sin ánimo de lucro.',
];

function openInfo(title: string, lines: string[]): void {
  const close = () => overlay.remove();
  const overlay = h('div', { class: 'modal-backdrop', onclick: (e: Event) => { if (e.target === overlay) close(); } },
    h('div', { class: 'modal' },
      h('h2', { class: 'modal-title' }, title),
      ...lines.map((l) => h('p', { class: 'modal-text' }, l)),
      h('button', { class: 'cta small', onclick: close }, h('span', { class: 'cta-main' }, 'Entendido')),
    ),
  );
  document.body.appendChild(overlay);
}
