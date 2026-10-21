// Utilidad mínima para crear elementos sin framework.

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'class') {
      el.className = String(v);
    } else if (k === 'html') {
      el.innerHTML = String(v);
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function img(src: string, cls = '', alt = ''): HTMLImageElement {
  return h('img', { src, class: `pix ${cls}`, alt, draggable: 'false' });
}

export { TYPE_COLORS, TYPE_NAMES } from '../data/typeColors';
import { TYPE_COLORS, TYPE_NAMES } from '../data/typeColors';
import { portrait } from '../render/animator';

/** Retrato del Pokémon (primer fotograma de su sprite); se rellena al cargar. */
export function pokeImg(dex: number, size = 64, cls = '', silhouette = false): HTMLImageElement {
  const el = img('', cls);
  el.width = size;
  el.height = size;
  void portrait(dex, size * 2, silhouette).then((url) => { if (url) el.src = url; });
  return el;
}

export function typeChip(t: string): HTMLElement {
  const k = t as keyof typeof TYPE_COLORS;
  return h('span', { class: 'type-chip', style: `background:${TYPE_COLORS[k] ?? '#888'}` }, TYPE_NAMES[k] ?? t);
}

export function toast(text: string): void {
  const el = h('div', { class: 'toast' }, text);
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 1800);
  setTimeout(() => el.remove(), 2300);
}
