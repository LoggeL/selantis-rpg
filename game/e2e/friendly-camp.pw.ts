import { test, expect, type Page } from '@playwright/test';
import { restartScene } from './helpers/scenes';
import { campSpot, prepareFirstCamp } from './helpers/camp-controls';

const layouts = [
  { name: 'desktop', width: 1280, height: 800, mobile: false, reducedMotion: false },
  { name: 'phone-portrait', width: 390, height: 844, mobile: true, reducedMotion: false },
  { name: 'phone-landscape', width: 844, height: 390, mobile: true, reducedMotion: false },
  { name: 'reduced-motion', width: 1280, height: 800, mobile: false, reducedMotion: true },
];
/** Start through the supported checkpoint UI, then await real scene creation. */
async function openFriendlyCamp(page: Page, layout: typeof layouts[number], beforeEncounter = false) {
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
  await page.setViewportSize({ width: layout.width, height: layout.height });
  await page.addInitScript(reducedMotion => localStorage.setItem('selantis.settings.v1', JSON.stringify({ reducedMotion })), layout.reducedMotion);
  if (beforeEncounter) {
    await prepareFirstCamp(page, layout.mobile);
    return;
  }
  await page.goto('/?scene=strangers');
  await page.waitForFunction(() => {
    const scene = (window as any).game?.scene?.getScene('journey');
    return scene?.sys.isActive() && scene.inCamp && !scene.locked && scene.foltan?.active;
  });
}

async function interact(page: Page, mobile: boolean) {
  if (mobile) {
    await expect(page.locator('.mobile-action[data-key="E"]')).toBeEnabled();
    await page.locator('.mobile-action[data-key="E"]').click();
  }
  else await page.keyboard.press('KeyE', { delay: 50 });
}
async function sample(page: Page) {
  return page.evaluate(() => {
    const game = (window as any).game, scene = game.scene.getScene('journey');
    return { text: scene.data.get('dialogue:fullText'), typing: scene.data.get('dialogue:typing'),
      frame: game.loop.frame, locked: scene.locked, step: scene.campStep,
      shot: scene.closeup?.image.texture.key, pose: scene.liaPose, met: !!game.registry.get('world').flags.metFoltanAzar,
      ropeFlag: !!game.registry.get('world').flags.journeyRopesReleased,
      targets: scene.spots.filter((spot: any) => !spot.enabled || spot.enabled()).map((spot: any) => spot.id),
      tweens: scene.tweens.getTweensOf(scene.lia).length, rope: !!scene.rope,
      objective: scene.data.get('mobile:objective') };
  });
}
for (const layout of layouts) {
  test.describe(layout.name, () => {
  test.use({ hasTouch: layout.mobile });
  test(`friendly camp dialogue stays continuous on ${layout.name}`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await openFriendlyCamp(page, layout, true);
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:camp-arrival') === 'entering');
    const arrival = () => page.evaluate(() => {
      const s = (window as any).game.scene.getScene('journey');
      return { phase: s.data.get('story:camp-arrival'), locked: s.locked, pose: s.liaPose,
        shot: !!s.closeup?.visible, controls: s.data.get('mobile:controls'),
        foltan: { x: s.foltan.x, y: s.foltan.y, frame: Number(s.foltan.frame.name), texture: s.foltan.texture.key, animation: s.foltan.anims.currentAnim?.key },
        azar: { x: s.azar.x, y: s.azar.y, frame: Number(s.azar.frame.name), texture: s.azar.texture.key, animation: s.azar.anims.currentAnim?.key } };
    });
    const entry = await arrival();
    expect(entry).toMatchObject({ phase: 'entering', locked: true, pose: 'lia-sleep', shot: false,
      controls: { directions: [], actions: {}, inventory: false, disabled: true }, foltan: { texture: 'foltan-walk' }, azar: { texture: 'azar-walk' } });
    for (const [name, actor] of [['foltan', entry.foltan], ['azar', entry.azar]] as const) {
      expect(Number.isInteger(actor.frame)).toBe(true);
      expect(actor.animation).toMatch(new RegExp(`^${name}-(?:idle-s|walk-w|idle-w)$`));
    }
    if (!layout.reducedMotion) {
      expect(entry.foltan.x).toBeGreaterThan(450); expect(entry.azar.x).toBeGreaterThan(450);
      // E cannot skip their arrival; movement and the bag also stay locked.
      await page.keyboard.press('KeyE'); await page.keyboard.press('KeyI');
      await page.keyboard.press('ArrowLeft', { delay: 200 });
      const moving = await arrival();
      expect(moving).toMatchObject({ phase: 'entering', shot: false, pose: 'lia-sleep' });
      expect(moving.foltan.x).toBeLessThan(entry.foltan.x); expect(moving.azar.x).toBeLessThan(entry.azar.x);
      expect(moving.foltan.animation).toBe('foltan-walk-w'); expect(moving.azar.animation).toBe('azar-walk-w');
      expect([4, 5, 6, 7]).toContain(moving.foltan.frame); expect([4, 5, 6, 7]).toContain(moving.azar.frame);
      expect(await page.evaluate(() => (window as any).game.scene.getScene('journey').inventory.isOpen)).toBe(false);
      await expect(page.locator('#bag-dialog')).not.toBeVisible();
      await page.screenshot({ path: `../output/qa/friendly-camp-${layout.name}-map-arrival.png`, fullPage: true });
    }
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('dialogue:fullText')?.includes('Ist sie tot?'));
    const lines: string[] = [];
    for (let index = 0; index < 20; index++) {
      let current = await sample(page); lines.push(current.text);
      expect(current).toMatchObject({ locked: true, step: 'waking', met: false, ropeFlag: false, targets: [], rope: false, tweens: 0 });
      expect(current.objective).not.toMatch(/Straße|schleichen/);
      expect(current.pose ?? '').not.toContain('bound');
      expect(current.shot).toBe(index < 2 ? 'cinematic-camp-observe' : index < 7 ? 'cut-camp-wake' : 'cut-camp-companions');
      if (index < 2) expect(current.pose).toBe('lia-sleep');
      const speaker = await page.evaluate(() => (window as any).game.scene.getScene('journey').data.get('dialogue:speaker'));
      expect(speaker).toBe(['???', '???', 'Lia', '???', '???', '???', '???', '???', 'Azar', 'Foltan', 'Azar', 'Lia', 'Foltan', 'Lia', 'Foltan', 'Lia', 'Foltan', 'Azar', 'Foltan', ''][index]);
      if (current.typing) {
        // A short line may finish between reading its typing flag and clicking.
        // Sample natural typing at shot boundaries; guard a reveal against advancement.
        if ([0, 7, 19].includes(index)) {
          await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').data.get('dialogue:typing'));
        } else {
          await interact(page, layout.mobile);
          if ((await sample(page)).text !== current.text) continue;
          await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').data.get('dialogue:typing'));
        }
        expect((await sample(page)).text).toBe(current.text);
      }
      current = await sample(page);
      // Sample the held card across idle frames at each cinematic shot.
      if ([0, 7, 19].includes(index)) {
        await page.waitForFunction(frame => (window as any).game.loop.frame > frame + 20, current.frame);
        expect((await sample(page)).text).toBe(current.text);
      }
      if (layout.mobile) {
        const caption = (await page.locator('.mobile-caption').boundingBox())!;
        expect(caption.x).toBeGreaterThanOrEqual(0); expect(caption.y).toBeGreaterThanOrEqual(0);
        expect(caption.x + caption.width).toBeLessThanOrEqual(layout.width);
        expect(caption.y + caption.height).toBeLessThanOrEqual(layout.height);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      if ([0, 7, 19].includes(index)) await page.screenshot({ path: `../output/qa/friendly-camp-${layout.name}-${index}.png`, fullPage: true });
      await interact(page, layout.mobile);
      if (index < 19) await expect.poll(async () => (await sample(page)).text).not.toBe(current.text);
    }
    expect(lines.join(' ')).toContain('Wir tun dir nichts.');
    expect(lines.join(' ')).toContain('Soll der feine Herr Foltan machen, was er für richtig hält.');
    expect(lines.join(' ')).toContain('Kyra mitgenommen');
    expect(lines.join(' ')).toContain('Versprechen können wir dir nichts.');
    await expect.poll(async () => (await sample(page)).step).toBe('star');
    expect(await sample(page)).toMatchObject({ locked: false, met: true, ropeFlag: false,
      targets: ['fire', 'bedroll', 'foltan', 'azar', 'fire-seat', 'star', 'road'] });
    // Scene restart with the same registry models a return to the restored camp.
    await restartScene(page, 'journey');
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').campStep === 'star');
    expect(await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('journey');
      return [scene.locked, scene.closeupVisible, scene.liaPose ?? null, scene.foltan.texture.key, scene.azar.texture.key, Number(scene.foltan.frame.name), Number(scene.azar.frame.name)];
    })).toEqual([false, false, null, 'foltan-walk', 'azar-walk', 1, 1]);
    expect(errors).toEqual([]);
  });

  test(`star reflection is held through all six cards and retained on ${layout.name}`, async ({ page }) => {
    test.setTimeout(45_000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await openFriendlyCamp(page, layout);
    await campSpot(page, 'star', layout.mobile);
    for (let index = 0; index < 6; index++) {
      await page.waitForFunction(index => {
        const scene = (window as any).game.scene.getScene('journey');
        return scene.data.get('story:star-reflection')?.active && scene.data.get('story:star-reflection').index === index;
      }, index);
      expect(await page.evaluate(() => {
        const scene = (window as any).game.scene.getScene('journey');
        return { locked: scene.locked, observed: !!(window as any).game.registry.get('world').flags.criosObserved,
          art: scene.closeup.image.texture.key };
      })).toEqual({ locked: true, observed: false, art: 'cut-crios-reflection' });
      const text = (await sample(page)).text;
      if ((await sample(page)).typing) {
        await interact(page, layout.mobile);
        if ((await sample(page)).text !== text) continue;
        await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').data.get('dialogue:typing'));
      }
      await interact(page, layout.mobile);
    }
    await expect.poll(async () => (await sample(page)).step).toBe('complete');
    expect(await page.evaluate(() => (window as any).game.registry.get('world').flags.criosObserved)).toBe(true);
    expect((await sample(page)).objective).toBe('Im Lager zur Ruhe kommen oder bis zum Morgen schlafen.');
    await restartScene(page, 'journey');
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').campStep === 'complete');
    expect(errors).toEqual([]);
  });

  test(`optional camp actions and direct sleep work on ${layout.name}`, async ({ page }) => {
    test.setTimeout(45_000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await openFriendlyCamp(page, layout);
    expect((await sample(page)).targets).toEqual(['fire', 'bedroll', 'foltan', 'azar', 'fire-seat', 'star', 'road']);
    const at = (id: string) => campSpot(page, id, layout.mobile);
    const continueLine = async () => {
      const current = await sample(page);
      if (current.typing) {
        await interact(page, layout.mobile);
        if ((await sample(page)).text !== current.text) return;
        await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').data.get('dialogue:typing'));
      }
      await interact(page, layout.mobile);
    };
    await at('foltan');
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:camp-dialogue')?.stage === 'intro');
    await continueLine();
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:camp-dialogue')?.stage === 'menu');
    expect(await page.evaluate(() => (window as any).game.scene.getScene('journey').data.get('story:camp-dialogue').choices))
      .toEqual(['kyra', 'road', 'watch', 'back']);
    await page.screenshot({ path: `../output/qa/friendly-camp-${layout.name}-choice-menu.png`, fullPage: true });
    if (layout.mobile) {
      for (const key of ['Q', 'R', 'SPACE', 'ESC']) {
        const choice = page.locator(`.mobile-action[data-key="${key}"]`);
        await expect(choice).toBeVisible();
        expect(await choice.evaluate(button => {
          const box = button.getBoundingClientRect();
          const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          return { inside: box.x >= 0 && box.y >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
            reachable: target === button || button.contains(target) };
        })).toEqual({ inside: true, reachable: true });
      }
    }
    if (layout.mobile) await page.locator('.mobile-action[data-key="Q"]').click();
    else await page.keyboard.press('KeyQ', { delay: 50 });
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:camp-dialogue')?.stage === 'kyra');
    expect((await sample(page)).text).toContain('Kyra');
    for (let index = 0; index < 3; index++) await continueLine();
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:camp-dialogue')?.stage === 'menu');
    if (layout.mobile) await page.locator('.mobile-action[data-key="ESC"]').click();
    else await page.keyboard.press('Escape', { delay: 50 });
    await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').locked);
    await at('azar');
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').areaRoot.list.some((object: any) => object.active && object.visible && object.text === 'Zzzzz'));
    await at('fire-seat');
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').liaPose === 'lia-camp-sit');
    expect(await page.evaluate(() => (window as any).game.scene.getScene('journey').data.get('story:camp-seated'))).toBe(true);
    await interact(page, layout.mobile);
    await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').data.get('story:camp-seated'));
    // No star interaction occurred. Choosing the bed must still start the morning.
    await at('bedroll');
    await page.waitForFunction(() => (window as any).game.scene.isActive('companions-road'));
    expect(await page.evaluate(() => !!(window as any).game.registry.get('world').flags.criosObserved)).toBe(false);
    expect(errors).toEqual([]);
  });
  });
}
