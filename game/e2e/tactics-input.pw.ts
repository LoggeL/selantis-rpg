import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page, id = 'flick'): Promise<void> {
  await page.waitForFunction(id => {
    const t = (window as any).__tactics;
    return t?.ready && t.ctrl.inputEnabled() && t.animating === 0 && t.ctrl.battle.activeUnit === id && !t.cameras.main.panEffect.isRunning;
  }, id, { timeout: 30000 });
}
async function boot(page: Page): Promise<void> {
  await page.goto('/?scene=tactics-sandbox');
  await ready(page);
}
async function point(page: Page, target: string | { x: number; y: number }) {
  return page.evaluate(target => (window as any).__tactics.debugPage(target), target);
}
async function click(page: Page, target: string | { x: number; y: number }): Promise<void> {
  const p = await point(page, target);
  await page.mouse.click(p.x, p.y);
}
async function valentus(page: Page): Promise<void> {
  await page.locator('.tac-endturn').click();
  await page.locator('.tac-confirm-facing').click();
  await ready(page, 'valentus');
}
const actor = (page: Page, id: string) => page.evaluate(id => {
  const u = (window as any).__tactics.ctrl.battle.unit(id);
  return { x: u.x, y: u.y, hp: u.hp, mp: u.mp, exp: u.exp, moved: u.moved, acted: u.acted, facing: u.facing };
}, id);

test('move command keeps the tile selectable, survives invalid clicks and can be undone', async ({ page }) => {
  await boot(page);
  await page.locator('.tac-menu [data-m="move"]').click();
  await page.keyboard.press('m'); // repeating the command must keep movement active
  expect(await page.evaluate(() => (window as any).__tactics.sel.mode)).toBe('move');
  await click(page, { x: 0, y: 5 }); // tree, outside the legal movement range
  expect(await page.evaluate(() => (window as any).__tactics.sel.unit)).toBe('flick');
  expect((await actor(page, 'flick')).moved).toBe(false);
  await click(page, { x: 2, y: 5 }); // this adjacent tile used to sit under the floating menu
  await expect.poll(() => actor(page, 'flick')).toMatchObject({ x: 2, y: 5, moved: true });
  await ready(page);
  await page.keyboard.press('z');
  await expect.poll(() => actor(page, 'flick')).toMatchObject({ x: 1, y: 5, moved: false });
  await ready(page);
  expect(await page.evaluate(() => (window as any).__tactics.stepImgs.some((im: any) => im.visible))).toBe(false);
});

test('first click pins the target, changing it and cancelling never spends the action', async ({ page }) => {
  await boot(page); await valentus(page);
  await page.locator('.tac-card [data-ab="handstoss"]').click();
  const before = await actor(page, 'valentus');
  await click(page, 's-south');
  await expect(page.locator('.tac-confirm-target')).toBeEnabled();
  expect(await actor(page, 'valentus')).toEqual(before);
  const north = await point(page, 's-north');
  await page.mouse.move(north.x, north.y);
  await expect(page.locator('.tac-target')).toHaveAttribute('data-target', 's-south');
  await click(page, 's-north');
  await expect(page.locator('.tac-target')).toHaveAttribute('data-target', 's-north');
  expect(await actor(page, 'valentus')).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('.tac-tcard.forecast')).toHaveCount(0);
  expect(await actor(page, 'valentus')).toEqual(before);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).__tactics.sel.mode)).toBe('none');
  expect(await page.locator('.menu-ov').isVisible()).toBe(false);
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
  test(`ring spell shows every target and casts only after confirmation at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await boot(page); await valentus(page);
    await page.locator('.tac-card [data-ab="druckwelle"]').click();
    const before = await actor(page, 'valentus');
    await click(page, 's-north'); // selecting an affected enemy works for a self-centred spell
    const forecast = page.locator('.tac-tcard.forecast');
    await expect(forecast).toContainText('4 Ziele');
    await expect(forecast.locator('.tac-target')).toHaveCount(4);
    for (const id of ['s-north', 's-east', 's-south', 'baris-young']) {
      const target = forecast.locator(`[data-target="${id}"]`);
      await expect(target).toContainText('HP');
      await expect(target).toContainText('MP');
      await expect(target).toContainText('Lvl');
      await expect(target).toContainText('Treffer');
      await expect(target).toContainText('Schaden');
    }
    expect(await actor(page, 'valentus')).toEqual(before);
    const boxes = await page.evaluate(() => {
      const box = (s: string) => document.querySelector(s)!.getBoundingClientRect().toJSON();
      return { panel: box('.tac-tcard'), root: box('.tac'), button: box('.tac-confirm-target') };
    });
    expect(boxes.panel.y).toBeGreaterThanOrEqual(boxes.root.y);
    expect(boxes.panel.bottom).toBeLessThanOrEqual(boxes.root.bottom);
    expect(boxes.button.bottom).toBeLessThanOrEqual(boxes.panel.bottom);
    await page.screenshot({ path: test.info().outputPath('all-targets.png') });
    const last = forecast.locator('.tac-target').last().locator('.tac-big');
    await last.scrollIntoViewIfNeeded();
    const lastBox = await last.boundingBox();
    const body = await forecast.locator('.tac-forecast-body').boundingBox();
    expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(body!.y + body!.height + 1);
    await page.locator('.tac-confirm-target').click();
    await page.waitForFunction(() => (window as any).__tactics.ctrl.battle.unit('valentus').acted);
    const after = await actor(page, 'valentus');
    expect(after.mp).toBeLessThan(before.mp);
    expect(after.exp).toBeGreaterThan(before.exp);
  });
}

test('self spells also wait for confirmation', async ({ page }) => {
  await boot(page); await valentus(page);
  await page.evaluate(() => {
    const t = (window as any).__tactics, u = t.ctrl.battle.unit('valentus');
    u.abilities.push('ausweichen'); u.mastered.push('ausweichen'); t.refresh();
  });
  const before = await actor(page, 'valentus');
  await page.locator('.tac-card [data-ab="ausweichen"]').click();
  await expect(page.locator('.tac-confirm-target')).toBeEnabled();
  expect(await actor(page, 'valentus')).toEqual(before);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).__tactics.ctrl.battle.unit('valentus').acted);
  expect((await actor(page, 'valentus')).exp).toBeGreaterThan(before.exp);
  expect(await page.evaluate(() => (window as any).__tactics.ctrl.battle.unit('valentus').statuses.evasive)).toBe(1);
});

test('the final facing previews, cancels and respects all four camera rotations', async ({ page }) => {
  await boot(page);
  const original = (await actor(page, 'flick')).facing;
  await page.locator('.tac-endturn').click();
  await click(page, 'flick');
  expect(await page.evaluate(() => (window as any).__tactics.views.get('flick').facing)).toBe(original);
  await page.locator('.tac-facing [data-facing="e"]').click();
  expect((await actor(page, 'flick')).facing).toBe(original);
  expect(await page.evaluate(() => (window as any).__tactics.views.get('flick').facing)).toBe('e');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).__tactics.views.get('flick').facing)).toBe(original);
  await page.locator('.tac-endturn').click();
  await page.locator('.tac-facing [data-facing="w"]').click();
  await page.keyboard.press('Backspace');
  await expect(page.locator('.tac-facing')).toBeHidden();
  expect(await page.evaluate(() => (window as any).__tactics.views.get('flick').facing)).toBe(original);
  await page.locator('.tac-endturn').click();
  for (let rotation = 0; rotation < 4; rotation++) {
    if (rotation) {
      await page.getByRole('button', { name: 'Ansicht nach rechts drehen', exact: true }).click();
      await page.waitForFunction(rotation => (window as any).__tactics.iso.rot === rotation, rotation);
    }
    const upper = page.getByRole('button', { name: 'Nach rechts oben schauen', exact: true });
    const facing = await upper.getAttribute('data-facing');
    await page.keyboard.press('ArrowUp');
    await expect(upper).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => (window as any).__tactics.views.get('flick').facing)).toBe(facing);
  }
  const selected = await page.locator('.tac-facing [aria-pressed="true"]').getAttribute('data-facing');
  await page.screenshot({ path: test.info().outputPath('facing.png') });
  await page.keyboard.press('Enter');
  await ready(page, 'valentus');
  expect((await actor(page, 'flick')).facing).toBe(selected);
});

test('moving and acting holds the turn open for the final facing', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('m');
  await click(page, { x: 2, y: 5 });
  await ready(page);
  await page.locator('.tac-card [data-ab="bogen"]').click();
  await click(page, 's-south');
  await page.locator('.tac-confirm-target').click();
  await expect(page.locator('.tac-facing')).toBeVisible();
  await page.waitForTimeout(1000); // longer than the old automatic end timer
  expect(await page.evaluate(() => (window as any).__tactics.ctrl.battle.activeUnit)).toBe('flick');
  await page.locator('.tac-facing [data-facing="w"]').click();
  await page.locator('.tac-confirm-facing').click();
  await ready(page, 'valentus');
  expect((await actor(page, 'flick')).facing).toBe('w');
});

test.describe('touch input', () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });
  test('movement and spell targets each wait for a confirming tap', async ({ page }) => {
    await boot(page);
    await page.locator('.tac-menu [data-m="move"]').tap();
    const destination = await point(page, { x: 2, y: 5 });
    await page.touchscreen.tap(destination.x, destination.y);
    expect((await actor(page, 'flick')).moved).toBe(false);
    await page.touchscreen.tap(destination.x, destination.y);
    await ready(page);
    expect(await actor(page, 'flick')).toMatchObject({ x: 2, y: 5, moved: true });
    await page.locator('.tac-card [data-ab="bogen"]').tap();
    const target = await point(page, 's-south');
    await page.touchscreen.tap(target.x, target.y);
    expect((await actor(page, 'flick')).acted).toBe(false);
    await page.locator('.tac-confirm-target').tap();
    await expect(page.locator('.tac-facing')).toBeVisible();
    expect((await actor(page, 'flick')).acted).toBe(true);
  });
});
