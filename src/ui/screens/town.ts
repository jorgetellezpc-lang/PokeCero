import { placeGym, ROUTES, TOWNS, type Spot, type TownDef } from '../../data/adventure';
import { getSpecies } from '../../data/pokemon';
import { World } from '../../game/world';
import { InputController } from '../../input/input';
import { arriveAt } from '../../meta/adventure';
import { perksFor } from '../../meta/shop';
import { preload } from '../../render/animator';
import { Renderer, type Viewport } from '../../render/renderer';
import { Scene3D } from '../../render/scene3d';
import type { App, Screen } from '../app';
import { h, pokeImg } from '../dom';
import { openSheet, upgrades } from './pokemonTab';

// ============================================================================
// Pueblo de la aventura: se recorre a pie con el joystick (sin combate), con
// el mismo escenario 3D que las salas. Al acercarte a un cartel, una puerta o
// un Pokémon aparece un botón para interactuar: diálogo, tienda de
// entrenamiento, gimnasio o la salida hacia la siguiente ruta.
// ============================================================================

const STEP = 1 / 60;
/** Distancia (en el mundo) a la que se puede interactuar con un sitio. */
const REACH = 30;

const ICON: Record<Spot['kind'], string> = {
  talk: '💬', sign: '📜', shop: '🛒', center: '❤', gym: '🏟', exit: '➜',
};

export class TownScreen implements Screen {
  el: HTMLElement;
  readonly world: World;
  private readonly town: TownDef;
  private canvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;
  private scene3d: Scene3D | null;
  private renderer: Renderer | null = null;
  private vp: Viewport = { dpr: 1, scale: 1, ox: 0, oy: 0 };
  private cssW = 0;
  private cssH = 0;
  private input: InputController;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private resizeObs: ResizeObserver;
  private actBtn: HTMLButtonElement;
  private overlay: HTMLElement;
  private near: Spot | null = null;
  /** Diálogo u hoja abiertos: el Pokémon no se mueve. */
  private busy = false;

  constructor(readonly app: App, townId: string) {
    const town = TOWNS[townId];
    this.town = town;
    const store = app.store;
    arriveAt(store, town.id);
    const speciesId = store.data.selectedPokemon;
    this.world = new World({ speciesId, gym: placeGym(town), rooms: [1], town, perks: perksFor(store, speciesId) });
    this.world.player.invuln = 0;
    preload([getSpecies(speciesId).dex, ...town.npcs.map((n) => n.dex)]);

    this.canvas = h('canvas', { class: 'game-canvas' });
    this.overlayCanvas = h('canvas', { class: 'game-canvas game-overlay' });
    this.scene3d = Scene3D.create(this.canvas, this.overlayCanvas, store.data.settings.graphics);
    if (this.scene3d) {
      this.scene3d.showDamageNumbers = false;
      this.scene3d.zoom = store.data.settings.zoom;
    } else {
      this.renderer = new Renderer(this.canvas.getContext('2d')!);
    }

    this.actBtn = h('button', { class: 'town-act hidden', 'data-testid': 'town-act', onclick: () => this.act() });
    this.overlay = h('div', { class: 'overlay hidden' });
    const top = h('div', { class: 'town-top' },
      h('div', { class: 'town-name', 'data-testid': 'town-name' }, h('b', {}, town.name), h('small', {}, town.blurb)),
      h('button', { class: 'town-map', 'data-testid': 'town-map', onclick: () => this.app.showMenu('map') }, 'Mapa'),
    );
    this.el = h('div', { class: `screen run town ${this.scene3d ? 'run-3d' : ''}`, 'data-view': this.scene3d ? '3d' : '2d', 'data-town': town.id },
      this.canvas, ...(this.scene3d ? [this.overlayCanvas, h('div', { class: 'vignette' })] : []), top, this.actBtn, this.overlay);
    this.input = new InputController(this.el, () => this.app.showMenu('map'));
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.el);
    app.audio.music('village');
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.scene3d?.dispose();
    this.input.destroy();
    this.resizeObs.disconnect();
    for (const s of document.querySelectorAll('.pk3-sheet-bg')) s.remove();
  }

  private resize(): void {
    const rect = this.el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cssW = rect.width;
    this.cssH = rect.height;
    if (this.scene3d) {
      this.scene3d.resize(rect.width, rect.height, dpr);
      return;
    }
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    const scale = Math.min(rect.width / this.world.W, rect.height / this.world.H);
    this.vp = { dpr, scale, ox: (rect.width - this.world.W * scale) / 2, oy: (rect.height - this.world.H * scale) / 2 };
  }

  private frame = (t: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    if (!this.last) this.last = t;
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    this.acc += dt;
    let steps = 0;
    const move = this.busy ? { x: 0, y: 0 } : this.input.vector;
    while (this.acc >= STEP && steps < 6) {
      this.world.update(STEP, move);
      this.acc -= STEP;
      steps++;
    }
    if (steps >= 6) this.acc = 0;
    this.world.events.length = 0;
    this.updateNear();
    if (this.cssW) {
      if (this.scene3d) this.scene3d.draw(this.world);
      else this.renderer?.draw(this.world, this.vp, this.cssW, this.cssH);
    }
  };

  /** Sitio más cercano al alcance y su botón. */
  private updateNear(): void {
    const p = this.world.player;
    let best: Spot | null = null;
    let bd = REACH;
    for (const s of this.town.spots) {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < bd) { bd = d; best = s; }
    }
    if (best === this.near) return;
    this.near = best;
    this.actBtn.classList.toggle('hidden', !best || this.busy);
    if (best) this.actBtn.replaceChildren(h('span', { class: 'town-act-ic' }, ICON[best.kind]), h('span', {}, best.label), h('small', {}, best.title));
  }

  /** Interactuar con el sitio cercano. */
  private act(): void {
    const s = this.near;
    if (!s || this.busy) return;
    this.app.audio.sfx('click');
    if (s.kind === 'shop') {
      const sp = getSpecies(this.app.store.data.selectedPokemon);
      this.setBusy(true);
      openSheet(this, `Tienda · Entrenar a ${sp.name}`, () => upgrades(this, sp));
      // La hoja se cierra sola (botón o fondo): al quitarse, se puede volver a andar.
      const watch = new MutationObserver(() => {
        if (!document.querySelector('.pk3-sheet-bg')) { watch.disconnect(); this.setBusy(false); }
      });
      watch.observe(document.body, { childList: true });
      return;
    }
    if (s.kind === 'gym' && s.gym === 'brock') {
      this.app.showGym('brock');
      return;
    }
    if (s.kind === 'exit' && s.route) {
      const r = ROUTES[s.route];
      this.dialog(s, [...(s.lines ?? []), `Son ${r.rooms} salas de combate. Si caes, vuelves a ${this.town.name}; el oro ganado se queda.`], {
        label: `Ir a la ${r.name}`, run: () => this.app.startRoute(r.id),
      });
      return;
    }
    this.dialog(s, s.lines ?? []);
  }

  private setBusy(b: boolean): void {
    this.busy = b;
    this.input.enabled = !b;
    if (b) this.input.reset();
    this.near = null;
  }

  /** Cuadro de diálogo (una línea tras otra). Opcionalmente, un botón de acción al final. */
  private dialog(s: Spot, lines: string[], action?: { label: string; run: () => void }): void {
    this.setBusy(true);
    let i = 0;
    const text = h('p', { class: 'town-line', 'data-testid': 'town-line' });
    const buttons = h('div', { class: 'town-dlg-btns' });
    const close = () => { this.overlay.classList.add('hidden'); this.overlay.replaceChildren(); this.setBusy(false); };
    const show = () => {
      text.textContent = lines[i] ?? '';
      const last = i >= lines.length - 1;
      const btns = [
        !last ? h('button', { class: 'btn', 'data-testid': 'town-next', onclick: () => { i++; show(); } }, 'Siguiente') : null,
        last && action ? h('button', { class: 'btn btn-play', 'data-testid': 'town-go', onclick: () => { close(); action.run(); } }, action.label) : null,
        last ? h('button', { class: 'btn', 'data-testid': 'town-close', onclick: close }, action ? 'Ahora no' : 'Cerrar') : null,
      ];
      buttons.replaceChildren(...btns.filter((b): b is HTMLButtonElement => !!b));
    };
    show();
    this.overlay.replaceChildren(h('div', { class: 'panel town-dlg', 'data-testid': 'town-dialog' },
      h('div', { class: 'town-dlg-head' }, s.dex ? pokeImg(s.dex, 48) : h('span', { class: 'town-dlg-ic' }, ICON[s.kind]), h('b', {}, s.title)),
      text, buttons));
    this.overlay.classList.remove('hidden');
  }
}
