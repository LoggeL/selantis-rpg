import { test, expect, type Page } from '@playwright/test';
import { CAMPAIGN_CHECKPOINTS } from '../src/modules/campaign/checkpoints';

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
});

async function worldReady(page: Page) {
  await page.waitForFunction(() => {
    const game = (window as any).game, scene = game?.scene?.getScene('world');
    return scene?.sys.isActive() && scene.lia?.active && !scene.load.isLoading();
  });
}

test('debug pauses movement, warps, applies flags and inventory, and restores input', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?scene=world&map=wiese');
  await worldReady(page);
  await page.getByRole('button', { name: 'Debug · Playtest' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const before = await page.evaluate(() => { const s = (window as any).game.scene.getScene('world'); return [s.lia.x, s.lia.y]; });
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => { const s = (window as any).game.scene.getScene('world'); return [s.lia.x, s.lia.y, s.input.enabled, s.input.keyboard.enabled]; })).toEqual([...before, false, false]);
  await page.getByLabel('Einstieg').selectOption('camp');
  await page.getByRole('button', { name: 'Zum Einstieg' }).click();
  await page.waitForFunction(() => (window as any).game.scene.isActive('journey'));
  expect(await page.evaluate(() => (window as any).game.scene.getScene('journey').inCamp)).toBe(true);
  await page.getByRole('button', { name: 'Debug · Playtest' }).click();
  await page.getByLabel('journeyCloakSpread', { exact: true }).check();
  await page.getByLabel('Proviant', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Änderungen anwenden' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.waitForFunction(() => (window as any).game.scene.isActive('journey'));
  expect(await page.evaluate(() => { const g = (window as any).game; return [g.registry.get('world').flags.journeyCloakSpread, g.registry.get('world').inv.proviant, g.scene.getScene('journey').input.enabled, g.scene.getScene('journey').input.keyboard.enabled]; })).toEqual([true, 4, true, true]);
  await page.keyboard.press('F2');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.keyboard.press('KeyO');
  await page.waitForFunction(() => (window as any).game.scene.isActive('Settings'));
  await page.getByRole('button', { name: 'Debug · Playtest' }).click();
  await expect(page.locator('#playtest-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

for (const [id] of CAMPAIGN_CHECKPOINTS) {
  test(`authored phone checkpoint ${id} creates its playable destination and restores input`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?scene=world');
    await worldReady(page);
    await page.getByRole('button', { name: 'Debug · Playtest' }).click();
    await expect(page.getByLabel('Einstieg').locator('option')).toHaveCount(CAMPAIGN_CHECKPOINTS.length);
    await page.getByLabel('Einstieg').selectOption(id);
    await page.getByRole('button', { name: 'Zum Einstieg' }).click();
    const target = id === 'world:hof' ? 'raid' : ['road', 'camp', 'strangers'].includes(id) ? 'journey' : id.split(':')[0];
    await page.waitForFunction(key => {
      const scene = (window as any).game.scene.getScene(key);
      return scene.sys.isActive() && !scene.load.isLoading() && scene.children.list.length > 0 && scene.input?.enabled && scene.input.keyboard?.enabled;
    }, target);
    expect(await page.evaluate(key => { const s = (window as any).game.scene.getScene(key); return [s.input.enabled, s.input.keyboard.enabled]; }, target)).toEqual([true, true]);
    expect(errors).toEqual([]);
  });
}

test('phone campaign reset requires explicit confirmation and returns to the title', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?scene=world');
  await worldReady(page);
  await page.getByRole('button', { name: 'Debug · Playtest' }).click();
  await expect(page.getByRole('button', { name: 'Alles zurücksetzen · Titel' })).toBeDisabled();
  await page.getByLabel('Fortschritt wirklich zurücksetzen').check();
  await page.getByRole('button', { name: 'Alles zurücksetzen · Titel' }).click();
  await page.waitForFunction(() => (window as any).game.scene.isActive('title'));
  expect(await page.evaluate(() => (window as any).game.registry.get('world'))).toBeUndefined();
  expect(errors).toEqual([]);
});
