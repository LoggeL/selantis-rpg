import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`camp meal needs bag selection and confirmation before sleep (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?scene=journey');
    await page.waitForFunction(() => (window as any).game?.scene?.isActive('journey'));
    // Start at the completed fireplace; the actual meal is performed entirely through the bag UI.
    await page.evaluate(() => {
      const game = (window as any).game, scene = game.scene.getScene('journey');
      Object.assign(game.registry.get('world').flags, { journeyCampReached: true, journeyCloakSpread: true,
        journeyStonesGathered: true, journeyFirepitBuilt: true, journeyTwigsGathered: true, campfireLit: true });
      scene.scene.restart({ from: 'camp' });
    });
    const snapshot = () => page.evaluate(() => {
      const game = (window as any).game, scene = game.scene.getScene('journey');
      return { step: scene.campStep, world: game.registry.get('world') };
    });
    await expect.poll(async () => (await snapshot()).step).toBe('meal');
    await page.waitForTimeout(600);
    expect((await snapshot()).world.flags.journeyAte).toBeFalsy();
    await page.getByRole('button', { name: 'Tasche', exact: true }).click();
    const bag = page.locator('#bag-dialog'); await expect(bag).toBeVisible();
    await expect(bag).toContainText('Wähle Reiseproviant und dann Essen.');
    await expect(bag.getByRole('button', { name: 'Reiseproviant: Essen', exact: true })).toHaveCount(0);
    await bag.getByRole('button', { name: 'Reiseproviant auswählen', exact: true }).click();
    expect((await snapshot()).world.inv.proviant).toBe(1);
    expect((await snapshot()).world.flags.journeyAte).toBeFalsy();
    const eat = bag.getByRole('button', { name: 'Reiseproviant: Essen', exact: true });
    await expect(eat).toBeVisible();
    const bounds = (await eat.boundingBox())!; expect(bounds.height).toBeGreaterThanOrEqual(44);
    const itemName = (await bag.locator('[data-item="proviant"] .bag-item-name').boundingBox())!;
    const itemViewport = (await bag.locator('.bag-items').boundingBox())!;
    expect(itemName.y).toBeGreaterThanOrEqual(itemViewport.y);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(itemViewport.y + itemViewport.height);
    await page.screenshot({ path: `../output/qa/camp-meal-${viewport.width}x${viewport.height}-choose.png`, fullPage: true });
    await eat.click();
    await expect(bag).toBeHidden();
    expect(await snapshot()).toMatchObject({ step: 'sleep', world: { flags: { journeyAte: true, journeyProviantPortionUsed: true } } });
    expect((await snapshot()).world.inv.proviant).toBeUndefined();
    await page.waitForTimeout(600); expect((await snapshot()).world.flags.firstCampRested).toBeFalsy();
    await page.getByRole('button', { name: 'Tasche', exact: true }).click();
    await expect(bag.getByRole('button', { name: 'Reiseproviant: Essen', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
    expect(errors).toEqual([]);
  });
}
