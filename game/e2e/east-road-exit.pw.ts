import { test, expect } from '@playwright/test';

test('the painted downward east branch supports early boundary, departure and field return', async ({ page }) => {
  test.setTimeout(45000);
  await page.routeWebSocket('ws://127.0.0.1:5173/**', socket => socket.close());
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?scene=world&map=felder');
  await page.waitForFunction(() => (window as any).game?.scene.isActive('world'));
  await page.waitForFunction(() => !(window as any).game.scene.getScene('world').cameras.main.fadeEffect.isRunning);
  const click = async (x: number, y: number) => {
    const bounds = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(bounds.x + bounds.width * x / 640, bounds.y + bounds.height * y / 360);
  };
  await page.screenshot({ path: '../output/qa/east-road-exit-painted-branch.png', fullPage: true });
  // This click follows the actual bent painted route from the field start.
  await click(636, 306);
  await page.waitForFunction(() => (window as any).game.scene.getScene('world').blockedExit === 'journey', undefined, { timeout: 12000 });
  const boundary = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('world');
    return [scene.lia.x, scene.lia.y];
  });
  expect(boundary[0]).toBeGreaterThanOrEqual(632);
  expect(boundary[1]).toBeGreaterThanOrEqual(294);
  expect(boundary[1]).toBeLessThanOrEqual(318);
  await page.screenshot({ path: '../output/qa/east-road-exit-early-boundary.png', fullPage: true });
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => (window as any).game.scene.getScene('world').lia.x < 620);
  await page.keyboard.up('ArrowLeft');
  // Open the story gate only, then use normal walking input for the exit.
  await page.evaluate(() => {
    const state = (window as any).game.registry.get('world');
    state.flags.raidWitnessed = true;
    state.flags.departureReady = true;
  });
  await click(636, 306);
  await page.waitForFunction(() => (window as any).game.scene.isActive('journey'), undefined, { timeout: 8000 });
  await click(414, 14);
  await page.waitForFunction(() => (window as any).game.scene.isActive('world'), undefined, { timeout: 8000 });
  await page.waitForFunction(() => !(window as any).game.scene.getScene('world').cameras.main.fadeEffect.isRunning);
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('world');
    return { map: scene.map.id, at: [scene.lia.x, scene.lia.y], facing: scene.facing };
  })).toEqual({ map: 'felder', at: [613, 306], facing: 'w' });
  await page.screenshot({ path: '../output/qa/east-road-exit-return.png', fullPage: true });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => (window as any).game.scene.isActive('journey'), undefined, { timeout: 5000 });
  await page.keyboard.up('ArrowRight');
  expect(errors).toEqual([]);
});
