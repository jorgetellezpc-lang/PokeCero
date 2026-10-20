import { BALANCE } from '../../config/balance';
import type { Settings } from '../../meta/save';
import { h, toast } from '../dom';
import type { MenuScreen } from './menu';

export function renderSettingsTab(menu: MenuScreen): HTMLElement {
  const store = menu.app.store;
  const s = store.data.settings;

  const toggle = (key: keyof Settings, label: string, desc: string) =>
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
    toggle('damageNumbers', 'Números de daño', 'Muestra el daño sobre los enemigos.'),
    toggle('vibration', 'Vibración', 'Vibra al recibir daño (si el dispositivo lo permite).'),
    h('h2', { class: 'section-title' }, 'Datos'),
    h('p', { class: 'note' }, 'El progreso se guarda en este navegador. Borrarlo elimina oro, tickets, medallas, Pokémon y mejoras.'),
    resetBtn,
    h('p', { class: 'note version' }, 'Pokécero · prototipo v0.1 · gráficos provisionales'),
  );
}
