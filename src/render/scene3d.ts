import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, Points, PointsMaterial, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DirectionalLight, ExtrudeGeometry, Shape, Fog, Group, HemisphereLight, IcosahedronGeometry,
  InstancedMesh, LinearFilter, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, NearestFilter, Object3D,
  PCFShadowMap, PerspectiveCamera, PlaneGeometry, RepeatWrapping, Scene, SRGBColorSpace, Texture, Vector3,
  WebGLRenderer,
} from 'three';
import { BALANCE } from '../config/balance';
import type { ArenaDef } from '../data/arenas';
import type { Obstacle } from '../data/layouts';
import { hasModels, modelFor, type ModelAnim } from '../data/models3d';
import { speciesByDex } from '../data/pokemon';
import { guardianPositions, orbitPositions } from '../game/combat';
import { jumpHeight } from '../game/enemyAI';
import { Rng } from '../game/rng';
import type { World } from '../game/world';
import { drawShadow, type AnimName, type Animator } from './animator';
import { disposeObject } from './dispose';
import type { ModelInstance, ModelLibrary } from './models';
import {
  buildBackground, drawAirField, drawBossRing, drawEnemyBar, drawEnemyMarks, drawExitArrow, drawGroundField, drawGuardian,
  drawHazard, drawMarker, drawMound, drawOrb, drawParticle, drawPickup, drawPickupShadow, drawPlayerAura, drawProjectile,
  drawRing, drawSlash, drawSpotHint, drawText, PIXEL,
} from './draw2d';

// ============================================================================
// Escenario 3D (Three.js) estilo Archero: cámara inclinada que sigue al
// jugador, suelo, muros, puerta, rocas con volumen, agua, luz y sombras.
// Los Pokémon son sus sprites animados de pie en el mundo (como carteles que
// miran a la cámara).
//
// Capas:
//   1. WebGL: escenario, Pokémon y una "capa de suelo" (canvas 2D como
//      textura) con avisos, sombras, zonas y anillos, debajo de los Pokémon.
//   2. Canvas 2D encima: proyectiles, partículas, números y barras, dibujados
//      con las mismas piezas que el 2D clásico y proyectados a la pantalla.
// No modifica la simulación.
// ============================================================================

const WALL_IN = 10;
const WALL_T = 30;
const WALL_H = 36;
const DECAL_RES = 1; // píxeles de la capa de suelo por unidad de mundo
/** Contorno de silueta en los sprites de los Pokémon. */
const OUTLINE = true;
/** En las arenas (cámara cenital) los modelos 3D se inclinan hacia la cámara para verse desde esta altura. */
const ARENA_MODEL_ELEV = (50 * Math.PI) / 180;
/** Vida que pierde una chispa por segundo (dura ~1,8 s). */
const EMBER_FADE = 0.55;
const MODEL_ANIM: Record<AnimName, ModelAnim> = {
  Idle: 'idle', Walk: 'walk', Attack: 'attack', Shoot: 'attack', Charge: 'attack', Hurt: 'hurt', Faint: 'faint',
};

/** Calidad aprendida en esta sesión: la siguiente partida empieza ya ahí. */
let sessionQuality = 0;

interface SpriteView {
  group: Group;
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  flash: { value: number };
  /** Tamaño de un píxel de la hoja (x, y) y si se dibuja el contorno (z). */
  texel: { value: Vector3 };
  used: boolean;
}

export class Scene3D {
  showDamageNumbers = true;
  /** Zoom de la cámara (ajuste del jugador): 1 = normal, más = más cerca. */
  zoom = 1;
  private gl: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(30, 1, 10, 6000);
  private octx: CanvasRenderingContext2D;
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private room: Group | null = null;
  private roomKey: unknown = null;
  private camPos = new Vector3();
  private camReady = false;
  private lookX = 0;
  private lookZ = 0;
  private lastTime = 0;
  private waterTex: Texture[] = [];
  private bars: Group | null = null;
  private glow: Mesh | null = null;
  private sheets = new Map<HTMLImageElement, Texture>();
  private views = new Map<object, SpriteView>();
  private decal: HTMLCanvasElement;
  private dctx: CanvasRenderingContext2D;
  private decalTex: CanvasTexture;
  private decalMesh: Mesh;
  private decalDirty = true;
  private sun: DirectionalLight;
  private v = new Vector3();
  /** Luz de las antorchas de la arena (una malla instanciada) y chispas que suben de ellas. */
  private torches: { mesh: InstancedMesh; spots: { x: number; z: number; size: number; ph: number }[] } | null = null;
  private embers: { pts: Points; spots: { x: number; z: number }[]; life: Float32Array; vel: Float32Array } | null = null;
  private tmpM = new Matrix4();
  /**
   * Modelos 3D (si una especie tiene; si no, o si falla la carga, sprite).
   * El módulo se trae solo cuando hay algún modelo configurado.
   */
  models: ModelLibrary | null = null;
  private modelsMod: typeof import('./models') | null = null;
  private modelsLoading = false;
  private modelViews = new Map<object, ModelInstance>();
  private tmpC = new Color();
  /** Calidad automática: si va lento, baja la resolución y luego quita las sombras. */
  private quality = sessionQuality;
  private adaptive = true;
  private frameMs = 16;
  private lastFrame = 0;
  private slowFor = 0;
  private readonly levels = [
    { pr: 2, shadows: true }, { pr: 1.5, shadows: true }, { pr: 1, shadows: true },
    { pr: 1, shadows: false }, { pr: 0.75, shadows: false }, { pr: 0.5, shadows: false },
  ];
  private baseTilt = (BALANCE.camera.elevation * Math.PI) / 180;
  /** Arena ilustrada de la sala (cámara cenital: la perspectiva ya está en el dibujo). */
  private art: ArenaDef | null = null;
  private get tilt(): number {
    return this.art ? Math.PI / 2 : this.baseTilt;
  }

  /** Crea la escena, o null si el dispositivo no tiene WebGL. */
  static create(glCanvas: HTMLCanvasElement, overlay: HTMLCanvasElement, mode: 'auto' | 'high' | 'medium' | 'low' = 'auto'): Scene3D | null {
    try {
      const probe = glCanvas.getContext('webgl2');
      if (!probe) return null;
      const s = new Scene3D(glCanvas, overlay);
      if (mode !== 'auto') {
        s.quality = mode === 'high' ? 0 : mode === 'medium' ? 2 : 4;
        s.adaptive = false;
      }
      return s;
    } catch {
      return null;
    }
  }

  private constructor(glCanvas: HTMLCanvasElement, overlay: HTMLCanvasElement) {
    this.gl = new WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = SRGBColorSpace;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = PCFShadowMap;
    this.octx = overlay.getContext('2d')!;

    this.scene.add(new HemisphereLight(0xe8f2ff, 0x5a4a30, 1.45));
    this.sun = new DirectionalLight(0xffecc8, 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 2048);
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.6;
    const sc = this.sun.shadow.camera;
    sc.left = -320; sc.right = 320; sc.top = 560; sc.bottom = -560; sc.near = 10; sc.far = 2000;
    this.scene.add(this.sun, this.sun.target);

    this.decal = document.createElement('canvas');
    this.dctx = this.decal.getContext('2d')!;
    this.decalTex = new CanvasTexture(this.decal);
    this.decalTex.colorSpace = SRGBColorSpace;
    this.decalTex.minFilter = LinearFilter;
    this.decalTex.generateMipmaps = false;
    this.decalMesh = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: this.decalTex, transparent: true, depthWrite: false }));
    this.decalMesh.rotation.x = -Math.PI / 2;
    this.decalMesh.renderOrder = 1;
    this.scene.add(this.decalMesh);
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr = dpr;
    this.applyQuality();
    const o = this.octx.canvas;
    o.width = Math.round(this.cssW * dpr);
    o.height = Math.round(this.cssH * dpr);
    this.camera.aspect = this.cssW / this.cssH;
  }

  private applyQuality(): void {
    const q = this.levels[this.quality];
    this.gl.setPixelRatio(Math.min(this.dpr, q.pr));
    this.gl.setSize(this.cssW, this.cssH, false);
    this.sun.castShadow = q.shadows;
  }

  /** Nivel de calidad actual (0 = máxima). */
  get qualityLevel(): number {
    return this.quality;
  }

  private adaptQuality(): void {
    if (!this.adaptive) return;
    const now = performance.now();
    if (this.lastFrame) {
      const dt = Math.min(250, now - this.lastFrame);
      this.frameMs += (dt - this.frameMs) * 0.05;
      // Más de ~2 s por debajo de 40 fps: un escalón menos.
      this.slowFor = this.frameMs > 25 ? this.slowFor + dt : 0;
      if (this.slowFor > 2000 && this.quality < this.levels.length - 1) {
        this.quality++;
        sessionQuality = this.quality;
        this.slowFor = 0;
        this.frameMs = 16;
        this.applyQuality();
      }
    }
    this.lastFrame = now;
  }

  /** Libera todo lo que la escena ha subido a la GPU (al salir de la partida). */
  dispose(): void {
    if (this.room) {
      this.scene.remove(this.room);
      disposeObject(this.room);
      this.room = null;
    }
    for (const v of this.views.values()) {
      v.mesh.geometry.dispose();
      v.mesh.material.dispose();
    }
    this.views.clear();
    for (const m of this.modelViews.values()) m.dispose();
    this.modelViews.clear();
    this.models?.dispose();
    for (const t of this.sheets.values()) t.dispose();
    this.sheets.clear();
    this.decalTex.dispose();
    this.decalMesh.geometry.dispose();
    (this.decalMesh.material as MeshBasicMaterial).dispose();
    // El mapa de sombras del sol es una textura de la GPU más.
    this.sun.dispose();
    this.gl.renderLists.dispose();
    this.gl.dispose();
    // El lienzo de la partida se tira: soltar el contexto libera también lo
    // interno de Three.js (p. ej. la tabla DFG compartida de los materiales PBR).
    this.gl.forceContextLoss();
  }

  /** Recursos vivos en la GPU (depuración y pruebas de fugas). */
  get memory(): { geometries: number; textures: number; calls: number; contextLost: boolean } {
    const i = this.gl.info;
    return { geometries: i.memory.geometries, textures: i.memory.textures, calls: i.render.calls, contextLost: this.gl.getContext().isContextLost() };
  }

  draw(w: World): void {
    const dt = Math.min(0.1, Math.max(0, w.time - this.lastTime));
    this.lastTime = w.time;
    this.adaptQuality();
    if (this.roomKey !== w.obstacles || !this.room) this.buildRoom(w);
    this.updateCamera(w, dt);
    this.updateRoom(w);
    this.updateTorches(w.time, dt);
    this.drawDecals(w);
    this.updateSprites(w, dt);
    this.gl.render(this.scene, this.camera);
    this.drawOverlay(w);
  }

  // --------------------------------------------------------------------------
  // Cámara
  // --------------------------------------------------------------------------

  private updateCamera(w: World, dt: number): void {
    if (this.art) return this.updateArenaCamera(w, dt, this.art);
    const C = BALANCE.camera;
    const cam = this.camera;
    cam.up.set(0, 1, 0);
    cam.fov = C.fov;
    const half = Math.atan(Math.tan((C.fov * Math.PI) / 360) * cam.aspect);
    const D = C.viewWidth / this.zoom / 2 / Math.tan(half);
    // Qué franja de suelo cae en el borde de arriba y de abajo de la pantalla
    // (respecto al punto al que mira), para no enseñar mucho fuera de la sala.
    const f2 = (C.fov * Math.PI) / 360;
    const ch = D * Math.sin(this.tilt);
    const back = D * Math.cos(this.tilt);
    const below = back - ch / Math.tan(this.tilt + f2);
    const above = this.tilt - f2 > 0.05 ? ch / Math.tan(this.tilt - f2) - back : 2000;
    const p = w.player;
    const span = (w.W - C.viewWidth) / 2 + 8;
    const tx = span > 0 ? Math.max(w.W / 2 - span, Math.min(w.W / 2 + span, p.x)) : w.W / 2;
    // Arriba se deja ver la puerta (la interfaz tapa un trozo); abajo, justo el muro.
    const zMin = above * 0.82 - 70;
    const zMax = w.H + 16 - below;
    const tz = zMin < zMax ? Math.max(zMin, Math.min(zMax, p.y - C.lead)) : w.H / 2;
    const target = new Vector3(tx, 0, tz);
    if (!this.camReady) {
      this.camPos.copy(target);
      this.camReady = true;
    } else {
      this.camPos.lerp(target, 1 - Math.exp(-dt * C.follow));
    }
    let sx = 0;
    let sy = 0;
    if (w.shake > 0) {
      sx = (Math.random() - 0.5) * 24 * w.shake;
      sy = (Math.random() - 0.5) * 24 * w.shake;
    }
    cam.position.set(this.camPos.x + sx, D * Math.sin(this.tilt) + sy, this.camPos.z + D * Math.cos(this.tilt));
    cam.near = D * 0.3;
    cam.far = D * 3;
    cam.lookAt(this.camPos.x + sx, sy, this.camPos.z);
    cam.updateProjectionMatrix();
    const fog = this.scene.fog as Fog | null;
    if (fog) {
      fog.near = D * 1.05;
      fog.far = D * 1.9;
    }
  }

  /** Cámara cenital sobre la ilustración: te sigue sin salirse del dibujo. */
  private updateArenaCamera(w: World, dt: number, a: ArenaDef): void {
    const C = BALANCE.camera;
    const cam = this.camera;
    cam.fov = 30;
    const viewW = C.arenaViewWidth / this.zoom;
    const half = Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect);
    const D = viewW / 2 / Math.tan(half);
    const hh = D * Math.tan((cam.fov * Math.PI) / 360);
    const x0 = -a.ox * a.s + viewW / 2;
    const x1 = (a.imgW - a.ox) * a.s - viewW / 2;
    const z0 = -a.oy * a.s + hh - 40; // arriba la interfaz tapa un trozo
    const z1 = (a.imgH - a.oy) * a.s - hh;
    const p = w.player;
    // Se adelanta un poco hacia donde te mueves; quieto, hacia tu blanco.
    const look = p.moving ? p.moveAngle : w.target ? Math.atan2(w.target.y - p.y, w.target.x - p.x) : -Math.PI / 2;
    this.lookX += (Math.cos(look) * C.arenaLook - this.lookX) * Math.min(1, dt * 2.5);
    this.lookZ += (Math.sin(look) * C.arenaLook - this.lookZ) * Math.min(1, dt * 2.5);
    const tx = x0 < x1 ? Math.max(x0, Math.min(x1, p.x + this.lookX)) : w.W / 2;
    const tz = z0 < z1 ? Math.max(z0, Math.min(z1, p.y - 10 + this.lookZ)) : w.H / 2;
    const target = new Vector3(tx, 0, tz);
    if (!this.camReady) {
      this.camPos.copy(target);
      this.camReady = true;
    } else {
      this.camPos.lerp(target, 1 - Math.exp(-dt * C.follow));
    }
    const sx = w.shake > 0 ? (Math.random() - 0.5) * 20 * w.shake : 0;
    const sz = w.shake > 0 ? (Math.random() - 0.5) * 20 * w.shake : 0;
    cam.up.set(0, 0, -1);
    cam.position.set(this.camPos.x + sx, D, this.camPos.z + sz);
    cam.near = D * 0.5;
    cam.far = D * 1.5;
    cam.lookAt(this.camPos.x + sx, 0, this.camPos.z + sz);
    cam.updateProjectionMatrix();
  }

  // --------------------------------------------------------------------------
  // Escenario de la sala
  // --------------------------------------------------------------------------

  /** Sala sobre una ilustración: el dibujo es el suelo y las rocas te tapan al pasar por detrás. */
  private buildArena(w: World, a: ArenaDef, g: Group): void {
    this.scene.background = new Color('#140d06');
    this.scene.fog = null;
    const load = (src: string) => {
      const img = new Image();
      const t = new Texture(img);
      t.colorSpace = SRGBColorSpace;
      t.minFilter = LinearFilter;
      t.generateMipmaps = false;
      img.onload = () => { t.needsUpdate = true; };
      img.src = src;
      return t;
    };
    const s = a.s;
    const ground = new Mesh(new PlaneGeometry(a.imgW * s, a.imgH * s), new MeshBasicMaterial({ map: load(a.image) }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((a.imgW / 2 - a.ox) * s, 0, (a.imgH / 2 - a.oy) * s);
    g.add(ground);
    const occ = load(a.occluder);
    for (const [x0, y0, x1, y1, top] of a.rocks) {
      const rx0 = x0 - 14;
      const rx1 = x1 + 14;
      const ry0 = top - 10;
      const ry1 = y1 + 6;
      const geo = new PlaneGeometry((rx1 - rx0) * s, (ry1 - ry0) * s);
      const uv = geo.attributes.uv.array as Float32Array;
      const u0 = rx0 / a.imgW;
      const u1 = rx1 / a.imgW;
      const vt = 1 - ry0 / a.imgH;
      const vb = 1 - ry1 / a.imgH;
      uv.set([u0, vt, u1, vt, u0, vb, u1, vb]);
      const m = new Mesh(geo, new MeshBasicMaterial({ map: occ, transparent: true, alphaTest: 0.5 }));
      m.rotation.x = -Math.PI / 2;
      // Altura de dibujo según la base: los Pokémon con los pies más arriba quedan detrás.
      m.position.set(((rx0 + rx1) / 2 - a.ox) * s, depthY(((y0 + y1) / 2 - a.oy) * s), ((ry0 + ry1) / 2 - a.oy) * s);
      g.add(m);
    }
    this.buildTorches(a, g);
    // Luz para los modelos 3D (la ilustración ya trae la suya): desde arriba a la izquierda, como en el dibujo.
    this.sun.position.set(w.W / 2 - 260, 520, w.H / 2 - 220);
    this.sun.target.position.set(w.W / 2, 0, w.H / 2);
  }

  /**
   * Luz de las antorchas dibujadas: un halo cálido que parpadea (aditivo, una
   * sola llamada de dibujo) y chispas que suben. Solo decorado: no toca la
   * simulación ni tapa a nadie (es luz que se suma, no un objeto opaco).
   */
  private buildTorches(a: ArenaDef, g: Group): void {
    const lights = a.lights ?? [];
    if (!lights.length) return;
    const glow = glowTexture();
    const s = a.s;
    const spots = lights.map(([x, y], i) => ({ x: (x - a.ox) * s, z: (y - a.oy) * s, size: 230 * s, ph: i * 1.7 }));
    const mesh = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({
      map: glow, color: 0xff8a30, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    }), spots.length);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 5;
    mesh.frustumCulled = false;
    g.add(mesh);
    this.torches = { mesh, spots };
    // Chispas: un puñado por antorcha, en un único Points.
    const n = Math.min(64, spots.length * 5);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new Points(geo, new PointsMaterial({
      map: glow, size: 9, vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    }));
    pts.renderOrder = 6;
    pts.frustumCulled = false;
    g.add(pts);
    this.embers = { pts, spots, life: new Float32Array(n), vel: new Float32Array(n * 2) };
    // Cada chispa empieza ya en vuelo desde una antorcha (no todas a la vez ni en el origen).
    for (let i = 0; i < n; i++) this.spawnEmber(i, Math.random());
  }

  private spawnEmber(i: number, life: number): void {
    const E = this.embers!;
    const pos = E.pts.geometry.attributes.position as BufferAttribute;
    const sp = E.spots[Math.floor(Math.random() * E.spots.length)];
    const vx = (Math.random() - 0.5) * 10;
    const vz = -(14 + Math.random() * 16);
    const age = (1 - life) / EMBER_FADE;
    E.life[i] = life;
    E.vel[i * 2] = vx;
    E.vel[i * 2 + 1] = vz;
    pos.setXYZ(i, sp.x + (Math.random() - 0.5) * 6 + vx * age, 6, sp.z - 4 + vz * age);
  }

  /** Parpadeo de las antorchas y vuelo de las chispas. */
  private updateTorches(t: number, dt: number): void {
    const T = this.torches;
    if (T) {
      const m = this.tmpM;
      T.spots.forEach((sp, i) => {
        const f = 0.82 + 0.1 * Math.sin(t * 9 + sp.ph) + 0.08 * Math.sin(t * 23 + sp.ph * 3);
        m.makeScale(sp.size * f, sp.size * f, 1);
        // La malla está girada -90° en X: (x, y local) → (x, -z del mundo).
        m.setPosition(sp.x, -sp.z, 6);
        T.mesh.setMatrixAt(i, m);
        T.mesh.setColorAt(i, this.tmpC.setRGB(0.85 * f, 0.85 * f, 0.85 * f));
      });
      T.mesh.instanceMatrix.needsUpdate = true;
      if (T.mesh.instanceColor) T.mesh.instanceColor.needsUpdate = true;
    }
    const E = this.embers;
    if (!E) return;
    E.pts.visible = this.quality < this.levels.length - 1;
    if (!E.pts.visible) return;
    const pos = E.pts.geometry.attributes.position as BufferAttribute;
    const col = E.pts.geometry.attributes.color as BufferAttribute;
    const n = E.life.length;
    for (let i = 0; i < n; i++) {
      E.life[i] -= dt * EMBER_FADE;
      if (E.life[i] <= 0) {
        // Renace en una antorcha al azar y sube (hacia arriba de la pantalla) con algo de deriva.
        this.spawnEmber(i, 1);
      } else {
        pos.setX(i, pos.getX(i) + E.vel[i * 2] * dt);
        pos.setZ(i, pos.getZ(i) + E.vel[i * 2 + 1] * dt);
      }
      const k = Math.min(1, E.life[i] * 1.6) * E.life[i];
      col.setXYZ(i, k, 0.55 * k, 0.15 * k);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  private buildRoom(w: World): void {
    if (this.room) {
      this.scene.remove(this.room);
      disposeObject(this.room);
    }
    this.roomKey = w.obstacles;
    this.camReady = false;
    const g = new Group();
    this.room = g;
    this.waterTex = [];
    this.bars = null;
    this.glow = null;
    this.torches = null;
    this.embers = null;
    this.art = w.arena;
    if (w.arena) {
      this.buildArena(w, w.arena, g);
      this.decal.width = Math.ceil(w.W * DECAL_RES);
      this.decal.height = Math.ceil(w.H * DECAL_RES);
      this.decalMesh.scale.set(w.W, w.H, 1);
      this.decalMesh.position.set(w.W / 2, 0.6, w.H / 2);
      this.decalTex.dispose();
      this.decalTex = new CanvasTexture(this.decal);
      this.decalTex.colorSpace = SRGBColorSpace;
      this.decalTex.minFilter = LinearFilter;
      this.decalTex.generateMipmaps = false;
      (this.decalMesh.material as MeshBasicMaterial).map = this.decalTex;
      this.decalDirty = true;
      this.scene.add(g);
      return;
    }
    const W = w.W;
    const H = w.H;
    const theme = w.gym.theme;
    const dark = new Color(theme.rock).multiplyScalar(0.35);
    this.scene.background = dark.clone();
    this.scene.fog = new Fog(dark.clone(), 1000, 2000);

    // Suelo de la sala (el fondo pixel art de siempre) con orillas de barro junto al agua.
    const bg = buildBackground(w.gym, W, H, false);
    const bctx = bg.getContext('2d')!;
    for (const o of w.obstacles) {
      if (o.kind !== 'water') continue;
      bctx.fillStyle = '#5a4630';
      bctx.fillRect(Math.floor(o.x / PIXEL) - 1, Math.floor(o.y / PIXEL) - 1, Math.ceil(o.w / PIXEL) + 2, Math.ceil(o.h / PIXEL) + 2);
    }
    for (const o of w.obstacles) {
      if (o.kind !== 'rock') continue;
      bctx.fillStyle = 'rgba(40, 30, 20, 0.35)';
      bctx.fillRect(Math.floor(o.x / PIXEL), Math.floor(o.y / PIXEL), Math.ceil(o.w / PIXEL), Math.ceil(o.h / PIXEL));
    }
    const groundTex = pixelTexture(bg);
    const ground = new Mesh(new PlaneGeometry(W, H), new MeshLambertMaterial({ map: groundTex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(W / 2, 0, H / 2);
    ground.receiveShadow = true;
    g.add(ground);

    // Suelo de fuera de la sala (oscuro, se pierde en la niebla).
    const outside = new Mesh(new PlaneGeometry(W * 8, H * 4), new MeshLambertMaterial({ color: new Color(theme.rock).multiplyScalar(0.55) }));
    outside.rotation.x = -Math.PI / 2;
    outside.position.set(W / 2, -0.4, H / 2);
    outside.receiveShadow = true;
    g.add(outside);

    // Muros de piedra alrededor, con hueco arriba para la puerta.
    const stone = stoneCanvas(theme.rock);
    const box = (x0: number, x1: number, z0: number, z1: number, h: number) => {
      const bw = x1 - x0;
      const bd = z1 - z0;
      const tex = pixelTexture(stone);
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.repeat.set(Math.max(bw, bd) / 32, h / 32);
      const m = new Mesh(new BoxGeometry(bw, h, bd), new MeshLambertMaterial({ map: tex }));
      m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const gapL = w.exit.x - w.exit.r - 6;
    const gapR = w.exit.x + w.exit.r + 6;
    box(WALL_IN - WALL_T, WALL_IN, WALL_IN - WALL_T, H - WALL_IN + WALL_T, WALL_H);
    box(W - WALL_IN, W - WALL_IN + WALL_T, WALL_IN - WALL_T, H - WALL_IN + WALL_T, WALL_H);
    box(WALL_IN, gapL, WALL_IN - WALL_T, WALL_IN, WALL_H);
    box(gapR, W - WALL_IN, WALL_IN - WALL_T, WALL_IN, WALL_H);
    box(WALL_IN, W - WALL_IN, H - WALL_IN, H - WALL_IN + WALL_T, 14);
    // Puerta: pilares, dintel, barrotes y luz cuando se abre.
    box(gapL - 8, gapL + 2, WALL_IN - WALL_T - 2, WALL_IN + 2, WALL_H + 18);
    box(gapR - 2, gapR + 8, WALL_IN - WALL_T - 2, WALL_IN + 2, WALL_H + 18);
    box(gapL - 8, gapR + 8, WALL_IN - WALL_T - 2, WALL_IN + 2, 10).position.y = WALL_H + 18 + 5;
    const bars = new Group();
    const barMat = new MeshLambertMaterial({ color: 0x4a3a2a });
    for (let i = 0; i < 6; i++) {
      const b = new Mesh(new BoxGeometry(3, WALL_H + 18, 3), barMat);
      b.position.set(gapL + 4 + i * ((gapR - gapL - 8) / 5), (WALL_H + 18) / 2, WALL_IN - WALL_T / 2);
      b.castShadow = true;
      bars.add(b);
    }
    g.add(bars);
    this.bars = bars;
    const glow = new Mesh(new PlaneGeometry(gapR - gapL, WALL_H + 18), new MeshBasicMaterial({ color: 0x78dcff, transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false }));
    glow.position.set((gapL + gapR) / 2, (WALL_H + 18) / 2, WALL_IN - WALL_T / 2);
    g.add(glow);
    this.glow = glow;

    // Bosque alrededor de la sala (decorado).
    g.add(forest(W, H, w.gym.order));

    // Obstáculos.
    for (const o of w.obstacles) g.add(o.kind === 'water' ? this.waterMesh(o) : o.kind === 'house' ? houseMesh(o) : rockMesh(o, theme.rock));

    // Capa de suelo para avisos, sombras y zonas.
    this.decal.width = Math.ceil(W * DECAL_RES);
    this.decal.height = Math.ceil(H * DECAL_RES);
    this.decalMesh.scale.set(W, H, 1);
    this.decalMesh.position.set(W / 2, 0.6, H / 2);
    this.decalTex.dispose();
    this.decalTex = new CanvasTexture(this.decal);
    this.decalTex.colorSpace = SRGBColorSpace;
    this.decalTex.minFilter = LinearFilter;
    this.decalTex.generateMipmaps = false;
    (this.decalMesh.material as MeshBasicMaterial).map = this.decalTex;
    this.decalDirty = true;

    // Sol: alto, desde la izquierda y por delante; las sombras caen hacia atrás a la derecha.
    this.sun.position.set(W / 2 - 260, 520, H / 2 + 220);
    this.sun.target.position.set(W / 2, 0, H / 2);
    this.scene.add(g);
  }

  private waterMesh(o: Obstacle): Object3D {
    const tex = pixelTexture(rippleCanvas());
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(o.w / 48, o.h / 48);
    this.waterTex.push(tex);
    const m = new Mesh(new PlaneGeometry(o.w, o.h), new MeshStandardMaterial({
      color: 0x4c9be0, map: tex, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.92,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(o.x + o.w / 2, 0.35, o.y + o.h / 2);
    m.receiveShadow = true;
    return m;
  }

  private updateRoom(w: World): void {
    for (const t of this.waterTex) {
      t.offset.x = (w.time * 0.05) % 1;
      t.offset.y = (w.time * 0.11) % 1;
    }
    if (this.bars) this.bars.visible = !w.exitOpen;
    if (this.glow) {
      this.glow.visible = w.exitOpen;
      (this.glow.material as MeshBasicMaterial).opacity = 0.45 + 0.3 * ((Math.sin(w.time * 6) + 1) / 2);
    }
  }

  // --------------------------------------------------------------------------
  // Capa de suelo (debajo de los Pokémon)
  // --------------------------------------------------------------------------

  private drawDecals(w: World): void {
    const ctx = this.dctx;
    ctx.setTransform(DECAL_RES, 0, 0, DECAL_RES, 0, 0);
    ctx.clearRect(0, 0, w.W, w.H);
    let n = 0;
    for (const f of w.fields) { drawGroundField(ctx, f, w, true); n++; }
    for (const h of w.hazards) { drawHazard(ctx, h, true); n++; }
    for (const m of w.markers) { drawMarker(ctx, m, w.time, true); n++; }
    for (const g of w.pickups) { drawPickupShadow(ctx, g, true); n++; }
    for (const s of w.slashes) { drawSlash(ctx, s); n++; }
    for (const r of w.rings) { drawRing(ctx, r, true); n++; }
    // Pueblo: un aro dorado que late en cada sitio con el que se puede interactuar.
    for (const sp of w.town?.spots ?? []) { drawSpotHint(ctx, sp.x, sp.y, w.time); n++; }
    const p = w.player;
    if (p.appear > 0) drawShadow(ctx, p.species.dex, p.x, p.y, p.anim.scale, true);
    for (const n of w.npcs) drawShadow(ctx, n.dex, n.x, n.y, n.anim.scale, true);
    for (const e of w.enemies) {
      const lift = jumpHeight(e);
      if (e.hidden) drawMound(ctx, e, true);
      else drawShadow(ctx, e.def.dex, e.x, e.y, e.scale * (lift ? 0.7 : 1), true);
      drawBossRing(ctx, e, true);
    }
    n += w.enemies.length + 1;
    // Solo se sube a la GPU si hay algo (o lo había en el fotograma anterior).
    if (n || this.decalDirty) this.decalTex.needsUpdate = true;
    this.decalDirty = n > 0;
  }

  // --------------------------------------------------------------------------
  // Pokémon (sprites de pie)
  // --------------------------------------------------------------------------

  private updateSprites(w: World, dt: number): void {
    for (const v of this.views.values()) v.used = false;
    const usedModels = new Set<object>();
    const models = hasModels() && this.ensureModels();
    const p = w.player;
    const blink = p.invuln > 0 && w.phase === 'playing' && Math.floor(w.time * 20) % 2 === 0;
    const draw = (key: object, id: string | null, anim: Animator, x: number, z: number, lift: number, o: { flash: number; alpha: number }) => {
      if (models && id && this.model(key, id, anim, x, z, lift, o, dt)) usedModels.add(key);
      else this.sprite(key, anim, x, z, lift, o);
    };
    // Al salir de la Poké Ball aparece en blanco y va tomando color.
    if (p.appear > 0) draw(p, p.species.id, p.anim, p.x, p.y, 0, { flash: p.appear < 1 ? 1 - p.appear * 0.9 : p.hitFlash > 0 ? 0.55 : 0, alpha: p.appear < 1 ? Math.min(1, p.appear * 2.5) : blink ? 0.45 : 1 });
    for (const e of w.enemies) {
      if (e.hidden) continue;
      const shake = e.phase === 'aim' || e.phase === 'fuse' ? Math.sin(w.time * 60) * 1.2 : 0;
      draw(e, models ? speciesByDex(e.def.dex).id : null, e.anim, e.x + shake, e.y, jumpHeight(e), { flash: e.flash > 0 ? (e.boss ? 0.55 : 1) : 0, alpha: 1 });
    }
    for (const c of w.corpses) this.sprite(c, c.anim, c.x, c.y, 0, { flash: 0, alpha: Math.min(1, c.fade * 1.6) });
    for (const n of w.npcs) this.sprite(n, n.anim, n.x, n.y, 0, { flash: 0, alpha: 1 });
    for (const [key, v] of this.views) {
      if (v.used) continue;
      this.scene.remove(v.group);
      v.mesh.geometry.dispose();
      v.mesh.material.dispose();
      this.views.delete(key);
    }
    for (const [key, m] of this.modelViews) {
      if (usedModels.has(key)) continue;
      m.dispose();
      this.modelViews.delete(key);
    }
  }

  /** Trae el módulo de modelos la primera vez (mientras, sprites). */
  private ensureModels(): boolean {
    if (this.models) return true;
    if (!this.modelsLoading) {
      this.modelsLoading = true;
      import('./models').then(
        (mod) => { this.modelsMod = mod; this.models = new mod.ModelLibrary(); },
        (e: unknown) => console.warn('[modelos 3D] No se pudo cargar el módulo; se usan sprites.', e),
      );
    }
    return false;
  }

  /** Dibuja con su modelo 3D si lo hay y ya cargó. Devuelve false para usar el sprite. */
  private model(key: object, id: string, anim: Animator, x: number, z: number, lift: number, o: { flash: number; alpha: number }, dt: number): boolean {
    const def = modelFor(id);
    const tpl = def && this.models ? this.models.get(def) : null;
    if (!tpl || !this.modelsMod) return false;
    let m = this.modelViews.get(key);
    if (m && m.template !== tpl) {
      m.dispose();
      m = undefined;
    }
    if (!m) {
      m = new this.modelsMod.ModelInstance(tpl);
      this.scene.add(m.root);
      this.modelViews.set(key, m);
    }
    // Fila de dirección del sprite (0 = hacia abajo) → ángulo en el suelo.
    const facing = Math.PI / 2 - anim.dir * (Math.PI / 4);
    m.update(dt, MODEL_ANIM[anim.cur] ?? 'idle', facing, o);
    m.root.visible = o.alpha > 0;
    if (this.art) {
      m.root.rotation.x = -(Math.PI / 2 - ARENA_MODEL_ELEV);
      m.root.position.set(x, depthY(z) + 0.001, z - lift);
    } else {
      m.root.rotation.x = 0;
      m.root.position.set(x, lift, z);
    }
    return true;
  }

  /** Estado de los modelos 3D en uso (depuración y pruebas). */
  modelDebug(): { instances: { anim: string | null }[] } {
    return { instances: [...this.modelViews.values()].map((m) => ({ anim: m.anim })) };
  }

  private sheetTexture(img: HTMLImageElement): Texture {
    let t = this.sheets.get(img);
    if (!t) {
      t = new Texture(img);
      t.colorSpace = SRGBColorSpace;
      t.magFilter = NearestFilter;
      t.minFilter = NearestFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      this.sheets.set(img, t);
    }
    return t;
  }

  private sprite(key: object, anim: Animator, x: number, z: number, lift: number, o: { flash: number; alpha: number }): void {
    const info = anim.frameInfo();
    let v = this.views.get(key);
    if (!v) {
      const flash = { value: 0 };
      const texel = { value: new Vector3(0, 0, 0) };
      const mat = new MeshBasicMaterial({ transparent: true, alphaTest: 0.35 });
      // Destello blanco al recibir un golpe (como el 2D) y contorno oscuro de
      // 1 píxel alrededor de la silueta, para leerla sobre la ilustración.
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uFlash = flash;
        sh.uniforms.uTexel = texel;
        sh.fragmentShader = sh.fragmentShader
          .replace('void main() {', 'uniform float uFlash;\nuniform vec3 uTexel;\nvoid main() {')
          .replace('#include <map_fragment>', `#include <map_fragment>
\tif (uTexel.z > 0.5 && diffuseColor.a < 0.35) {
\t\tfloat n = max(max(texture2D(map, vMapUv + vec2(uTexel.x, 0.0)).a, texture2D(map, vMapUv - vec2(uTexel.x, 0.0)).a),
\t\t\tmax(texture2D(map, vMapUv + vec2(0.0, uTexel.y)).a, texture2D(map, vMapUv - vec2(0.0, uTexel.y)).a));
\t\tif (n > 0.35) diffuseColor = vec4(0.09, 0.06, 0.05, 0.85 * opacity);
\t}`)
          .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n\tgl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), uFlash);');
      };
      const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
      const group = new Group();
      group.add(mesh);
      this.scene.add(group);
      v = { group, mesh, flash, texel, used: true };
      this.views.set(key, v);
    }
    v.used = true;
    if (!info) {
      v.group.visible = false;
      return;
    }
    v.group.visible = o.alpha > 0;
    const mat = v.mesh.material;
    const tex = this.sheetTexture(info.img);
    if (mat.map !== tex) {
      mat.map = tex;
      mat.needsUpdate = true;
      v.texel.value.set(1 / info.img.width, 1 / info.img.height, OUTLINE ? 1 : 0);
    }
    mat.opacity = o.alpha;
    v.flash.value = o.flash;
    // Recorte del fotograma en la hoja (UV de los 4 vértices).
    const iw = info.img.width;
    const ih = info.img.height;
    const u0 = info.sx / iw;
    const u1 = (info.sx + info.w) / iw;
    const vt = 1 - info.sy / ih;
    const vb = 1 - (info.sy + info.h) / ih;
    const uv = v.mesh.geometry.attributes.uv;
    const a = uv.array as Float32Array;
    if (a[0] !== u0 || a[1] !== vt || a[2] !== u1 || a[5] !== vb) {
      a.set([u0, vt, u1, vt, u0, vb, u1, vb]);
      uv.needsUpdate = true;
    }
    const k = info.k;
    const wd = info.w * k;
    const hd = info.h * k;
    v.mesh.scale.set(wd, hd, 1);
    v.mesh.position.set(wd / 2 - info.ax * k, info.ay * k - hd / 2, 0);
    v.group.rotation.x = -this.tilt;
    if (this.art) v.group.position.set(x, depthY(z) + 0.001, z - lift);
    else v.group.position.set(x, lift, z);
  }

  // --------------------------------------------------------------------------
  // Efectos por encima (canvas 2D proyectado)
  // --------------------------------------------------------------------------

  /** Coloca el canvas para dibujar en coordenadas del mundo alrededor de (wx, wy), a `lift` de altura. */
  private place(wx: number, wy: number, lift: number): boolean {
    const zz = this.art ? wy : wy + lift;
    const v = this.v.set(wx, lift, zz).project(this.camera);
    if (v.z > 1 || v.x < -1.3 || v.x > 1.3 || v.y < -1.3 || v.y > 1.3) return false;
    const sx = ((v.x + 1) / 2) * this.cssW;
    const sy = ((1 - v.y) / 2) * this.cssH;
    const v2 = this.v.set(wx + 1, lift, zz).project(this.camera);
    const s = Math.abs(((v2.x + 1) / 2) * this.cssW - sx);
    const d = this.dpr;
    this.octx.setTransform(d * s, 0, 0, d * s, d * (sx - s * wx), d * (sy - s * wy));
    return true;
  }

  private drawOverlay(w: World): void {
    const ctx = this.octx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.imageSmoothingEnabled = false;
    for (const g of w.pickups) if (this.place(g.x, g.y, 0)) drawPickup(ctx, g, w.time);
    for (const f of w.fields) if (this.place(f.x, f.y, 0)) drawAirField(ctx, f, w);
    const p = w.player;
    if (p.appear >= 1 && this.place(p.x, p.y, 0)) drawPlayerAura(ctx, p);
    for (const g of guardianPositions(w)) if (this.place(g.x, g.y, 10)) drawGuardian(ctx, g);
    for (const m of p.moves) if (m.def.kind === 'orbit') for (const o of orbitPositions(w, m)) if (this.place(o.x, o.y, 8)) drawOrb(ctx, m, o, w.time);
    for (const pr of w.projectiles) if (this.place(pr.x, pr.y, 12)) drawProjectile(ctx, pr, w.time);
    for (const b of w.beams) this.drawBeam3d(b);
    for (const pt of w.particles) if (this.place(pt.x, pt.y, 12)) drawParticle(ctx, pt);
    for (const e of w.enemies) {
      if (e.hidden || !this.place(e.x, e.y, 0)) continue;
      drawEnemyMarks(ctx, e);
      drawEnemyBar(ctx, e);
    }
    if (this.showDamageNumbers) for (const t of w.texts) if (this.place(t.x, t.y, 20)) drawText(ctx, t);
    if (w.exitOpen && this.place(w.exit.x, w.exit.y + 30, 0)) drawExitArrow(ctx, w);
    // Lo que añada la pantalla (el lanzamiento de la Poké Ball), en coordenadas del mundo.
    if (this.onTop && this.place(w.W / 2, w.H / 2, 0)) this.onTop(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Dibujo extra por encima de todo, en coordenadas del mundo. */
  onTop: ((ctx: CanvasRenderingContext2D) => void) | null = null;

  /** Rayo del jugador: franja proyectada de punta a punta (a 12 de altura). */
  private drawBeam3d(b: World['beams'][number]): void {
    const k = Math.max(0, b.life / 0.22);
    const ex = b.x + Math.cos(b.angle) * b.len;
    const ey = b.y + Math.sin(b.angle) * b.len;
    const A = this.screen(b.x, b.y + 12, 12);
    const B = this.screen(ex, ey + 12, 12);
    const nx = -Math.sin(b.angle);
    const ny = Math.cos(b.angle);
    const A2 = this.screen(b.x + nx, b.y + 12 + ny, 12);
    const B2 = this.screen(ex + nx, ey + 12 + ny, 12);
    const ctx = this.octx;
    const d = this.dpr;
    const quad = (wk: number) => {
      const hw = (b.w / 2) * wk;
      ctx.beginPath();
      ctx.moveTo(d * (A.x + (A2.x - A.x) * hw), d * (A.y + (A2.y - A.y) * hw));
      ctx.lineTo(d * (B.x + (B2.x - B.x) * hw), d * (B.y + (B2.y - B.y) * hw));
      ctx.lineTo(d * (B.x - (B2.x - B.x) * hw), d * (B.y - (B2.y - B.y) * hw));
      ctx.lineTo(d * (A.x - (A2.x - A.x) * hw), d * (A.y - (A2.y - A.y) * hw));
      ctx.closePath();
      ctx.fill();
    };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.min(1, k * 1.5) * 0.55;
    ctx.fillStyle = b.color;
    quad(1);
    ctx.globalAlpha = Math.min(1, k * 1.5);
    ctx.fillStyle = '#ffffff';
    quad(1 / 3);
    ctx.globalAlpha = 1;
  }

  private screen(x: number, z: number, h: number): { x: number; y: number } {
    const v = this.v.set(x, h, this.art ? z - h : z).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.cssW, y: ((1 - v.y) / 2) * this.cssH };
  }
}

// ----------------------------------------------------------------------------
// Texturas y modelos procedurales
// ----------------------------------------------------------------------------

/** Altura a la que se dibuja algo plano en la arena, según su profundidad (más abajo = delante). */
function depthY(z: number): number {
  return 2 + z * 0.004;
}

/** Halo radial suave (luz de antorcha y chispas). */
function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.15)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function pixelTexture(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  return t;
}

/** Sillares de piedra pixel art (32 × 32, se repite). */
function stoneCanvas(base: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  const col = new Color(base);
  const shade = (k: number) => `#${col.clone().multiplyScalar(k).getHexString()}`;
  ctx.fillStyle = shade(0.55);
  ctx.fillRect(0, 0, 32, 32);
  const rng = new Rng(7);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 8 : 0;
    for (let i = -1; i < 2; i++) {
      const x = i * 16 + off;
      ctx.fillStyle = shade(0.85 + rng.next() * 0.25);
      ctx.fillRect(x + 1, row * 8 + 1, 14, 6);
      ctx.fillStyle = shade(1.15);
      ctx.fillRect(x + 1, row * 8 + 1, 14, 1);
    }
  }
  return c;
}

/** Ondas del agua (64 × 64, se repite). */
function rippleCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#d8ecff';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';
  const rng = new Rng(11);
  for (let i = 0; i < 9; i++) ctx.fillRect(rng.int(0, 56), rng.int(0, 62), rng.int(4, 9), 1);
  ctx.fillStyle = '#b9d8f4';
  for (let i = 0; i < 12; i++) ctx.fillRect(rng.int(0, 58), rng.int(0, 62), rng.int(3, 6), 1);
  return c;
}

const BOULDER = new IcosahedronGeometry(1, 0);
const TRUNK = new CylinderGeometry(2.5, 3.5, 14, 6);
const LEAVES = new ConeGeometry(1, 1, 7);

/** Pinos fuera de los muros, para que la sala no flote en el vacío. */
function forest(W: number, H: number, seed: number): Object3D {
  const g = new Group();
  const rng = new Rng(seed * 131 + 5);
  // Todos los troncos en una sola malla instanciada, y lo mismo con las copas.
  const trunks: Matrix4[] = [];
  const crowns: { m: Matrix4; c: Color }[] = [];
  const greens = [0x2f6a34, 0x3a7a3a, 0x285c30].map((c) => new Color(c));
  const o = new Object3D();
  const tree = (x: number, z: number) => {
    const s = rng.range(0.8, 1.35);
    o.position.set(x, 7 * s, z);
    o.rotation.set(0, rng.range(0, Math.PI), 0);
    o.scale.setScalar(s);
    o.updateMatrix();
    trunks.push(o.matrix.clone());
    const c = rng.pick(greens);
    for (let i = 0; i < 2; i++) {
      const r = (17 - i * 5) * s;
      o.scale.set(r, (26 - i * 6) * s, r);
      o.position.set(x, (20.5 + i * 12) * s, z);
      o.updateMatrix();
      crowns.push({ m: o.matrix.clone(), c });
    }
  };
  for (let z = -60; z < H + 60; z += rng.range(30, 44)) {
    tree(rng.range(-70, -32), z);
    tree(W + rng.range(32, 70), z);
    if (rng.next() < 0.6) tree(rng.range(-130, -80), z + 15);
    if (rng.next() < 0.6) tree(W + rng.range(80, 130), z + 15);
  }
  for (let x = -40; x < W + 40; x += rng.range(28, 40)) {
    if (Math.abs(x - W / 2) < 50) continue;
    tree(x, rng.range(-75, -38));
  }
  const tm = new InstancedMesh(TRUNK, new MeshLambertMaterial({ color: 0x5a3e28 }), trunks.length);
  trunks.forEach((m, i) => tm.setMatrixAt(i, m));
  const cm = new InstancedMesh(LEAVES, new MeshLambertMaterial({ flatShading: true }), crowns.length);
  crowns.forEach((x, i) => { cm.setMatrixAt(i, x.m); cm.setColorAt(i, x.c); });
  tm.castShadow = cm.castShadow = true;
  g.add(tm, cm);
  return g;
}

/** Casa de pueblo: paredes, tejado a dos aguas, puerta y ventanas, del tamaño de su colisión. */
function houseMesh(o: Obstacle): Object3D {
  const g = new Group();
  const wallH = Math.min(46, 22 + o.h * 0.2);
  const wall = new Mesh(new BoxGeometry(o.w, wallH, o.h), new MeshLambertMaterial({ color: new Color(o.wall ?? '#efe6d6') }));
  wall.position.set(o.x + o.w / 2, wallH / 2, o.y + o.h / 2);
  wall.castShadow = wall.receiveShadow = true;
  g.add(wall);
  // Tejado: prisma triangular a lo largo del ancho, que sobresale un poco.
  const roofH = Math.min(36, o.h * 0.4);
  const d = o.h + 14;
  const tri = new Shape();
  tri.moveTo(-d / 2, 0);
  tri.lineTo(d / 2, 0);
  tri.lineTo(0, roofH);
  tri.closePath();
  const roof = new Mesh(new ExtrudeGeometry(tri, { depth: o.w + 12, bevelEnabled: false }), new MeshLambertMaterial({ color: new Color(o.roof ?? '#c84a3a'), flatShading: true }));
  // La extrusión va en +z; girada 90° queda a lo largo de +x.
  roof.rotation.y = Math.PI / 2;
  roof.position.set(o.x - 6, wallH, o.y + o.h / 2);
  roof.castShadow = true;
  g.add(roof);
  // Puerta y ventanas en la fachada de abajo (la que mira a la cámara).
  const front = o.y + o.h + 0.6;
  const door = new Mesh(new PlaneGeometry(16, 24), new MeshLambertMaterial({ color: 0x5a3a22 }));
  door.position.set(o.x + o.w / 2, 12, front);
  g.add(door);
  const winMat = new MeshLambertMaterial({ color: 0x8ad0ff, emissive: 0x1a3a5a });
  for (const fx of [0.2, 0.8]) {
    const win = new Mesh(new PlaneGeometry(14, 12), winMat);
    win.position.set(o.x + o.w * fx, wallH * 0.6, front);
    g.add(win);
  }
  return g;
}

/** Roca: montón de pedruscos facetados que ocupa el rectángulo de colisión. */
function rockMesh(o: Obstacle, base: string): Object3D {
  const g = new Group();
  const rng = new Rng(Math.round(o.x * 31 + o.y * 17 + o.w));
  const col = new Color(base);
  const foot = new Mesh(new BoxGeometry(o.w, 4, o.h), new MeshLambertMaterial({ color: col.clone().multiplyScalar(0.45) }));
  foot.position.set(o.x + o.w / 2, 2, o.y + o.h / 2);
  foot.receiveShadow = true;
  g.add(foot);
  const nx = Math.max(1, Math.round(o.w / 34));
  const nz = Math.max(1, Math.round(o.h / 34));
  const cw = o.w / nx;
  const ch = o.h / nz;
  const r = Math.min(cw, ch) * 0.62;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const mat = new MeshLambertMaterial({ color: col.clone().multiplyScalar(0.85 + rng.next() * 0.35), flatShading: true });
      const b = new Mesh(BOULDER, mat);
      b.position.set(o.x + (i + 0.5) * cw + rng.range(-3, 3), r * 0.7, o.y + (j + 0.5) * ch + rng.range(-3, 3));
      b.scale.set(r * rng.range(0.92, 1.12), r * rng.range(0.85, 1.2), r * rng.range(0.92, 1.12));
      b.rotation.set(rng.range(0, Math.PI), rng.range(0, Math.PI), rng.range(0, Math.PI));
      b.castShadow = true;
      b.receiveShadow = true;
      g.add(b);
    }
  }
  return g;
}
