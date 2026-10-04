import { expect, test, type Page } from '@playwright/test';

const output = '../output/qa/visual-playtest/shared';
async function tapWorld(page: Page, point: { x: number; y: number }) {
  const view = await page.evaluate(point => {
    const camera = (window as any).game.scene.getScene('rescue-battle').cameras.main;
    return camera.matrix.transformPoint(point.x - camera.scrollX, point.y - camera.scrollY);
  }, point);
  const bounds = (await page.locator('canvas').boundingBox())!;
  expect(view.x).toBeGreaterThanOrEqual(0); expect(view.x).toBeLessThanOrEqual(640);
  expect(view.y).toBeGreaterThanOrEqual(0); expect(view.y).toBeLessThanOrEqual(360);
  await page.touchscreen.tap(bounds.x + view.x / 640 * bounds.width, bounds.y + view.y / 360 * bounds.height);
}
async function tapActor(page: Page, id: string) {
  const point = await page.evaluate(id => {
    const sprite = (window as any).game.scene.getScene('rescue-battle').sprites.get(id);
    return { x: sprite.x, y: sprite.y - 12 };
  }, id);
  await tapWorld(page, point);
}
async function snapshot(page: Page) { return page.evaluate(() => (window as any).game.registry.get('rescue:state')); }
for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) test.describe(`${viewport.width}x${viewport.height}`, () => {
  test.use({ viewport, hasTouch: true });
  test('rendered actor taps and legal field taps follow the zoomed mobile camera', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.routeWebSocket(/127\.0\.0\.1:\d+/, socket => socket.close());
    await page.goto('/?scene=rescue-battle');
    await page.waitForFunction(() => (window as any).game?.scene.isActive('rescue-battle') && (window as any).game.registry.get('rescue:state'));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as any).game.scene.getScene('rescue-battle').cameras.main.zoom)).toBeGreaterThan(1);
    await tapActor(page, 'lia'); expect((await snapshot(page)).selected).toBe('lia');
    await tapActor(page, 'flick'); expect((await snapshot(page)).selected).toBe('flick');
    await page.screenshot({ path: `${output}/rescue-pointer-${viewport.width}x${viewport.height}-flick.png`, fullPage: true });
    await tapWorld(page, { x: 280, y: 106 });
    await page.waitForFunction(() => !(window as any).game.scene.getScene('rescue-battle').data.get('rescue:animating'));
    const moved = await snapshot(page);
    expect(moved.units.find((unit: any) => unit.id === 'flick').cell).toEqual({ x: 6, y: 0 });
    expect(moved.budgets.flick.moved).toBe(true);
    await tapActor(page, 'lia'); expect((await snapshot(page)).selected).toBe('lia');
    await tapWorld(page, { x: 120, y: 226 });
    await page.waitForFunction(() => !(window as any).game.scene.getScene('rescue-battle').data.get('rescue:animating'));
    expect((await snapshot(page)).units.find((unit: any) => unit.id === 'lia').cell).toEqual({ x: 2, y: 3 });
    await page.screenshot({ path: `${output}/rescue-pointer-${viewport.width}x${viewport.height}-moved.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
});
