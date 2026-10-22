import { expect, test, type Page } from '@playwright/test';

// Flujo completo en un móvil simulado (Pixel 7, vertical). Usa el acceso de
// depuración (?debug) solo para acelerar pasos largos (dar XP, ir a la sala
// del jefe); el resto se hace pulsando la interfaz como un jugador.

const shots = process.env.SHOTS_DIR;
const shot = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
};

/** Elige cartas y objetos hasta que aparezca el resultado de la partida. */
async function pickUntilResult(page: Page) {
  for (let i = 0; i < 120; i++) {
    if (await page.getByTestId('result').isVisible()) return;
    const phase = await world(page, 'return w.phase;');
    if (phase === 'item') await page.getByTestId('item-new').click();
    else if (phase === 'levelup') await page.getByTestId('card-0').click();
    await page.waitForTimeout(450);
  }
}

/** Elige la primera carta en todas las subidas de nivel pendientes. */
async function pickAllCards(page: Page) {
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(450);
    const phase = await world(page, 'return w.phase;');
    if (phase === 'item') await page.getByTestId('item-new').click();
    else if (phase === 'levelup') await page.getByTestId('card-0').click();
    else return;
  }
}

test.beforeEach(async ({ page }) => {
  // Sin red en CI: la fuente pixel se sustituye por la de reserva.
  await page.route('**/fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
});
const world = (page: Page, fn: string) =>
  page.evaluate(`(() => { const w = window.__pokecero.app.run.world; ${fn} })()`);

test('ciclo completo del prototipo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/?debug');
  await expect(page.locator('.bottom-nav .nav-btn')).toHaveCount(4);
  await expect(page.getByTestId('gym-detail')).toContainText('Ciudad Plateada');
  await shot(page, '01-mapa');

  // Navegación por las cuatro pestañas
  await page.click('[data-tab="pokemon"]');
  await expect(page.locator('.hero-name')).toContainText('Charmander');
  await expect(page.locator('.upgrade-row')).toHaveCount(10);
  await expect(page.getByTestId('hero-passive')).toContainText('Mar Llamas');
  await shot(page, '02-pokemon');
  await page.click('[data-tab="settings"]');
  await expect(page.locator('[data-setting="testMode"]')).toBeChecked();
  await shot(page, '03-ajustes');
  await page.click('[data-tab="gacha"]');
  await expect(page.getByTestId('tickets')).toHaveText('10');
  await page.getByTestId('gacha-pull').click();
  await expect(page.getByTestId('gacha-result')).toBeVisible();
  await expect(page.getByTestId('tickets')).toHaveText('9');
  await shot(page, '04-gachapon');

  // Entrar al gimnasio
  await page.click('[data-tab="map"]');
  await page.getByTestId('play').click();
  await expect(page.locator('.game-canvas').first()).toBeVisible();
  // Con WebGL 2 se juega en 3D (si no, el 2D clásico de respaldo).
  await expect(page.locator('.run')).toHaveAttribute('data-view', '3d');
  await expect(page.getByTestId('room')).toHaveText('Sala 1/50');
  await page.waitForTimeout(1500);
  await shot(page, '05-combate');

  // Mover con el joystick táctil (arrastre)
  const x0 = (await world(page, 'return w.player.x;')) as number;
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width / 2, vp.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(vp.width / 2 + 60, vp.height * 0.7, { steps: 5 });
  await page.waitForTimeout(500);
  await shot(page, '06-joystick');
  await page.mouse.up();
  const x1 = (await world(page, 'return w.player.x;')) as number;
  expect(x1).toBeGreaterThan(x0 + 20);

  // Subida de nivel: exactamente 3 cartas, se elige una
  await world(page, 'w.addXp(w.xpNeeded / w.xpMult);');
  await expect(page.locator('.card')).toHaveCount(3);
  await page.waitForTimeout(400);
  await shot(page, '07-cartas');
  const progress = 'return w.player.moves.length + Object.values(w.player.statsTaken).reduce((a,b)=>a+b,0) + w.player.moves.reduce((a,b)=>a+b.level,0) + Object.values(w.player.abilities).reduce((a,b)=>a+b,0) + w.bonusGold + Math.round(w.player.hp);';
  const attacksBefore = (await world(page, progress)) as number;
  await page.getByTestId('card-0').click();
  await expect(page.locator('.overlay')).toBeHidden();
  const attacksAfter = (await world(page, progress)) as number;
  expect(attacksAfter).toBeGreaterThan(attacksBefore);

  // Habilidad + sinergia: aparece el aviso y se listan en la pausa
  await world(page, 'w.player.abilities["cuerpo-llama"] = 1; w.refreshMods();');
  await expect(page.locator('.banner')).toContainText('Infierno');
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('ability-list')).toContainText('Mar Llamas');
  await expect(page.getByTestId('ability-list')).toContainText('Cuerpo Llama');
  await expect(page.getByTestId('ability-list')).toContainText('Infierno');
  await shot(page, '07b-pausa-habilidades');
  await page.getByTestId('resume').click();

  // Superar la sala y cruzar la salida
  await world(page, 'w.debugKillAll();');
  await page.waitForTimeout(1200);
  await pickAllCards(page);
  await expect.poll(() => world(page, 'return w.exitOpen && w.pickups.length === 0;'), { timeout: 15000 }).toBe(true);
  await shot(page, '08-salida');
  await world(page, 'w.player.x = w.exit.x; w.player.y = w.exit.y + 12;');
  await expect(page.getByTestId('room')).toHaveText('Sala 4/50');
  expect(await world(page, 'return w.obstacles.length;')).toBeGreaterThan(0);
  await page.waitForTimeout(1800);
  await shot(page, '08b-obstaculos');

  // Ir al miniboss (sala 20) y comprobar barra de jefe
  await world(page, 'w.startRoom(3);');
  await expect(page.locator('.boss-bar')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await shot(page, '09-miniboss');

  // Derrota: el oro se conserva
  await world(page, 'w.player.invuln = 0; w.hurtPlayer(99999, "normal", "physical");');
  await expect(page.getByTestId('result')).toContainText('Derrota');
  await shot(page, '10-derrota');
  await page.getByTestId('result-continue').click();
  const goldAfterLoss = Number(await page.getByTestId('gold').textContent());
  expect(goldAfterLoss).toBeGreaterThan(500);

  // Victoria contra el jefe final: medalla y tickets (una sola vez)
  await page.getByTestId('play').click();
  await world(page, 'w.startRoom(w.rooms.length - 1);');
  await expect(page.locator('.boss-bar')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1200);
  await shot(page, '11-jefe');
  await world(page, 'w.debugKillAll();');
  await page.waitForTimeout(500);
  await pickUntilResult(page);
  await expect(page.getByTestId('result')).toContainText('¡Victoria!', { timeout: 5000 });
  await shot(page, '12-victoria');
  await page.getByTestId('result-continue').click();
  const ticketsAfterWin = Number(await page.getByTestId('tickets').textContent());
  expect(ticketsAfterWin).toBeGreaterThanOrEqual(19);
  await expect(page.locator('.topbar')).toContainText('1/8');

  // Repetir el jefe no vuelve a dar los tickets
  await page.getByTestId('play').click();
  await world(page, 'w.startRoom(w.rooms.length - 1);');
  await expect(page.locator('.boss-bar')).toBeVisible({ timeout: 5000 });
  await world(page, 'w.debugKillAll();');
  await page.waitForTimeout(300);
  await pickUntilResult(page);
  await expect(page.getByTestId('result')).toContainText('ya la tenías', { timeout: 5000 });
  await page.getByTestId('result-continue').click();
  expect(Number(await page.getByTestId('tickets').textContent())).toBeLessThan(ticketsAfterWin + 10);

  // Comprar una mejora permanente con oro
  await page.click('[data-tab="pokemon"]');
  const goldBefore = Number(await page.getByTestId('gold').textContent());
  await page.getByTestId('buy-spd').click();
  const goldAfter = Number(await page.getByTestId('gold').textContent());
  expect(goldAfter).toBeLessThan(goldBefore);
  await shot(page, '13-mejora');

  // El progreso permanente sobrevive a recargar la página
  await page.reload();
  await expect(page.getByTestId('gold')).toHaveText(String(goldAfter));
  await expect(page.locator('.topbar')).toContainText('1/8');
  await page.click('[data-tab="pokemon"]');
  await expect(page.locator('.upgrade-row').nth(2)).toContainText('Nv 1');

  expect(errors).toEqual([]);
});

test('sin desplazamiento de página y joystick no hace scroll', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('play').click();
  const scroll = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
  expect(scroll[0]).toBeLessThanOrEqual(scroll[1]);
  const touchAction = await page.locator('.run').evaluate((el) => getComputedStyle(el).touchAction);
  expect(touchAction).toBe('none');
});

test('sin WebGL 2 se juega con el dibujo 2D clásico', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error simulación de un dispositivo sin WebGL 2
    HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
      return type === 'webgl2' ? null : orig.call(this, type, ...rest);
    };
  });
  await page.goto('/?debug');
  await page.getByTestId('play').click();
  await expect(page.locator('.run')).toHaveAttribute('data-view', '2d');
  await page.waitForTimeout(1500);
  expect(await world(page, 'return w.time;')).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});
