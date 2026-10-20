import type { Vec } from '../game/entities';

// Control: joystick táctil flotante (aparece donde se toca, usable con una
// mano) y teclado (WASD / flechas) para escritorio.

const RADIUS = 52;

export class InputController {
  private pointerId: number | null = null;
  private origin: Vec = { x: 0, y: 0 };
  private touchVec: Vec = { x: 0, y: 0 };
  private keys = new Set<string>();
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  enabled = true;

  constructor(private surface: HTMLElement, private onPause: () => void) {
    this.base = document.createElement('div');
    this.base.className = 'joy-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.base.appendChild(this.knob);
    surface.appendChild(this.base);

    surface.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.reset);
  }

  destroy(): void {
    this.surface.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.up);
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.reset);
    this.base.remove();
  }

  /** Dirección de movimiento con magnitud 0..1. */
  get vector(): Vec {
    if (!this.enabled) return { x: 0, y: 0 };
    let kx = 0;
    let ky = 0;
    if (this.keys.has('left')) kx -= 1;
    if (this.keys.has('right')) kx += 1;
    if (this.keys.has('up')) ky -= 1;
    if (this.keys.has('down')) ky += 1;
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      return { x: kx / l, y: ky / l };
    }
    return this.touchVec;
  }

  reset = (): void => {
    this.pointerId = null;
    this.touchVec = { x: 0, y: 0 };
    this.keys.clear();
    this.base.style.display = 'none';
  };

  private down = (ev: PointerEvent): void => {
    if (!this.enabled || this.pointerId !== null) return;
    if ((ev.target as HTMLElement).closest('button')) return;
    ev.preventDefault();
    this.pointerId = ev.pointerId;
    const rect = this.surface.getBoundingClientRect();
    this.origin = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    this.base.style.display = 'block';
    this.base.style.left = `${this.origin.x}px`;
    this.base.style.top = `${this.origin.y}px`;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.touchVec = { x: 0, y: 0 };
  };

  private move = (ev: PointerEvent): void => {
    if (ev.pointerId !== this.pointerId) return;
    const rect = this.surface.getBoundingClientRect();
    const dx = ev.clientX - rect.left - this.origin.x;
    const dy = ev.clientY - rect.top - this.origin.y;
    const d = Math.hypot(dx, dy);
    const k = d > RADIUS ? RADIUS / d : 1;
    const kx = dx * k;
    const ky = dy * k;
    this.knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    const mag = Math.min(1, d / RADIUS);
    this.touchVec = d > 4 ? { x: (dx / d) * mag, y: (dy / d) * mag } : { x: 0, y: 0 };
  };

  private up = (ev: PointerEvent): void => {
    if (ev.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.touchVec = { x: 0, y: 0 };
    this.base.style.display = 'none';
  };

  private keydown = (ev: KeyboardEvent): void => {
    const k = keyName(ev.key);
    if (k) {
      this.keys.add(k);
      ev.preventDefault();
    } else if (ev.key === 'Escape' || ev.key === 'p' || ev.key === 'P') {
      this.onPause();
    }
  };

  private keyup = (ev: KeyboardEvent): void => {
    const k = keyName(ev.key);
    if (k) this.keys.delete(k);
  };
}

function keyName(key: string): string | null {
  switch (key) {
    case 'ArrowLeft': case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
    case 'ArrowUp': case 'w': case 'W': return 'up';
    case 'ArrowDown': case 's': case 'S': return 'down';
    default: return null;
  }
}
