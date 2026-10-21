// Iconos pixel art de la interfaz, generados por código (provisionales).
// Los Pokémon usan los sprites animados de render/animator.ts.

const OUTLINE = '#1c1424';

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const cache = new Map<string, HTMLCanvasElement>();

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
  if (hit) return hit.toDataURL();
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
