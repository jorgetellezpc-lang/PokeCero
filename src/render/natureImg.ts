// Imagen del atlas de naturaleza (árboles, arbustos, hierba alta y rocas del usuario).
// Se empieza a cargar al arrancar el juego; la usan los pueblos (2D) y las rutas (3D).
export const NATURE_IMG: HTMLImageElement | null = typeof Image === 'undefined' ? null : Object.assign(new Image(), { src: 'ui/nature.webp' });

export const natureReady = () => !!NATURE_IMG?.complete && !!NATURE_IMG.naturalWidth;
