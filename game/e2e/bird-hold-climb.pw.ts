import { expect, test, type Page } from '@playwright/test';

async function worldPoint(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  return { x: box.x + box.width * x / 640, y: box.y + box.height * y / 360 };
}
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const game = (window as any).game, s = game.scene.getScene('world'), st = game.registry.get('world');
    return { x: s.lia.x, y: s.lia.y, busy: s.busy, progress: s.nestClimb?.progress,
      returning: s.nestClimb?.returning, inv: st.inv, returned: !!st.flags.chickReturned,
      rewards: s.pickups.filter((p: any) => p.key === 'waldrand:dank-feder').length };
  });
}
async function collectBird(page: Page) {
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
  await page.goto('/?scene=world&map=waldrand');
  await page.waitForFunction(() => (window as any).game?.scene?.isActive('world'));
  const chick = await worldPoint(page, 448, 200);
  await page.mouse.click(chick.x, chick.y);
  await expect.poll(async () => (await snapshot(page)).inv.kueken, { timeout: 10000 }).toBe(1);
  await page.waitForFunction(() => !(window as any).game.scene.getScene('world').target);
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => (window as any).game.scene.getScene('world').lia.x < 436);
  await page.keyboard.up('ArrowLeft');
}

for (const mode of ['keyboard', 'pointer', 'touch-action'] as const) {
  test(`bird climb moves while held, pauses, and finishes safely (${mode})`, async ({ page }) => {
    test.setTimeout(45000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(mode === 'touch-action' ? { width: 390, height: 844 } : { width: 1280, height: 800 });
    const touch = mode === 'touch-action' ? await page.context().newCDPSession(page) : undefined;
    if (touch) await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await collectBird(page);
    const ground = await snapshot(page);
    const hold = async () => {
      if (mode === 'keyboard') await page.keyboard.down('KeyE');
      else {
        const point = mode === 'pointer' ? await worldPoint(page, 420, 184) : await page.getByRole('button', { name: 'Klettern halten', exact: true }).boundingBox().then(box => ({ x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }));
        if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 1 }] });
        else { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
      }
    };
    const release = async () => {
      if (mode === 'keyboard') await page.keyboard.up('KeyE');
      else if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await page.mouse.up();
    };
    await hold();
    await expect.poll(async () => (await snapshot(page)).progress, { intervals: [50, 100] }).toBeGreaterThan(0.4);
    await page.screenshot({ path: `../output/qa/bird-${mode}-mid-climb.png`, fullPage: true });
    await release();
    const mid = await snapshot(page);
    expect(mid.progress).toBeLessThan(0.75);
    expect(mid.y).toBeLessThan(ground.y - 12);
    expect(mid.returned).toBe(false); expect(mid.inv.kueken).toBe(1); expect(mid.rewards).toBe(0);
    await page.waitForTimeout(450);
    const paused = await snapshot(page);
    expect(paused.progress).toBe(mid.progress); expect(paused.y).toBe(mid.y);
    await page.screenshot({ path: `../output/qa/bird-${mode}-paused.png`, fullPage: true });
    await hold();
    await expect.poll(async () => (await snapshot(page)).returned, { timeout: 6000 }).toBe(true);
    await release();
    await expect.poll(async () => (await snapshot(page)).busy).toBe(false);
    const done = await snapshot(page);
    expect(done.x).toBeCloseTo(ground.x); expect(done.y).toBeCloseTo(ground.y);
    expect(done.inv.kueken ?? 0).toBe(0); expect(done.rewards).toBe(1);
    await page.keyboard.press('KeyE'); expect((await snapshot(page)).rewards).toBe(1);
    await page.screenshot({ path: `../output/qa/bird-${mode}-returned.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
