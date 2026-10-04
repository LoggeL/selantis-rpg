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
  test.describe(`farm markers ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.mobile });
    const enterFarm = async (page: Page) => {
      await page.routeWebSocket(/127\.0\.0\.1:\d+/, socket => socket.close());
      await page.goto('/?scene=aftermath');
      await page.waitForFunction(() => {
        const scene = (window as any).game?.scene?.getScene('aftermath');
        return scene?.scene.isActive() && scene.input.keyboard.enabled && !scene.cameras.main.fadeEffect.isRunning;
      });
      const interact = async () => {
        if (viewport.mobile) await page.locator('.mobile-action[data-key="E"]').tap();
        else await page.keyboard.press('KeyE', { delay: 50 });
      };
      await completeGrief(page, interact);
      return interact;
    };
    const use = async (page: Page, id: string) => {
      const frame = await page.evaluate(() => (window as any).game.loop.frame);
      await page.waitForFunction(frame => (window as any).game.loop.frame > frame + 3, frame);
      const at = await page.evaluate(id => (window as any).game.scene.getScene('aftermath').spots.find((spot: any) => spot.id === id).at, id);
      const canvas = (await page.locator('canvas').boundingBox())!;
      const x = canvas.x + canvas.width * at[0] / 640, y = canvas.y + canvas.height * at[1] / 360;
      if (viewport.mobile) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
    };
    const noOverlayMarkers = async (page: Page) => expect(await page.evaluate(() =>
      (window as any).game.scene.getScene('aftermath').areaRoot.list.filter((object: any) => object.type === 'Graphics' && object.depth === 800).length)).toBe(0);

    test('farewell and gate markers disappear after their actual interactions', async ({ page }) => {
      test.setTimeout(45_000);
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      const interact = await enterFarm(page);
      await expect.poll(() => markers(page)).toMatchObject({ door: true, 'pig-gate': true, 'grave-mother': true, 'grave-father': true });
      await noOverlayMarkers(page);
      for (const [id, picked] of [['grave-mother', 'farewell-mother'], ['grave-father', 'farewell-father']]) {
        await use(page, id);
        await page.waitForFunction(() => (window as any).game.scene.getScene('aftermath').closeup?.hasCaption);
        expect(await page.evaluate(picked => (window as any).game.registry.get('world').picked[picked], picked)).toBeUndefined();
        // The farewell is a held card. Let its short line settle before closing.
        await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').data.get('dialogue:typing'));
        await interact();
        await expect.poll(() => markers(page)).toHaveProperty(id, false);
      }
      await use(page, 'pig-gate');
      await expect.poll(() => markers(page)).toMatchObject({ 'grave-mother': false, 'grave-father': false, 'pig-gate': false, door: true });
      await page.screenshot({ path: `../output/qa/farm-farewell-complete-${viewport.width}x${viewport.height}.png`, fullPage: true });
      expect(errors).toEqual([]);
    });

    test('packed house loses its task marker and stays enterable without duplicate items', async ({ page }) => {
      // This case includes walking across the room for six pickups and two door
      // returns. The separate farewell case owns the optional grave cards.
      test.setTimeout(60_000);
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await enterFarm(page);
      await use(page, 'door');
      await page.waitForFunction(() => (window as any).game.scene.getScene('aftermath').inside);
      for (const id of ['clothing', 'food', 'water', 'cupboard', 'medicine', 'books']) {
        await use(page, id);
        await expect.poll(() => markers(page), { timeout: 12_000 }).not.toHaveProperty(id);
      }
      const inventory = { proviant: 1, wasserschlauch: 1, kupfer: 22, silber: 7, dolch: 1, heilzeug: 1, reisezeug: 1, 'buch-kraeuter': 1, 'buch-alana': 1 };
      expect(await page.evaluate(() => (window as any).game.registry.get('world').inv)).toEqual(inventory);
      await use(page, 'exit-door');
      await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').inside);
      await use(page, 'pig-gate');
      await expect.poll(() => markers(page), { timeout: 12_000 }).toMatchObject({ door: false, 'pig-gate': false, 'grave-mother': true, 'grave-father': true, 'east-departure': true });
      await noOverlayMarkers(page);
      await page.screenshot({ path: `../output/qa/farm-packed-markers-${viewport.width}x${viewport.height}.png`, fullPage: true });
      await use(page, 'door');
      await page.waitForFunction(() => (window as any).game.scene.getScene('aftermath').inside);
      expect(await page.evaluate(() => {
        const scene = (window as any).game.scene.getScene('aftermath');
        return { items: scene.houseItems.size, markers: scene.markers.map((marker: any) => marker.spot.id), inventory: scene.st.inv };
      })).toEqual({ items: 0, markers: ['exit-door'], inventory });
      await use(page, 'exit-door');
      await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').inside);
      await expect.poll(() => markers(page)).toMatchObject({ door: false, 'pig-gate': false });
      expect(await page.evaluate(() => (window as any).game.registry.get('world').inv)).toEqual(inventory);
      expect(errors).toEqual([]);
    });
  });
}
