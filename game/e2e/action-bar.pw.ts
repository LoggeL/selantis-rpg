import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`action bar opens bag and group without moving the player (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?scene=world&map=wiese');
    const bar = page.getByRole('navigation', { name: 'Fähigkeiten und Inventar' });
    await expect(bar).toBeVisible();
    const canvas = (await page.locator('canvas').boundingBox())!, bounds = (await bar.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await expect(bar.locator('[data-key="Q"]')).toBeHidden();
    await expect(bar.locator('[data-key="R"]')).toBeHidden();
    for (const button of await bar.locator('button:visible').all()) {
      const size = (await button.boundingBox())!;
      expect(size.width).toBeGreaterThanOrEqual(44); expect(size.height).toBeGreaterThanOrEqual(44);
    }
    const location = () => page.evaluate(() => {
      const lia = (window as any).game.scene.getScene('world').lia;
      return [lia.x, lia.y];
    });
    const before = await location();
    await bar.getByRole('button', { name: 'Tasche', exact: true }).click();
    await expect(page.locator('#bag-dialog')).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Interagieren', exact: true })).toBeDisabled();
    await page.keyboard.press('ArrowDown'); expect(await location()).toEqual(before);
    await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
    await expect(page.locator('#bag-dialog')).toBeHidden();
    await expect(bar.getByRole('button', { name: 'Tasche', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#bag-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await bar.getByRole('button', { name: 'Gruppe ansehen · C', exact: true }).click();
    await expect(page.locator('#character-dialog [data-party-member]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(bar.getByRole('button', { name: 'Interagieren', exact: true })).toBeEnabled();
    expect(await location()).toEqual(before);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `${process.env.UI_QA_OUTPUT ?? '../output/qa'}/action-bar-${viewport.width}x${viewport.height}.png`, fullPage: true });
  });
}

test('battle bar reveals actual spells, selects targets and keeps spent spells disabled', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
  await page.goto('/?scene=battle');
  await page.waitForFunction(() => (window as any).game?.scene.isActive('battle'));
  const bar = page.getByRole('navigation', { name: 'Fähigkeiten und Inventar' });
  await expect(bar.locator('[data-key="Q"]')).toBeHidden();
  // Remove only the long approach; real direction and action inputs run the tutorial.
  await page.evaluate(() => (window as any).game.scene.getScene('battle').sprites.get('valentus').setPosition(160, 221));
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(() => (window as any).game.scene.getScene('battle').phase === 'busy');
  await page.keyboard.up('ArrowDown');
  await page.waitForFunction(() => (window as any).game.scene.getScene('battle').phase === 'plan');
  const beam = bar.getByRole('button', { name: 'Strahl', exact: true });
  await expect(beam).toBeEnabled(); await beam.click();
  await page.waitForFunction(() => (window as any).game.scene.getScene('battle').phase === 'beam');
  await expect(beam).toHaveAttribute('aria-pressed', 'true');
  await bar.getByRole('button', { name: 'Zurück', exact: true }).click();
  await page.waitForFunction(() => (window as any).game.scene.getScene('battle').phase === 'plan');
  await bar.getByRole('button', { name: 'Warten', exact: true }).click();
  await page.waitForFunction(() => (window as any).game.scene.getScene('battle').phase === 'facing');
  await expect(beam).toBeVisible(); await expect(beam).toBeDisabled();
  await expect(bar.getByRole('button', { name: 'Druckwelle', exact: true })).toBeDisabled();
  await bar.getByRole('button', { name: 'Zug beenden', exact: true }).click();
  await page.waitForFunction(() => (window as any).game.scene.getScene('battle').phase === 'plan');
  await expect(beam).toBeEnabled();
});

test('dialogue takes over actions and restores the gameplay bar after reading', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
  await page.goto('/?scene=lia');
  const bar = page.getByRole('navigation', { name: 'Fähigkeiten und Inventar' });
  await page.waitForFunction(() => (window as any).game?.scene.isActive('lia'));
  await expect(bar).toBeHidden();
  const action = page.locator('.mobile-action[data-key="E"]');
  // The chapter card disables input before Kyra's three held observations.
  await page.waitForFunction(() => (window as any).game.scene.getScene('lia').phase === 'kyra');
  for (const [phase, count, field] of [['kyra', 3, 'kyraLine'], ['sisters', 12, 'sisterLine']] as const) {
    for (let index = 0; index < count; index++) {
      await page.waitForFunction(({ phase, field, index }) => {
        const scene = (window as any).game.scene.getScene('lia');
        return scene.phase === phase && scene[field] === index;
      }, { phase, field, index });
      await expect(action).toBeEnabled();
      if (await page.evaluate(() => (window as any).game.scene.getScene('lia').data.get('dialogue:typing'))) {
        await action.click();
        const unchanged = await page.evaluate(({ phase, field, index }) => {
          const scene = (window as any).game.scene.getScene('lia');
          return scene.phase === phase && scene[field] === index;
        }, { phase, field, index });
        if (!unchanged) continue;
        await page.waitForFunction(() => !(window as any).game.scene.getScene('lia').data.get('dialogue:typing'));
      }
      await action.click();
    }
  }
  await page.waitForFunction(() => (window as any).game.scene.getScene('lia').phase === 'reading');
  await expect(action).toHaveAccessibleName('Buch schließen');
  await action.click();
  await page.waitForFunction(() => (window as any).game.scene.getScene('lia').phase === 'free');
  await expect(bar).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Gruppe ansehen · C', exact: true })).toBeVisible();
  await expect(bar.locator('[data-key="Q"]')).toBeHidden();
});
