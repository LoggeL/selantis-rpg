import { expect, test, type Page } from '@playwright/test';
import { completeSceneAction } from './sceneActions';
import { disableReloads } from './noReloads';

test.use({ viewport: { width: 1280, height: 720 } });

async function boot(page: Page, kind: string) {
  await disableReloads(page);
  await page.goto(`/?scene=interaction-demo&kind=${kind}`);
  await expect(page.locator('.scene-action')).toBeVisible();
  await page.waitForTimeout(220);
}

for (const kind of ['reach', 'lift', 'open-eyes', 'tend', 'bellows', 'cover', 'duck', 'listen']) {
  test(`${kind}: real directional inputs complete the interaction and continue the story`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await boot(page, kind);
    await completeSceneAction(page);
    await page.waitForFunction(() => (window as any).G.state.is('demo-interaction-done'));
    await expect(page.locator('.scene-action')).toHaveCount(0);
    await expect(page.locator('.thought')).toContainText('Geschichte');
    expect(errors).toEqual([]);
  });
}

test('bellows: click and drag compresses the folds directly, and W/S give fast full strokes', async ({ page }) => {
  await boot(page, 'bellows');
  const before = (await page.locator('.bellows-folds').boundingBox())!;
  const handle = (await page.locator('.bellows-handle').boundingBox())!;
  const stage = (await page.locator('.action-stage').boundingBox())!;
  const cx = handle.x + handle.width / 2, cy = handle.y + handle.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx, cy + (stage.height - 48) * 0.6, { steps: 10 });
  await page.mouse.up(); await page.waitForTimeout(80);
  const compressed = (await page.locator('.bellows-folds').boundingBox())!;
  expect(compressed.height).toBeLessThan(before.height * 0.65);
  const current = (await page.locator('.bellows-handle').boundingBox())!;
  await page.mouse.move(current.x + current.width / 2, current.y + current.height / 2); await page.mouse.down();
  await page.mouse.move(cx, cy, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(80);
  expect((await page.locator('.bellows-folds').boundingBox())!.height).toBeGreaterThan(before.height * 0.9);
  await page.keyboard.down('s'); await page.waitForTimeout(430); await page.keyboard.up('s');
  await expect(page.locator('.scene-action')).toHaveAttribute('data-strokes', '1');
  await page.keyboard.down('w'); await page.waitForTimeout(430); await page.keyboard.up('w');
  await expect(page.locator('.scene-action')).toHaveAttribute('data-strokes', '2');
  await completeSceneAction(page);
  await page.waitForFunction(() => (window as any).G.state.is('demo-interaction-done'));
});

test('holding E does not solve a story gesture or a hiding challenge', async ({ page }) => {
  await boot(page, 'lift');
  await page.keyboard.down('e'); await page.waitForTimeout(1400); await page.keyboard.up('e');
  await expect(page.locator('.scene-action')).toHaveAttribute('data-strokes', '0');
  await completeSceneAction(page);
  await boot(page, 'cover');
  await page.keyboard.down('e'); await page.waitForTimeout(3400); await page.keyboard.up('e');
  await expect(page.locator('.scene-action')).toHaveAttribute('data-round', '0');
  expect(Number(await page.locator('.scene-action').getAttribute('data-mistakes'))).toBeGreaterThan(0);
  await completeSceneAction(page);
});

test('a held movement key stays locked after completion until released', async ({ page }) => {
  await boot(page, 'lift');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(2100);
  await expect(page.locator('.scene-action')).toHaveCount(0);
  expect(await page.evaluate(async () => (await import('/src/core/input.ts' as string)).inputLock.locked)).toBe(true);
  await page.keyboard.up('ArrowUp');
  // The next story line owns the lock; close it to prove no lock was leaked by the action.
  await page.keyboard.press('Enter'); await page.waitForTimeout(300); await page.keyboard.press('Enter');
  await page.waitForFunction(async () => !(await import('/src/core/input.ts' as string)).inputLock.locked);
});

test('scene changes cancel a running action and its completion callback', async ({ page }) => {
  await boot(page, 'bellows');
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(350); await page.keyboard.up('ArrowDown');
  await page.evaluate(() => (window as any).G.ui.transition(() => (window as any).G.warp('ui-sandbox'), { fadeMs: 0 }));
  await page.waitForTimeout(600);
  await expect(page.locator('.scene-action')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).G.state.is('demo-interaction-done'))).toBe(false);
  expect(await page.evaluate(() => (window as any).G.ui.busy())).toBe(false);
});

test('opening scene selection pauses an active challenge', async ({ page }) => {
  await boot(page, 'cover');
  await page.keyboard.press('Enter');
  await page.keyboard.press('F2');
  const action = page.locator('.scene-action');
  const mistakes = await action.getAttribute('data-mistakes');
  await page.waitForTimeout(3200);
  await expect(action).toHaveAttribute('data-round', '0');
  await expect(action).toHaveAttribute('data-mistakes', mistakes!);
  await page.keyboard.press('Escape');
  await completeSceneAction(page);
  await page.waitForFunction(() => (window as any).G.state.is('demo-interaction-done'));
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`touch ${viewport.width}x${viewport.height}: drag and on-screen arrows work without clipping`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true });
    const page = await context.newPage();
    await boot(page, 'reach');
    const grip = (await page.locator('.action-grip').boundingBox())!;
    const goal = (await page.locator('.action-goal').boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(goal.x + goal.width / 2, goal.y + goal.height / 2, { steps: 14 });
    await page.mouse.up();
    await page.waitForFunction(() => (window as any).G.state.is('demo-interaction-done'));
    await boot(page, 'duck');
    for (const selector of ['.action-instruction', '.action-stage', '.action-controls']) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
    await page.getByRole('button', { name: 'Bereit', exact: true }).tap();
    const down = (await page.getByRole('button', { name: 'Nach unten', exact: true }).boundingBox())!;
    await page.mouse.move(down.x + down.width / 2, down.y + down.height / 2);
    await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    expect(Number(await page.locator('.scene-action').getAttribute('data-position'))).toBeGreaterThan(0.65);
    await completeSceneAction(page);
    await page.waitForFunction(() => (window as any).G.state.is('demo-interaction-done'));
    await context.close();
  });
}
