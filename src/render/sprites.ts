import type { BodyShape, SpriteSpec } from '../data/types';

// ============================================================================
// SPRITES PROVISIONALES (placeholders)
// ----------------------------------------------------------------------------
// No son arte final. Se generan a partir de plantillas 16x16 por forma de
// cuerpo y los colores de cada especie. Para usar arte definitivo basta con
// definir `sprite.image` en los datos de la especie (ruta en /public); se usa
// automáticamente en lugar del placeholder.
//
// Leyenda: . vacío  o contorno  a color principal  b vientre  c acento
//          e blanco del ojo  p pupila
// ============================================================================

const T: Record<BodyShape, string[]> = {
  biped: [
    '................',
    '.....oooooo.....',
    '....oaaaaaao....',
    '...oaaaaaaaao...',
    '...oaepaaepao...',
    '...oaeeaaeeao...',
    '...oaaaaaaaao...',
    '....oaaaaaao....',
    '...oaabbbbaao.c.',
    '..oaaobbbboaocc.',
    '..oaaobbbboaoco.',
    '...ooabbbbaoo.o.',
    '....oaaaaaaoao..',
    '....oaaoaaaoo...',
    '....ooo.ooo.....',
    '................',
  ],
  quad: [
    '................',
    '......cccc......',
    '.....cccccc.....',
    '....cccoccco....',
    '..oooocccco.....',
    '.oaaaaooooaao...',
    'oaepaaaaaaepao..',
    'oaeeaaaaaaeeao..',
    'oaaaaaaaaaaaao..',
    '.oaabbbbbbbaao..',
    '..oaaaaaaaaao...',
    '..oaoaao.oaoao..',
    '..ooooo..ooooo..',
    '................',
    '................',
    '................',
  ],
  mouse: [
    '..o..........o..',
    '.oco........oco.',
    '.oao........oao.',
    '.oaao......oaao.',
    '..oaaoooooooaao.',
    '..oaaaaaaaaaao..',
    '.oaaepaaaaepaao.',
    '.oaaeeaaaaeeaao.',
    '.oacaaaaaaaacao.',
    '..oaaaabbaaaao..',
    '...oaaaaaaaao.oo',
    '...oabbbbbbaooao',
    '...oabbbbbbao.o.',
    '....oaaooaao....',
    '....ooo..ooo....',
    '................',
  ],
  bird: [
    '................',
    '......oooo......',
    '.....occcco.....',
    '....oaaaaaao....',
    '....oaepaaao....',
    '....oaeeaacco...',
    '....oaaaaaco....',
    '...oaaabbaao....',
    '..oaaabbbbaao...',
    '.oaaaabbbbaaao..',
    'oaaoaabbbbaoaao.',
    'oaoooabbbbaoooo.',
    '.o...oaaaao.....',
    '.....ocooco.....',
    '.....oc..co.....',
    '................',
  ],
  serpent: [
    '................',
    '....oooooo......',
    '...oaaaaaao.....',
    '..oaepaaepao....',
    '..oaeeaaeeao....',
    '..oaaaccaaao....',
    '...oaaaaaao.....',
    '....oaabao......',
    '.....oabaoooo...',
    '....oabaoaaaao..',
    '...oabaoaabbaao.',
    '...oaaaaabbbaao.',
    '....oaaaabbbao..',
    '.....oaaaaaao...',
    '......ooooooo...',
    '................',
  ],
  blob: [
    '.....c...c......',
    '....ccc.ccc.....',
    '.....cccccc.....',
    '......cccc......',
    '.....oooooo.....',
    '...ooaaaaaaoo...',
    '..oaaaaaaaaaao..',
    '..oaepaaaaepao..',
    '.oaaeeaaaaeeaao.',
    '.oaaaaaaaaaaaao.',
    '.oaaaaabbaaaaao.',
    '..oaaaaaaaaaao..',
    '...ooaaaaaaoo...',
    '....oao..oao....',
    '....ooo..ooo....',
    '................',
  ],
  rock: [
    '................',
    '................',
    '.....oooooo.....',
    '....oaaaaaao....',
    '...oaaaabaaao...',
    '..oaaepaaepaao..',
    '..oaaeeaaeeaao..',
    'oooaaaaaaaaaaooo',
    'obbaaaaooaaaabbo',
    'obbbaaaaaaaabbbo',
    '.obboaaaaaaobbo.',
    '..oo.oaaaao.oo..',
    '......oooo......',
    '................',
    '................',
    '................',
  ],
  bug: [
    '................',
    '.......cc.......',
    '......occo......',
    '.....oaaaao.....',
    '....oaepepao....',
    '....oaeeeeao....',
    '.....oaaaao.....',
    '....oabbbbao....',
    '.....oaaaao.....',
    '....oabbbbao....',
    '.....oaaaao.....',
    '....oabbbbao....',
    '.....oaaaao.....',
    '......oaao......',
    '.......cc.......',
    '................',
  ],
  bat: [
    '................',
    '.oo..........oo.',
    '.oao...oo...oao.',
    '.oaaoooaaoooaao.',
    '.oaaaaaaaaaaaao.',
    '..oaaaepepaaao..',
    '..oaaaeeeeaaao..',
    '...oaaabbaaao...',
    '...oaaabbaaao...',
    '..oaaaoaaoaaao..',
    '..oaao.oo.oaao..',
    '..ooo......ooo..',
    '................',
    '................',
    '................',
    '................',
  ],
  turtle: [
    '................',
    '.....oooooo.....',
    '....oaaaaaao....',
    '...oaepaaepao...',
    '...oaeeaaeeao...',
    '...oaaaaaaaao...',
    '....oaaaaaao....',
    '..ooocccccccoo..',
    '.oaocbbbbbbcoao.',
    '.oaocbbbbbbcoao.',
    '..oocbbbbbbcoo..',
    '...occccccccoa..',
    '....oaaooaaooao.',
    '....ooo..ooo.o..',
    '................',
    '................',
  ],
};

const OUTLINE = '#1c1424';

function colorFor(ch: string, s: SpriteSpec): string | null {
  switch (ch) {
    case 'o': return OUTLINE;
    case 'a': return s.main;
    case 'b': return s.belly;
    case 'c': return s.accent;
    case 'e': return '#ffffff';
    case 'p': return '#101018';
    default: return null;
  }
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const cache = new Map<string, HTMLCanvasElement | HTMLImageElement>();
const images = new Map<string, HTMLImageElement>();

function keyOf(s: SpriteSpec, variant: string): string {
  return `${s.shape}|${s.main}|${s.belly}|${s.accent}|${s.image ?? ''}|${variant}`;
}

/**
 * Devuelve el sprite (16x16 lógico) de una especie. `variant`:
 * 'normal' | 'flash' (silueta blanca para impactos) | 'shadow' (silueta oscura).
 */
export function getSprite(s: SpriteSpec, variant: 'normal' | 'flash' | 'shadow' = 'normal'): HTMLCanvasElement | HTMLImageElement {
  const key = keyOf(s, variant);
  const hit = cache.get(key);
  if (hit) return hit;

  if (s.image && variant === 'normal') {
    let img = images.get(s.image);
    if (!img) {
      img = new Image();
      img.src = s.image;
      images.set(s.image, img);
    }
    if (img.complete && img.naturalWidth) {
      cache.set(key, img);
      return img;
    }
    // Mientras carga se usa el placeholder.
  }

  const rows = T[s.shape];
  const c = makeCanvas(16, 16);
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 16; y++) {
    const row = (rows[y] ?? '').padEnd(16, '.');
    for (let x = 0; x < 16; x++) {
      const col = colorFor(row[x], s);
      if (!col) continue;
      ctx.fillStyle = variant === 'flash' ? '#ffffff' : variant === 'shadow' ? '#1a1a2a' : col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  if (!s.image) cache.set(key, c);
  return c;
}

/** Sprite como data URL (para la interfaz HTML). */
export function spriteDataUrl(s: SpriteSpec, variant: 'normal' | 'shadow' = 'normal', scale = 4): string {
  if (s.image && variant === 'normal') return s.image;
  const src = getSprite(s, variant);
  const c = makeCanvas(16 * scale, 16 * scale);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL();
}

// --- Iconos pixel art de la interfaz (también provisionales) -----------------

const ICONS: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  pokeball: {
    pal: { o: OUTLINE, r: '#e83838', w: '#f8f8f8', g: '#c8c8d0' },
    rows: [
      '................',
      '.....oooooo.....',
      '...oorrrrrroo...',
      '..orrrrrrrrrro..',
      '.orrwrrrrrrrrro.',
      '.orwrrrrrrrrrro.',
      'orrrrrooooorrrro',
      'oooooowwwwoooooo',
      'oooooowoowoooooo',
      'owwwwwowwwowwwwo',
      '.owwwwwooowwwwo.',
      '.owwwwwwwwwwwgo.',
      '..owwwwwwwwwgo..',
      '...oowwwwwwoo...',
      '.....oooooo.....',
      '................',
    ],
  },
  map: {
    pal: { o: OUTLINE, y: '#f0d890', g: '#68b048', b: '#4890d8', r: '#e83838' },
    rows: [
      '................',
      '.oooo.oooo.oooo.',
      '.oyyoooggoooyyo.',
      '.oyyyoggggoyyyo.',
      '.oyggoggggobbyo.',
      '.oggrogggbobbyo.',
      '.ogrrrogbbobyyo.',
      '.oggrogbbbbyyyo.',
      '.oygggobbbbyyyo.',
      '.oyyggobbbgyyyo.',
      '.oyyygogggoyyyo.',
      '.oyyyyogggoyyyo.',
      '.oooo.oooo.oooo.',
      '................',
      '................',
      '................',
    ],
  },
  gacha: {
    pal: { o: OUTLINE, r: '#e84848', w: '#f8f8f8', y: '#f8d030', b: '#80c8f0' },
    rows: [
      '....oooooooo....',
      '...obbbbbbbbo...',
      '..obyrbwbbybbo..',
      '..obrrbbyrbbbo..',
      '..obbwbrrbwbbo..',
      '..obbbbbbbbbbo..',
      '...oooooooooo...',
      '...orrrrrrrro...',
      '...orrooooorro..',
      '...orrowwworro..',
      '...orrooooorro..',
      '...orrrrrrrro...',
      '...orrrooorro...',
      '...orrrowworro..',
      '...oooooooooo...',
      '................',
    ],
  },
  gear: {
    pal: { o: OUTLINE, g: '#b8c0d0', d: '#788098' },
    rows: [
      '................',
      '......oooo......',
      '...oo.oggo.oo...',
      '..oggooggooggo..',
      '..ogggggggggdo..',
      '...ogggooggdo...',
      '.ooggoo..oogdoo.',
      '.ogggo....ogddo.',
      '.ogggo....oggdo.',
      '.ooggoo..oogdoo.',
      '...oggdooddgo...',
      '..ogggdddddgdo..',
      '..oggoodgoodgo..',
      '...oo.oddo.oo...',
      '......oooo......',
      '................',
    ],
  },
  coin: {
    pal: { o: '#7a4a10', y: '#f8d030', w: '#fff0a0', d: '#d0a020' },
    rows: [
      '................',
      '................',
      '.....oooooo.....',
      '....oyyyyyyo....',
      '...oywwyyyydo...',
      '...oywyyyyydo...',
      '...oyyyddyydo...',
      '...oyyydyyydo...',
      '...oyyyddyydo...',
      '...oyyyyyyydo...',
      '...oyyyyyyddo...',
      '....oddddddo....',
      '.....oooooo.....',
      '................',
      '................',
      '................',
    ],
  },
  ticket: {
    pal: { o: OUTLINE, p: '#f070b0', w: '#ffd0e8', d: '#c04888' },
    rows: [
      '................',
      '................',
      '................',
      '.oooooooooooooo.',
      '.oppppppdpppppo.',
      '..owwppppdppppo.',
      '..opwwpppdppppo.',
      '.oppppppdpppppo.',
      '..oppppppdppppo.',
      '..opppppdpppppo.',
      '.oppppppdpppppo.',
      '.oooooooooooooo.',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  badge: {
    pal: { o: OUTLINE, g: '#a8a8b8', w: '#e8e8f0', d: '#686878' },
    rows: [
      '................',
      '.......oo.......',
      '......oggo......',
      '.....oggwgo.....',
      '....oggwwggo....',
      '...oggggwgggo...',
      '..ogggggggggdo..',
      '.oggggggggggddo.',
      '..ogggggggggdo..',
      '...oggggggddo...',
      '....oggggddo....',
      '.....oggddo.....',
      '......oddo......',
      '.......oo.......',
      '................',
      '................',
    ],
  },
  lock: {
    pal: { o: OUTLINE, g: '#c0c0c8', y: '#d8b040', d: '#987820' },
    rows: [
      '................',
      '.....oooooo.....',
      '....oggggggo....',
      '...ogoooooogo...',
      '...ogo....ogo...',
      '...ogo....ogo...',
      '..oooooooooooo..',
      '..oyyyyyyyyyyo..',
      '..oyyyyooyyyyo..',
      '..oyyyyooyyyyo..',
      '..oyyyyyoyyyyo..',
      '..oyyyyyyyyyyo..',
      '..oddddddddddo..',
      '..oooooooooooo..',
      '................',
      '................',
    ],
  },
};

export function iconDataUrl(name: keyof typeof ICONS | string, scale = 3, tint?: Record<string, string>): string {
  const key = `icon|${name}|${scale}|${JSON.stringify(tint ?? {})}`;
  const hit = cache.get(key);
  if (hit) return (hit as HTMLCanvasElement).toDataURL();
  const def = ICONS[name];
  const c = makeCanvas(16 * scale, 16 * scale);
  const ctx = c.getContext('2d')!;
  if (def) {
    const pal = { ...def.pal, ...(tint ?? {}) };
    def.rows.forEach((row, y) => {
      for (let x = 0; x < 16; x++) {
        const col = pal[row[x]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    });
  }
  cache.set(key, c);
  return c.toDataURL();
}
