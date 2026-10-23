// ============================================================================
// Modelos 3D de los Pokémon (GLB/glTF). Si una especie tiene modelo aquí, el
// escenario 3D lo usa en lugar de su sprite; si no lo tiene, o si el modelo
// no carga, se sigue usando el sprite animado (no se pierde nada).
//
// IMPORTANTE (licencias): los Pokémon son propiedad de Nintendo, Creatures y
// GAME FREAK. Solo se añade un modelo si su procedencia y su licencia
// permiten usarlo en este proyecto sin ánimo de lucro, y se anota en
// `source` y `license` (y en THIRD_PARTY_NOTICES.md). Ver docs/3D.md.
// ============================================================================

/** Animaciones que entiende el juego (se mapean a los nombres del archivo). */
export type ModelAnim = 'idle' | 'walk' | 'attack' | 'hurt' | 'faint';

export interface ModelDef {
  /** Ruta relativa a la web (p. ej. 'models/pidgeotto.glb') o URL completa. */
  url: string;
  /** Altura en el mundo a la que se escala el modelo (los sprites miden ~25-45). */
  height: number;
  /** Giro extra (radianes) si el modelo no mira hacia +Z, que es lo estándar en glTF. */
  yaw?: number;
  /** Nombre de cada animación dentro del archivo. Las que falten usan 'idle'. */
  clips?: Partial<Record<ModelAnim, string>>;
  source: string;
  license: string;
}

/**
 * Modelos disponibles, por id de especie.
 *
 * Pidgeotto (piloto): PENDIENTE. No hay todavía un modelo con licencia
 * verificable que permita usarlo; cuando lo haya, se añade así:
 *
 *   pidgeotto: { url: 'models/pidgeotto.glb', height: 34, source: '…', license: '…',
 *                clips: { idle: 'Idle', walk: 'Fly', attack: 'Attack', hurt: 'Hit', faint: 'Faint' } },
 */
const MODELS: Record<string, ModelDef> = {};

/** Modelos añadidos en tiempo de ejecución (solo depuración y pruebas: ?model3d=especie|url). */
const overrides: Record<string, ModelDef> = {};

/** ¿Hay algún modelo? (si no, el escenario ni lo mira). */
export function hasModels(): boolean {
  return Object.keys(MODELS).length + Object.keys(overrides).length > 0;
}

export function modelFor(speciesId: string): ModelDef | null {
  return overrides[speciesId] ?? MODELS[speciesId] ?? null;
}

export function setModelOverride(speciesId: string, def: ModelDef | null): void {
  if (def) overrides[speciesId] = def;
  else delete overrides[speciesId];
}

/** Lee `?model3d=especie|url|altura` (varias separadas por comas). Solo para pruebas. */
export function applyModelOverridesFromQuery(search: string): void {
  const q = new URLSearchParams(search).get('model3d');
  if (!q) return;
  for (const item of q.split(',')) {
    const [id, url, h] = item.split('|');
    if (id && url) setModelOverride(id, { url, height: Number(h) || 32, source: 'prueba', license: 'prueba' });
  }
}
