import { AnimationClip, BoxGeometry, Group, Mesh, MeshStandardMaterial, NumberKeyframeTrack, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { applyModelOverridesFromQuery, hasModels, modelFor, setModelOverride, type ModelDef } from '../src/data/models3d';
import { ModelInstance, ModelLibrary, normalize, type LoadedModel } from '../src/render/models';

// Infraestructura de modelos 3D. Los "modelos" de estas pruebas son cajas
// generadas aquí mismo: solo comprueban el cargador, no son Pokémon.

const DEF: ModelDef = { url: 'models/prueba.glb', height: 30, source: 'prueba', license: 'prueba', clips: { walk: 'Walk' } };

function boxModel(): LoadedModel {
  const root = new Group();
  const mesh = new Mesh(new BoxGeometry(2, 4, 2), new MeshStandardMaterial());
  mesh.name = 'cuerpo';
  mesh.position.set(5, 7, -3);
  root.add(mesh);
  const clip = (name: string) => new AnimationClip(name, 1, [new NumberKeyframeTrack('cuerpo.position[x]', [0, 1], [5, 6])]);
  return { scene: root, animations: [clip('Idle'), clip('Walk')] };
}

describe('modelos 3D', () => {
  it('normaliza: escala a la altura pedida y apoya los pies en el suelo', () => {
    const m = boxModel();
    const { scale, offset } = normalize(m.scene, 30);
    expect(scale).toBeCloseTo(7.5);
    // Caja de y = 5 a 9, centrada en (5, -3).
    expect(offset.y).toBeCloseTo(-5);
    expect(offset.x).toBeCloseTo(-5);
    expect(offset.z).toBeCloseTo(3);
  });

  it('mientras carga y si falla se usa el sprite (null); si falla no se reintenta', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = vi.fn(async () => { throw new Error('404'); });
    const lib = new ModelLibrary(loader);
    expect(lib.get(DEF)).toBeNull();
    expect(lib.state(DEF.url)).toBe('loading');
    await lib.whenSettled(DEF.url);
    expect(lib.state(DEF.url)).toBe('failed');
    expect(lib.error(DEF.url)).toBe('404');
    expect(lib.get(DEF)).toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('carga, instancia, anima, orienta y libera los recursos', async () => {
    const src = boxModel();
    const lib = new ModelLibrary(async () => src);
    lib.get(DEF);
    await lib.whenSettled(DEF.url);
    const tpl = lib.get(DEF)!;
    expect(tpl).not.toBeNull();
    const inst = new ModelInstance(tpl);
    inst.update(0.016, 'idle', Math.PI / 2, { flash: 0, alpha: 1 });
    expect(inst.anim).toBe('idle');
    inst.update(0.016, 'walk', 0, { flash: 0, alpha: 1 });
    expect(inst.anim).toBe('walk');
    // Sin animación de golpe en el archivo: sigue con la de reposo.
    inst.update(0.016, 'hurt', 0, { flash: 1, alpha: 0.5 });
    expect(inst.anim).toBe('idle');
    // Mirando hacia abajo de la pantalla (+y del juego = +Z del mundo): sin giro.
    inst.update(0.016, 'idle', Math.PI / 2, { flash: 0, alpha: 1 });
    const yawNode = inst.root.children[0] as Object3D;
    expect(yawNode.rotation.y).toBeCloseTo(0);
    inst.update(0.016, 'idle', 0, { flash: 0, alpha: 1 });
    expect(yawNode.rotation.y).toBeCloseTo(Math.PI / 2);
    // Libera: materiales de la instancia ahora; geometrías y texturas con la biblioteca.
    let geoGone = 0;
    let instMatGone = 0;
    (src.scene.children[0] as Mesh).geometry.addEventListener('dispose', () => geoGone++);
    inst.root.traverse((o) => { const m = o as Mesh; if (m.isMesh) (m.material as MeshStandardMaterial).addEventListener('dispose', () => instMatGone++); });
    inst.dispose();
    expect(instMatGone).toBe(1);
    expect(geoGone).toBe(0);
    lib.dispose();
    expect(geoGone).toBe(1);
  });

  it('el cargador glTF real lee un GLB binario (triángulo generado en la prueba)', async () => {
    const res = await new GLTFLoader().parseAsync(triangleGlb(), '');
    const { scale } = normalize(res.scene, 30);
    expect(scale).toBeCloseTo(15);
  });

  it('sin modelos configurados todo sigue con sprites; ?model3d solo añade los de prueba', () => {
    expect(hasModels()).toBe(false);
    expect(modelFor('pidgeotto')).toBeNull();
    applyModelOverridesFromQuery('?debug&model3d=pidgeotto|models/x.glb|40');
    expect(modelFor('pidgeotto')).toMatchObject({ url: 'models/x.glb', height: 40 });
    setModelOverride('pidgeotto', null);
    expect(hasModels()).toBe(false);
  });
});

/** GLB mínimo: un triángulo de 2 de alto, con su búfer dentro del archivo. */
export function triangleGlb(): ArrayBuffer {
  const bin = new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 0]).buffer);
  const json = new TextEncoder().encode(JSON.stringify({
    asset: { version: '2.0' },
    scenes: [{ nodes: [0] }], scene: 0, nodes: [{ mesh: 0, name: 'tri' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteLength: bin.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 2, 0] }],
  }));
  const pad = (n: number) => (n + 3) & ~3;
  const jl = pad(json.length);
  const bl = pad(bin.length);
  const out = new ArrayBuffer(12 + 8 + jl + 8 + bl);
  const dv = new DataView(out);
  const u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, out.byteLength, true);
  dv.setUint32(12, jl, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  u8.fill(0x20, 20, 20 + jl);
  u8.set(json, 20);
  dv.setUint32(20 + jl, bl, true);
  dv.setUint32(24 + jl, 0x004e4942, true); // 'BIN'
  u8.set(bin, 28 + jl);
  return out;
}
