import { expect, type Page } from '@playwright/test';

/** Resolve the current canvas after mobile captions have changed its layout. */
export async function campSpot(page: Page, id: string, touch: boolean) {
  const frame = await page.evaluate(() => (window as any).game.loop.frame);
  await page.waitForFunction(frame => (window as any).game.loop.frame > frame + 3, frame);
  const at = await page.evaluate(id => (window as any).game.scene.getScene('journey').spots.find((spot: any) => spot.id === id).at, id);
  const canvas = (await page.locator('canvas').boundingBox())!;
  const x = canvas.x + canvas.width * at[0] / 640, y = canvas.y + canvas.height * at[1] / 360;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Real timed strokes can miss under transport latency; every result is checked. */
export async function drillToHeat(page: Page, target: number, touch: boolean) {
  const state = () => page.evaluate(() => { const f = (window as any).game.scene.getScene('journey').data.get('story:fire-minigame'); return { ...f, strokes: f.hits + f.misses }; });
  for (let attempt = 0; attempt < 12; attempt++) {
    const before = await state();
    if (before.heat >= target) return;
    const button = page.getByRole('button', { name: 'Holz bohren', exact: true });
    await expect(button).toBeEnabled();
    // Resolve actionability and coordinates before waiting for the moving band.
    const box = (await button.boundingBox())!;
    await page.waitForFunction(() => {
      const f = (window as any).game.scene.getScene('journey').data.get('story:fire-minigame');
      return f?.active && f.ready && f.marker > 0.43 && f.marker < 0.57;
    });
    if (touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    else await page.keyboard.press('KeyE');
    await expect.poll(async () => (await state()).strokes).toBe(before.strokes + 1);
    const after = await state();
    expect(after.hits + after.misses).toBe(after.strokes);
    if (after.hits === before.hits + 1) {
      expect(after.misses).toBe(before.misses);
      expect(after.heat).toBe(before.heat + 1);
    } else {
      expect(after.hits).toBe(before.hits);
      expect(after.misses).toBe(before.misses + 1);
      expect(after.heat).toBe(Math.max(0, before.heat - 1));
    }
    if (after.heat >= target) return;
  }
  expect((await state()).heat, 'bounded physical strokes must reach the requested heat').toBeGreaterThanOrEqual(target);
}

/** Reach the encounter through construction, the meal and sleep, without flag edits. */
export async function prepareFirstCamp(page: Page, touch: boolean) {
  const step = (next: string) => page.waitForFunction(next => (window as any).game.scene.getScene('journey').campStep === next, next);
  await page.goto('/?scene=camp');
  await page.waitForFunction(() => {
    const scene = (window as any).game?.scene?.getScene('journey');
    return scene?.sys.isActive() && scene.inCamp && !scene.locked;
  });
  for (const [id, next] of [['bedroll', 'stones'], ['stones', 'ring'], ['fire', 'twigs'], ['twigs', 'fire']]) {
    await campSpot(page, id, touch); await step(next);
  }
  await campSpot(page, 'fire', touch);
  await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:fire-minigame')?.active);
  await drillToHeat(page, 6, touch); await step('meal');
  // Ignition keeps its input lock for 700 ms after the meal step is recorded.
  await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').fireBusy);
  if (touch) await page.getByRole('button', { name: 'Tasche', exact: true }).tap();
  else await page.keyboard.press('KeyI');
  const bag = page.locator('#bag-dialog');
  await bag.getByRole('button', { name: 'Reiseproviant auswählen', exact: true }).click();
  await bag.getByRole('button', { name: 'Reiseproviant: Essen', exact: true }).click();
  await step('sleep');
  await page.keyboard.press('Escape');
  await campSpot(page, 'bedroll', touch);
}
