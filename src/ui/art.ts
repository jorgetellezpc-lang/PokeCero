// Huecos para las ilustraciones de los menús. Cada una se busca en
// public/ui/<nombre>.webp; si aún no está, se usa una provisional (o nada) y
// la pantalla se ve igual de ordenada. Al subir la ilustración aparece sola.
//
//   region-kanto   portada de la región (isla)        ~1080 × 1350
//   map-kanto      mapa de Kanto con caminos          ~1080 × 1440
//   gym-brock      cabecera del gimnasio de Brock     ~1080 × 700
//   gacha          escenario del gachapón             ~1080 × 900
//   logo           logotipo «Pokécero»                ~1000 × 360 (fondo transparente)

export const ART_NAMES = ['region-kanto', 'map-kanto', 'gym-brock', 'gacha', 'logo'] as const;
export type ArtName = (typeof ART_NAMES)[number] | `gym-${string}` | `region-${string}` | `map-${string}`;

/** Ilustraciones que ya se sabe que existen (o no), para no reintentar. */
const known = new Map<string, boolean>();

/**
 * Imagen de una ilustración. `onReal` se llama si la ilustración existe (para
 * ocultar lo provisional); si no existe, se muestra `fallback` o se quita.
 */
export function artSlot(name: ArtName, cls: string, fallback?: () => string, onReal?: () => void): HTMLImageElement {
  const img = document.createElement('img');
  img.className = `art ${cls}`;
  img.alt = '';
  img.draggable = false;
  const real = `ui/${name}.webp`;
  const useFallback = () => {
    img.onerror = null;
    if (fallback) {
      img.src = fallback();
      img.classList.add('art-fallback');
    } else img.remove();
  };
  if (known.get(name) === false) {
    useFallback();
    return img;
  }
  img.onload = () => {
    if (!img.src.endsWith(real)) return;
    known.set(name, true);
    onReal?.();
  };
  img.onerror = () => {
    known.set(name, false);
    useFallback();
  };
  img.src = real;
  if (known.get(name)) queueMicrotask(() => onReal?.());
  return img;
}
