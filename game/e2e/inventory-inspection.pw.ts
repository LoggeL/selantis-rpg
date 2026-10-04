import { expect, test } from '@playwright/test';
import { ITEM_ORDER, ITEM_NAMES } from '../src/modules/inventory/catalog';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`each carried item responds to pointer and keyboard (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.routeWebSocket(/127\.0\.0\.1:\d+/, socket => socket.close());
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?scene=camp');
    await page.waitForFunction(() => (window as any).game?.scene?.isActive('journey'));
    // All item types share the same real bag handlers; seed stacks only for coverage.
    await page.evaluate(items => {
      const game = (window as any).game, scene = game.scene.getScene('journey');
      const world = game.registry.get('world');
      world.inv = Object.fromEntries(items.map(item => [item, 2]));
      scene.inventory.refresh(world.inv);
    }, ITEM_ORDER);
    const before = await page.evaluate(() => (window as any).game.registry.get('world'));
    await page.getByRole('button', { name: 'Tasche', exact: true }).click();
    const bag = page.locator('#bag-dialog');
    await expect(bag).toBeVisible();
    for (const [index, item] of ITEM_ORDER.entries()) {
      const choice = bag.getByRole('button', { name: `${ITEM_NAMES[item]} auswählen`, exact: true });
      if (index % 2) { await choice.focus(); await page.keyboard.press(index % 4 === 1 ? 'Enter' : 'Space'); }
      else await choice.click();
      const selected = bag.locator(`[data-item="${item}"]`), comment = bag.locator(`[data-inspected-item="${item}"]`);
      await expect(selected.locator('.bag-item-select')).toHaveAttribute('aria-pressed', 'true');
      await expect(comment).toContainText('Lia:');
      await expect(comment).toBeInViewport();
      await expect(bag.getByRole('status')).toHaveCount(1);
      await expect(bag.locator('.bag-item-use')).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).game.registry.get('world'))).toEqual(before);
    }
    await page.screenshot({ path: `../output/qa/inventory-comment-${viewport.width}x${viewport.height}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await expect(bag).toBeHidden();
    expect(errors).toEqual([]);
  });
}
