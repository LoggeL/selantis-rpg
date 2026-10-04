import { test, expect, type Page } from '@playwright/test';

async function roadClick(page: Page, x: number, y: number) {
  const bounds = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width * x / 640, bounds.y + bounds.height * y / 360);
}

test('north road trail supports walking, field return and eastward progress on revisit', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?scene=journey');
  await page.waitForFunction(() => (window as any).game?.scene.isActive('journey'));
  // Direct road debug entry represents travel after the raid and packing.
  await page.evaluate(() => { (window as any).game.registry.get('world').flags.raidWitnessed = true; });
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('journey');
    return [scene.lia.x, scene.lia.y];
  })).toEqual([390, 70]);
  await page.screenshot({ path: '../output/qa/journey-10-north-arrival.png', fullPage: true });

  // Keyboard motion traverses the actual northern path before pointer routing.
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(() => (window as any).game.scene.getScene('journey').lia.y > 105);
  await page.keyboard.up('ArrowDown');
  await roadClick(page, 370, 193);
  await page.waitForFunction(() => (window as any).game.scene.getScene('journey').lia.y > 188);
  await roadClick(page, 243, 235);
  await page.waitForFunction(() => (window as any).game.registry.get('world').flags.streamVisited, undefined, { timeout: 7000 });
  await roadClick(page, 435, 184);
  await page.waitForFunction(() => (window as any).game.registry.get('world').flags.journeyEastChosen, undefined, { timeout: 7000 });

  const before = await page.evaluate(() => JSON.stringify((window as any).game.registry.get('world')));
  await roadClick(page, 414, 14);
  await page.waitForFunction(() => (window as any).game.scene.isActive('world'), undefined, { timeout: 8000 });
  expect(await page.evaluate(() => {
    const game = (window as any).game, scene = game.scene.getScene('world');
    return { map: scene.map.id, position: [scene.lia.x, scene.lia.y], facing: scene.facing, state: JSON.stringify(game.registry.get('world')) };
  })).toEqual({ map: 'felder', position: [615, 286], facing: 'w', state: before });
  await page.screenshot({ path: '../output/qa/journey-10-field-return.png', fullPage: true });

  // Field exit is crossed by normal input; no scene or position teleport.
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => (window as any).game.scene.isActive('journey'), undefined, { timeout: 3000 });
  await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(() => {
    const game = (window as any).game, scene = game.scene.getScene('journey');
    return { position: [scene.lia.x, scene.lia.y], objective: scene.data.get('mobile:objective'), state: JSON.stringify(game.registry.get('world')) };
  })).toEqual({ position: [390, 70], objective: 'Nach Osten bis zum Wald gehen.', state: before });
  await roadClick(page, 590, 193);
  await page.waitForFunction(() => (window as any).game.scene.getScene('journey').inCamp, undefined, { timeout: 10000 });
  expect(errors).toEqual([]);
});
