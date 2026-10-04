import { expect, test } from '@playwright/test';
import { restartScene } from './helpers/scenes';

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
  // Settled text makes every physical press an advance, so duplicate handlers
  // cannot be concealed by the typewriter consuming an extra press.
  await page.addInitScript(() => localStorage.setItem('selantis.settings.v1', JSON.stringify({ reducedMotion: true })));
});

test('a restarted prologue advances exactly one card per physical key press', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?scene=storyprologue');
  const index = () => page.evaluate(() => (window as any).game.scene.getScene('storyprologue').data.get('story:prologue').index);
  await page.waitForFunction(() => (window as any).game?.scene?.isActive('storyprologue'));

  for (let reentry = 0; reentry < 4; reentry++) {
    if (reentry) {
      await restartScene(page, 'storyprologue');
      await expect.poll(index).toBe(0);
    }
    await page.keyboard.press('KeyE');
    await expect.poll(index).toBe(1);
    await page.keyboard.press('Space');
    await expect.poll(index).toBe(2);
    await page.keyboard.press('Enter');
    await expect.poll(index).toBe(3);
  }
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => (window as any).game.scene.isActive('battle'));
  expect(errors).toEqual([]);
});

test('a restarted exploration scene opens and closes the bag once per physical input', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?scene=world&map=wiese');
  await page.waitForFunction(() => (window as any).game?.scene?.isActive('world'));
  const bag = page.locator('#bag-dialog');
  for (let reentry = 0; reentry < 4; reentry++) {
    if (reentry) {
      // Keep the real registry and run Phaser shutdown/create every time.
      await restartScene(page, 'world', { map: 'wiese' });
      await page.waitForFunction(() => (window as any).game.scene.isActive('world'));
    }
    await expect(bag).not.toBeVisible();
    await page.keyboard.press('KeyI');
    await expect(bag, `physical I opens one bag after reentry ${reentry}`).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zurück zum Spiel', exact: true })).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(bag).toBeHidden();
    await page.getByRole('button', { name: 'Tasche', exact: true }).click();
    await expect(bag, `Tasche opens one bag after reentry ${reentry}`).toBeVisible();
    await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
    await expect(bag).toBeHidden();
  }
  expect(errors).toEqual([]);
});
