import { BALANCE } from '../../config/balance';
import { getAttack } from '../../data/attacks';
import { findGym } from '../../data/regions';
import { roomSequence } from '../../game/rooms';
import { World, type WorldEvent } from '../../game/world';
import { InputController } from '../../input/input';
import { awardMedal, bankRunGold, claimMilestone, recordBestRoom } from '../../meta/rewards';
import { permanentBonuses } from '../../meta/shop';
import { Renderer, type Viewport } from '../../render/renderer';
import { iconDataUrl, spriteDataUrl } from '../../render/sprites';
import type { App, Screen } from '../app';
import { h, img, TYPE_COLORS, toast } from '../dom';
import type { UpgradeChoice } from '../../game/upgradeGenerator';

// Pantalla de partida: conecta World (lógica), Renderer (dibujo), entrada
// táctil/teclado y la interfaz HTML (HUD, cartas de mejora, pausa, resultado).

const STEP = 1 / 60;

const FAMILY_CLASS: Record<UpgradeChoice['family'], string> = {
  newAttack: 'fam-new', attackUpgrade: 'fam-up', stat: 'fam-stat', fallback: 'fam-fb',
};

export class RunScreen implements Screen {
  el: HTMLElement;
  world: World;
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private input: InputController;
  private vp: Viewport = { ox: 0, oy: 0, scale: 1, dpr: 1 };
  private cssW = 0;
  private cssH = 0;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private paused = false;
  private ended = false;
  private levelUpShownFor: UpgradeChoice[] | null = null;
  private ticketsEarned = 0;
  private hud: Record<string, HTMLElement> = {};
  private overlay: HTMLElement;
  private banner: HTMLElement;
  private resizeObs: ResizeObserver;
  private safeProbe: HTMLElement;

  constructor(private app: App, private gymId: string) {
    const { gym } = findGym(gymId);
    const store = app.store;
    const test = store.data.settings.testMode;
    this.world = new World({
      speciesId: store.data.selectedPokemon,
      gym,
      rooms: roomSequence(test),
      permanent: permanentBonuses(store),
      xpMult: test ? BALANCE.rooms.testModeXpMult : 1,
      scalingFactor: test ? BALANCE.rooms.testModeScalingFactor : 1,
    });
    store.update((d) => { d.stats.runs++; });

    this.canvas = h('canvas', { class: 'game-canvas' });
    this.renderer = new Renderer(this.canvas.getContext('2d')!);
    this.renderer.showDamageNumbers = store.data.settings.damageNumbers;

    const hud = this.buildHud();
    this.banner = h('div', { class: 'banner' });
    this.overlay = h('div', { class: 'overlay hidden' });
    this.safeProbe = h('div', { class: 'safe-probe' });
    this.el = h('div', { class: 'screen run' }, this.canvas, hud, this.banner, this.overlay, this.safeProbe);

    this.input = new InputController(this.el, () => this.togglePause());
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.el);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    this.resizeObs.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = (): void => {
    if (document.hidden && !this.paused && !this.ended && this.world.phase === 'playing') this.togglePause();
  };

  // --------------------------------------------------------------------------

  private buildHud(): HTMLElement {
    const H = this.hud;
    H.hpFill = h('div', { class: 'bar-fill hp' });
    H.hpText = h('span', { class: 'bar-text' });
    H.xpFill = h('div', { class: 'bar-fill xp' });
    H.level = h('span', { class: 'lv' });
    H.room = h('span', { class: 'room', 'data-testid': 'room' });
    H.gold = h('span', { class: 'gold' });
    H.attacks = h('div', { class: 'hud-attacks' });
    H.bossName = h('span', {});
    H.bossFill = h('div', { class: 'bar-fill boss' });
    H.boss = h('div', { class: 'boss-bar hidden' }, H.bossName, h('div', { class: 'bar' }, H.bossFill));
    const pause = h('button', { class: 'pause-btn', 'aria-label': 'Pausa', 'data-testid': 'pause', onclick: () => this.togglePause() }, 'II');
    return h('div', { class: 'hud' },
      h('div', { class: 'hud-row' },
        h('div', { class: 'hud-col' },
          h('div', { class: 'bar hp-bar' }, H.hpFill, H.hpText),
          h('div', { class: 'xp-row' }, H.level, h('div', { class: 'bar xp-bar' }, H.xpFill)),
        ),
        h('div', { class: 'hud-side' }, H.room, h('span', { class: 'gold-wrap' }, img(iconDataUrl('coin', 2), 'res-icon'), H.gold)),
        pause,
      ),
      H.attacks,
      H.boss,
    );
  }

  private updateHud(): void {
    const w = this.world;
    const p = w.player;
    const H = this.hud;
    H.hpFill.style.width = `${(100 * p.hp) / p.maxHp}%`;
    H.hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    const maxed = p.level >= BALANCE.experience.maxLevel;
    H.xpFill.style.width = maxed ? '100%' : `${(100 * p.xp) / w.xpNeeded}%`;
    H.level.textContent = `Nv ${p.level}`;
    H.room.textContent = `Sala ${w.room}/${BALANCE.rooms.perGym}`;
    H.gold.textContent = String(Math.floor(w.runGold + w.bonusGold));
    const atkKey = p.attacks.map((a) => `${a.def.id}${a.level}`).join();
    if (H.attacks.dataset.key !== atkKey) {
      H.attacks.dataset.key = atkKey;
      H.attacks.replaceChildren(...p.attacks.map((a) =>
        h('span', { class: 'atk-chip', style: `border-color:${TYPE_COLORS[a.def.type]}` }, `${a.def.name} ${a.level}`)));
    }
    if (w.boss) {
      H.boss.classList.remove('hidden');
      H.bossName.textContent = `${w.boss.boss!.title}: ${w.boss.def.name}${w.boss.phase2 ? ' ¡Enfurecido!' : ''}`;
      H.bossFill.style.width = `${(100 * Math.max(0, w.boss.hp)) / w.boss.maxHp}%`;
    } else {
      H.boss.classList.add('hidden');
    }
  }

  private resize(): void {
    const rect = this.el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cssW = rect.width;
    this.cssH = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    const hudEl = this.el.querySelector('.hud') as HTMLElement;
    const top = (hudEl?.offsetHeight ?? 70) + 4;
    const bottom = 6 + (this.safeProbe.offsetHeight || 0);
    const availH = Math.max(100, rect.height - top - bottom);
    const scale = Math.min(rect.width / this.world.W, availH / this.world.H);
    this.vp = {
      dpr,
      scale,
      ox: (rect.width - this.world.W * scale) / 2,
      oy: top + (availH - this.world.H * scale) / 2,
    };
  }

  // --------------------------------------------------------------------------

  private frame = (t: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    if (!this.last) this.last = t;
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    if (!this.paused && !this.ended) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 6) {
        this.world.update(STEP, this.input.vector);
        this.acc -= STEP;
        steps++;
      }
      if (steps >= 6) this.acc = 0;
    }
    this.handleEvents();
    this.checkLevelUp();
    if (this.cssW) this.renderer.draw(this.world, this.vp, this.cssW, this.cssH);
    this.updateHud();
  };

  private handleEvents(): void {
    const w = this.world;
    const store = this.app.store;
    const events: WorldEvent[] = w.events.splice(0);
    for (const ev of events) {
      switch (ev.type) {
        case 'roomStart':
          recordBestRoom(store, this.gymId, ev.room);
          this.showBanner(
            ev.kind === 'boss' ? '¡JEFE DE GIMNASIO!' : ev.kind === 'miniboss' ? '¡MINIBOSS!' : `Sala ${ev.room}`,
            ev.kind === 'normal' ? '' : 'danger',
          );
          break;
        case 'roomCleared': {
          // Los tickets se guardan al momento y solo una vez por hito.
          const t = claimMilestone(store, this.gymId, ev.room);
          if (t) {
            this.ticketsEarned += t;
            toast(`+${t} tickets del gachapón`);
          }
          if (!w.isLastRoom) this.showBanner('¡Sala superada! Sube a la salida ▲');
          break;
        }
        case 'playerHit':
          if (store.data.settings.vibration && navigator.vibrate) navigator.vibrate(30);
          break;
        case 'evolved':
          this.showBanner(`¡${ev.from} ha evolucionado a ${ev.to}!`, 'gold');
          break;
        case 'bossSpawn':
          break;
        case 'victory':
          this.finish(true);
          break;
        case 'defeat':
          setTimeout(() => this.finish(false), 900);
          break;
        default:
          break;
      }
    }
  }

  private showBanner(text: string, cls = ''): void {
    this.banner.textContent = text;
    this.banner.className = `banner show ${cls}`;
    clearTimeout((this.banner as unknown as { _t: number })._t);
    (this.banner as unknown as { _t: number })._t = window.setTimeout(() => { this.banner.className = 'banner'; }, 1800);
  }

  // --------------------------------------------------------------------------
  // Subida de nivel: tres cartas, se elige una.
  // --------------------------------------------------------------------------

  private checkLevelUp(): void {
    const w = this.world;
    if (w.phase !== 'levelup' || this.paused) return;
    if (this.levelUpShownFor === w.choices) return;
    this.levelUpShownFor = w.choices;
    this.input.reset();
    this.input.enabled = false;
    let picked = false;
    const cards = w.choices.map((c, i) => {
      const color = c.element ? TYPE_COLORS[c.element] : c.family === 'stat' ? '#58a8f8' : '#c8a040';
      const btn = h('button', {
        class: `card ${FAMILY_CLASS[c.family]}`, style: `--accent:${color}`, 'data-testid': `card-${i}`, disabled: true,
        onclick: () => {
          if (picked) return;
          picked = true;
          for (const b of this.overlay.querySelectorAll('button')) (b as HTMLButtonElement).disabled = true;
          btn.classList.add('chosen');
          setTimeout(() => {
            w.chooseUpgrade(i);
            if (w.phase === 'levelup') {
              this.checkLevelUp();
            } else {
              this.hideOverlay();
              this.input.enabled = true;
            }
          }, 180);
        },
      },
        h('div', { class: 'card-icon' }, cardGlyph(c)),
        h('div', { class: 'card-body' },
          h('div', { class: 'card-cat' }, c.category),
          h('div', { class: 'card-title' }, c.title),
          h('div', { class: 'card-desc' }, c.description),
          c.detail ? h('div', { class: 'card-detail' }, c.detail) : null,
        ),
      );
      return btn;
    });
    this.showOverlay(h('div', { class: 'levelup' },
      h('div', { class: 'levelup-title' }, `¡Nivel ${w.player.level}!`),
      h('div', { class: 'note center' }, 'Elige una mejora'),
      h('div', { class: 'cards' }, ...cards),
    ));
    // Pequeño retardo para evitar elegir una carta sin querer con el dedo del joystick.
    setTimeout(() => cards.forEach((c) => { if (!picked) c.disabled = false; }), 350);
  }

  // --------------------------------------------------------------------------

  private showOverlay(content: HTMLElement): void {
    this.overlay.replaceChildren(content);
    this.overlay.classList.remove('hidden');
  }

  private hideOverlay(): void {
    this.overlay.classList.add('hidden');
    this.overlay.replaceChildren();
  }

  togglePause(): void {
    if (this.ended || this.world.phase !== 'playing') return;
    this.paused = !this.paused;
    if (!this.paused) {
      this.hideOverlay();
      this.input.enabled = true;
      this.last = 0;
      return;
    }
    this.input.reset();
    this.input.enabled = false;
    const p = this.world.player;
    this.showOverlay(h('div', { class: 'panel' },
      h('div', { class: 'levelup-title' }, 'Pausa'),
      h('div', { class: 'pause-info' },
        img(spriteDataUrl(p.species.sprite, 'normal', 4), 'slot-sprite'),
        h('div', {}, h('b', {}, `${p.species.name} Nv ${p.level}`),
          h('div', { class: 'note' }, p.attacks.map((a) => `${getAttack(a.def.id).name} ${a.level}`).join(' · ')),
          h('div', { class: 'note' }, `Sala ${this.world.room} · ${this.world.kills} derrotados`)),
      ),
      h('button', { class: 'btn btn-play', 'data-testid': 'resume', onclick: () => this.togglePause() }, 'Continuar'),
      h('button', { class: 'btn btn-danger', 'data-testid': 'abandon', onclick: () => this.finish(false, true) }, 'Abandonar partida'),
      h('p', { class: 'note' }, 'Al abandonar pierdes el nivel y las mejoras de esta partida; conservas el oro ganado.'),
    ));
  }

  private finish(victory: boolean, abandoned = false): void {
    if (this.ended) return;
    this.ended = true;
    this.paused = false;
    this.input.enabled = false;
    const w = this.world;
    const store = this.app.store;
    const { region, gym } = findGym(this.gymId);
    const gold = Math.floor(w.runGold + w.bonusGold);
    bankRunGold(store, gold);
    let medal = false;
    if (victory) medal = awardMedal(store, region, gym);
    store.update((d) => {
      d.stats.kills += w.kills;
      if (victory) d.stats.wins++;
    });

    const p = w.player;
    this.showOverlay(h('div', { class: `panel result ${victory ? 'win' : 'lose'}`, 'data-testid': 'result' },
      h('div', { class: 'levelup-title' }, victory ? '¡Victoria!' : abandoned ? 'Partida abandonada' : 'Derrota'),
      img(spriteDataUrl(p.species.sprite, 'normal', 6), 'gacha-sprite'),
      h('div', { class: 'result-lines' },
        line('Sala alcanzada', `${w.room} / ${BALANCE.rooms.perGym}`),
        line('Nivel alcanzado', String(p.level)),
        line('Enemigos derrotados', String(w.kills)),
        line('Oro ganado', `+${gold}`),
        line('Tickets ganados', `+${this.ticketsEarned}`),
        victory ? line('Medalla', medal ? `¡${gym.badge}!` : `${gym.badge} (ya la tenías)`) : null,
      ),
      h('p', { class: 'note' }, victory
        ? `Has derrotado al jefe del gimnasio de ${gym.leader}.`
        : 'El nivel y las mejoras de la partida se pierden. El oro, los tickets y las mejoras permanentes se conservan.'),
      h('button', { class: 'btn btn-play', 'data-testid': 'result-continue', onclick: () => this.app.showMenu('map') }, 'Continuar'),
    ));
  }
}

function line(label: string, value: string): HTMLElement {
  return h('div', { class: 'result-line' }, h('span', {}, label), h('b', {}, value));
}

function cardGlyph(c: UpgradeChoice): string {
  switch (c.family) {
    case 'newAttack': return '✦';
    case 'attackUpgrade': return '▲';
    case 'stat': return '◆';
    default: return '●';
  }
}
