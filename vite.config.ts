import { defineConfig } from 'vite';

// base relativa: el build funciona tanto en la raíz de un dominio como en
// una subruta (por ejemplo GitHub Pages: /PokeCero/).
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
} as never);
