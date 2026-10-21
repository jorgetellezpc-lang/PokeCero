// Genera una versión del juego en un único archivo HTML (JS, CSS y sprites en
// línea), útil para abrirlo en el móvil sin servidor. Uso: npm run build:single
import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build', { stdio: 'inherit' });
let html = readFileSync('dist/index.html', 'utf8');
const css = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/);
const js = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/);
if (!css || !js) throw new Error('No se encontraron los recursos del build');

// Sprites como data URLs: { "4/Walk": "data:image/png;base64,..." }
const sprites = {};
const base = 'public/sprites/pokemon';
for (const dex of readdirSync(base)) {
  for (const f of readdirSync(`${base}/${dex}`)) {
    if (!f.endsWith('.png')) continue;
    sprites[`${dex}/${f.slice(0, -4)}`] = `data:image/png;base64,${readFileSync(`${base}/${dex}/${f}`).toString('base64')}`;
  }
}

const code = readFileSync(`dist/${js[1]}`, 'utf8').replace(/<\/script/gi, '<\\/script');
html = html
  .replace(css[0], `<style>${readFileSync(`dist/${css[1]}`, 'utf8')}</style>`)
  .replace(js[0], '')
  .replace('</body>', `<script>window.__POKECERO_SPRITES=${JSON.stringify(sprites)};</script><script type="module">${code}</script></body>`);
mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/pokecero.html', html);
console.log('dist-single/pokecero.html', (html.length / 1024 / 1024).toFixed(1), 'MB,', Object.keys(sprites).length, 'sprites');
