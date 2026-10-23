import { Audio } from '../audio/audio';
import type { SaveStore } from '../meta/save';
import { hasStarter } from '../meta/team';
import { MenuScreen, type MenuTab } from './screens/menu';
import { StarterScreen } from './screens/starter';
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
    store.subscribe(() => {
      this.audio.setVolumes({ music: store.data.settings.music, sfx: store.data.settings.sfx });
      // Progreso borrado: vuelta al test del inicial.
      if (!hasStarter(store) && !(this.current instanceof StarterScreen)) this.showStarter();
    });
  }

  /** Test de compatibilidad para elegir el inicial (partida nueva). */
  showStarter(): void {
    this.run = null;
    this.town = null;
    this.audio.music('village');
    this.show(new StarterScreen(this));
  }

  private show(screen: Screen): void {
    this.current?.destroy();
    this.root.replaceChildren(screen.el);
    this.current = screen;
  }

  showMenu(tab: MenuTab = 'map'): void {
    if (!hasStarter(this.store)) return this.showStarter();
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
    if (!hasStarter(this.store)) return this.showStarter();
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

  /** Reto de captura 1 contra 1 de un inicial (desde el laboratorio). */
  startCapture(line: string): void {
    this.town = null;
    const run = new RunScreen(this, line, 'capture');
    this.run = run;
    this.show(run);
  }

  /** Empieza una ruta de combate de la aventura. */
  startRoute(routeId: string): void {
    this.town = null;
    const run = new RunScreen(this, routeId, 'route');
    this.run = run;
    this.show(run);
  }
}
