import { Audio } from '../audio/audio';
import type { SaveStore } from '../meta/save';
import { MenuScreen, type MenuTab } from './screens/menu';
import { RunScreen } from './screens/run';
import { TownScreen } from './screens/town';

// Navegación de alto nivel: menú principal ↔ pueblo ↔ partida (gimnasio o ruta).

export interface Screen { el: HTMLElement; destroy(): void }

export class App {
  private current: Screen | null = null;
  run: RunScreen | null = null;
  town: TownScreen | null = null;
  readonly audio: Audio;

  constructor(private root: HTMLElement, readonly store: SaveStore) {
    const s = store.data.settings;
    this.audio = new Audio({ music: s.music, sfx: s.sfx });
    store.subscribe(() => this.audio.setVolumes({ music: store.data.settings.music, sfx: store.data.settings.sfx }));
  }

  private show(screen: Screen): void {
    this.current?.destroy();
    this.root.replaceChildren(screen.el);
    this.current = screen;
  }

  showMenu(tab: MenuTab = 'map'): void {
    this.run = null;
    this.town = null;
    this.audio.music('village');
    this.show(new MenuScreen(this, tab));
  }

  /** Ficha de un gimnasio (con Comenzar), dentro de la pestaña Mapa. */
  showGym(gymId: string): void {
    this.showMenu('map');
    (this.current as MenuScreen).go('gym', gymId);
  }

  /** Entra a un pueblo de la aventura. */
  showTown(townId: string): void {
    this.run = null;
    const town = new TownScreen(this, townId);
    this.town = town;
    this.show(town);
  }

  startRun(gymId: string): void {
    this.town = null;
    const run = new RunScreen(this, gymId);
    this.run = run;
    this.show(run);
  }

  /** Empieza una ruta de combate de la aventura. */
  startRoute(routeId: string): void {
    this.town = null;
    const run = new RunScreen(this, routeId, true);
    this.run = run;
    this.show(run);
  }
}
