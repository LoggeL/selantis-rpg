import { expect, test, type Page } from '@playwright/test';
import { restartScene } from './helpers/scenes';

async function sample(page: Page) {
  return page.evaluate(() => {
    const game = (window as any).game, scene = game.scene.getScene('journey');
    return { step: scene.campStep, world: game.registry.get('world'), fire: scene.data.get('story:fire-minigame'),
      dialogue: scene.data.get('story:camp-dialogue'), text: scene.data.get('dialogue:fullText') };
  });
}

for (const layout of [
  { name: 'desktop', width: 1280, height: 800, touch: false },
  { name: 'touch', width: 390, height: 844, touch: true },
]) {
  test.describe(`camp acceptance ${layout.name}`, () => {
    test.use({ viewport: { width: layout.width, height: layout.height }, hasTouch: layout.touch });
    test.afterEach(async ({ page }, testInfo) => {
      if (testInfo.status === testInfo.expectedStatus) return;
      const diagnostic = await page.evaluate(() => {
        const scene = (window as any).game?.scene?.getScene('journey');
        return { controls: scene?.data.get('mobile:controls'), locked: scene?.locked, leaving: scene?.leaving,
          fireBusy: scene?.fireBusy, fireEHeld: scene?.fireEHeld, fire: scene?.data.get('story:fire-minigame'),
          lia: scene?.lia && { x: scene.lia.x, y: scene.lia.y },
          focus: { tag: document.activeElement?.tagName, id: document.activeElement?.id, label: document.activeElement?.getAttribute('aria-label') } };
      });
      await testInfo.attach('camp-input-state', { body: JSON.stringify(diagnostic, null, 2), contentType: 'application/json' });
    });
    test('build, eat, meet the party and leave with the same progress after reentry', async ({ page }) => {
      test.setTimeout(90_000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
      await page.addInitScript(() => localStorage.setItem('selantis.settings.v1', JSON.stringify({ reducedMotion: true })));
      await page.goto('/');
      await page.waitForFunction(() => (window as any).game?.scene?.isActive('title'));
      // The supported checkpoint UI sets only the starting point. Every camp
      // action and the following chapter transition use real player input.
      await page.getByRole('button', { name: 'Debug · Playtest' }).click();
      await page.getByLabel('Einstieg').selectOption('camp');
      await page.getByRole('button', { name: 'Zum Einstieg' }).click();
      await page.waitForFunction(() => (window as any).game.scene.isActive('journey'));

      const use = async (id: string) => {
        // Cinematic controls change the footer and canvas scale. Wait for its
        // resize frames before translating an authored map point to pixels.
        const frame = await page.evaluate(() => (window as any).game.loop.frame);
        await page.waitForFunction(frame => (window as any).game.loop.frame > frame + 2, frame);
        const at = await page.evaluate(id => (window as any).game.scene.getScene('journey').spots.find((spot: any) => spot.id === id).at, id);
        const canvas = (await page.locator('canvas').boundingBox())!;
        const x = canvas.x + canvas.width * at[0] / 640, y = canvas.y + canvas.height * at[1] / 360;
        if (layout.touch) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
      };
      const advance = async () => {
        // Arrival choreography briefly removes all actions between authored
        // lines. A reader can advance only after the next line is ready.
        await expect(page.locator('.mobile-action[data-key="E"]')).toBeEnabled();
        if (layout.touch) await page.locator('.mobile-action[data-key="E"]').tap();
        else await page.keyboard.press('KeyE');
      };
      const step = async (expected: string) => expect.poll(async () => (await sample(page)).step, { timeout: 12_000 }).toBe(expected);
      await step('cloak');
      await use('bedroll'); await step('stones');
      await use('stones'); await step('ring');
      expect((await sample(page)).world.inv.steine).toBe(6);
      await use('fire'); await step('twigs');
      expect((await sample(page)).world.inv.steine).toBeUndefined();
      await use('twigs'); await step('fire');
      expect((await sample(page)).world.inv.zunderholz).toBe(1);
      await use('fire');
      await expect.poll(async () => (await sample(page)).fire.active).toBe(true);
      // Reduced motion is a supported player setting: each separate stroke
      // must add precisely one heat point, including after pausing.
      const stroke = async (heat: number) => {
        await expect.poll(async () => (await sample(page)).fire.ready).toBe(true);
        if (layout.touch) await page.getByRole('button', { name: 'Holz bohren', exact: true }).tap();
        else if (heat === 1) await page.keyboard.press('KeyE');
        else await page.getByRole('button', { name: 'Holz bohren', exact: true }).click();
        if (heat < 6) await expect.poll(async () => (await sample(page)).fire.heat).toBe(heat);
      };
      await stroke(1);
      if (layout.touch) await page.getByRole('button', { name: 'Pause', exact: true }).tap();
      else await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await expect.poll(async () => (await sample(page)).fire.active).toBe(false);
      expect((await sample(page)).world.inv.zunderholz).toBe(1);
      await use('fire');
      await expect.poll(async () => (await sample(page)).fire.active).toBe(true);
      expect((await sample(page)).fire.heat).toBe(1);
      for (let heat = 2; heat <= 6; heat++) await stroke(heat);
      await step('meal');
      expect((await sample(page)).world.inv.zunderholz).toBeUndefined();
      await page.getByRole('button', { name: 'Tasche', exact: true }).click();
      const bag = page.locator('#bag-dialog');
      await bag.getByRole('button', { name: 'Reiseproviant auswählen', exact: true }).click();
      await bag.getByRole('button', { name: 'Reiseproviant: Essen', exact: true }).click();
      await step('sleep');
      const eaten = (await sample(page)).world;
      expect(eaten.inv.proviant).toBeUndefined();
      await restartScene(page, 'journey');
      await step('sleep');
      expect((await sample(page)).world).toEqual(eaten);
      await use('bedroll'); await step('waking');
      await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('dialogue:fullText')?.includes('Ist sie tot?'));
      for (let line = 0; line < 20; line++) {
        const before = (await sample(page)).text;
        await advance();
        await expect.poll(async () => (await sample(page)).text).not.toBe(before);
      }
      await step('star');
      expect((await sample(page)).world.flags.metFoltanAzar).toBe(true);
      // Repeated lifecycle reentry must not duplicate conversation handlers.
      for (let reentry = 0; reentry < 3; reentry++) {
        await restartScene(page, 'journey');
        await step('star');
      }
      await use('foltan');
      await expect.poll(async () => (await sample(page)).dialogue.stage).toBe('intro');
      await advance();
      await expect.poll(async () => (await sample(page)).dialogue.stage).toBe('menu');
      if (layout.touch) await page.getByRole('button', { name: 'Über Kyra', exact: true }).tap();
      else await page.getByRole('button', { name: 'Über Kyra', exact: true }).click();
      await expect.poll(async () => (await sample(page)).dialogue.stage).toBe('kyra');
      expect((await sample(page)).text).toContain('Kyra');
      for (let line = 0; line < 3; line++) await advance();
      await expect.poll(async () => (await sample(page)).dialogue.stage).toBe('menu');
      if (layout.touch) await page.getByRole('button', { name: 'Zurück', exact: true }).tap();
      else await page.getByRole('button', { name: 'Zurück', exact: true }).click();
      await expect.poll(async () => (await sample(page)).dialogue.active).toBe(false);
      const beforeMorning = (await sample(page)).world;
      await use('bedroll');
      await page.waitForFunction(() => (window as any).game.scene.isActive('companions-road'));
      expect(await page.evaluate(() => (window as any).game.registry.get('world').inv)).toEqual(beforeMorning.inv);
      expect(await page.evaluate(() => (window as any).game.registry.get('world').flags.journeyCloakRecovered)).toBe(true);
      await page.getByRole('button', { name: 'Gruppe ansehen · C' }).click();
      await expect(page.locator('#character-dialog [data-party-member]')).toHaveCount(3);
      expect(errors).toEqual([]);
    });
  });
}
