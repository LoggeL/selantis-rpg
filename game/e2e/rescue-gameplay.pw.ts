import { expect, test } from '@playwright/test';
import { rescueField, rescueRound, rescueSnapshot, selectRescueAlly, waitForRescue, winRescue } from './helpers/rescue';

// Keep each run on its initial source while parallel QA agents edit other scenes.
test.beforeEach(async ({ page }) => { await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {}); });

const output = '../output/qa/visual-playtest/gameplay-rescue';
async function clickCanvas(page: import('@playwright/test').Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + x / 640 * box.width, box.y + y / 360 * box.height);
}
for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`real tactical rescue win at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(80_000); await page.setViewportSize(viewport);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?scene=rescue-battle'); await waitForRescue(page);
    await page.screenshot({ path: `${output}/opening-${viewport.width}x${viewport.height}.png`, fullPage: true });
    await winRescue(page, { touch: viewport.width <= 900 });
    const result = await rescueSnapshot(page);
    expect(result).toMatchObject({ phase: 'won', round: 3, freed: true });
    expect(result.units.find((unit: any) => unit.id === 'kyra').hp).toBe(18);
    expect(await page.evaluate(() => (window as any).game.scene.getScene('rescue-battle').data.get('rescue:last-enemy-events').find((event: any) => event.actor === 'captain' && event.damage))).toMatchObject({ target: 'lia', damage: 5 });
    expect(result.units.find((unit: any) => unit.id === 'captain').hp).toBe(30);
    expect(result.units.find((unit: any) => unit.id === 'guard').hp).toBe(16);
    expect(await page.evaluate(() => (window as any).game.registry.get('world').flags['film.magic-erupted'])).not.toBe(true);
    await expect(page.getByRole('button', { name: 'Geschichte fortsetzen', exact: true })).toBeVisible();
    await page.screenshot({ path: `${output}/won-${viewport.width}x${viewport.height}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('real failed rescue retries with fresh budgets, preserves campaign state and can then win', async ({ page }) => {
  test.setTimeout(70_000); await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?scene=rescue-battle'); await waitForRescue(page);
  const campaign = await page.evaluate(() => JSON.stringify((window as any).game.registry.get('world')));
  await rescueField(page, 4, 1); expect((await rescueSnapshot(page)).budgets.lia.moved).toBe(false);
  await rescueField(page, 4, 3); await rescueField(page, 5, 3);
  expect((await rescueSnapshot(page)).units.find((unit: any) => unit.id === 'lia').cell).toEqual({ x: 4, y: 3 });
  await selectRescueAlly(page, 'flick'); await rescueField(page, 7, 1);
  await rescueRound(page); await rescueRound(page); await rescueRound(page, 'failed');
  expect((await rescueSnapshot(page)).units.find((unit: any) => unit.id === 'kyra').hp).toBe(0);
  expect(await page.evaluate(() => JSON.stringify((window as any).game.registry.get('world')))).toBe(campaign);
  await page.screenshot({ path: `${output}/failed-desktop.png`, fullPage: true });
  await clickCanvas(page, 512, 271); await waitForRescue(page);
  expect(await rescueSnapshot(page)).toMatchObject({ round: 1, freed: false, budgets: { lia: { moved: false, acted: false }, flick: { moved: false, acted: false } } });
  await winRescue(page);
  expect(await page.evaluate(() => JSON.stringify((window as any).game.registry.get('world')))).toBe(campaign);
});

test('chapter rescue abort and failure leave Kyra bound; only the real win completes the action and preserves inventory', async ({ page }) => {
  test.setTimeout(100_000); await page.setViewportSize({ width: 1280, height: 800 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?scene=sisters-reunited');
  await page.waitForFunction(() => (window as any).game?.scene.getScene('sisters-reunited').data.get('story:continuation'));
  for (let i = 0; i < 12; i++) {
    const talking = await page.evaluate(() => (window as any).game.scene.getScene('sisters-reunited').data.get('story:continuation').talking);
    if (!talking) break;
    await page.keyboard.press('KeyE'); await page.waitForTimeout(100);
  }
  const original = await page.evaluate(() => ({ inv: (window as any).game.registry.get('world').inv, picked: (window as any).game.registry.get('world').picked }));
  expect(original.inv).toMatchObject({ proviant: 1, dolch: 1, kupfer: 22, 'buch-kraeuter': 1 });
  const launch = async () => {
    const position = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('sisters-reunited');
      const action = scene.data.get('story:continuation').actions.find((action: any) => action.id === 'hold-guards-attention');
      const point = scene.areaRoot.getWorldTransformMatrix().transformPoint(action.at[0], action.at[1]);
      return [point.x, point.y];
    });
    const box = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(box.x + position[0] / 640 * box.width, box.y + position[1] / 360 * box.height);
    await waitForRescue(page);
    expect(await page.evaluate(() => (window as any).game.scene.isSleeping('sisters-reunited'))).toBe(true);
  };
  const returned = async () => {
    await page.waitForFunction(() => (window as any).game.scene.isActive('sisters-reunited') && !(window as any).game.scene.isActive('rescue-battle'));
    const chapter = await page.evaluate(() => (window as any).game.scene.getScene('sisters-reunited').data.get('story:continuation'));
    expect(chapter.actors.find((actor: any) => actor.id === 'kyra')).toMatchObject({ bound: true, frame: 1 });
    expect(await page.evaluate(() => (window as any).game.registry.get('world').flags['film.kyra-unbound'])).not.toBe(true);
  };
  await launch(); await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await clickCanvas(page, 512, 302);
  await expect(page.getByRole('button', { name: 'Abbrechen', exact: true })).toBeVisible();
  expect((await rescueSnapshot(page)).round).toBe(1);
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click(); await clickCanvas(page, 512, 271); await returned();
  await launch(); await selectRescueAlly(page, 'flick'); await rescueField(page, 7, 1);
  await rescueRound(page); await rescueRound(page); await rescueRound(page, 'failed');
  await clickCanvas(page, 512, 302); await returned();
  await launch(); await winRescue(page);
  await clickCanvas(page, 512, 302);
  await page.waitForFunction(() => (window as any).game.scene.isActive('sisters-reunited') && !(window as any).game.scene.isActive('rescue-battle'));
  expect(await page.evaluate(() => (window as any).game.registry.get('world').flags['film.kyra-unbound'])).toBe(true);
  expect(await page.evaluate(() => (window as any).game.registry.get('world').flags['film.magic-erupted'])).not.toBe(true);
  expect(await page.evaluate(() => ({ inv: (window as any).game.registry.get('world').inv, picked: (window as any).game.registry.get('world').picked }))).toEqual(original);
  expect(errors).toEqual([]);
});

test('desktop canvas actions respect the movement lock and activate normally after the walk', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?scene=rescue-battle'); await waitForRescue(page);
  const box = (await page.locator('canvas').boundingBox())!;
  const click = (x: number, y: number) => page.mouse.click(box.x + x / 640 * box.width, box.y + y / 360 * box.height);
  const visual = () => page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('rescue-battle');
    return { animating: scene.data.get('rescue:animating'), x: scene.sprites.get('lia').x, y: scene.sprites.get('lia').y };
  });
  // Three cell steps give an observable walk. The following clicks hit actual
  // canvas buttons while the same scene scope still owns the movement lock.
  await click(200, 226);
  await click(512, 271);
  await click(512, 302);
  const walking = await visual();
  expect(walking.animating).toBe(true);
  expect(walking.x).toBeLessThan(200);
  expect(walking.x).toBeGreaterThanOrEqual(80);
  expect(await rescueSnapshot(page)).toMatchObject({ phase: 'player', budgets: { lia: { moved: true, acted: false } }, guarding: [] });
  await page.waitForFunction(() => !(window as any).game.scene.getScene('rescue-battle').data.get('rescue:animating'));
  expect(await visual()).toMatchObject({ animating: false, x: 200, y: 238 });
  await click(512, 271);
  expect(await rescueSnapshot(page)).toMatchObject({ phase: 'player', budgets: { lia: { moved: true, acted: true } }, guarding: ['lia'] });
  await click(512, 302);
  await expect.poll(async () => (await rescueSnapshot(page)).phase).toBe('enemy');
  await expect.poll(async () => (await rescueSnapshot(page)).round).toBe(2);
  expect(errors).toEqual([]);
});
