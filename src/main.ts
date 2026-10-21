import './styles.css';
import { browserStorage, SaveStore } from './meta/save';
import { setSpriteResolver } from './render/animator';
import { App } from './ui/app';

// Versión de un solo archivo (npm run build:single): los sprites vienen incrustados.
const embedded = (window as unknown as { __POKECERO_SPRITES?: Record<string, string> }).__POKECERO_SPRITES;
if (embedded) setSpriteResolver((dex, anim) => embedded[`${dex}/${anim}`] ?? '');

const store = new SaveStore(browserStorage());
const app = new App(document.getElementById('app')!, store);
app.showMenu('map');

// Evita gestos del navegador (zoom por doble toque, menú contextual) durante el juego.
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Acceso de depuración para pruebas automáticas: solo con ?debug en la URL.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __pokecero: unknown }).__pokecero = { app, store };
}
