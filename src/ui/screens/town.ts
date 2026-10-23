import { placeGym, ROUTES, TOWNS, type Spot, type TownDef } from '../../data/adventure';
import { getSpecies } from '../../data/pokemon';
import { World } from '../../game/world';
import { InputController } from '../../input/input';
import { arriveAt } from '../../meta/adventure';
import { active, missingStarters } from '../../meta/team';
import { CAPTURE_COST, canAffordCapture, payCapture } from '../../meta/capture';
import { preload } from '../../render/animator';
import { TownView } from '../../render/townView';
import type { App, Screen } from '../app';
import { h, pokeImg, toast } from '../dom';
import { uiImg } from './menu';

// ============================================================================
// Pueblo de la aventura: se recorre a pie con el joystick (sin combate), en
// pixel art (render/townView.ts) con minimapa. Al acercarte a un cartel, una
// puerta o un Pokémon aparece un botón para interactuar: diálogo, tienda de
// reto de captura (laboratorio), gimnasio o la salida hacia la siguiente ruta.
// ============================================================================

const STEP = 1 / 60;
/** Distancia (en el mundo) a la que se puede interactuar con un sitio. */
const REACH = 30;

const ICON: Record<Spot['kind'], string> = {
  talk: '💬', sign: '📜', shop: '🛒', center: '❤', gym: '🏟', exit: '➜', lab: '🔬',
};

export class TownScreen implements Screen {
  el: HTMLElement;
  readonly world: World;
  private readonly town: TownDef;
  private canvas: HTMLCanvasElement;
  readonly view: TownView;
  private mini: HTMLCanvasElement;
  private miniCtx: CanvasRenderingContext2D;
  private cssW = 0;
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
    const speciesId = active(store)?.species ?? 'charmander';
    this.world = new World({ speciesId, gym: placeGym(town), rooms: [1], town });
    this.world.player.invuln = 0;
    preload([getSpecies(speciesId).dex, ...town.npcs.map((n) => n.dex)]);

    this.canvas = h('canvas', { class: 'game-canvas town-canvas' });
    this.view = new TownView(this.canvas, town);
    this.mini = h('canvas', { class: 'town-mini-map' });
    this.miniCtx = this.mini.getContext('2d')!;

    this.actBtn = h('button', { class: 'town-act hidden', 'data-testid': 'town-act', onclick: () => this.act() });
    this.overlay = h('div', { class: 'overlay hidden' });
    const sp = getSpecies(speciesId);
    const hud = h('div', { class: 'town-hud' },
      h('div', { class: 'town-me' },
        h('span', { class: 'town-face', title: `Llevas a ${sp.name} en su Poké Ball` }, uiImg('avatar')),
        h('button', { class: 'town-map', 'data-testid': 'town-map', onclick: () => this.app.showMenu('map') }, 'Mapa'),
      ),
      h('div', { class: 'town-mini' }, this.mini, h('b', { class: 'town-name', 'data-testid': 'town-name' }, town.name)),
    );
    // Cartel con el nombre al llegar, como en los juegos clásicos.
    const banner = h('div', { class: 'town-banner' }, h('b', {}, town.name), h('small', {}, town.blurb));
    this.el = h('div', { class: 'screen run town', 'data-view': 'pixel', 'data-town': town.id },
      this.canvas, hud, banner, this.actBtn, this.overlay);
    this.input = new InputController(this.el, () => this.app.showMenu('map'));
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.el);
    app.audio.music('village');
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    this.resizeObs.disconnect();
    for (const s of document.querySelectorAll('.pk3-sheet-bg')) s.remove();
  }

  private resize(): void {
    const rect = this.el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cssW = rect.width;
    this.view.resize(rect.width, rect.height, dpr);
    const ms = Math.round(this.mini.getBoundingClientRect().width * dpr) || 200;
    this.mini.width = this.mini.height = ms;
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
      this.view.draw(this.world, this.busy ? null : this.near);
      this.view.drawMini(this.miniCtx, this.mini.width, this.world);
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
    if (best) this.actBtn.replaceChildren(h('span', { class: 'town-act-ic' }, 'A'), h('span', {}, best.label), h('small', {}, best.title));
  }

  /** Interactuar con el sitio cercano. */
  private act(): void {
    const s = this.near;
    if (!s || this.busy) return;
    this.app.audio.sfx('click');
    if (s.kind === 'shop') {
      this.dialog(s, ['—¡Bienvenido a la tienda!', '—Estamos preparando objetos para tus aventuras: pociones, caramelos raros… ¡Vuelve pronto!']);
      return;
    }
    if (s.kind === 'lab') {
      // Reto de captura 1 contra 1 por cada inicial que te falta.
      const store = this.app.store;
      const missing = missingStarters(store);
      const lines = [...(s.lines ?? [])];
      if (!missing.length) lines.push('—¡Ya tienes a los cuatro! Eres todo un entrenador.');
      else lines.push(`—Cada reto cuesta ${CAPTURE_COST} tickets. Tienes ${store.data.admin ? '∞' : store.data.tickets}. Su nivel se adapta al tuyo: ¡no será fácil!`);
      this.dialog(s, lines, missing.map((line) => ({
        label: `Retar a ${getSpecies(line).name}`,
        id: `capture-${line}`,
        run: () => {
          if (!canAffordCapture(store)) return toast(`Necesitas ${CAPTURE_COST} tickets para el reto.`);
          payCapture(store);
          this.app.startCapture(line);
        },
      })));
      return;
    }
    if (s.kind === 'gym' && s.gym === 'brock') {
      this.app.showGym('brock');
      return;
    }
    if (s.kind === 'exit' && s.route) {
      const r = ROUTES[s.route];
      this.dialog(s, [...(s.lines ?? []), `Son ${r.rooms} salas de combate. Si caes, vuelves a ${this.town.name}: el oro se queda, la experiencia no.`], [{
        label: `Ir a la ${r.name}`, id: 'town-go', run: () => this.app.startRoute(r.id),
      }]);
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

  /** Cuadro de diálogo (una línea tras otra). Opcionalmente, botones de acción al final. */
  private dialog(s: Spot, lines: string[], actions: { label: string; id: string; run: () => void }[] = []): void {
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
        ...(last ? actions.map((a) => h('button', { class: 'btn btn-play', 'data-testid': a.id, onclick: () => { close(); a.run(); } }, a.label)) : []),
        last ? h('button', { class: 'btn', 'data-testid': 'town-close', onclick: close }, actions.length ? 'Ahora no' : 'Cerrar') : null,
      ];
      buttons.replaceChildren(...btns.filter((b): b is HTMLButtonElement => !!b));
    };
    show();
    this.overlay.replaceChildren(h('div', { class: 'town-dlg', 'data-testid': 'town-dialog' },
      h('div', { class: 'town-dlg-head' }, s.dex ? pokeImg(s.dex, 48) : h('span', { class: 'town-dlg-ic' }, ICON[s.kind]), h('b', {}, s.title)),
      text, buttons));
    this.overlay.classList.remove('hidden');
  }
}
