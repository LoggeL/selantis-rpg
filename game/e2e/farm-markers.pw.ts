import { test, expect, type Page } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1280, height: 800, mobile: false },
  { name: 'phone portrait', width: 390, height: 844, mobile: true },
  { name: 'phone landscape', width: 844, height: 390, mobile: true },
];

async function markers(page: Page) {
  return page.evaluate(() => Object.fromEntries((window as any).game.scene.getScene('aftermath').markers
    .map(({ spot, object }: any) => [spot.id, object.visible])));
}

async function completeGrief(page: Page, interact: () => Promise<void>) {
  const beats = ['night-stones', 'night-wounds', 'night-thoughts', 'dawn-graves', 'dawn-farewell', 'dawn-preparation'];
  for (const [index, step] of beats.entries()) {
    await expect.poll(() => page.evaluate(() =>
      (window as any).game.scene.getScene('aftermath').data.get('story:grief')))
      .toMatchObject({ active: true, index, step, ready: true });
    expect(await page.evaluate(() => (window as any).game.scene.getScene('aftermath').locked)).toBe(true);
    if (await page.evaluate(() => (window as any).game.scene.getScene('aftermath').data.get('dialogue:typing'))) {
      await interact();
      const current = await page.evaluate(() => (window as any).game.scene.getScene('aftermath').data.get('story:grief'));
      if (!current.active || current.index !== index) continue;
      await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').data.get('dialogue:typing'));
    }
    await interact();
  }
  await expect.poll(() => page.evaluate(() =>
    (window as any).game.scene.getScene('aftermath').data.get('story:grief'))).toMatchObject({ active: false, step: 'complete' });
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('aftermath');
    return [scene.locked, scene.st.flags.aftermathGriefSeen];
  })).toEqual([false, true]);
}

for (const viewport of viewports) {
  test(`Completed farm markers disappear while the house stays enterable on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(45_000);
    await page.setViewportSize(viewport);
    await page.routeWebSocket(/127\.0\.0\.1:\d+/, socket => socket.close());
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?scene=aftermath');
    await page.waitForFunction(() => {
      const scene = (window as any).game?.scene.getScene('aftermath');
      return scene?.scene.isActive() && scene.input.keyboard.enabled && !scene.cameras.main.fadeEffect.isRunning;
    });
    const interact = async () => {
      if (viewport.mobile) await page.locator('.mobile-action[data-key="E"]').click();
      else await page.keyboard.press('KeyE', { delay: 50 });
    };
    await completeGrief(page, interact);
    // Placement removes walking time; each action uses the real keyboard/touch path.
    const use = async (x: number, y: number) => {
      await page.evaluate(([x, y]) => (window as any).game.scene.getScene('aftermath').lia.setPosition(x, y), [x, y]);
      await interact();
    };
    await expect.poll(() => markers(page)).toMatchObject({ door: true, 'pig-gate': true, 'grave-mother': true, 'grave-father': true });
    expect(await page.evaluate(() => (window as any).game.scene.getScene('aftermath').areaRoot.list.filter((object: any) => object.type === 'Graphics' && object.depth === 800).length)).toBe(0);
    await use(220, 270);
    await page.waitForFunction(() => (window as any).game.scene.getScene('aftermath').closeup?.hasCaption);
    expect(await page.evaluate(() => (window as any).game.registry.get('world').picked['farewell-mother'])).toBeUndefined();
    if (await page.evaluate(() => (window as any).game.scene.getScene('aftermath').data.get('dialogue:typing'))) await interact();
    await interact();
    await expect.poll(() => markers(page)).toMatchObject({ 'grave-mother': false, 'grave-father': true, door: true, 'pig-gate': true });
    await use(283, 270);
    if (await page.evaluate(() => (window as any).game.scene.getScene('aftermath').data.get('dialogue:typing'))) await interact();
    await interact();
    await expect.poll(() => markers(page)).toMatchObject({ 'grave-mother': false, 'grave-father': false, door: true, 'pig-gate': true });
    await use(154, 108);
    await expect.poll(() => markers(page)).toMatchObject({ 'pig-gate': false, door: true });
    await page.screenshot({ path: `../output/qa/farm-farewell-complete-${viewport.width}x${viewport.height}.png`, fullPage: true });
    await use(273, 198);
    await page.waitForFunction(() => (window as any).game.scene.getScene('aftermath').inside);
    const pickups = [
      [142, 216, 'clothing'], [431, 188, 'food'], [518, 176, 'water'],
      [505, 201, 'cupboard'], [145, 145, 'medicine'], [289, 210, 'books'],
    ] as const;
    for (const [x, y, id] of pickups) {
      await use(x, y);
      await expect.poll(() => markers(page)).not.toHaveProperty(id);
    }
    const inventory = { proviant: 1, wasserschlauch: 1, kupfer: 22, silber: 7, dolch: 1, heilzeug: 1, reisezeug: 1, 'buch-kraeuter': 1, 'buch-alana': 1 };
    expect(await page.evaluate(() => (window as any).game.registry.get('world').inv)).toEqual(inventory);
    await use(310, 306);
    await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').inside);
    await expect.poll(() => markers(page)).toMatchObject({ door: false, 'pig-gate': false, 'grave-mother': false, 'grave-father': false, 'east-departure': true });
    expect(await page.evaluate(() => (window as any).game.scene.getScene('aftermath').areaRoot.list.filter((object: any) => object.type === 'Graphics' && object.depth === 800).length)).toBe(0);
    await page.screenshot({ path: `../output/qa/farm-packed-markers-${viewport.width}x${viewport.height}.png`, fullPage: true });
    await use(273, 198);
    await page.waitForFunction(() => (window as any).game.scene.getScene('aftermath').inside);
    expect(await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('aftermath');
      return { items: scene.houseItems.size, markers: scene.markers.map((marker: any) => marker.spot.id), inventory: scene.st.inv };
    })).toEqual({ items: 0, markers: ['exit-door'], inventory });
    await use(310, 306);
    await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').inside);
    await expect.poll(() => markers(page)).toMatchObject({ door: false, 'pig-gate': false, 'grave-mother': false, 'grave-father': false });
    expect(await page.evaluate(() => (window as any).game.registry.get('world').inv)).toEqual(inventory);
    expect(errors).toEqual([]);
  });
}
