import { expect, test } from '@playwright/test';

for (const variant of [
  { name: 'desktop', viewport: { width: 1280, height: 720 }, rotation: 0, reduced: false, down: false },
  { name: 'portrait', viewport: { width: 390, height: 844 }, rotation: 1, reduced: false, down: true },
  { name: 'landscape-reduced-motion', viewport: { width: 844, height: 390 }, rotation: 2, reduced: true, down: true },
]) test(`Urmacht: engine explosion before splash art (${variant.name})`, async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await page.setViewportSize(variant.viewport);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?scene=rettung');
  await page.waitForFunction(() => (window as any).__tactics?.ready);
  // Advance the ordinary opening; only the story's round trigger is accelerated below.
  for (let i = 0; i < 50; i++) {
    if (await page.evaluate(() => (window as any).__tactics.ctrl.inputEnabled() && !(window as any).G.ui.busy() && !document.querySelector('.tac-hint:not(.hidden)'))) break;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
  }
  await page.waitForFunction(() => (window as any).__tactics.ctrl.inputEnabled());
  await page.evaluate(({ rotation, reduced, down }) => {
    const w = window as any, t = w.__tactics;
    w.G.settings.reducedMotion = reduced;
    t.iso.rot = rotation;
    t.buildField();
    for (const v of t.views.values()) v.reorient();
    if (down) { const f = t.ctrl.battle.unit('flick'); f.down = 'wounded'; f.hp = 0; t.views.get('flick').setDown('wounded'); }
    const original = t.magicBurst.bind(t);
    w.__urmachtProof = { started: false, paused: false, complete: false };
    t.magicBurst = async (...args: any[]) => {
      w.__urmachtProof.started = true;
      t.time.delayedCall(2650, () => { w.__urmachtProof.paused = true; t.scene.pause(); });
      await original(...args);
      w.__urmachtProof.complete = true;
    };
    void (async () => {
      await t.startData.battle.hooks.onRound(t.ctrl.ctx, 5, 'player');
      await t.startData.battle.hooks.onRound(t.ctrl.ctx, 6, 'player');
    })();
  }, variant);
  for (let i = 0; i < 100; i++) {
    if (await page.evaluate(() => (window as any).__urmachtProof.started)) break;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => (window as any).__urmachtProof.paused);
  expect(await page.locator('.plate').count()).toBe(0);
  const framed = await page.evaluate(() => {
    const t = (window as any).__tactics, cam = t.cameras.main;
    return [...t.views.values()].map((v: any) => ({
      id: v.unit.id, ring: v.ring.visible, hp: v.hp.visible,
      x: (v.feet.x - cam.worldView.x) * cam.zoom,
      head: (v.head.y - cam.worldView.y) * cam.zoom,
      feet: (v.feet.y - cam.worldView.y) * cam.zoom,
    }));
  });
  for (const actor of framed) {
    expect(actor.ring).toBe(false); expect(actor.hp).toBe(false);
    if (actor.id === 'baris') continue; // His flight deliberately leaves the formation.
    expect(actor.x).toBeGreaterThan(0); expect(actor.x).toBeLessThan(640);
    expect(actor.head).toBeGreaterThan(0); expect(actor.feet).toBeLessThan(360);
  }
  await page.screenshot({ path: testInfo.outputPath(`urmacht-${variant.name}.png`) });
  await page.keyboard.press('r'); // Camera controls must stay locked during the explosion.
  expect(await page.evaluate(() => (window as any).__tactics.iso.rot)).toBe(variant.rotation);
  await page.evaluate(() => (window as any).__tactics.scene.resume());
  await page.waitForFunction(() => (window as any).__urmachtProof.complete);
  await expect(page.locator('.plate .plate-caption-text')).toHaveText('Die Urmacht');
  expect(await page.evaluate(() => (window as any).__tactics.ctrl.ctx.hasFlag('k5-urmacht-exploded'))).toBe(true);
  expect(errors).toEqual([]);
});
