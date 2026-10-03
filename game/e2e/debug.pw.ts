import { test, expect } from '@playwright/test';

test('debug pauses movement, warps, applies flags and inventory, and restores input', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/?scene=world&map=wiese');
  await page.waitForFunction(() => (window as any).game?.scene.isActive('world'));
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

test('all authored warps are playable on a phone and reset requires confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/?scene=world');
  await page.waitForFunction(() => (window as any).game?.scene.isActive('world'));
  await page.getByRole('button', { name: 'Debug · Playtest' }).click();
  const ids = await page.getByLabel('Einstieg').locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  await page.getByRole('button', { name: 'Schließen · Esc' }).click();
  for (const id of ids) {
    await page.getByRole('button', { name: 'Debug · Playtest' }).click();
    await page.getByLabel('Einstieg').selectOption(id);
    await page.getByRole('button', { name: 'Zum Einstieg' }).click();
    const target = ['road', 'camp', 'strangers'].includes(id) ? 'journey' : id.split(':')[0];
    await page.waitForFunction(key => (window as any).game.scene.isActive(key), target);
    expect(await page.evaluate(key => { const s = (window as any).game.scene.getScene(key); return [s.input.enabled, s.input.keyboard.enabled]; }, target)).toEqual([true, true]);
  }
  await page.getByRole('button', { name: 'Debug · Playtest' }).click();
  await expect(page.getByRole('button', { name: 'Alles zurücksetzen · Titel' })).toBeDisabled();
  await page.getByLabel('Fortschritt wirklich zurücksetzen').check();
  await page.getByRole('button', { name: 'Alles zurücksetzen · Titel' }).click();
  await page.waitForFunction(() => (window as any).game.scene.isActive('title'));
  expect(await page.evaluate(() => (window as any).game.registry.get('world'))).toBeUndefined();
  expect(errors).toEqual([]);
});
