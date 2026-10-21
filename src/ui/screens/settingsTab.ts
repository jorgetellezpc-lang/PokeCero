import { BALANCE } from '../../config/balance';
import type { Settings } from '../../meta/save';
import { h, toast } from '../dom';
import type { MenuScreen } from './menu';

type BoolSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
type NumSetting = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];

export function renderSettingsTab(menu: MenuScreen): HTMLElement {
  const store = menu.app.store;
  const s = store.data.settings;

  const toggle = (key: BoolSetting, label: string, desc: string) =>
    h('label', { class: 'setting' },
      h('div', {}, h('b', {}, label), h('div', { class: 'note' }, desc)),
      h('input', {
        type: 'checkbox', class: 'switch', 'data-setting': key, checked: s[key],
        onchange: (e: Event) => {
          const v = (e.target as HTMLInputElement).checked;
          store.update((d) => { d.settings[key] = v; });
        },
      }),
    );

  const slider = (key: NumSetting, label: string) =>
    h('label', { class: 'setting' },
      h('div', {}, h('b', {}, label)),
      h('input', {
        type: 'range', min: 0, max: 100, step: 5, value: Math.round(s[key] * 100), class: 'slider', 'data-setting': key,
        onchange: (e: Event) => {
          const v = Number((e.target as HTMLInputElement).value) / 100;
          store.update((d) => { d.settings[key] = v; });
          menu.app.audio.sfx('click');
        },
      }),
    );

  let resetArmed = false;
  const resetBtn = h('button', {
    class: 'btn btn-danger',
    onclick: () => {
      if (!resetArmed) {
        resetArmed = true;
        resetBtn.textContent = '¿Seguro? Toca otra vez para borrar';
        return;
      }
      store.reset();
      toast('Progreso borrado');
    },
  }, 'Borrar todo el progreso');

  return h('div', { class: 'tab tab-settings' },
    h('h2', { class: 'section-title' }, 'Ajustes'),
    toggle('testMode', 'Modo prueba', `Gimnasio corto de ${BALANCE.rooms.testModeRooms.length} salas (incluye minibosses y jefe) con más experiencia. Desactívalo para jugar las 50 salas.`),
    slider('music', 'Música'),
    slider('sfx', 'Efectos de sonido'),
    toggle('damageNumbers', 'Números de daño', 'Muestra el daño sobre los enemigos.'),
    toggle('vibration', 'Vibración', 'Vibra al recibir daño (si el dispositivo lo permite).'),
    h('h2', { class: 'section-title' }, 'Datos'),
    h('p', { class: 'note' }, 'El progreso se guarda en este navegador. Borrarlo elimina oro, tickets, medallas, Pokémon y mejoras.'),
    resetBtn,
    h('h2', { class: 'section-title' }, 'Créditos'),
    h('p', { class: 'note' },
      'Movimientos, enemigos, jefes, cartas, objetos, gachapón, efectos y música basados en PokéSurvivor © 2026 JPTER78 (github.com/JPTER78/pokesurvivor), licencia PolyForm Noncommercial 1.0.0. ',
      'Sprites de PMD SpriteCollab (CC BY-NC 4.0); artistas en sprites/CREDITS.md. Datos de PokeAPI. ',
      'Pokémon es propiedad de Nintendo, Creatures Inc. y GAME FREAK. Proyecto de fan sin ánimo de lucro.'),
    h('p', { class: 'note version' }, 'Pokécero · prototipo v0.2'),
  );
}
