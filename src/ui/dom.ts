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

export const TYPE_NAMES: Record<string, string> = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', grass: 'Planta', electric: 'Eléctrico', rock: 'Roca',
  ground: 'Tierra', poison: 'Veneno', flying: 'Volador', bug: 'Bicho', psychic: 'Psíquico', fighting: 'Lucha',
};

export const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', grass: '#78c850', electric: '#f8d030', rock: '#b8a038',
  ground: '#e0c068', poison: '#a040a0', flying: '#a890f0', bug: '#a8b820', psychic: '#f85888', fighting: '#c03028',
};

export function typeChip(t: string): HTMLElement {
  return h('span', { class: 'type-chip', style: `background:${TYPE_COLORS[t] ?? '#888'}` }, TYPE_NAMES[t] ?? t);
}

export function toast(text: string): void {
  const el = h('div', { class: 'toast' }, text);
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 1800);
  setTimeout(() => el.remove(), 2300);
}
