import {
  AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Vector3, type AnimationAction, type AnimationClip, type Material,
  type Mesh, type Object3D,
} from 'three';
import type { ModelAnim, ModelDef } from '../data/models3d';
import { disposeObject } from './dispose';

// ============================================================================
// Modelos 3D (GLB/glTF) de los Pokémon: carga, normalización (escala y
// apoyo en el suelo), instancias con animación y orientación, y liberación de
// recursos. Solo presentación: no lee ni toca la simulación.
//
// El cargador de glTF de Three.js se trae en diferido (import dinámico): si
// ninguna especie tiene modelo, no pesa nada en la descarga del juego.
// ============================================================================

export interface LoadedModel {
  scene: Object3D;
  animations: AnimationClip[];
  /** Copia una instancia (con esqueleto si lo tiene). Por defecto, `clone(true)`. */
  clone?: (o: Object3D) => Object3D;
}

export type ModelLoader = (url: string) => Promise<LoadedModel>;

/** Plantilla ya cargada y normalizada de un modelo (se comparte entre instancias). */
export interface ModelTemplate {
  def: ModelDef;
  scene: Object3D;
  animations: AnimationClip[];
  /** Escala para que mida `def.height` y desplazamiento para apoyar los pies en y = 0. */
  scale: number;
  offset: Vector3;
  clone: (o: Object3D) => Object3D;
}

export type ModelState = 'loading' | 'ready' | 'failed';

const defaultLoader: ModelLoader = async (url) => {
  const [{ GLTFLoader }, { clone }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/utils/SkeletonUtils.js'),
  ]);
  const gltf = await new GLTFLoader().loadAsync(url);
  return { scene: gltf.scene, animations: gltf.animations, clone };
};

/** Ruta del recurso en producción: relativa a la web, como el resto de imágenes del juego. */
const resolveUrl = (url: string) => (/^(https?:|data:|blob:|\/)/.test(url) ? url : `${import.meta.env.BASE_URL ?? './'}${url}`);

/** Calcula la escala y el apoyo de un modelo a partir de su caja. */
export function normalize(scene: Object3D, height: number): { scale: number; offset: Vector3 } {
  scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(scene);
  const size = box.getSize(new Vector3());
  const scale = size.y > 1e-6 ? height / size.y : 1;
  const c = box.getCenter(new Vector3());
  return { scale, offset: new Vector3(-c.x, -box.min.y, -c.z) };
}

/** Caché de modelos por URL. Una URL que falla no se reintenta en esta partida. */
export class ModelLibrary {
  private templates = new Map<string, ModelTemplate>();
  private states = new Map<string, ModelState>();
  private errors = new Map<string, string>();
  private pending = new Map<string, Promise<void>>();

  constructor(private loader: ModelLoader = defaultLoader) {}

  /** Plantilla lista, o null mientras carga o si falló (y entonces se usa el sprite). */
  get(def: ModelDef): ModelTemplate | null {
    const st = this.states.get(def.url);
    if (st === 'ready') return this.templates.get(def.url)!;
    if (!st) this.load(def);
    return null;
  }

  state(url: string): ModelState | undefined {
    return this.states.get(url);
  }

  error(url: string): string | undefined {
    return this.errors.get(url);
  }

  /** Espera a que termine la carga en curso (para pruebas). */
  whenSettled(url: string): Promise<void> {
    return this.pending.get(url) ?? Promise.resolve();
  }

  private load(def: ModelDef): void {
    this.states.set(def.url, 'loading');
    const p = this.loader(resolveUrl(def.url)).then(
      (m) => {
        const { scale, offset } = normalize(m.scene, def.height);
        this.templates.set(def.url, { def, scene: m.scene, animations: m.animations, scale, offset, clone: m.clone ?? ((o) => o.clone(true)) });
        this.states.set(def.url, 'ready');
      },
      (e: unknown) => {
        this.states.set(def.url, 'failed');
        this.errors.set(def.url, e instanceof Error ? e.message : String(e));
        // Aviso, no error: el juego sigue con el sprite.
        console.warn(`[modelos 3D] No se pudo cargar ${def.url}; se usa el sprite.`, e);
      },
    );
    this.pending.set(def.url, p);
  }

  /** Libera geometrías, materiales y texturas de todas las plantillas. */
  dispose(): void {
    for (const t of this.templates.values()) disposeObject(t.scene);
    this.templates.clear();
    this.states.clear();
    this.pending.clear();
  }
}

/** Instancia de un modelo en la escena: pivote (inclinación) → giro → modelo. */
export class ModelInstance {
  /** Nodo que se coloca en el mundo (posición e inclinación hacia la cámara). */
  readonly root = new Group();
  private yawNode = new Group();
  private model: Object3D;
  private mixer: AnimationMixer | null = null;
  private actions = new Map<ModelAnim, AnimationAction>();
  private current: ModelAnim | null = null;
  /** Materiales propios de esta instancia (para el destello y la transparencia). */
  private materials: Material[] = [];

  constructor(readonly template: ModelTemplate) {
    const t = template;
    this.model = t.clone(t.scene);
    this.model.scale.setScalar(t.scale);
    this.model.position.copy(t.offset).multiplyScalar(t.scale);
    this.model.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const own = mats.map((x) => x.clone());
      m.material = Array.isArray(m.material) ? own : own[0];
      this.materials.push(...own);
    });
    this.yawNode.add(this.model);
    this.root.add(this.yawNode);
    if (t.animations.length) {
      this.mixer = new AnimationMixer(this.model);
      const clips = t.def.clips ?? {};
      for (const anim of ['idle', 'walk', 'attack', 'hurt', 'faint'] as ModelAnim[]) {
        const name = clips[anim] ?? (anim === 'idle' ? t.animations[0].name : undefined);
        const clip = name ? t.animations.find((c) => c.name === name) : undefined;
        if (clip) this.actions.set(anim, this.mixer.clipAction(clip));
      }
    }
  }

  /** Animación que se está reproduciendo (para pruebas y depuración). */
  get anim(): ModelAnim | null {
    return this.current;
  }

  /**
   * Orienta y anima. `facing`: ángulo en el plano del suelo (atan2(dy, dx) del
   * juego). Las animaciones que el archivo no tiene caen en 'idle'.
   */
  update(dt: number, anim: ModelAnim, facing: number, o: { flash: number; alpha: number }): void {
    // glTF mira a +Z; en el juego, x → X y y → Z del mundo.
    this.yawNode.rotation.y = Math.atan2(Math.cos(facing), Math.sin(facing)) + (this.template.def.yaw ?? 0);
    const want = this.actions.has(anim) ? anim : 'idle';
    if (want !== this.current && this.actions.has(want)) {
      const next = this.actions.get(want)!;
      const once = want === 'attack' || want === 'hurt' || want === 'faint';
      next.reset();
      next.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
      next.clampWhenFinished = once;
      next.play();
      const prev = this.current ? this.actions.get(this.current) : null;
      if (prev) next.crossFadeFrom(prev, 0.15, false);
      this.current = want;
    }
    this.mixer?.update(dt);
    for (const m of this.materials) {
      const em = (m as Material & { emissive?: { setScalar(v: number): void } }).emissive;
      if (em) em.setScalar(o.flash * 0.8);
      m.transparent = o.alpha < 1;
      m.opacity = o.alpha;
    }
  }

  dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.model);
    }
    // Las geometrías y texturas son de la plantilla (se liberan con la biblioteca); los materiales, de la instancia.
    for (const m of this.materials) m.dispose();
    this.root.removeFromParent();
  }
}
