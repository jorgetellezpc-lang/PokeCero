import './styles.css';
import { browserStorage, SaveStore } from './meta/save';
import { App } from './ui/app';

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
