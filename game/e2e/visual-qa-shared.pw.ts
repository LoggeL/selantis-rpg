import { expect, test, type Page } from '@playwright/test';

const output = '../output/qa/visual-playtest/shared';
test.describe.configure({ mode: 'parallel' });
const modes = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, touch: false },
  { name: 'portrait', viewport: { width: 390, height: 844 }, touch: true },
  { name: 'landscape', viewport: { width: 844, height: 390 }, touch: true },
];
async function enter(page: Page, query: string, key: string) {
  await page.goto(`/?scene=${query}`);
  await page.waitForFunction(key => (window as any).game?.scene.isActive(key), key);
  await page.waitForTimeout(1000);
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
async function clickMap(page: Page, x: number, y: number, touch: boolean) {
  // Camp progress changes before its caption is rendered. Let that reflow and
  // Phaser's input bounds settle before deriving physical pointer coordinates.
  const frame = await page.evaluate(() => (window as any).game.loop.frame);
  await page.waitForFunction(frame => (window as any).game.loop.frame > frame + 3, frame);
  const bounds = (await page.locator('canvas').boundingBox())!;
  const px = bounds.x + bounds.width * x / 640, py = bounds.y + bounds.height * y / 360;
  if (touch) await page.touchscreen.tap(px, py); else await page.mouse.click(px, py);
}

for (const mode of modes) test.describe(mode.name, () => {
  test.use({ viewport: mode.viewport, hasTouch: mode.touch });
  test.beforeEach(async ({ page }) => {
    await page.routeWebSocket(/127\.0\.0\.1:\d+/, socket => socket.close());
  });
  test('DOM bag keeps logical inventory open while its canvas fallback stays hidden', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await enter(page, 'world&map=waldrand', 'world');
    await page.getByRole('button', { name: 'Tasche', exact: true }).click();
    await expect(page.locator('#bag-dialog')).toBeVisible();
    await shot(page, `${mode.name}-world-bag`);
    expect(await page.evaluate(() => {
      const game = (window as any).game, scene = game.scene.getScene('world');
      return { logical: scene.inventory.isOpen, published: scene.data.get('mobile:inventory').open, canvas: scene.inventory.panel.visible, paused: game.scene.isPaused('world') };
    })).toEqual({ logical: true, published: true, canvas: false, paused: true });
    await page.keyboard.press('Escape');
    await expect(page.locator('#bag-dialog')).toHaveCount(0);
    await page.waitForFunction(() => (window as any).game.scene.isActive('world'));
    expect(await page.evaluate(() => (window as any).game.scene.getScene('world').inventory.isOpen)).toBe(false);
    await page.getByRole('button', { name: 'Tasche', exact: true }).click();
    await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
    await page.getByRole('button', { name: 'Gruppe ansehen · C', exact: true }).click();
    await expect(page.locator('#character-dialog')).toBeVisible();
    expect(await page.evaluate(() => (window as any).game.scene.getScene('world').inventory.isOpen)).toBe(false);
    await page.keyboard.press('Escape'); expect(errors).toEqual([]);
  });
  test('wound cinematic has no empty caption frame', async ({ page }) => {
    await enter(page, 'break', 'break');
    await page.waitForFunction(() => (window as any).game.scene.getScene('break').data.get('story:breakStage') === 'wound');
    await expect(page.locator('.mobile-caption')).toBeHidden();
    await shot(page, `${mode.name}-wound`);
  });
  test('camp bag selection and ration use work without a canvas panel', async ({ page }) => {
    test.setTimeout(120000);
    await enter(page, 'camp', 'journey');
    for (const [id, next] of [['bedroll', 'stones'], ['stones', 'ring'], ['fire', 'twigs'], ['twigs', 'fire']]) {
      const at = await page.evaluate(id => (window as any).game.scene.getScene('journey').spots.find((spot: any) => spot.id === id).at, id);
      await clickMap(page, at[0], at[1], mode.touch);
      await page.waitForFunction(next => (window as any).game.scene.getScene('journey').campStep === next, next);
    }
    const fire = await page.evaluate(() => (window as any).game.scene.getScene('journey').spots.find((spot: any) => spot.id === 'fire').at);
    await clickMap(page, fire[0], fire[1], mode.touch);
    for (let heat = 1; heat <= 6; heat++) {
      await page.waitForFunction(() => { const fire = (window as any).game.scene.getScene('journey').data.get('story:fire-minigame'); return fire?.active && fire.ready && fire.marker > .43 && fire.marker < .57; });
      await page.getByRole('button', { name: 'Holz bohren', exact: true }).click();
      await page.waitForFunction(heat => (window as any).game.scene.getScene('journey').data.get('story:fire-minigame')?.heat >= heat, heat);
    }
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').campStep === 'meal');
    await page.getByRole('button', { name: 'Tasche', exact: true }).click();
    const bag = page.locator('#bag-dialog');
    await bag.getByRole('button', { name: 'Reiseproviant auswählen', exact: true }).click();
    expect(await page.evaluate(() => (window as any).game.scene.getScene('journey').inventory.panel.visible)).toBe(false);
    const count = await page.evaluate(() => (window as any).game.registry.get('world').inv.proviant);
    await shot(page, `${mode.name}-ration-selected`);
    await bag.getByRole('button', { name: 'Reiseproviant: Essen', exact: true }).click();
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').campStep === 'sleep');
    expect(await page.evaluate(() => (window as any).game.registry.get('world').inv.proviant ?? 0)).toBe(count - 1);
    await expect(bag).toHaveCount(0);
  });
});

test('desktop dialogue uses available canvas space and landscape battle shows the next enemies', async ({ page }) => {
  await page.routeWebSocket(/127\.0\.0\.1:\d+/, socket => socket.close());
  await page.setViewportSize({ width: 1280, height: 800 });
  await enter(page, 'world&map=waldrand', 'world');
  const exploration = (await page.locator('canvas').boundingBox())!;
  await enter(page, 'rain-forest', 'rain-forest');
  await page.waitForFunction(() => (window as any).game.scene.getScene('rain-forest').data.get('dialogue:active'));
  await shot(page, 'desktop-dialogue-frame');
  const dialogue = (await page.locator('canvas').boundingBox())!;
  expect(dialogue.width).toBeGreaterThan(1100);
  expect(Math.max(exploration.width, dialogue.width) / Math.min(exploration.width, dialogue.width)).toBeLessThan(1.15);
  await page.setViewportSize({ width: 844, height: 390 });
  await enter(page, 'battle', 'battle');
  await clickMap(page, 160, 232, false);
  await page.waitForFunction(() => (window as any).game.scene.getScene('battle').phase === 'plan');
  await shot(page, 'landscape-battle-status');
  const status = await page.locator('[data-mobile-battle-status]').textContent();
  expect(status).toContain('Blick Ost'); expect(status).toContain('Danach:');
  expect(await page.locator('.mobile-caption-text').evaluate(element => {
    const text = element.querySelector('[data-mobile-battle-status]')!;
    const line = getComputedStyle(text).lineHeight;
    return element.clientHeight >= Number.parseFloat(line) * 3;
  })).toBe(true);
});
