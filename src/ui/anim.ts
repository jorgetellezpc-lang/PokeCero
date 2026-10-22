import { Animator, type AnimName } from '../render/animator';

// Pokémon animado para los menús (su sprite de Mundo Misterioso en bucle).
// El bucle se para solo cuando el canvas sale de la página.

export function animatedPokemon(dex: number, size: number, opts: { anim?: AnimName; cls?: string; dir?: number } = {}): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * dpr);
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  c.className = `pix ${opts.cls ?? ''}`;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const a = new Animator(dex, 1);
  a.dir = opts.dir ?? 0;
  a.loop(opts.anim ?? 'Idle');
  let last = 0;
  let seen = false;
  const frame = (t: number) => {
    if (c.isConnected) seen = true;
    else if (seen) return;
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    a.update(dt);
    const f = a.frameInfo();
    ctx.clearRect(0, 0, c.width, c.height);
    if (f) {
      // Escala entera para que el pixel art se vea nítido; pies abajo en el centro.
      let k = (c.height * 0.92) / Math.max(f.ay + 4, f.h * 0.6, f.w * 0.6);
      k = k >= 2 ? Math.floor(k) : Math.max(1, k);
      const x = c.width / 2 - f.ax * k;
      const y = c.height * 0.94 - f.ay * k;
      ctx.drawImage(f.img, f.sx, f.sy, f.w, f.h, Math.round(x), Math.round(y), f.w * k, f.h * k);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return c;
}
