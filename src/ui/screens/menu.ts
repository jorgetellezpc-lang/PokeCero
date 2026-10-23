import { KANTO } from '../../data/regions';
import { getSpecies } from '../../data/pokemon';
import type { App, Screen } from '../app';
import { active } from '../../meta/team';
import { h } from '../dom';
import { renderGachaTab } from './gachaTab';
import { renderMapTab } from './mapTab';
import { renderPokemonTab } from './pokemonTab';
import { renderSettingsTab } from './settingsTab';

// Menú principal estilo Archero: barra superior (tu Pokémon, medallas, oro,
// tickets y ajustes), contenido y navegación inferior con cuatro apartados.

export type MenuTab = 'pokemon' | 'map' | 'gacha' | 'settings';

const TABS: { id: MenuTab; label: string; img: string }[] = [
  { id: 'pokemon', label: 'Pokémon', img: 'n-pokemon' },
  { id: 'map', label: 'Mapa', img: 'n-map' },
  { id: 'gacha', label: 'Gachapón', img: 'n-gacha' },
  { id: 'settings', label: 'Ajustes', img: 'n-gear' },
];

/** Pantalla dentro de la pestaña Mapa: portada de la región, mapa o ficha del gimnasio. */
export type MapView = 'home' | 'map' | 'gym';

export class MenuScreen implements Screen {
  el: HTMLElement;
  private content: HTMLElement;
  private topbar: HTMLElement;
  private nav: HTMLElement;
  private unsub: () => void;
  /** Estado de UI de cada pestaña que se conserva al re-renderizar. */
  ui: { selectedGym?: string; mapView: MapView; region: number } = { mapView: 'home', region: 0 };

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
    if (tab === 'map' && this.tab === 'map') this.ui.mapView = 'home';
    this.tab = tab;
    this.content.scrollTop = 0;
    this.render();
  }

  /** Cambia de pantalla dentro del Mapa. */
  go(view: MapView, gymId?: string): void {
    this.ui.mapView = view;
    if (gymId) this.ui.selectedGym = gymId;
    this.content.scrollTop = 0;
    this.render();
  }

  render(): void {
    const d = this.app.store.data;
    const medals = (d.medals[KANTO.id] ?? []).length;
    const sp = getSpecies(active(this.app.store)?.species ?? 'charmander');
    // Avisos «!» con sentido (ahora no hay nada pendiente en Pokémon ni en el gachapón).
    const alerts: Partial<Record<MenuTab, boolean>> = {
      pokemon: false,
      gacha: false, // sin sorteo por ahora: no hay nada que hacer allí
    };
    this.topbar.replaceChildren(
      h('button', { class: 'tb-avatar', 'aria-label': `Tu Pokémon: ${sp.name}`, onclick: () => this.setTab('pokemon') },
        h('span', { class: 'tb-face' }, uiImg('avatar')),
        h('span', { class: 'tb-medals' },
          h('b', { class: 'tb-region' }, KANTO.name),
          h('span', { class: 'tb-medals-num', 'data-testid': 'medals' }, `Medallas ${medals}/8`),
          h('span', { class: 'tb-dots' }, ...Array.from({ length: 8 }, (_, i) => h('i', { class: i < medals ? 'on' : '' }))),
        ),
      ),
      h('div', { class: 'pill', 'data-testid': 'gold', title: `${d.gold} de oro` }, uiImg('i-coin'), d.admin ? '∞' : compact(d.gold)),
      h('div', { class: 'pill', 'data-testid': 'tickets' }, uiImg('i-ticket'), d.admin ? '∞' : String(d.tickets)),
      h('button', { class: 'tb-gear', 'aria-label': 'Ajustes', onclick: () => this.setTab('settings') }, uiImg('i-gear')),
    );

    this.nav.replaceChildren(
      ...TABS.map((t) =>
        h('button', {
          class: `nav-btn ${t.id === this.tab ? 'active' : ''}`,
          'data-tab': t.id,
          onclick: () => this.setTab(t.id),
        }, h('span', { class: 'nav-ico' }, uiImg(t.img, 'nav-icon')), h('span', { class: 'nav-label' }, t.label),
        alerts[t.id] ? h('span', { class: 'nav-alert' }, '!') : null),
      ),
    );

    const scroll = this.content.scrollTop;
    const body =
      this.tab === 'pokemon' ? renderPokemonTab(this) :
      this.tab === 'map' ? renderMapTab(this) :
      this.tab === 'gacha' ? renderGachaTab(this) :
      renderSettingsTab(this);
    this.content.classList.toggle('full', this.tab === 'map' && this.ui.mapView === 'home');
    // Las pestañas con escenario a pantalla completa cambian la barra superior (menu.css).
    this.el.dataset.tab = this.tab;
    this.el.style.backgroundImage = this.tab === 'pokemon' ? 'url(ui/pk-bg.webp)' : this.tab === 'map' && this.ui.mapView === 'home' ? 'url(ui/map-blur.webp)' : '';
    this.content.replaceChildren(body);
    this.content.scrollTop = scroll;
  }
}

/** 12600 → "12.6K" (el valor exacto va en el atributo title). */
function compact(n: number): string {
  if (n < 10000) return String(n);
  return `${(n / 1000).toFixed(n < 100000 ? 1 : 0).replace('.0', '')}K`;
}

/** Icono recortado del diseño (public/ui). */
export function uiImg(name: string, cls = ''): HTMLImageElement {
  return h('img', { src: `ui/${name}.webp`, alt: '', class: `ui-ic ${cls}`, draggable: 'false' });
}
