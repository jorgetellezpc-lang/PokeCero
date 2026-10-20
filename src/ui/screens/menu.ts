import { KANTO } from '../../data/regions';
import { iconDataUrl } from '../../render/sprites';
import type { App, Screen } from '../app';
import { h, img } from '../dom';
import { renderGachaTab } from './gachaTab';
import { renderMapTab } from './mapTab';
import { renderPokemonTab } from './pokemonTab';
import { renderSettingsTab } from './settingsTab';

// Menú principal estilo Archero: barra superior de recursos, contenido y
// navegación inferior con cuatro apartados.

export type MenuTab = 'pokemon' | 'map' | 'gacha' | 'settings';

const TABS: { id: MenuTab; label: string; icon: string }[] = [
  { id: 'pokemon', label: 'Pokémon', icon: 'pokeball' },
  { id: 'map', label: 'Mapa', icon: 'map' },
  { id: 'gacha', label: 'Gachapón', icon: 'gacha' },
  { id: 'settings', label: 'Ajustes', icon: 'gear' },
];

export class MenuScreen implements Screen {
  el: HTMLElement;
  private content: HTMLElement;
  private topbar: HTMLElement;
  private nav: HTMLElement;
  private unsub: () => void;
  /** Estado de UI de cada pestaña que se conserva al re-renderizar. */
  ui: { selectedGym?: string } = {};

  constructor(readonly app: App, private tab: MenuTab) {
    this.topbar = h('header', { class: 'topbar' });
    this.content = h('main', { class: 'menu-content' });
    this.nav = h('nav', { class: 'bottom-nav' });
    this.el = h('div', { class: 'screen menu' }, this.topbar, this.content, this.nav);
    this.unsub = app.store.subscribe(() => this.render());
    this.render();
  }

  destroy(): void {
    this.unsub();
  }

  setTab(tab: MenuTab): void {
    this.tab = tab;
    this.content.scrollTop = 0;
    this.render();
  }

  render(): void {
    const d = this.app.store.data;
    const medals = (d.medals[KANTO.id] ?? []).length;
    this.topbar.replaceChildren(
      h('div', { class: 'res', 'data-testid': 'gold' }, img(iconDataUrl('coin', 2), 'res-icon'), String(d.gold)),
      h('div', { class: 'res', 'data-testid': 'tickets' }, img(iconDataUrl('ticket', 2), 'res-icon'), String(d.tickets)),
      h('div', { class: 'res' }, img(iconDataUrl('badge', 2), 'res-icon'), `${medals}/8`),
    );

    this.nav.replaceChildren(
      ...TABS.map((t) =>
        h('button', {
          class: `nav-btn ${t.id === this.tab ? 'active' : ''}`,
          'data-tab': t.id,
          onclick: () => this.setTab(t.id),
        }, img(iconDataUrl(t.icon, 2), 'nav-icon'), h('span', {}, t.label)),
      ),
    );

    const scroll = this.content.scrollTop;
    const body =
      this.tab === 'pokemon' ? renderPokemonTab(this) :
      this.tab === 'map' ? renderMapTab(this) :
      this.tab === 'gacha' ? renderGachaTab(this) :
      renderSettingsTab(this);
    this.content.replaceChildren(body);
    this.content.scrollTop = scroll;
  }
}
