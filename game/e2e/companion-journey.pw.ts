import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
});

async function clickMap(page: Page, x: number, y: number) {
  const bounds = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width * x / 640, bounds.y + bounds.height * y / 360);
}

test('the morning forest walk, noon rest and afternoon stretch preserve supplies and permit backtracking', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?scene=companions-road');
  await page.waitForFunction(() => (window as any).game?.scene?.isActive('companions-road'));
  expect(await page.evaluate(() => (window as any).game.registry.get('world').flags.metFoltanAzar)).toBe(true);
  await page.getByRole('button', { name: 'Gruppe ansehen · C' }).click();
  await expect(page.locator('#character-dialog [data-party-member]')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Foltan ansehen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Azar ansehen' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('companions-road');
    scene.data.set('qa:max-party-gap', 0);
    scene.events.on('postupdate', () => {
      if (scene.talking || !scene.lia?.active) return;
      for (const actor of [scene.foltan, scene.azar]) if (actor?.active) {
        scene.data.set('qa:max-party-gap', Math.max(scene.data.get('qa:max-party-gap'), Math.hypot(actor.x - scene.lia.x, actor.y - scene.lia.y)));
      }
    });
  });
  const before = await page.evaluate(() => {
    const st = (window as any).game.registry.get('world');
    return { inv: JSON.stringify(st.inv), picked: JSON.stringify(st.picked), flags: { ...st.flags } };
  });
  await clickMap(page, 100, 198);
  await page.waitForFunction(() => (window as any).game.registry.get('world').flags.companionBreakfastRemembered);
  // Close the optional dialogue with real player input before issuing a route.
  await page.keyboard.press('KeyE', { delay: 60 });
  await page.keyboard.press('KeyE', { delay: 60 });
  await page.waitForFunction(() => !(window as any).game.scene.getScene('companions-road').hud.dialogueVisible);
  await clickMap(page, 320, 214);
  await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').talking, undefined, { timeout: 7000 });
  await page.screenshot({ path: '../output/qa/companions-midday-rest.png', fullPage: true });
  for (let line = 0; line < 10; line++) {
    await page.keyboard.press('KeyE', { delay: 60 });
    await page.keyboard.press('KeyE', { delay: 60 });
  }
  await page.waitForFunction(() => (window as any).game.registry.get('world').flags.companionRestTaken);
  await clickMap(page, 604, 154);
  await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').data.get('story:companions-phase') === 'afternoon', undefined, { timeout: 7000 });
  await clickMap(page, 22, 148);
  await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').data.get('story:companions-phase') === 'morning');
  await clickMap(page, 604, 154);
  await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').data.get('story:companions-phase') === 'afternoon');
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('companions-road');
    return scene.areaRoot.list.filter((object: any) => ['foltan-walk', 'azar-walk'].includes(object.texture?.key)).map((object: any) => object.texture.key).sort();
  })).toEqual(['azar-walk', 'foltan-walk']);
  await clickMap(page, 600, 185);
  await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').talking, undefined, { timeout: 12000 });
  for (let line = 0; line < 4; line++) { await page.keyboard.press('KeyE', { delay: 60 }); await page.keyboard.press('KeyE', { delay: 60 }); }
  await page.waitForFunction(() => (window as any).game.scene.isActive('golden-boar'), undefined, { timeout: 12000 });
  expect(await page.evaluate(before => {
    const game = (window as any).game, st = game.registry.get('world'), scene = game.scene.getScene('companions-road');
    return { inv: JSON.stringify(st.inv), picked: JSON.stringify(st.picked), priorFlags: Object.entries(before.flags).filter(([key]) => !key.startsWith('companion')).every(([key, value]) => st.flags[key] === value), destination: game.scene.isActive('golden-boar') };
  }, before)).toEqual({ inv: before.inv, picked: before.picked, priorFlags: true, destination: true });
  await page.screenshot({ path: '../output/qa/companions-evening-boundary.png', fullPage: true });
  expect(await page.evaluate(() => (window as any).game.scene.getScene('companions-road').data.get('qa:max-party-gap'))).toBeLessThanOrEqual(60);
  // A saved scene re-entry resumes the second stretch without replaying rest.
  await page.evaluate(() => (window as any).game.scene.getScene('golden-boar').scene.start('companions-road'));
  await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').data.get('story:companions-phase') === 'evening');
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('companions-road');
    return { talking: scene.talking, position: [scene.lia.x, scene.lia.y], party: scene.areaRoot.list.filter((object: any) => ['foltan-walk', 'azar-walk'].includes(object.texture?.key)).map((object: any) => object.texture.key).sort() };
  })).toEqual({ talking: false, position: [582, 185], party: ['azar-walk', 'foltan-walk'] });
  expect(errors).toEqual([]);
});

test('sleeping at the completed first camp continues into the next morning with the same named party and supplies', async ({ page }) => {
  await page.goto('/?scene=companions-road');
  await page.waitForFunction(() => (window as any).game?.scene?.isActive('companions-road'));
  const before = await page.evaluate(() => JSON.stringify((window as any).game.registry.get('world')));
  await clickMap(page, 22, 183);
  await page.waitForFunction(() => (window as any).game.scene.isActive('journey'));
  await clickMap(page, 233, 260);
  await page.waitForFunction(() => (window as any).game.scene.isActive('companions-road'), undefined, { timeout: 7000 });
  expect(await page.evaluate(() => JSON.stringify((window as any).game.registry.get('world')))).toBe(before);
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('companions-road');
    return { at: [scene.lia.x, scene.lia.y], party: scene.areaRoot.list.filter((object: any) => ['foltan-walk', 'azar-walk'].includes(object.texture?.key)).map((object: any) => object.texture.key).sort() };
  })).toEqual({ at: [40, 185], party: ['azar-walk', 'foltan-walk'] });
});

test('Foltan and Azar use all four walking phases and return to idle beside Lia', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?scene=companions-road');
  await page.waitForFunction(() => (window as any).game?.scene?.isActive('companions-road'));
  const before = await page.evaluate(() => JSON.stringify((window as any).game.registry.get('world')));
  // Use an unmarked painted path point; no scene teleport or animation call.
  await clickMap(page, 225, 210);
  await page.waitForFunction(() => {
    const scene = (window as any).game.scene.getScene('companions-road');
    return [scene.foltan, scene.azar].every(actor => actor.anims.isPlaying && actor.anims.currentAnim.key.endsWith('-walk-e'));
  });
  await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('companions-road');
    const sample = { elapsed: 0, foltan: [] as number[], azar: [] as number[], start: [scene.foltan.x, scene.azar.x] };
    (window as any).companionGaitSample = sample;
    const collect = (_time: number, dt: number) => {
      sample.elapsed += Math.min(dt, 50);
      for (const name of ['foltan', 'azar'] as const) {
        const actor = scene[name];
        if (actor.anims.isPlaying && actor.anims.currentAnim.key === `${name}-walk-e`) sample[name].push(Number(actor.frame.name));
      }
    };
    scene.events.on('postupdate', collect);
    (window as any).stopCompanionGaitSample = () => scene.events.off('postupdate', collect);
  });
  await page.waitForFunction(() => (window as any).companionGaitSample.elapsed >= 850);
  const sample = await page.evaluate(() => {
    (window as any).stopCompanionGaitSample();
    const scene = (window as any).game.scene.getScene('companions-road');
    return { ...(window as any).companionGaitSample, now: [scene.foltan.x, scene.azar.x],
      actors: [scene.foltan, scene.azar].map(actor => [actor.texture.key, actor.flipX]), lia: scene.lia.texture.key };
  });
  expect(new Set(sample.foltan)).toEqual(new Set([8, 9, 10, 11]));
  expect(new Set(sample.azar)).toEqual(new Set([8, 9, 10, 11]));
  expect(sample.actors).toEqual([['foltan-walk', false], ['azar-walk', false]]);
  expect(sample.now[0]).toBeGreaterThan(sample.start[0]);
  expect(sample.now[1]).toBeGreaterThan(sample.start[1]);
  expect(sample.lia).toBe('lia-cloak-walk');
  await page.screenshot({ path: '../output/qa/companions-novel-walking-gaits.png', fullPage: true });
  await page.waitForFunction(() => {
    const scene = (window as any).game.scene.getScene('companions-road');
    return !scene.destination && [scene.foltan, scene.azar].every(actor => !actor.anims.isPlaying && actor.anims.currentAnim.key.endsWith('-idle-e'));
  });
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('companions-road');
    return [Number(scene.foltan.frame.name), Number(scene.azar.frame.name)];
  })).toEqual([9, 9]);
  expect(await page.evaluate(() => JSON.stringify((window as any).game.registry.get('world')))).toBe(before);
  expect(errors).toEqual([]);
});

test('mobile walking and interaction return after the noon dialogue', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?scene=companions-road');
  await page.waitForFunction(() => (window as any).game?.scene?.isActive('companions-road'));
  const right = page.locator('.mobile-direction[data-direction="right"]');
  const action = page.locator('.mobile-action[data-key="E"]');
  await expect(right).toBeVisible(); await expect(action).toBeVisible();
  const button = (await right.boundingBox())!;
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').lia.x > 60);
  await page.mouse.up();
  await clickMap(page, 320, 214);
  await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').talking, undefined, { timeout: 10000 });
  await expect(page.locator('.mobile-dpad')).toBeHidden();
  for (let step = 0; step < 24; step++) {
    if (await page.evaluate(() => !!(window as any).game.registry.get('world').flags.companionRestTaken)) break;
    await action.click({ delay: 60 });
  }
  await page.waitForFunction(() => (window as any).game.registry.get('world').flags.companionRestTaken);
  await expect(right).toBeVisible(); await expect(action).toBeVisible();
  const x = await page.evaluate(() => (window as any).game.scene.getScene('companions-road').lia.x);
  const after = (await right.boundingBox())!;
  await page.mouse.move(after.x + after.width / 2, after.y + after.height / 2);
  await page.mouse.down();
  await page.waitForFunction(x => (window as any).game.scene.getScene('companions-road').lia.x > x + 8, x);
  await page.mouse.up();
  await page.screenshot({ path: '../output/qa/companions-mobile-after-rest.png', fullPage: true });
});
