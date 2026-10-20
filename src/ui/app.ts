import type { SaveStore } from '../meta/save';
import { MenuScreen, type MenuTab } from './screens/menu';
import { RunScreen } from './screens/run';

// Navegación de alto nivel: menú principal ↔ partida.

export interface Screen { el: HTMLElement; destroy(): void }

export class App {
  private current: Screen | null = null;
  run: RunScreen | null = null;

  constructor(private root: HTMLElement, readonly store: SaveStore) {}

  private show(screen: Screen): void {
    this.current?.destroy();
    this.root.replaceChildren(screen.el);
    this.current = screen;
  }

  showMenu(tab: MenuTab = 'map'): void {
    this.run = null;
    this.show(new MenuScreen(this, tab));
  }

  startRun(gymId: string): void {
    const run = new RunScreen(this, gymId);
    this.run = run;
    this.show(run);
  }
}
