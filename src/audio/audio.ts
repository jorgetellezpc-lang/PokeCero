import { MUSIC, type Drum, type Instrument, type Song, type SongName } from './music';

// ============================================================================
// Sintetizador, secuenciador y efectos de sonido con Web Audio (sin ficheros).
// Basado en PokéSurvivor (js/core/audio.js). Required Notice: Copyright 2026
// JPTER78 (https://github.com/JPTER78/pokesurvivor)
//
// Los navegadores no dejan sonar nada hasta el primer toque o tecla: el
// contexto se crea entonces y arranca la música que estuviera pedida.
// ============================================================================

type Ev = { inst: Instrument | Drum; f?: number; len?: number; v: number; drum?: boolean };
interface Compiled { steps: number; ev: Ev[][]; bpm: number; swing: number }

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function midiOf(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name)!;
  return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

function parseChord(c: string) {
  const m = /^([A-G])(#|b)?(m?)(?:\/([A-G])(#|b)?)?$/.exec(c)!;
  const pc = (l: string, a?: string) => (NOTE[l] + (a === '#' ? 1 : a === 'b' ? -1 : 0) + 12) % 12;
  const root = pc(m[1], m[2]);
  return { root, minor: m[3] === 'm', bass: m[4] ? pc(m[4], m[5]) : root };
}

/** Compila una canción a eventos por semicorchea. */
function compile(song: Song): Compiled {
  const bars = song.chords.length;
  const steps = bars * 16;
  const ev: Ev[][] = Array.from({ length: steps }, () => []);
  for (const tr of song.melody) {
    tr.bars.forEach((bar, bi) => {
      let s = 0;
      for (const tok of bar.trim().split(/\s+/)) {
        const [n, len] = tok.split(':');
        const L = +len || 1;
        if (n !== '-') ev[(bi * 16 + s) % steps].push({ inst: tr.inst, f: midiFreq(midiOf(n)), len: L, v: tr.vel });
        s += L;
      }
    });
  }
  const chords = song.chords.map(parseChord);
  const chordTone = (ch: ReturnType<typeof parseChord>, i: number, base: number) => {
    const third = ch.minor ? 3 : 4;
    return base + ch.root + ([0, third, 7, 12, 12 + third, 19][i] ?? 0);
  };
  for (let b = 0; b < bars; b++) {
    const ch = chords[b % chords.length];
    for (const tr of song.parts) {
      const base = 12 * (tr.octave + 1);
      for (let s = 0; s < 16; s++) {
        const c = tr.pattern[s];
        if (!c || c === '.' || c === '-') continue;
        let len = 1;
        while (s + len < 16 && tr.pattern[s + len] === '-') len++;
        let midi: number;
        if (c === 'R') midi = base + (tr.useBass ? ch.bass : ch.root);
        else if (c === 'F') midi = base + ch.root + 7;
        else if (c === 'O') midi = base + ch.root + 12;
        else if (c === 'T') midi = base + ch.root + (ch.minor ? 3 : 4);
        else if (c === 'C') {
          for (let i = 0; i < 3; i++) ev[b * 16 + s].push({ inst: tr.inst, f: midiFreq(chordTone(ch, i, base)), len, v: tr.vel });
          continue;
        } else midi = chordTone(ch, +c, base);
        ev[b * 16 + s].push({ inst: tr.inst, f: midiFreq(midi), len, v: tr.vel });
      }
    }
    for (const [inst, pat] of Object.entries(song.drums) as [Drum, string][]) {
      for (let s = 0; s < 16; s++) {
        const c = pat[s];
        if (c && c !== '.') ev[b * 16 + s].push({ inst, drum: true, v: c === 'X' ? 1 : c === 'x' ? 0.75 : 0.45 });
      }
    }
  }
  return { steps, ev, bpm: song.bpm, swing: song.swing ?? 0 };
}

const SHOT_PITCH: Record<string, number> = {
  fire: 520, water: 700, electric: 1100, psychic: 800, grass: 640, ice: 900, poison: 400, ghost: 350, dragon: 300,
  fairy: 1200, normal: 600, fighting: 450, rock: 260, ground: 240, steel: 750, bug: 980, dark: 330, flying: 820,
};
const MIN_GAP: Record<string, number> = { hit: 45, faint: 60, xp: 35, coin: 50, shot: 70 };

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: DynamicsCompressorNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private reverb!: ConvolverNode;
  private noiseBuf!: AudioBuffer;
  private wanted: SongName | null = null;
  private current: { name: SongName; song: Compiled; bus: GainNode; step: number; next: number } | null = null;
  private compiled: Partial<Record<SongName, Compiled>> = {};
  private last: Record<string, number> = {};
  private xpCombo = 0;
  private xpT = 0;
  private voices = 0;
  private timer = 0;

  constructor(private vol: { music: number; sfx: number }) {
    if (typeof window === 'undefined') return;
    const unlock = () => this.unlock();
    // En móvil, levantar el dedo es lo que cuenta como gesto para el sonido.
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { capture: true });
  }

  private init(): boolean {
    if (this.ctx) return true;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createDynamicsCompressor();
    this.master.threshold.value = -14;
    this.master.ratio.value = 4;
    const out = ctx.createGain();
    out.gain.value = 0.9;
    this.master.connect(out).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    let ch = 0;
    const fill = () => {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const g = 1 - i / len;
        d[i] = (Math.random() * 2 - 1) * g * g * Math.sqrt(g);
      }
      if (++ch < 2) setTimeout(fill, 30);
      else this.reverb.buffer = ir;
    };
    setTimeout(fill, 300);
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    this.reverb.connect(wet).connect(this.musicBus);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.timer = window.setInterval(() => this.schedule(), 25);
    return true;
  }

  unlock(): void {
    if (!this.init()) return;
    const ctx = this.ctx!;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (this.wanted && !this.current) this.startSong(this.wanted);
  }

  setVolumes(vol: { music: number; sfx: number }): void {
    this.vol = vol;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.7, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 2.4, t, 0.05);
  }

  // ---------------- piezas básicas ----------------

  private osc(type: OscillatorType, f: number, t: number, end: number, dest: AudioNode): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(dest);
    o.start(t);
    o.stop(end + 0.05);
    return o;
  }

  private gainEnv(dest: AudioNode, t: number, a: number, peak: number, dur: number, rel: number, sus = 0.7): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, Math.max(0.02, dur * 0.4));
    g.gain.setTargetAtTime(0.0001, t + dur, rel / 3);
    g.connect(dest);
    return g;
  }

  private noise(t: number, dur: number, dest: AudioNode): void {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf;
    s.connect(dest);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  private filt(type: BiquadFilterType, f: number, q: number, dest: AudioNode): BiquadFilterNode {
    const b = this.ctx!.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    b.connect(dest);
    return b;
  }

  private send(node: AudioNode, amount: number): void {
    const s = this.ctx!.createGain();
    s.gain.value = amount;
    node.connect(s).connect(this.reverb);
  }

  // ---------------- instrumentos ----------------

  private play(inst: Instrument, t: number, f: number, d: number, v: number, bus: AudioNode): void {
    const ctx = this.ctx!;
    switch (inst) {
      case 'flute': {
        const lp = this.filt('lowpass', 3600, 0.5, bus);
        const g = this.gainEnv(lp, t, 0.045, 0.2 * v, d, 0.14, 0.82);
        this.send(g, 0.35);
        const o1 = this.osc('triangle', f, t, t + d + 0.3, g);
        const g2 = ctx.createGain();
        g2.gain.value = 0.18;
        g2.connect(g);
        const o2 = this.osc('sine', f * 2, t, t + d + 0.3, g2);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.3;
        const lg = ctx.createGain();
        lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.35, d));
        lfo.connect(lg);
        lg.connect(o1.frequency);
        lg.connect(o2.frequency);
        lfo.start(t);
        lfo.stop(t + d + 0.35);
        break;
      }
      case 'bell': {
        const g = ctx.createGain();
        g.connect(bus);
        this.send(g, 0.3);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.22 * v, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0008, t + Math.min(d, 0.45) + 0.45);
        this.osc('sine', f, t, t + 1, g);
        const g2 = ctx.createGain();
        g2.connect(g);
        g2.gain.setValueAtTime(0.35, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        this.osc('sine', f * 4, t, t + 0.12, g2);
        break;
      }
      case 'pluck': {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 2;
        lp.frequency.setValueAtTime(3200, t);
        lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.8), t + 0.22);
        const g = ctx.createGain();
        g.connect(bus);
        this.send(g, 0.2);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.11 * v, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0008, t + Math.min(d, 0.35) + 0.25);
        lp.connect(g);
        this.osc('sawtooth', f, t, t + 0.7, lp);
        break;
      }
      case 'bass': {
        const lp = this.filt('lowpass', 900, 0.7, bus);
        const g = this.gainEnv(lp, t, 0.008, 0.34 * v, d * 0.9, 0.08, 0.65);
        this.osc('triangle', f, t, t + d + 0.2, g);
        const g2 = ctx.createGain();
        g2.gain.value = 0.25;
        g2.connect(g);
        this.osc('square', f, t, t + d + 0.2, g2);
        break;
      }
      case 'pad': {
        const lp = this.filt('lowpass', 1100, 0.6, bus);
        const g = this.gainEnv(lp, t, 0.35, 0.05 * v, d, 0.7, 0.9);
        this.send(g, 0.5);
        this.osc('sawtooth', f * 1.004, t, t + d + 1, g);
        this.osc('sawtooth', f * 0.996, t, t + d + 1, g);
        break;
      }
      case 'lead': {
        const lp = this.filt('lowpass', 2600, 1, bus);
        const g = this.gainEnv(lp, t, 0.01, 0.075 * v, d, 0.08, 0.75);
        this.send(g, 0.2);
        this.osc('square', f, t, t + d + 0.2, g);
        this.osc('square', f * 1.006, t, t + d + 0.2, g);
        break;
      }
    }
  }

  private drum(inst: Drum, t: number, v: number, bus: AudioNode): void {
    const ctx = this.ctx!;
    if (inst === 'kick') {
      const g = ctx.createGain();
      g.connect(bus);
      g.gain.setValueAtTime(0.55 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      const o = this.osc('sine', 150, t, t + 0.25, g);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    } else if (inst === 'snare') {
      const hp = this.filt('highpass', 1300, 0.7, bus);
      const g = ctx.createGain();
      g.connect(hp);
      g.gain.setValueAtTime(0.22 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      this.noise(t, 0.15, g);
    } else if (inst === 'hat') {
      const hp = this.filt('highpass', 7500, 0.7, bus);
      const g = ctx.createGain();
      g.connect(hp);
      g.gain.setValueAtTime(0.08 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      this.noise(t, 0.05, g);
    } else {
      const bp = this.filt('bandpass', 5200, 1.2, bus);
      const g = ctx.createGain();
      g.connect(bp);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07 * v, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      this.noise(t, 0.08, g);
    }
  }

  // ---------------- música ----------------

  private startSong(name: SongName): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const song = (this.compiled[name] ??= compile(MUSIC[name]));
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.8);
    bus.connect(this.musicBus);
    this.current = { name, song, bus, step: 0, next: ctx.currentTime + 0.1 };
  }

  private stopCurrent(): void {
    if (!this.current || !this.ctx) return;
    const b = this.current.bus;
    const t = this.ctx.currentTime;
    b.gain.cancelScheduledValues(t);
    b.gain.setValueAtTime(b.gain.value, t);
    b.gain.linearRampToValueAtTime(0.0001, t + 0.7);
    setTimeout(() => b.disconnect(), 900);
    this.current = null;
  }

  /** Cambia de tema con fundido (null = silencio). */
  music(name: SongName | null): void {
    if (this.wanted === name) return;
    this.wanted = name;
    if (!this.ctx) return;
    this.stopCurrent();
    if (name) this.startSong(name);
  }

  private schedule(): void {
    const ctx = this.ctx;
    const c = this.current;
    if (!ctx || !c || ctx.state !== 'running') return;
    const sd = 60 / c.song.bpm / 4;
    while (c.next < ctx.currentTime + 0.15) {
      const i = c.step % c.song.steps;
      const t = c.next + (i % 4 === 2 ? c.song.swing * sd : 0);
      for (const e of c.song.ev[i]) {
        if (e.drum) this.drum(e.inst as Drum, t, e.v, c.bus);
        else this.play(e.inst as Instrument, t, e.f!, e.len! * sd, e.v, c.bus);
      }
      c.next += sd;
      c.step++;
    }
  }

  // ---------------- efectos ----------------

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const g = ctx.createGain();
    g.connect(this.sfxBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    const o = this.osc(type, f0, t, t + dur, g);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  }

  private hiss(dur: number, vol: number, type: BiquadFilterType, f0: number, f1 = 0, at = 0, q = 1): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.Q.value = q;
    b.frequency.setValueAtTime(f0, t);
    if (f1) b.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    b.connect(g);
    g.connect(this.sfxBus);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    this.noise(t, dur, b);
  }

  private arp(type: OscillatorType, freqs: number[], gap: number, dur: number, vol: number): void {
    freqs.forEach((f, i) => this.tone(type, f, f, dur, vol, i * gap));
  }

  private bell(f: number, at: number): void {
    this.play('bell', this.ctx!.currentTime + at, f, 0.3, 0.8, this.sfxBus);
  }

  /** Efecto de sonido. `opts` para el disparo: { kind, type }. */
  sfx(name: string, opts?: { kind?: string; type?: string }): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.vol.sfx <= 0) return;
    const now = performance.now();
    const key = name === 'shot' && opts ? `shot${opts.kind}` : name;
    if (now - (this.last[key] ?? 0) < (MIN_GAP[name] ?? 0)) return;
    if (this.voices > 24) return;
    this.last[key] = now;
    this.voices++;
    setTimeout(() => this.voices--, 150);
    try {
      this.fx(name, opts);
    } catch {
      // Un efecto nunca debe romper el juego.
    }
  }

  private fx(name: string, o?: { kind?: string; type?: string }): void {
    switch (name) {
      case 'click': this.tone('square', 660, 990, 0.05, 0.06); break;
      case 'confirm': this.arp('triangle', [784, 988, 1319], 0.05, 0.12, 0.09); break;
      case 'error': this.arp('square', [330, 262], 0.08, 0.09, 0.05); break;
      case 'shot': {
        const f = SHOT_PITCH[o?.type ?? 'normal'] ?? 600;
        const k = o?.kind;
        if (k === 'melee' || k === 'spin' || k === 'dash') this.hiss(0.12, 0.13, 'bandpass', 600, 2800, 0, 1.4);
        else if (k === 'beam' || k === 'charge' || k === 'chain') { this.tone('sawtooth', f * 0.6, f * 0.35, 0.3, 0.05); this.hiss(0.25, 0.04, 'bandpass', f * 2, f, 0, 3); }
        else if (k === 'nova' || k === 'shove' || k === 'quake') { this.hiss(0.2, 0.1, 'lowpass', 2400, 300); this.tone('sine', 140, 60, 0.16, 0.12); }
        else if (k === 'aura') { this.tone('sine', f * 0.5, f * 0.55, 0.25, 0.04); }
        else if (k === 'buff') this.arp('sine', [f, f * 1.25, f * 1.5], 0.05, 0.12, 0.05);
        else this.tone('triangle', f * 1.5, f * 0.5, 0.09, 0.05);
        break;
      }
      case 'hit': this.tone('triangle', 230, 90, 0.045, 0.045); break;
      case 'faint': this.tone('sine', 720, 240, 0.08, 0.04); break;
      case 'bossDown': this.hiss(0.7, 0.18, 'lowpass', 1500, 100); this.arp('triangle', [262, 330, 392, 523], 0.09, 0.4, 0.08); break;
      case 'xp': {
        const now = this.ctx!.currentTime;
        this.xpCombo = now - this.xpT < 0.45 ? Math.min(this.xpCombo + 1, 24) : 0;
        this.xpT = now;
        this.tone('sine', 880 * Math.pow(2, this.xpCombo / 12), 0, 0.06, 0.035);
        break;
      }
      case 'coin': this.tone('square', 1320, 1320, 0.05, 0.035); this.tone('square', 1760, 1760, 0.14, 0.035, 0.05); break;
      case 'heal': this.arp('triangle', [523, 659, 784, 1047], 0.06, 0.18, 0.06); break;
      case 'level': this.arp('square', [523, 659, 784, 1047], 0.07, 0.14, 0.05); this.arp('triangle', [1047, 1319, 1568], 0.07, 0.3, 0.05); break;
      case 'hurt': this.tone('square', 150, 70, 0.14, 0.06); this.hiss(0.1, 0.06, 'lowpass', 900); break;
      case 'boss': [82, 123, 165].forEach((f) => this.tone('sawtooth', f, f * 0.98, 1.3, 0.05)); this.drum('kick', this.ctx!.currentTime, 1, this.sfxBus); break;
      case 'legend': this.arp('square', [523, 659, 784, 1047, 1319, 1568], 0.08, 0.3, 0.05); [2093, 2637, 3136, 2349, 3520, 4186].forEach((f, i) => this.bell(f, i * 0.07)); break;
      case 'gameover': this.arp('triangle', [523, 440, 349, 262], 0.2, 0.35, 0.08); break;
      case 'buy': this.tone('square', 1320, 1320, 0.05, 0.035); this.arp('triangle', [659, 784, 1047], 0.05, 0.12, 0.06); break;
      case 'pause': this.arp('square', [784, 523], 0.06, 0.07, 0.04); break;
      case 'ticket': this.arp('square', [1047, 1319, 1568, 2093], 0.06, 0.12, 0.04); break;
    }
  }

  destroy(): void {
    clearInterval(this.timer);
  }
}
