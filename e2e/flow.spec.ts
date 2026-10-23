import { expect, test, type Page } from '@playwright/test';

// Flujo completo en un móvil simulado (Pixel 7, vertical). Usa el acceso de
// depuración (?debug) solo para acelerar pasos largos (dar XP, ir a la sala
// del jefe); el resto se hace pulsando la interfaz como un jugador.

const shots = process.env.SHOTS_DIR;
const shot = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` });
};

/** Abre la ficha del gimnasio de Brock (la puerta del gimnasio de Plateada) y pulsa Comenzar. */
async function startGym(page: Page) {
  await page.evaluate(() => (window as any).__pokecero.app.showGym('brock'));
  await page.getByTestId('play').click();
}

/** Lleva al Pokémon junto a un punto del pueblo y pulsa el botón de interactuar. */
async function actAt(page: Page, x: number, y: number) {
  await page.evaluate(([x, y]) => { const p = (window as any).__pokecero.app.town.world.player; p.x = x; p.y = y; }, [x, y]);
  await page.getByTestId('town-act').click();
}

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
  // Mapa: la aventura empieza en Pueblo Paleta; sin medallas en los pueblos sin gimnasio.
  await expect(page.getByTestId('gym-card')).toContainText('Pueblo Paleta');
  await expect(page.getByTestId('gym-card')).toContainText('Visitado');
  await expect(page.getByTestId('gym-card')).not.toContainText('Medalla');
  await shot(page, '00-mapa');
  // Un lugar sin visitar se puede consultar, pero no se entra.
  await page.click('.map3-hot[data-place="plateada"]');
  await expect(page.getByTestId('gym-card')).toContainText('Ciudad Plateada');
  await expect(page.getByTestId('gym-card')).toContainText('Medalla Roca');
  await expect(page.getByTestId('enter')).toContainText('Bloqueado');
  await page.click('.map3-hot[data-place="paleta"]');
  await expect(page.getByTestId('enter')).toContainText('Entrar');
  await shot(page, '01-mapa');

  // Navegación por las cuatro pestañas
  await page.click('[data-tab="pokemon"]');
  await expect(page.locator('.hero-name')).toContainText('Charmander');
  // Al tocar tu Pokémon se abre su ficha completa (habilidad, ataque, objetos e información).
  await page.getByTestId('pk-hero').click();
  await expect(page.getByTestId('hero-passive')).toContainText('Mar Llamas');
  await expect(page.getByTestId('signature-attack')).toContainText('Ascuas');
  await expect(page.getByTestId('signature-attack')).toContainText('Evoluciona a Llamarada');
  await shot(page, '02b-ataque');
  await page.getByTestId('sheet-close').click();
  // El entrenamiento se compra en la tienda de los pueblos: el botón lo indica.
  await page.getByTestId('train').click();
  await expect(page.locator('.toast').last()).toContainText('Ciudad Verde');
  await shot(page, '02-pokemon');
  // Selección: solo los 3 iniciales de Kanto y Pikachu, todos disponibles.
  await expect(page.locator('.pk4-face')).toHaveCount(4);
  await page.getByTestId('pick-pikachu').click();
  await expect(page.locator('.hero-name')).toContainText('Pikachu');
  await shot(page, '02a-seleccion');
  await page.getByTestId('pick-charmander').click();
  await expect(page.locator('.hero-name')).toContainText('Charmander');
  await page.click('[data-tab="settings"]');
  await expect(page.locator('[data-setting="testMode"]')).toBeChecked();
  await shot(page, '03-ajustes');
  await page.click('[data-tab="gacha"]');
  await expect(page.getByTestId('tickets')).toHaveText('10');
  // El gachapón ya no reparte Pokémon: queda visible, sin tiradas.
  await expect(page.getByTestId('gacha-soon')).toBeVisible();
  await expect(page.getByTestId('gacha-pull')).toHaveCount(0);
  await shot(page, '04-gachapon');

  // Entrar al gimnasio
  await page.click('[data-tab="map"]');
  await startGym(page);
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
  await startGym(page);
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
  await startGym(page);
  await world(page, 'w.startRoom(w.rooms.length - 1);');
  await expect(page.locator('.boss-bar')).toBeVisible({ timeout: 5000 });
  await world(page, 'w.debugKillAll();');
  await page.waitForTimeout(300);
  await pickUntilResult(page);
  await expect(page.getByTestId('result')).toContainText('ya la tenías', { timeout: 5000 });
  await page.getByTestId('result-continue').click();
  expect(Number(await page.getByTestId('tickets').textContent())).toBeLessThan(ticketsAfterWin + 10);

  // Comprar una mejora permanente con oro en la tienda de Ciudad Verde
  await page.evaluate(() => { const a = (window as any).__pokecero.app; a.store.update((d: any) => { d.adventure.visited.push('verde'); }); a.showTown('verde'); });
  await expect(page.getByTestId('town-name')).toContainText('Ciudad Verde');
  const gold = () => page.evaluate(() => (window as any).__pokecero.app.store.data.gold as number);
  const goldBefore = await gold();
  await actAt(page, 515, 1872);
  await page.getByTestId('buy-spd').click();
  const goldAfter = await gold();
  expect(goldAfter).toBeLessThan(goldBefore);
  await shot(page, '13-mejora');
  await page.getByTestId('sheet-close').click();

  // El progreso permanente sobrevive a recargar la página
  await page.reload();
  await expect(page.getByTestId('gold')).toHaveText(String(goldAfter));
  await expect(page.locator('.topbar')).toContainText('1/8');
  expect(await page.evaluate(() => (window as any).__pokecero.app.store.data.upgrades.charmander?.spd)).toBe(1);

  expect(errors).toEqual([]);
});

test('sin desplazamiento de página y joystick no hace scroll', async ({ page }) => {
  await page.goto('/?debug');
  await startGym(page);
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
  await startGym(page);
  await expect(page.locator('.run')).toHaveAttribute('data-view', '2d');
  await page.waitForTimeout(1500);
  expect(await world(page, 'return w.time;')).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});

test('aventura: Pueblo Paleta → Ruta 1 → Ciudad Verde', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?debug');
  // Ciudad Verde aún no se puede visitar.
  await page.click('.map3-hot[data-place="verde"]');
  await expect(page.getByTestId('enter')).toContainText('Bloqueado');
  await page.click('.map3-hot[data-place="paleta"]');
  await page.getByTestId('enter').click();
  await expect(page.getByTestId('town-name')).toContainText('Pueblo Paleta');
  await page.waitForTimeout(800);
  await shot(page, '20-paleta');
  // Cartel
  await actAt(page, 420, 2184);
  await expect(page.getByTestId('town-line')).toContainText('PUEBLO PALETA');
  await page.getByTestId('town-next').click();
  await page.getByTestId('town-close').click();
  // Salida norte → Ruta 1
  await actAt(page, 360, 80);
  await page.getByTestId('town-next').click();
  await shot(page, '20b-salida');
  await page.getByTestId('town-go').click();
  await expect(page.getByTestId('room')).toContainText('1/5');
  for (let room = 0; room < 5; room++) {
    await world(page, 'w.player.hp = w.player.maxHp = 1e6;');
    for (let i = 0; i < 40; i++) {
      const st = await world(page, `w.debugKillAll(); if (w.exitOpen) { w.player.x = w.exit.x; w.player.y = w.exit.y; } return w.phase + ':' + w.roomIndex;`) as string;
      if (st.startsWith('levelup')) await page.getByTestId('card-0').click();
      else if (st.startsWith('item')) await page.getByTestId('item-new').click();
      if (await page.getByTestId('result').isVisible()) break;
      if (Number(st.split(':')[1]) > room) break;
      await page.waitForTimeout(250);
    }
  }
  await pickUntilResult(page);
  await expect(page.getByTestId('result')).toContainText('Ruta 1');
  await page.getByTestId('result-continue').click();
  await expect(page.getByTestId('town-name')).toContainText('Ciudad Verde');
  await page.waitForTimeout(800);
  await shot(page, '21-verde');
  // De vuelta al mapa, Verde ya está visitada.
  await page.getByTestId('town-map').click();
  await page.click('.map3-hot[data-place="verde"]');
  await expect(page.getByTestId('enter')).toContainText('Entrar');
  expect(errors).toEqual([]);
});

test('modo admin en Ajustes: contraseña, oro ilimitado y todo abierto', async ({ page }) => {
  await page.goto('/?debug');
  await page.click('[data-tab="settings"]');
  await page.getByTestId('admin-toggle').click();
  await page.getByTestId('admin-pass').fill('otra');
  await page.getByTestId('admin-ok').click();
  await expect(page.getByTestId('admin-msg')).toContainText('incorrecta');
  await page.getByTestId('admin-pass').fill('Josejosejose');
  await shot(page, '30-admin');
  await page.getByTestId('admin-ok').click();
  await expect(page.getByTestId('gold')).toHaveText('∞');
  await expect(page.getByTestId('admin-toggle')).toContainText('Desactivar');
  await page.click('[data-tab="map"]');
  await page.click('.map3-hot[data-place="plateada"]');
  await expect(page.getByTestId('enter')).toContainText('Entrar');
  await page.click('[data-tab="pokemon"]');
  await page.getByTestId('train').click();
  await page.getByTestId('buy-atk').click();
  await expect(page.getByTestId('gold')).toHaveText('∞');
  await page.getByTestId('sheet-close').click();
  await page.reload();
  await expect(page.getByTestId('gold')).toHaveText('∞');
  await page.click('[data-tab="settings"]');
  await page.getByTestId('admin-toggle').click();
  await expect(page.getByTestId('gold')).toHaveText('500');
});
