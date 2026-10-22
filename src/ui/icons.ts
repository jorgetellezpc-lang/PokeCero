// Iconos dibujados (SVG) para los menús, en el estilo del ejemplo: formas
// redondeadas con degradado y contorno. Sin pixel art.

let uid = 0;

function svg(body: (id: string) => string, size: number, cls = ''): SVGSVGElement {
  const id = `ic${uid++}`;
  const wrap = document.createElement('span');
  wrap.innerHTML = `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${body(id)}</svg>`;
  return wrap.firstElementChild as SVGSVGElement;
}

const grad = (id: string, a: string, b: string) =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;

const ICONS: Record<string, (id: string) => string> = {
  coin: (id) => `${grad(id, '#ffe680', '#f0a800')}<circle cx="24" cy="24" r="19" fill="url(#${id})" stroke="#9a6200" stroke-width="3"/><circle cx="24" cy="24" r="12" fill="none" stroke="#c88a00" stroke-width="2.5"/><path d="M24 15l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z" fill="#fff6c0" stroke="#9a6200" stroke-width="2" stroke-linejoin="round"/>`,
  ticket: (id) => `${grad(id, '#ff9ad0', '#e8408c')}<path d="M6 14h36v6a4 4 0 0 0 0 8v6H6v-6a4 4 0 0 0 0-8z" fill="url(#${id})" stroke="#8a1450" stroke-width="3" stroke-linejoin="round"/><path d="M30 15v18" stroke="#ffe0f0" stroke-width="2.5" stroke-dasharray="3 3"/><path d="M14 21h10M14 27h7" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  medal: (id) => `${grad(id, '#e8f0ff', '#8fa0c8')}<path d="M24 4l17 10v20L24 44 7 34V14z" fill="url(#${id})" stroke="#4a5880" stroke-width="3" stroke-linejoin="round"/><path d="M24 12l9 5v12l-9 5-9-5V17z" fill="#fff" opacity=".55"/>`,
  medalGold: (id) => `${grad(id, '#fff2a0', '#e8a000')}<path d="M24 4l17 10v20L24 44 7 34V14z" fill="url(#${id})" stroke="#8a5a00" stroke-width="3" stroke-linejoin="round"/><path d="M24 12l9 5v12l-9 5-9-5V17z" fill="#fff" opacity=".6"/>`,
  gear: (id) => `${grad(id, '#ffffff', '#c8d4f0')}<path d="M21 4h6l1 6 5 2 5-4 4 4-4 5 2 5 6 1v6l-6 1-2 5 4 5-4 4-5-4-5 2-1 6h-6l-1-6-5-2-5 4-4-4 4-5-2-5-6-1v-6l6-1 2-5-4-5 4-4 5 4 5-2z" fill="url(#${id})" stroke="#3a4a80" stroke-width="2.5" stroke-linejoin="round"/><circle cx="24" cy="24" r="7" fill="#3a4a80"/>`,
  pokeball: () => `<circle cx="24" cy="24" r="20" fill="#fff" stroke="#1d1d2a" stroke-width="3.5"/><path d="M4 24a20 20 0 0 1 40 0z" fill="#ff4a3a" stroke="#1d1d2a" stroke-width="3.5"/><path d="M4 24h40" stroke="#1d1d2a" stroke-width="3.5"/><circle cx="24" cy="24" r="6.5" fill="#fff" stroke="#1d1d2a" stroke-width="3.5"/>`,
  pikachu: () => `<path d="M9 6l9 13M39 6l-9 13" stroke="#1d1d2a" stroke-width="3" stroke-linecap="round"/><path d="M8 5l9 12-5 2zM40 5l-9 12 5 2z" fill="#ffd23a" stroke="#1d1d2a" stroke-width="2.5" stroke-linejoin="round"/><path d="M8 5l3 4 3-1zM40 5l-3 4-3-1z" fill="#1d1d2a"/><ellipse cx="24" cy="29" rx="17" ry="14" fill="#ffd23a" stroke="#1d1d2a" stroke-width="3"/><circle cx="17" cy="26" r="2.6" fill="#1d1d2a"/><circle cx="31" cy="26" r="2.6" fill="#1d1d2a"/><circle cx="12" cy="33" r="3.6" fill="#ff5a4a"/><circle cx="36" cy="33" r="3.6" fill="#ff5a4a"/><path d="M21 33q3 3 6 0" fill="none" stroke="#1d1d2a" stroke-width="2" stroke-linecap="round"/>`,
  map: (id) => `${grad(id, '#9fe07a', '#3aa84a')}<path d="M5 11l12-5 14 5 12-5v31l-12 5-14-5-12 5z" fill="url(#${id})" stroke="#1d5a2a" stroke-width="3" stroke-linejoin="round"/><path d="M17 6v31M31 11v31" stroke="#1d5a2a" stroke-width="2.5"/><path d="M8 26c4-3 7 2 10-1s6-6 10-3 7 1 10-2" fill="none" stroke="#4aa8ff" stroke-width="3" stroke-linecap="round"/><circle cx="34" cy="18" r="3.5" fill="#ff4a3a" stroke="#fff" stroke-width="1.5"/>`,
  gacha: (id) => `${grad(id, '#ff7a6a', '#c82a20')}<circle cx="24" cy="17" r="13" fill="#d8f0ff" stroke="#3a4a80" stroke-width="3"/><circle cx="19" cy="18" r="4" fill="#ff4a3a"/><circle cx="28" cy="14" r="4" fill="#4aa8ff"/><circle cx="27" cy="22" r="3.5" fill="#ffd23a"/><rect x="11" y="26" width="26" height="18" rx="4" fill="url(#${id})" stroke="#6a1410" stroke-width="3"/><circle cx="24" cy="34" r="4" fill="#ffd23a" stroke="#6a1410" stroke-width="2"/>`,
  lock: (id) => `${grad(id, '#ffe680', '#e0a000')}<path d="M15 22v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#5a6680" stroke-width="5"/><rect x="10" y="21" width="28" height="22" rx="5" fill="url(#${id})" stroke="#7a5000" stroke-width="3"/><circle cx="24" cy="30" r="3" fill="#7a5000"/><path d="M24 31v6" stroke="#7a5000" stroke-width="3" stroke-linecap="round"/>`,
  heart: (id) => `${grad(id, '#ff9ab8', '#ff2a6a')}<path d="M24 41S6 30 6 17a9 9 0 0 1 18-2 9 9 0 0 1 18 2c0 13-18 24-18 24z" fill="url(#${id})" stroke="#8a0a34" stroke-width="3" stroke-linejoin="round"/><path d="M13 14a5 5 0 0 1 6-1" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  sword: (id) => `${grad(id, '#ffffff', '#a8b8d8')}<path d="M38 5l5 0 0 5-20 20-5-5z" fill="url(#${id})" stroke="#3a4a6a" stroke-width="2.5" stroke-linejoin="round"/><path d="M13 23l12 12M9 31l8 8" stroke="#8a5a20" stroke-width="5" stroke-linecap="round"/><path d="M12 22l14 14" stroke="#ffd23a" stroke-width="4" stroke-linecap="round"/>`,
  boot: (id) => `${grad(id, '#9fe0ff', '#2a8ae0')}<path d="M14 6h12v18l12 6a5 5 0 0 1 4 5v5H8V30z" fill="url(#${id})" stroke="#0a3a7a" stroke-width="3" stroke-linejoin="round"/><path d="M8 36h34" stroke="#0a3a7a" stroke-width="3"/><path d="M33 16h9M30 11h8M36 21h7" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  clock: (id) => `${grad(id, '#ffffff', '#b8d0ff')}<circle cx="24" cy="25" r="17" fill="url(#${id})" stroke="#2a4a9a" stroke-width="3.5"/><path d="M24 14v11l8 5" stroke="#2a4a9a" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M19 4h10" stroke="#2a4a9a" stroke-width="4" stroke-linecap="round"/>`,
  shield: (id) => `${grad(id, '#d8e4ff', '#6a88e8')}<path d="M24 4l17 6v12c0 11-8 18-17 22C15 40 7 33 7 22V10z" fill="url(#${id})" stroke="#1a2a7a" stroke-width="3" stroke-linejoin="round"/><path d="M24 12v24M15 21h18" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
  leaf: (id) => `${grad(id, '#aaf07a', '#2aa84a')}<path d="M8 40C8 18 22 8 42 8c0 20-10 34-32 32z" fill="url(#${id})" stroke="#0a5a2a" stroke-width="3" stroke-linejoin="round"/><path d="M10 38L30 18" stroke="#0a5a2a" stroke-width="2.5" stroke-linecap="round"/>`,
  magnet: (id) => `${grad(id, '#ff8a8a', '#d82a3a')}<path d="M10 8h9v16a5 5 0 0 0 10 0V8h9v16a14 14 0 0 1-28 0z" fill="url(#${id})" stroke="#6a0a1a" stroke-width="3" stroke-linejoin="round"/><path d="M10 8h9v7h-9zM29 8h9v7h-9z" fill="#e8eef8" stroke="#6a0a1a" stroke-width="3"/>`,
  book: (id) => `${grad(id, '#9feaff', '#2aa8e0')}<path d="M6 10c6-3 12-3 18 1 6-4 12-4 18-1v28c-6-3-12-3-18 1-6-4-12-4-18-1z" fill="url(#${id})" stroke="#0a4a7a" stroke-width="3" stroke-linejoin="round"/><path d="M24 11v28" stroke="#0a4a7a" stroke-width="2.5"/><path d="M11 17h8M11 23h8M29 17h8M29 23h8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  bag: (id) => `${grad(id, '#fff07a', '#e8a000')}<path d="M10 18h28l3 22H7z" fill="url(#${id})" stroke="#7a5000" stroke-width="3" stroke-linejoin="round"/><path d="M17 18a7 7 0 0 1 14 0" fill="none" stroke="#7a5000" stroke-width="3"/><circle cx="24" cy="30" r="5" fill="#fff" opacity=".6"/>`,
  star: (id) => `${grad(id, '#fff2a0', '#ff9a1a')}<path d="M24 4l6 13 14 2-10 10 3 14-13-7-13 7 3-14L4 19l14-2z" fill="url(#${id})" stroke="#8a4a00" stroke-width="3" stroke-linejoin="round"/>`,
  music: () => `<path d="M18 36V10l20-4v26" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><circle cx="13" cy="36" r="6" fill="#fff"/><circle cx="33" cy="32" r="6" fill="#fff"/>`,
  sound: () => `<path d="M6 18h8l11-9v30l-11-9H6z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M31 16a10 10 0 0 1 0 16M36 11a17 17 0 0 1 0 26" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`,
  vibrate: () => `<rect x="15" y="6" width="18" height="36" rx="4" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M8 16v16M40 16v16M3 20v8M45 20v8" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  numbers: () => `<path d="M8 34l8-20 8 20M11 27h10" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 12h10l-6 10a6 6 0 1 1-5 9" fill="none" stroke="#ffd23a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  quality: () => `<path d="M24 5l5 12 13 1-10 9 3 13-11-7-11 7 3-13L6 18l13-1z" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/>`,
  flag: () => `<path d="M12 44V6" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M12 8h24l-5 8 5 8H12" fill="#fff"/>`,
  info: () => `<circle cx="24" cy="24" r="18" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M24 22v12" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="15" r="2.6" fill="#fff"/>`,
  guide: () => `<path d="M8 10c6-3 11-3 16 1 5-4 10-4 16-1v28c-6-3-11-3-16 1-5-4-10-4-16-1z" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/><path d="M24 11v28" stroke="#fff" stroke-width="3"/>`,
  reset: () => `<path d="M38 24a14 14 0 1 1-5-10.7" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/><path d="M35 6v9h-9" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  back: () => `<path d="M30 8L14 24l16 16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  next: () => `<path d="M18 8l16 16-16 16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  play: () => `<path d="M14 8l26 16-26 16z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`,
  up: () => `<path d="M24 8L8 26h10v14h12V26h10z" fill="#fff" stroke="#7a4a00" stroke-width="3" stroke-linejoin="round"/>`,
  bolt: () => `<path d="M28 4L10 28h12l-4 16 20-26H26z" fill="#ffd23a" stroke="#7a4a00" stroke-width="3" stroke-linejoin="round"/>`,
};

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, size = 24, cls = ''): SVGSVGElement {
  return svg(ICONS[name], size, cls);
}
