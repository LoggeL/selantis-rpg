import { test, expect, type Page, type TestInfo } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Load current source on navigation, then keep this running scene stable
  // while other workers edit modules in the same development server.
  await page.routeWebSocket('ws://127.0.0.1:5173/**', socket => socket.close());
});

async function screenshot(page: Page, info: TestInfo, filename: string) {
  const evidence = process.env.SELANTIS_FEEDBACK_EVIDENCE_DIR;
  await page.screenshot({ path: evidence ? `${evidence}/${filename}` : info.outputPath(filename) });
}

async function ready(page: Page) {
  await page.goto('/?scene=flight');
  await page.waitForFunction(() => (window as any).game?.scene.isActive('flight'));
  // The real collapse occurs after the opening thought. Let that scheduled
  // beat run before placing a focused test at a later point on the route.
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('flight').data.get('mobile:thought'));
}

test('forest interaction stays optional and is readable', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('flight');
    scene.nextStation = 1;
    scene.placeAt(scene.pauses[0].at);
  });
  await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('flight').data.get('mobile:hint'))).toContain('(optional)');
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('flight');
    return { markerSize: Number(scene.pauses[0].marker.list[1].style.fontSize.replace('px', '')), hintSize: Number(scene.hud.hintText.style.fontSize.replace('px', '')), busy: scene.busy };
  })).toEqual({ markerSize: 16, hintSize: 14, busy: false });
  await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('flight').hud.hintText.alpha)).toBeGreaterThan(0.95);
  await screenshot(page, info, 'message-03-interaction.png');
  await page.keyboard.press('KeyE');
  expect(await page.evaluate(() => (window as any).game.scene.getScene('flight').pauses[0].done)).toBe(true);
});

test('forest seam is blended while the surrounding stages remain intact', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  const edge = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('flight');
    const texture = scene.textures.get('bg-flight-blended');
    const context = texture.getContext();
    const a = document.createElement('canvas'); a.width = 640; a.height = 360;
    const b = document.createElement('canvas'); b.width = 640; b.height = 360;
    a.getContext('2d')!.drawImage(scene.textures.get('bg-flight-a').getSourceImage(), 0, 0);
    b.getContext('2d')!.drawImage(scene.textures.get('bg-flight-b').getSourceImage(), 0, 0);
    const pixels = (ctx: CanvasRenderingContext2D, x: number) => ctx.getImageData(x, 0, 1, 360).data;
    const difference = (left: Uint8ClampedArray, right: Uint8ClampedArray) => Array.from(left).reduce((sum, value, i) => sum + Math.abs(value - right[i]), 0) / left.length;
    return {
      original: difference(pixels(a.getContext('2d')!, 639), pixels(b.getContext('2d')!, 0)),
      blended: difference(pixels(context, 639), pixels(context, 640)),
      left: difference(pixels(context, 200), pixels(a.getContext('2d')!, 200)),
      right: difference(pixels(context, 900), pixels(b.getContext('2d')!, 260)),
    };
  });
  expect(edge.blended).toBeLessThan(edge.original / 2);
  expect(edge.left).toBe(0);
  expect(edge.right).toBe(0);
  await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('flight');
    scene.nextStation = 2; scene.placeAt(scene.stations[1].to);
  });
  await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('flight').cameras.main.scrollX)).toBeGreaterThan(300);
  await screenshot(page, info, 'message-03-forest-seam.png');
});

for (const mobile of [false, true]) {
  test(`collapse rescue bridge waits for the reader (${mobile ? 'phone' : 'desktop'})`, async ({ page }, info) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 });
    await ready(page);
    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('flight');
      scene.placeAt(scene.total); scene.slip();
    });
    await page.waitForFunction(() => (window as any).game.scene.getScene('flight').data.get('dialogue:complete')?.startsWith('Schritte im Unterholz.'));
    await page.waitForTimeout(2800);
    expect(await page.evaluate(() => (window as any).game.scene.isActive('flight'))).toBe(true);
    await screenshot(page, info, `message-03-footsteps-${mobile ? 'phone' : 'desktop'}.png`);
    if (mobile) await page.locator('.mobile-action[data-key="E"]').click();
    else await page.keyboard.press('KeyE');
    await page.waitForFunction(() => (window as any).game.scene.getScene('flight').data.get('dialogue:complete')?.startsWith('Ein Mann findet Valentus'));
    expect(await page.evaluate(() => (window as any).game.scene.isActive('refuge'))).toBe(false);
    await screenshot(page, info, `message-03-rescue-${mobile ? 'phone' : 'desktop'}.png`);
    if (mobile) await page.locator('.mobile-action[data-key="E"]').click();
    else await page.keyboard.press('KeyE');
    await page.waitForFunction(() => (window as any).game.scene.isActive('refuge'));
    await page.waitForFunction(() => (window as any).game.scene.getScene('refuge').data.get('dialogue:speaker') === 'Frau');
  });
}
