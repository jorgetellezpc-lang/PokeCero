import { expect, test, type Page } from '@playwright/test';
import { boxGlb } from './testModel';

// Ruta de modelos 3D en el juego real. El modelo es una caja de prueba
// servida por la propia prueba (no hay modelos de Pokémon en el repositorio).

const shots = process.env.SHOTS_DIR;

test.beforeEach(async ({ page }) => {
  await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
});

const run = (page: Page, fn: string) =>
  page.evaluate(`(() => { const r = window.__pokecero.app.run; const w = r.world; const s = r.scene3d; ${fn} })()`);

async function startGym(page: Page) {
  await page.evaluate(() => (window as any).__pokecero.app.showGym('brock'));
  await page.getByTestId('play').click();
  await expect(page.locator('.run')).toHaveAttribute('data-view', '3d');
}

test('un modelo GLB sustituye al sprite del jugador y se puede jugar con él', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/models/e2e-caja.glb', (r) => r.fulfill({ body: boxGlb(), contentType: 'model/gltf-binary' }));
  await page.goto('/?debug&model3d=charmander|models/e2e-caja.glb|30');
  await startGym(page);
  await expect.poll(() => run(page, "return s.models?.state('models/e2e-caja.glb');"), { timeout: 15000 }).toBe('ready');
  await expect.poll(() => run(page, 'return s.modelDebug().instances.length;')).toBeGreaterThanOrEqual(1);
  // Sigue siendo el mismo juego: se mueve, ataca y hace daño.
  const x0 = Number(await run(page, 'w.player.invuln = 99; return w.player.x;'));
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width / 2, vp.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(vp.width / 2 + 60, vp.height * 0.7, { steps: 5 });
  await page.waitForTimeout(600);
  await page.mouse.up();
  expect(Number(await run(page, 'return w.player.x;'))).not.toBe(x0);
  await expect.poll(() => run(page, 'return w.projectiles.some((p) => p.friendly) || w.kills > 0 || w.enemies.some((e) => e.hp < e.maxHp);'), { timeout: 15000 }).toBe(true);
  if (shots) await page.screenshot({ path: `${shots}/modelo-prueba.png` });
  expect(errors).toEqual([]);
});

test('si el modelo no carga, se juega con el sprite sin errores', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/models/no-existe.glb', (r) => r.fulfill({ status: 404, body: 'no' }));
  await page.goto('/?debug&model3d=charmander|models/no-existe.glb|30');
  await startGym(page);
  await expect.poll(() => run(page, "return s.models?.state('models/no-existe.glb');"), { timeout: 15000 }).toBe('failed');
  await page.waitForTimeout(800);
  expect(await run(page, 'return s.modelDebug().instances.length;')).toBe(0);
  expect(Number(await run(page, 'return w.time;'))).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});

test('al abandonar la partida se libera lo subido a la GPU', async ({ page }) => {
  await page.route('**/models/e2e-caja.glb', (r) => r.fulfill({ body: boxGlb(), contentType: 'model/gltf-binary' }));
  await page.goto('/?debug&model3d=charmander|models/e2e-caja.glb|30');
  await startGym(page);
  await expect.poll(() => run(page, 'return s.modelDebug().instances.length;'), { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(1000);
  const live = await run(page, 'window.__s = s; return s.memory;') as { geometries: number; textures: number };
  expect(live.geometries).toBeGreaterThan(0);
  expect(live.textures).toBeGreaterThan(0);
  await page.getByTestId('pause').click();
  await page.getByTestId('abandon').click();
  await expect(page.getByTestId('result')).toBeVisible();
  await page.getByTestId('result-continue').click();
  const after = await page.evaluate('window.__s.memory') as { geometries: number; textures: number; contextLost: boolean };
  // Todo lo nuestro liberado. Three.js deja contada su tabla DFG compartida
  // (materiales PBR del modelo); al soltar el contexto se libera igualmente.
  expect(after.geometries, JSON.stringify(after)).toBe(0);
  expect(after.textures, JSON.stringify(after)).toBeLessThanOrEqual(1);
  expect(after.contextLost).toBe(true);
});
