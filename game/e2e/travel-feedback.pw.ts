import { test, expect, type Page } from '@playwright/test';
test.setTimeout(60000);
// A concurrent source edit must not replace the registry halfway through a journey.
// Each test still loads the latest modules on navigation.
test.beforeEach(async ({ page }) => {
  await page.routeWebSocket('ws://127.0.0.1:5173/**', socket => socket.close());
});

async function clickWorld(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * x / 640, box.y + box.height * y / 360);
}
async function waitMap(page: Page, map: string) {
  await page.waitForFunction(id => {
    const game = (window as any).game;
    return game.scene.isActive('world') && game.scene.getScene('world').map.id === id;
  }, map, { timeout: 14000 }).catch(async error => {
    console.log(await page.evaluate(() => (window as any).game.scene.getScenes(true).map((s: any) => ({ key: s.sys.settings.key, position: [s.lia?.x, s.lia?.y], destination: s.destination, spots: s.spots?.map((p: any) => p.id), locked: s.locked, leaving: s.leaving }))));
    throw error;
  });
}

async function finishGrief(page: Page) {
  // Packing and travel only become available after the player has read the
  // night and dawn sequence. Continue each held card through actual input.
  for (let index = 0; index < 6; index++) {
    await page.waitForFunction(index => {
      const scene = (window as any).game.scene.getScene('aftermath');
      const grief = scene.data.get('story:grief');
      return grief?.active && grief.index === index && grief.ready;
    }, index);
    if (await page.evaluate(() => (window as any).game.scene.getScene('aftermath').data.get('dialogue:typing'))) {
      await page.keyboard.press('KeyE', { delay: 50 });
      const unchanged = await page.evaluate(index => {
        const grief = (window as any).game.scene.getScene('aftermath').data.get('story:grief');
        return grief.active && grief.index === index;
      }, index);
      if (!unchanged) continue;
      await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').data.get('dialogue:typing'));
    }
    await page.keyboard.press('KeyE', { delay: 50 });
  }
  await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').locked);
}

test('the visible eastern branch explains the early boundary and permits retreat', async ({ page }) => {
  await page.goto('/?scene=world&map=felder');
  await waitMap(page, 'felder');
  await clickWorld(page, 636, 306);
  await page.waitForFunction(() => (window as any).game.scene.getScene('world').blockedExit === 'journey', undefined, { timeout: 10000 });
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('world');
    return { active: scene.scene.isActive('world'), busy: scene.busy, text: scene.hud.thoughtText?.text ?? scene.hud.bubbleText?.text };
  })).toMatchObject({ active: true, busy: false, text: 'Ich muss nach Hause. Bald gibt es Abendbrot, und Mutter wartet auf mich.' });
  await page.screenshot({ path: '../output/qa/travel-09-early-boundary.png', fullPage: true });
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => (window as any).game.scene.getScene('world').lia.x < 618);
  await page.keyboard.up('ArrowLeft');
  expect(await page.evaluate(() => (window as any).game.scene.getScene('world').blockedExit)).toBeUndefined();
});

test('the bereaved farm still connects to fields, meadow and sunken lane without replaying the raid', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?scene=aftermath');
  await page.waitForFunction(() => (window as any).game.scene.isActive('aftermath'));
  await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').cameras.main.fadeEffect.isRunning);
  await finishGrief(page);
  // Seed one completed packing task, then preserve it through real map travel.
  await page.evaluate(() => {
    const st = (window as any).game.registry.get('world');
    st.flags.packedFood = true; st.inv.proviant = 1;
  });
  await clickWorld(page, 596, 40);
  await waitMap(page, 'felder');
  expect(await page.evaluate(() => (window as any).game.registry.get('world').flags.departureReady)).toBe(false);
  await clickWorld(page, 636, 306);
  await page.waitForFunction(() => (window as any).game.scene.getScene('world').blockedExit === 'journey', undefined, { timeout: 5000 });
  await clickWorld(page, 500, 280);
  await page.waitForFunction(() => {
    const s = (window as any).game.scene.getScene('world');
    return s.propIndex.get('felder:hufspuren-feldweg') === 1;
  }, undefined, { timeout: 5000 });
  await page.screenshot({ path: '../output/qa/travel-09-horse-tracks.png', fullPage: true });
  await clickWorld(page, 4, 238);
  await waitMap(page, 'wiese');
  await clickWorld(page, 544, 356);
  await waitMap(page, 'hohlweg');
  await clickWorld(page, 636, 153);
  await page.waitForFunction(() => (window as any).game.scene.isActive('aftermath'), undefined, { timeout: 14000 });
  const state = await page.evaluate(() => {
    const game = (window as any).game, st = game.registry.get('world');
    return { raidActive: game.scene.isActive('raid'), flags: st.flags, inv: st.inv, visited: game.registry.get('visited') };
  });
  expect(state.raidActive).toBe(false);
  expect(state.flags).toMatchObject({ raidWitnessed: true, parentsLost: true, packedFood: true, departureReady: false });
  expect(state.inv.proviant).toBe(1);
  expect(state.visited).toMatchObject({ felder: true, wiese: true, hohlweg: true, hof: true });
  await page.screenshot({ path: '../output/qa/travel-09-farm-return.png', fullPage: true });
  expect(errors).toEqual([]);
});
