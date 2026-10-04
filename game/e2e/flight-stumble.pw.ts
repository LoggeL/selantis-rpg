import { test, expect } from '@playwright/test';

for (const mode of ['click-root', 'click-beyond', 'hold-pointer', 'keyboard'] as const) {
  test(`mandatory root stumble is reached with ${mode}`, async ({ page }, info) => {
    await page.routeWebSocket('ws://127.0.0.1:5173/**', socket => socket.close());
    await page.goto('/?scene=flight');
    await page.waitForFunction(() => (window as any).game?.scene.isActive('flight'));
    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('flight');
      (window as any).stumbleEvents = [];
      scene.v.on('animationstart', (animation: { key: string }) => {
        if (animation.key === 'vc-stumble') (window as any).stumbleEvents.push('start');
      });
      scene.v.on('animationcomplete', (animation: { key: string }) => {
        if (animation.key === 'vc-stumble') (window as any).stumbleEvents.push('complete');
      });
    });
    if (mode === 'keyboard') await page.keyboard.down('KeyD');
    else {
      const box = (await page.locator('canvas').boundingBox())!;
      const point = mode === 'click-root' ? { x: 250, y: 136 } : { x: 310, y: 190 };
      await page.mouse.move(box.x + box.width * point.x / 640, box.y + box.height * point.y / 360);
      if (mode === 'hold-pointer') await page.mouse.down();
      else await page.mouse.click(box.x + box.width * point.x / 640, box.y + box.height * point.y / 360);
    }
    try {
      await expect.poll(() => page.evaluate(() => (window as any).stumbleEvents), { timeout: 10000 }).toContain('start');
      await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('flight').nextStation), { timeout: 3000 }).toBe(1);
      expect(await page.evaluate(() => (window as any).stumbleEvents)).toEqual(['start', 'complete']);
      expect(await page.evaluate(() => (window as any).game.scene.getScene('flight').busy)).toBe(false);
      await page.screenshot({ path: info.outputPath(`root-stumble-${mode}.png`) });
    } finally {
      if (mode === 'hold-pointer') await page.mouse.up();
      if (mode === 'keyboard') await page.keyboard.up('KeyD');
    }
    // The next stretch remains reachable by the same controls after the fall.
    const previous = await page.evaluate(() => (window as any).game.scene.getScene('flight').dist);
    const box = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(box.x + box.width * 390 / 640, box.y + box.height * 230 / 360);
    await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('flight').dist)).toBeGreaterThan(previous + 10);
    expect(await page.evaluate(() => (window as any).stumbleEvents)).toEqual(['start', 'complete']);
  });
}
