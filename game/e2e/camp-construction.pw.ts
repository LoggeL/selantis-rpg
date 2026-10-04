import { expect, test } from '@playwright/test';
import { restartScene } from './helpers/scenes';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test.describe(`camp input ${viewport.width}`, () => {
    test.use({ hasTouch: viewport.width < 500 });
  test(`camp is built from inventory at dusk before night (${viewport.width})`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    // Keep the loaded game stable while other agents edit the shared Vite workspace.
    // The game itself has no WebSocket transport; this only intercepts HMR.
    await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
    await page.goto('/?scene=journey');
    await page.waitForFunction(() => (window as any).game?.scene?.isActive('journey'));
    // Isolate the camp phase; all preparation below uses the rendered interaction targets.
    await page.getByRole('button', { name: 'Debug · Playtest' }).click();
    await page.getByLabel('Einstieg').selectOption('camp');
    await page.getByRole('button', { name: 'Zum Einstieg' }).click();
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').inCamp);
    await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').locked);
    const snap = () => page.evaluate(() => {
      const game = (window as any).game, s = game.scene.getScene('journey');
      return { step: s.campStep, time: s.data.get('story:camp-time'), texture: s.campBackground.texture.key,
        minigame: s.data.get('story:fire-minigame'), world: game.registry.get('world'), stonesVisible: s.campStones.visible, twigsVisible: s.campTwigs.visible,
        cloak: { texture: s.cloak.texture.key, visible: s.cloak.visible },
        ring: { texture: s.fireRing.texture.key, visible: s.fireRing.visible },
        fire: { texture: s.flame.texture.key, visible: s.flame.visible, scaleY: s.flame.scaleY }, frame: game.loop.frame };
    });
    expect(await snap()).toMatchObject({ step: 'cloak', time: 'dusk', texture: 'bg-first-camp-evening', stonesVisible: true, twigsVisible: true });
    expect(await snap()).toMatchObject({ cloak: { texture: 'camp-cloak-detailed', visible: false },
      ring: { texture: 'camp-fire-ring-detailed', visible: false }, fire: { texture: 'camp-fire-detailed', visible: false } });
    const use = async (id: string, next: string) => {
      const frame = await page.evaluate(() => (window as any).game.loop.frame);
      await page.waitForFunction(frame => (window as any).game.loop.frame > frame + 2, frame);
      const at = await page.evaluate(id => (window as any).game.scene.getScene('journey').spots.find((s: any) => s.id === id).at, id);
      const canvas = (await page.locator('canvas').boundingBox())!;
      const x = canvas.x + canvas.width * at[0] / 640, y = canvas.y + canvas.height * at[1] / 360;
      if (viewport.width < 500) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
      await expect.poll(async () => (await snap()).step, { timeout: 12000 }).toBe(next);
    };
    const replay = async (step: string) => {
      const before = (await snap()).world;
      await restartScene(page, 'journey');
      await expect.poll(async () => (await snap()).step).toBe(step);
      expect((await snap()).world).toEqual(before);
    };
    await page.screenshot({ path: `../output/qa/camp-${viewport.width}-dusk-empty.png`, fullPage: true });
    await use('bedroll', 'stones');
    expect((await snap()).cloak.visible).toBe(true);
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
    await replay('ring');
    expect(await snap()).toMatchObject({ stonesVisible: false, world: { inv: { steine: 6 } } });
    await use('fire', 'twigs');
    expect((await snap()).world.inv.steine).toBeUndefined();
    expect((await snap()).ring.visible).toBe(true);
    expect((await snap()).fire.visible).toBe(false);
    await replay('twigs');
    expect((await snap()).world.inv.steine).toBeUndefined();
    await use('twigs', 'fire');
    expect(await snap()).toMatchObject({ twigsVisible: false, world: { inv: { zunderholz: 1 }, flags: { journeyFirepitBuilt: true } } });
    await use('fire', 'fire');
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:fire-minigame')?.active);
    await page.screenshot({ path: `../output/qa/camp-${viewport.width}-fire-minigame.png`, fullPage: true });
    const fireButton = async (name: 'Holz bohren' | 'Pause') => {
      const button = page.getByRole('button', { name, exact: true });
      await expect(button).toBeEnabled();
      if (viewport.width < 500) await button.tap();
      else await button.click();
    };
    const waitGoodStroke = () => page.waitForFunction(() => {
      const f = (window as any).game.scene.getScene('journey').data.get('story:fire-minigame');
      return f?.active && f.ready && f.marker > 0.43 && f.marker < 0.57;
    });
    await waitGoodStroke();
    if (viewport.width < 500) await fireButton('Holz bohren');
    else await page.keyboard.press('KeyE');
    await expect.poll(async () => (await snap()).minigame.heat).toBe(1);
    // Pause preserves wood and progress, while tapping outside the game cannot walk Lia.
    await fireButton('Pause');
    await expect.poll(async () => (await snap()).minigame.active).toBe(false);
    expect((await snap()).world.inv.zunderholz).toBe(1);
    expect((await snap()).world.flags.campfireLit).toBeFalsy();
    await use('fire', 'fire');
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:fire-minigame')?.active);
    expect((await snap()).minigame.heat).toBe(1);
    for (let heat = 2; heat <= 6; heat++) {
      await waitGoodStroke();
      if (viewport.width < 500) await fireButton('Holz bohren');
      else await page.keyboard.press('KeyE');
      await expect.poll(async () => (await snap()).minigame.heat).toBe(heat);
    }
    await expect.poll(async () => (await snap()).step).toBe('meal');
    expect((await snap()).world.inv.zunderholz).toBeUndefined();
    expect(await snap()).toMatchObject({ time: 'dusk', world: { flags: { campfireLit: true } } });
    const lit = await snap(); expect(lit.fire.visible).toBe(true);
    await page.waitForFunction(frame => (window as any).game.loop.frame > frame + 15, lit.frame);
    expect((await snap()).fire.scaleY).not.toBe(lit.fire.scaleY);
    expect((await snap()).world.flags.journeyAte).toBeFalsy();
    await replay('meal');
    expect((await snap()).world.inv.zunderholz).toBeUndefined();
    if (viewport.width < 500) await page.getByRole('button', { name: 'Tasche', exact: true }).click();
    else await page.keyboard.press('KeyI');
    const bag = page.locator('#bag-dialog');
    await bag.getByRole('button', { name: 'Reiseproviant auswählen', exact: true }).click();
    await bag.getByRole('button', { name: 'Reiseproviant: Essen', exact: true }).click();
    await expect.poll(async () => (await snap()).step).toBe('sleep');
    await page.keyboard.press('Escape');
    expect(await snap()).toMatchObject({ world: { flags: { journeyAte: true, journeyProviantPortionUsed: true } } });
    expect((await snap()).world.flags.journeyFeetChecked).toBeUndefined();
    await replay('sleep');
    if (viewport.width < 500) await page.getByRole('button', { name: 'Tasche', exact: true }).click();
    else await page.keyboard.press('KeyI');
    await expect(page.locator('#bag-dialog').getByRole('button', { name: 'Reiseproviant: Essen', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
    await page.screenshot({ path: `../output/qa/camp-${viewport.width}-dusk-built.png`, fullPage: true });
    await use('bedroll', 'waking');
    await expect.poll(async () => (await snap()).time).toBe('night');
    await expect.poll(async () => (await snap()).texture).toBe('bg-first-camp-night');
    await page.screenshot({ path: `../output/qa/camp-${viewport.width}-night.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
  });
}
