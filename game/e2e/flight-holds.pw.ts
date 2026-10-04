import { test, expect, type Page, type TestInfo, type CDPSession } from '@playwright/test';

type Mode = 'keyboard' | 'pointer' | 'phone';
type Touch = { id: number; x: number; y: number };

async function ready(page: Page, station: number) {
  // Keep concurrent source edits from reloading a held input midway through a test.
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
  await page.goto('/?scene=flight');
  await page.waitForFunction(() => (window as any).game?.scene?.isActive('flight'));
  await page.waitForFunction(() => !!(window as any).game.scene.getScene('flight').data.get('mobile:thought'));
  await page.evaluate(index => {
    const scene = (window as any).game.scene.getScene('flight');
    scene.nextStation = index;
    scene.placeAt(scene.stations[index].at);
    scene.cameras.main.centerOn(scene.v.x, scene.v.y);
  }, station);
}

async function state(page: Page) {
  return page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('flight');
    return {
      x: scene.v.x, y: scene.v.y, dist: scene.dist, progress: scene.holding,
      texture: scene.v.texture.key, frame: Number(scene.v.frame.name), playing: scene.v.anims.isPlaying,
      next: scene.nextStation, floor: scene.safeFloor, busy: scene.busy,
      holdX: scene.holdBack?.x, holdY: scene.holdBack?.y,
    };
  });
}

async function evidence(page: Page, info: TestInfo, name: string) {
  const directory = process.env.SELANTIS_FEEDBACK_EVIDENCE_DIR;
  await page.screenshot({ path: directory ? `${directory}/${name}.png` : info.outputPath(`${name}.png`) });
}

async function holdInput(page: Page, mode: Mode) {
  let client: CDPSession | undefined;
  let action: Touch, direction: Touch;
  let directionHeld = false;
  const actionButton = page.locator('.mobile-action[data-key="E"]');
  const directionButton = page.locator('.mobile-direction[data-direction="right"]');
  if (mode === 'phone') {
    const e = (await actionButton.boundingBox())!;
    const d = (await directionButton.boundingBox())!;
    action = { id: 1, x: e.x + e.width / 2, y: e.y + e.height / 2 };
    direction = { id: 2, x: d.x + d.width / 2, y: d.y + d.height / 2 };
    client = await page.context().newCDPSession(page);
  } else await page.keyboard.down('KeyD');
  return {
    async press() {
      if (mode === 'keyboard') await page.keyboard.down('KeyE');
      else if (mode === 'pointer') {
        const box = (await page.locator('canvas').boundingBox())!;
        const position = await page.evaluate(() => {
          const scene = (window as any).game.scene.getScene('flight');
          return { x: scene.v.x - scene.cameras.main.scrollX, y: scene.v.y - scene.cameras.main.scrollY };
        });
        await page.mouse.move(box.x + box.width * position.x / 640, box.y + box.height * position.y / 360);
        await page.mouse.down();
      } else {
        await client!.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: directionHeld ? [action] : [action, direction] });
        directionHeld = true;
        await expect(actionButton).toHaveClass(/is-pressed/);
        await expect(directionButton).toHaveClass(/is-pressed/);
      }
    },
    async release() {
      if (mode === 'keyboard') await page.keyboard.up('KeyE');
      else if (mode === 'pointer') await page.mouse.up();
      // Lift only the action contact, keeping the direction finger down.
      else await client!.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [action] });
      if (mode === 'phone') {
        await expect(actionButton).not.toHaveClass(/is-pressed/);
        await expect(directionButton).toHaveClass(/is-pressed/);
      }
    },
    async stopDirection() {
      if (mode === 'phone') {
        await client!.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        directionHeld = false;
        await expect(directionButton).not.toHaveClass(/is-pressed/);
      }
      else await page.keyboard.up('KeyD');
    },
  };
}

for (const mode of ['keyboard', 'pointer', 'phone'] as const) {
  test.describe(`forest holds (${mode})`, () => {
    test.use({ viewport: mode === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mode === 'phone', isMobile: mode === 'phone' });

    test('climbs during hold, freezes on release, and resumes to the ledge', async ({ page }, info) => {
      await ready(page, 2);
      const start = await state(page);
      const input = await holdInput(page, mode);
      await input.press();
      await expect.poll(async () => (await state(page)).progress).toBeGreaterThan(350);
      const middle = await state(page);
      expect(middle.next).toBe(2);
      expect(middle.x).toBeGreaterThan(start.x);
      expect(middle.y).toBeLessThan(start.y - 10);
      expect(middle.texture).toBe('valentus-cloak-events');
      expect(middle.frame).toBe(8);
      expect(middle.playing).toBe(false);
      expect(middle.holdX).toBe(middle.x);
      expect(middle.holdY).toBe(middle.y + 9);
      await evidence(page, info, `message-04-mid-climb-${mode}`);
      await input.release();
      await page.waitForTimeout(100);
      const paused = await state(page);
      await page.waitForTimeout(400);
      expect(await state(page)).toEqual(paused);
      await input.press();
      await expect.poll(async () => (await state(page)).next).toBe(3);
      await input.release();
      await input.stopDirection();
      const top = await state(page);
      expect(top.y).toBeLessThanOrEqual(134);
      expect(top.floor).toBeGreaterThan(start.dist);
      expect(top.dist).toBeGreaterThanOrEqual(top.floor);
      expect(top.busy).toBe(false);
      expect(top.texture).toBe('valentus-cloak-run');
      // Holding backwards after climbing must not put him back on the cliff.
      await page.keyboard.down('KeyA');
      await page.waitForTimeout(350);
      await page.keyboard.up('KeyA');
      expect((await state(page)).dist).toBeGreaterThanOrEqual(top.floor);
    });

    test('anchors the supported stance and restores idle and walking after release', async ({ page }, info) => {
      await ready(page, 3);
      const start = await state(page);
      const input = await holdInput(page, mode);
      await input.press();
      await expect.poll(async () => (await state(page)).progress).toBeGreaterThan(250);
      const middle = await state(page);
      expect(middle.x).toBe(start.x);
      expect(middle.y).toBe(start.y);
      expect(middle.dist).toBe(start.dist);
      expect(middle.texture).toBe('valentus-cloak-events');
      expect(middle.frame).toBe(9);
      expect(middle.playing).toBe(false);
      await evidence(page, info, `message-04-mid-brace-${mode}`);
      await input.release();
      await page.waitForTimeout(100);
      const paused = await state(page);
      expect(paused.texture).toBe('valentus-cloak-run');
      expect(paused.playing).toBe(false);
      await page.waitForTimeout(350);
      expect(await state(page)).toEqual(paused);
      await input.press();
      await expect.poll(async () => (await state(page)).next).toBe(4);
      await input.release();
      await expect.poll(async () => (await state(page)).dist).toBeGreaterThan(start.dist + 2);
      const walking = await state(page);
      expect(walking.texture).toBe('valentus-cloak-run');
      expect(walking.playing).toBe(true);
      await input.stopDirection();
    });
  });
}
