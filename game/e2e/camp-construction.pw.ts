import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`camp is built from inventory at dusk before night (${viewport.width})`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    // Keep the loaded game stable while other agents edit the shared Vite workspace.
    // The game itself has no WebSocket transport; this only intercepts HMR.
    await page.routeWebSocket('ws://127.0.0.1:5173/**', () => {});
    await page.goto('/?scene=journey');
    await page.waitForFunction(() => (window as any).game?.scene.isActive('journey'));
    // Isolate the camp phase; all preparation below uses the rendered interaction targets.
    await page.evaluate(() => (window as any).game.scene.getScene('journey').enterCamp());
    await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').locked);
    const snap = () => page.evaluate(() => {
      const game = (window as any).game, s = game.scene.getScene('journey');
      return { step: s.campStep, time: s.data.get('story:camp-time'), texture: s.campBackground.texture.key,
        world: game.registry.get('world'), stonesVisible: s.campStones.visible, twigsVisible: s.campTwigs.visible };
    });
    expect(await snap()).toMatchObject({ step: 'cloak', time: 'dusk', texture: 'bg-first-camp-evening', stonesVisible: true, twigsVisible: true });
    const use = async (id: string, next: string) => {
      const at = await page.evaluate(id => (window as any).game.scene.getScene('journey').spots.find((s: any) => s.id === id).at, id);
      const canvas = (await page.locator('canvas').boundingBox())!;
      await page.mouse.click(canvas.x + canvas.width * at[0] / 640, canvas.y + canvas.height * at[1] / 360);
      await expect.poll(async () => (await snap()).step, { timeout: 12000 }).toBe(next);
    };
    await page.screenshot({ path: `../output/qa/camp-${viewport.width}-dusk-empty.png`, fullPage: true });
    await use('bedroll', 'stones');
    await use('stones', 'ring');
    expect(await snap()).toMatchObject({ stonesVisible: false, world: { inv: { steine: 6 }, flags: { journeyStonesGathered: true } } });
    if (viewport.width < 500) await page.getByRole('button', { name: 'Tasche', exact: true }).click();
    else await page.keyboard.press('KeyI');
    const stoneRow = page.locator('#bag-dialog [data-item="steine"]');
    await stoneRow.scrollIntoViewIfNeeded();
    await expect(stoneRow).toBeVisible();
    await expect(stoneRow).toContainText('× 6');
    await page.screenshot({ path: `../output/qa/camp-${viewport.width}-stones-in-bag.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await use('fire', 'twigs');
    expect((await snap()).world.inv.steine).toBeUndefined();
    await use('twigs', 'fire');
    expect(await snap()).toMatchObject({ twigsVisible: false, world: { inv: { zunderholz: 1 }, flags: { journeyFirepitBuilt: true } } });
    await use('fire', 'meal');
    expect((await snap()).world.inv.zunderholz).toBeUndefined();
    expect(await snap()).toMatchObject({ time: 'dusk', world: { flags: { campfireLit: true } } });
    await use('fire', 'sleep');
    expect(await snap()).toMatchObject({ world: { flags: { journeyAte: true, journeyProviantPortionUsed: true } } });
    expect((await snap()).world.flags.journeyFeetChecked).toBeUndefined();
    await page.screenshot({ path: `../output/qa/camp-${viewport.width}-dusk-built.png`, fullPage: true });
    await use('bedroll', 'waking');
    await expect.poll(async () => (await snap()).time).toBe('night');
    await expect.poll(async () => (await snap()).texture).toBe('bg-first-camp-night');
    await page.screenshot({ path: `../output/qa/camp-${viewport.width}-night.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
