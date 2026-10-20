// Genera una versión del juego en un único archivo HTML (JS y CSS en línea),
// útil para abrirlo en el móvil sin servidor. Uso: npm run build:single
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build', { stdio: 'inherit' });
let html = readFileSync('dist/index.html', 'utf8');
const css = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/);
const js = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/);
if (!css || !js) throw new Error('No se encontraron los recursos del build');
const code = readFileSync(`dist/${js[1]}`, 'utf8').replace(/<\/script/gi, '<\\/script');
html = html
  .replace(css[0], `<style>${readFileSync(`dist/${css[1]}`, 'utf8')}</style>`)
  .replace(js[0], '')
  .replace('</body>', `<script type="module">${code}</script></body>`);
mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/pokecero.html', html);
console.log('dist-single/pokecero.html', (html.length / 1024).toFixed(0), 'KB');
