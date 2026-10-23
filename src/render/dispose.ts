import type { Mesh, Object3D } from 'three';

/** Libera todo lo de un objeto: geometrías, materiales y sus texturas. */
export function disposeObject(root: Object3D): void {
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v && typeof v === 'object' && 'isTexture' in v) (v as { dispose(): void }).dispose();
      mat.dispose();
    }
  });
}
