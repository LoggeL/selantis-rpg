import { expect, test, type Page } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true });

async function fillsScreen(page: Page): Promise<void> {
  await expect.poll(() => page.locator('#game canvas').evaluate(c => {
    const r = c.getBoundingClientRect();
    return Math.max(Math.abs(r.left), Math.abs(r.top), Math.abs(innerWidth - r.right), Math.abs(innerHeight - r.bottom));
  })).toBeLessThan(1);
}

test('landscape rotation and browser-bar resize fill the screen without resetting the world', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/?scene=world-stress&touch=1');
  await page.waitForFunction(() => (window as any).__world?.player);
  const player = await page.evaluate(() => { const w = (window as any).__world; return { x: w.player.x, y: w.player.y }; });
  for (const size of [{ width: 844, height: 390 }, { width: 932, height: 430 }, { width: 844, height: 344 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(size); await fillsScreen(page);
    await expect.poll(() => page.evaluate(() => {
      const w = (window as any).__world, c = document.querySelector<HTMLCanvasElement>('#game canvas')!;
      const camerasMatch = [w.cam.width, w.cam.height, w.overlayCam.width, w.overlayCam.height].join(',') === [c.width, c.height, c.width, c.height].join(',');
      // Phaser pads render textures to an even size; the light layer must cover the entire canvas.
      const lightCovers = w.lighting.rt.width >= c.width && w.lighting.rt.width <= c.width + 1 && w.lighting.rt.height >= c.height && w.lighting.rt.height <= c.height + 1;
      return camerasMatch && lightCovers;
    })).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#ui')).toHaveClass(/is-portrait/);
  await page.setViewportSize({ width: 844, height: 390 }); await fillsScreen(page);
  const after = await page.evaluate(() => { const w = (window as any).__world; return { x: w.player.x, y: w.player.y }; });
  expect(after).toEqual(player);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(220); await page.keyboard.up('ArrowRight');
  await expect.poll(() => page.evaluate(() => (window as any).__world.player.x)).toBeGreaterThan(player.x + 5);
  await page.screenshot({ path: test.info().outputPath('phone-landscape.png') });
  expect(errors).toEqual([]);
});

test('real fullscreen entry and exit preserve full landscape coverage', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/?scene=world-stress&touch=1');
  await page.waitForFunction(() => (window as any).__world?.player);
  await page.getByRole('button', { name: 'Menü', exact: true }).click();
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  const toggle = page.getByRole('button', { name: 'Vollbild', exact: true });
  await toggle.click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await fillsScreen(page); await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await fillsScreen(page); await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

test('notch insets protect HUD and battle controls without narrowing the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/?scene=tactics-sandbox');
  await page.waitForFunction(() => (window as any).__tactics?.ready);
  await page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('#ui')!.style;
    s.setProperty('--safe-left', '47px'); s.setProperty('--safe-right', '47px'); s.setProperty('--safe-bottom', '21px');
    window.dispatchEvent(new Event('resize'));
  });
  await fillsScreen(page);
  for (const selector of ['.hud-btn-menu', '.tac-obj', '.tac-rot', '.tac-end']) {
    await expect.poll(() => page.locator(selector).evaluate(e => {
      const r = e.getBoundingClientRect(); return r.left >= 47 && r.right <= innerWidth - 47 && r.bottom <= innerHeight - 21;
    })).toBe(true);
  }
  await page.screenshot({ path: test.info().outputPath('battle-landscape-safe-area.png') });
});

test('small painted maps also cover a wide phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 932, height: 430 });
  await page.goto('/?scene=world-demo-2&touch=1');
  await page.waitForFunction(() => (window as any).__world?.player);
  await fillsScreen(page);
  await expect.poll(() => page.evaluate(() => {
    const w = (window as any).__world, v = w.cam.worldView;
    return v.width <= w.mapW + 1 && v.height <= w.mapH + 1 && v.x >= -1 && v.y >= -1 && v.right <= w.mapW + 1 && v.bottom <= w.mapH + 1;
  })).toBe(true);
  await page.screenshot({ path: test.info().outputPath('small-map-landscape.png') });
});
