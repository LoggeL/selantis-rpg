import { test, expect, type Page } from '@playwright/test';

const layouts = [
  { name: 'desktop', width: 1280, height: 800, mobile: false, reducedMotion: false },
  { name: 'phone-portrait', width: 390, height: 844, mobile: true, reducedMotion: false },
  { name: 'phone-landscape', width: 844, height: 390, mobile: true, reducedMotion: false },
  { name: 'reduced-motion', width: 1280, height: 800, mobile: false, reducedMotion: true },
];
async function interact(page: Page, mobile: boolean) {
  if (mobile) await page.locator('.mobile-action[data-key="E"]').click();
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
  test(`friendly camp dialogue stays continuous on ${layout.name}`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    // Concurrent source edits must not reload the loaded game during acceptance.
    await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.addInitScript(reducedMotion => localStorage.setItem('selantis.settings.v1', JSON.stringify({ reducedMotion })), layout.reducedMotion);
    await page.goto('/?scene=journey');
    await page.waitForFunction(() => (window as any).game?.scene.isActive('journey'));
    // Restore a rested camp through create(), with real E/touch thereafter.
    await page.evaluate(() => {
      const game = (window as any).game;
      Object.assign(game.registry.get('world').flags, { journeyCampReached: true, firstCampRested: true,
        journeyCloakSpread: true, journeyStonesGathered: true, journeyFirepitBuilt: true,
        journeyTwigsGathered: true, campfireLit: true, journeyAte: true });
      game.scene.getScene('journey').scene.restart();
    });
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:camp-arrival') === 'entering');
    const arrival = () => page.evaluate(() => {
      const s = (window as any).game.scene.getScene('journey');
      return { phase: s.data.get('story:camp-arrival'), locked: s.locked, pose: s.liaPose,
        shot: !!s.closeup?.visible, controls: s.data.get('mobile:controls'),
        foltan: { x: s.foltan.x, y: s.foltan.y, frame: Number(s.foltan.frame.name) },
        azar: { x: s.azar.x, y: s.azar.y, frame: Number(s.azar.frame.name) } };
    });
    const entry = await arrival();
    expect(entry).toMatchObject({ phase: 'entering', locked: true, pose: 'lia-sleep', shot: false,
      controls: { directions: [], actions: {}, inventory: false, disabled: true }, foltan: { frame: 5 }, azar: { frame: 6 } });
    if (!layout.reducedMotion) {
      expect(entry.foltan.x).toBeGreaterThan(450); expect(entry.azar.x).toBeGreaterThan(450);
      // E cannot skip their arrival; movement and the bag also stay locked.
      await page.keyboard.press('KeyE'); await page.keyboard.press('KeyI');
      await page.keyboard.press('ArrowLeft', { delay: 200 });
      const moving = await arrival();
      expect(moving).toMatchObject({ phase: 'entering', shot: false, pose: 'lia-sleep' });
      expect(moving.foltan.x).toBeLessThan(entry.foltan.x); expect(moving.azar.x).toBeLessThan(entry.azar.x);
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
      if (current.typing) {
        // A short line may finish between reading its typing flag and clicking.
        // Wait for the authored line to settle before using the real advance input.
        await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').data.get('dialogue:typing'));
        expect((await sample(page)).text).toBe(current.text);
      }
      current = await sample(page);
      // Twenty rendered frames without input must keep the same line and lock.
      await page.waitForFunction(frame => (window as any).game.loop.frame > frame + 20, current.frame);
      expect((await sample(page)).text).toBe(current.text);
      if (layout.mobile) {
        const caption = (await page.locator('.mobile-caption').boundingBox())!;
        expect(caption.x).toBeGreaterThanOrEqual(0); expect(caption.y).toBeGreaterThanOrEqual(0);
        expect(caption.x + caption.width).toBeLessThanOrEqual(layout.width);
        expect(caption.y + caption.height).toBeLessThanOrEqual(layout.height);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      if ([0, 7, 19].includes(index)) await page.screenshot({ path: `../output/qa/friendly-camp-${layout.name}-${index}.png`, fullPage: true });
      const speaker = await page.evaluate(() => (window as any).game.scene.getScene('journey').data.get('dialogue:speaker'));
      expect(speaker).toBe(['???', '???', 'Lia', '???', '???', '???', '???', '???', 'Azar', 'Foltan', 'Azar', 'Lia', 'Foltan', 'Lia', 'Foltan', 'Lia', 'Foltan', 'Azar', 'Foltan', ''][index]);
      await interact(page, layout.mobile);
      if (index < 19) await expect.poll(async () => (await sample(page)).text).not.toBe(current.text);
    }
    expect(lines.join(' ')).toContain('Wir tun dir nichts.');
    expect(lines.join(' ')).toContain('Bei meinem Amboss antwortet auch keiner.');
    expect(lines.join(' ')).toContain('Kyra mitgenommen');
    expect(lines.join(' ')).toContain('Versprechen können wir dir nichts.');
    await expect.poll(async () => (await sample(page)).step).toBe('star');
    expect(await sample(page)).toMatchObject({ locked: false, met: true, ropeFlag: false, targets: ['star'] });
    // Scene restart with the same registry models a return to the restored camp.
    await page.evaluate(() => (window as any).game.scene.getScene('journey').scene.restart());
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').campStep === 'star');
    expect(await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('journey');
      return [scene.locked, scene.closeupVisible, scene.liaPose ?? null, Number(scene.foltan.frame.name), Number(scene.azar.frame.name)];
    })).toEqual([false, false, null, 5, 6]);
    await page.evaluate(() => (window as any).game.scene.getScene('journey').lia.setPosition(155, 188));
    await interact(page, layout.mobile);
    await expect.poll(async () => (await sample(page)).step).toBe('complete');
    expect(await page.evaluate(() => (window as any).game.registry.get('world').flags.criosObserved)).toBe(true);
    expect((await sample(page)).objective).toBe('Bis zum Morgen schlafen und gemeinsam aufbrechen.');
    await page.evaluate(() => (window as any).game.scene.getScene('journey').scene.restart());
    await page.waitForFunction(() => (window as any).game.scene.getScene('journey').campStep === 'complete');
    expect(errors).toEqual([]);
  });
}
