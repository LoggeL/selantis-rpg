import { expect, test } from '@playwright/test';

test('title defers chapter art and real transitions load usable scene packs', async ({ page }) => {
  test.setTimeout(60_000);
  const requests = new Set<string>();
  const errors: string[] = [];
  page.on('request', request => requests.add(new URL(request.url()).pathname));
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
  await page.addInitScript(() => localStorage.setItem('selantis.settings.v1', JSON.stringify({ reducedMotion: true })));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).game?.scene?.isActive('title'));
  const futureFiles = [
    'assets/cut/prologue-power.png', 'assets/sprites/valentus-walk.png',
    'assets/bg/first-camp-evening-unbuilt.png', 'assets/bg/companion-forest-trail.png',
    'assets/sprites/foltan-walk.png', 'assets/sprites/azar-walk.png',
  ];
  const requested = (file: string) => [...requests].some(path => path.endsWith(`/${file}`));
  for (const file of futureFiles) expect(requested(file), `${file} must be deferred at title`).toBe(false);

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).game.scene.isActive('storyprologue'));
  expect(requested('assets/cut/prologue-power.png')).toBe(true);
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('storyprologue');
    return { card: scene.data.get('story:prologue').id, loaded: scene.textures.exists('prologue-power') };
  })).toEqual({ card: 'power', loaded: true });
  expect(requested('assets/bg/companion-forest-trail.png')).toBe(false);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as any).game.scene.isActive('battle'));
  expect(requested('assets/sprites/valentus-walk.png')).toBe(true);
  expect(await page.evaluate(() => (window as any).game.scene.getScene('battle').textures.exists('valentus-walk'))).toBe(true);

  // The supported playtest UI exercises the same scene-loading path used by
  // chapter transitions, without completing an unrelated full battle here.
  await page.getByRole('button', { name: 'Debug · Playtest' }).click();
  await page.getByLabel('Einstieg').selectOption('camp');
  await page.getByRole('button', { name: 'Zum Einstieg' }).click();
  await page.waitForFunction(() => (window as any).game.scene.isActive('journey') && (window as any).game.scene.getScene('journey').inCamp);
  expect(requested('assets/bg/first-camp-evening-unbuilt.png')).toBe(true);
  const canvas = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(canvas.x + canvas.width * 233 / 640, canvas.y + canvas.height * 260 / 360);
  await page.waitForFunction(() => (window as any).game.scene.getScene('journey').campStep === 'stones');
  expect(requested('assets/bg/companion-forest-trail.png')).toBe(false);

  await page.getByRole('button', { name: 'Debug · Playtest' }).click();
  await page.getByLabel('Einstieg').selectOption('companions-road');
  await page.getByRole('button', { name: 'Zum Einstieg' }).click();
  await page.waitForFunction(() => (window as any).game.scene.isActive('companions-road'));
  for (const file of futureFiles.slice(3)) expect(requested(file), `${file} must load for the later chapter`).toBe(true);
  await page.getByRole('button', { name: 'Gruppe ansehen · C' }).click();
  await expect(page.locator('#character-dialog [data-party-member]')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Debug · Playtest' }).click();
  await page.getByLabel('Einstieg').selectOption('camp');
  await page.getByRole('button', { name: 'Zum Einstieg' }).click();
  await page.waitForFunction(() => (window as any).game.scene.isActive('journey'));
  expect(await page.evaluate(() => (window as any).game.registry.get('assets:pack:journey'))).toMatchObject({
    pack: 'journey', requestedIds: [], requestedGraphicBytes: 0,
  });
  expect(errors).toEqual([]);
});
