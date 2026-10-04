import { test, expect } from '@playwright/test';

test('walkthrough follows context, allows read-only selection and scrolls on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?scene=world&map=waldrand');
  await page.waitForFunction(() => (window as any).game?.scene.isActive('world'));
  const snapshot = () => page.evaluate(() => JSON.stringify((window as any).game.registry.get('world')));
  const before = await snapshot();
  await page.getByRole('button', { name: 'Debug · Playtest' }).click();
  await expect(page.getByLabel('Walkthrough für')).not.toBeVisible();
  await page.getByText('Walkthrough · Spoiler', { exact: true }).click();
  await expect(page.getByLabel('Walkthrough für')).toHaveValue('world:waldrand');
  await page.getByLabel('Walkthrough für').selectOption('battle');
  await expect(page.locator('#debug-guide-content')).toContainText('Druckwelle');
  await page.getByLabel('Walkthrough für').selectOption('strangers');
  await expect(page.locator('#debug-guide-content')).toContainText('gemeinsamer Aufbruch und Mittagsrast');
  await page.getByRole('button', { name: 'Aktueller Bereich' }).click();
  await expect(page.getByLabel('Walkthrough für')).toHaveValue('world:waldrand');
  expect(await snapshot()).toBe(before);
  expect(await page.locator('#playtest-dialog').evaluate(el => { el.scrollTop = el.scrollHeight; return el.scrollTop > 0 && el.scrollWidth <= el.clientWidth; })).toBe(true);
  await page.getByRole('button', { name: 'Schließen · Esc' }).click();
  await page.getByRole('button', { name: 'Debug · Playtest' }).click();
  await page.getByLabel('Einstieg').selectOption('strangers');
  await page.getByRole('button', { name: 'Zum Einstieg' }).click();
  await page.waitForFunction(() => (window as any).game.scene.isActive('journey'));
  await page.getByRole('button', { name: 'Debug · Playtest' }).click();
  await page.getByText('Walkthrough · Spoiler', { exact: true }).click();
  await expect(page.getByLabel('Walkthrough für')).toHaveValue('strangers');
  expect(errors).toEqual([]);
});

for (const arrival of ['hohlweg', 'felder', 'hof']) {
  test(`farm arrival from ${arrival} starts the raid before free farm exploration`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/?scene=world&map=${arrival}`);
    if (arrival !== 'hof') {
      await page.waitForFunction(() => (window as any).game?.scene.isActive('world'));
      // Start one walking step before the real map exit, then cross using input.
      await page.evaluate(arrival => {
        const scene = (window as any).game.scene.getScene('world');
        scene.lia.setPosition(...(arrival === 'hohlweg' ? [630, 155] : [510, 350]));
        (window as any).game.registry.get('world').inv.apfel = 2;
      }, arrival);
      await page.keyboard.down(arrival === 'hohlweg' ? 'ArrowRight' : 'ArrowDown');
    }
    await page.waitForFunction(() => (window as any).game?.scene.isActive('raid'), undefined, { timeout: 2000 });
    await page.keyboard.up(arrival === 'hohlweg' ? 'ArrowRight' : 'ArrowDown');
    expect(await page.evaluate(() => {
      const game = (window as any).game, scene = game.scene.getScene('raid');
      return {
        worldActive: game.scene.isActive('world'), arrived: game.registry.get('world').flags.homeArrived,
        objective: scene.data.get('mobile:objective'), phase: scene.data.get('story:raid').phase,
        parentsPresent: [scene.mother, scene.father].every(actor => actor.active && actor.visible),
        raidersPresent: scene.raiders.filter(actor => actor.active && actor.visible).length,
        crouched: scene.data.get('story:lia-crouched'),
      };
    })).toMatchObject({
      worldActive: false, arrived: true, phase: 'approach', parentsPresent: true, raidersPresent: 4,
      crouched: true, objective: 'In der Böschung links am Weg verstecken.',
    });
    // Holding movement towards the house cannot cross the armed courtyard.
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(750);
    await page.keyboard.up('ArrowRight');
    expect(await page.evaluate(() => (window as any).game.scene.getScene('raid').lia.x)).toBeLessThanOrEqual(174);
    await page.screenshot({ path: `../output/qa/arrival-04-${arrival}.png`, fullPage: true });
    const bounds = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(bounds.x + bounds.width * 104 / 640, bounds.y + bounds.height * 185 / 360);
    await page.waitForFunction(() => (window as any).game.scene.getScene('raid').data.get('story:raid').phase === 'hidden');
    expect(errors).toEqual([]);
  });
}
