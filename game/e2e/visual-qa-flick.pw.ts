import { expect, test, type Page } from '@playwright/test';
import { restartScene } from './helpers/scenes';
import { solveTracking } from './helpers/tracking';

const output = '../output/qa/visual-playtest/flick';
const chapters = ['rain-forest', 'flick-trail', 'shadow-camp'];
const modes = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, touch: false },
  { name: 'touch', viewport: { width: 390, height: 844 }, touch: true },
  { name: 'landscape', viewport: { width: 844, height: 390 }, touch: true },
];
const snapshot = (page: Page, key: string) => page.evaluate(key => (window as any).game.scene.getScene(key).data.get('story:continuation'), key);
async function save(page: Page, name: string) {
  await page.waitForFunction(() => (window as any).game.scene.getScenes(true).every((scene: any) => !scene.cameras.main.fadeEffect.isRunning));
  return page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
async function clickMap(page: Page, at: number[], touch: boolean) {
  const canvas = (await page.locator('canvas').boundingBox())!;
  const x = canvas.x + canvas.width * at[0] / 640, y = canvas.y + canvas.height * at[1] / 360;
  if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
}
async function advance(page: Page, touch: boolean) {
  if (touch) await page.locator('.mobile-action[data-key="E"]').click();
  else await page.keyboard.press('KeyE');
}
async function finishDialogue(page: Page, key: string, touch: boolean, prefix: string) {
  for (let guard = 0; guard < 80; guard++) {
    const before = await snapshot(page, key);
    if (!before.talking) return;
    await advance(page, touch);
    await page.waitForTimeout(35);
    await page.waitForFunction(key => {
      const scene = (window as any).game.scene.getScene(key);
      return !scene.data.get('story:continuation').talking || !scene.data.get('dialogue:typing');
    }, key);
    const current = await snapshot(page, key);
    if (!current.talking) return;
    if (!current.sequence.ready) {
      // A touch click can finish its actionability wait as the cue becomes ready.
      // Even at that boundary one physical press consumes at most one beat.
      const index = current.sequence.index;
      await advance(page, touch);
      expect((await snapshot(page, key)).sequence.index).toBeLessThanOrEqual(index + 1);
      await save(page, `${prefix}-moving-${index}`);
    }
    await page.waitForFunction(key => {
      const current = (window as any).game.scene.getScene(key).data.get('story:continuation');
      return !current.talking || current.sequence.ready;
    }, key);
    if (!(await snapshot(page, key)).talking) return;
    if (guard === 0) {
      await save(page, `${prefix}-dialogue`);
      const index = (await snapshot(page, key)).sequence.index;
      if (touch) await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
      else await page.keyboard.press('KeyO');
      await save(page, `${prefix}-dialogue-options`);
      await page.keyboard.press('KeyO');
      expect((await snapshot(page, key)).sequence.index).toBe(index);
    }
    await advance(page, touch);
    await page.waitForTimeout(35);
  }
  throw new Error(`Unfinished dialogue in ${key}`);
}
for (const mode of modes) test.describe(mode.name, () => {
  test.use({ viewport: mode.viewport, hasTouch: mode.touch });
  for (const key of chapters) test(`${key}: visual playtest with physical inputs`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.routeWebSocket(/127\.0\.0\.1:\d+/, socket => socket.close());
    await page.goto(`/?scene=${key}`);
    await page.waitForFunction(key => (window as any).game?.scene.isActive(key) && (window as any).game.scene.getScene(key).data.get('story:continuation'), key);
    const prefix = `${mode.name}-${key}`;
    await save(page, `${prefix}-entry`);
    await finishDialogue(page, key, mode.touch, `${prefix}-entry`);
    await save(page, `${prefix}-ready`);
    if (key === 'rain-forest') expect((await snapshot(page, key)).actors.find((actor: any) => actor.id === 'flick').visible).toBe(false);
    if (key === 'shadow-camp') expect((await snapshot(page, key)).actors.find((actor: any) => actor.id === 'kyra').bound).toBe(true);
    if (!mode.touch) {
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(250);
      await page.keyboard.up('ArrowRight');
      await save(page, `${prefix}-keyboard-walk`);
    }
    const initial = await page.evaluate(() => (window as any).game.registry.get('world').inv);
    await page.getByRole('button', { name: 'Tasche', exact: true }).click();
    await expect(page.locator('#bag-dialog')).toBeVisible();
    await save(page, `${prefix}-inventory`);
    await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
    await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
    await save(page, `${prefix}-options`);
    await page.keyboard.press('KeyO');
    for (let guard = 0; guard < 10; guard++) {
      const state = await snapshot(page, key);
      const action = state.actions.find((action: any) => action.available && !action.complete);
      if (!action) break;
      await clickMap(page, action.at, mode.touch);
      await page.waitForTimeout(180);
      await save(page, `${prefix}-${action.id}-approach`);
      await expect.poll(async () => (await snapshot(page, key)).talking, { timeout: 15_000 }).toBe(true);
      if (action.id === 'cross-fallen-trunk') {
        const dialog = page.getByRole('dialog', { name: 'Flicks Fährte', exact: true });
        await expect(dialog).toBeVisible();
        expect((await snapshot(page, key)).actions.find((candidate: any) => candidate.id === action.id).complete).toBe(false);
        await save(page, `${prefix}-tracking-entry`);
        await dialog.getByRole('button', { name: 'Hufabdrücke untersuchen', exact: true }).click();
        await dialog.getByRole('button', { name: 'Rindenspur untersuchen', exact: true }).click();
        await save(page, `${prefix}-tracking-clues`);
        // Optional visual-only pass after tracking CSS changes, without replaying
        // the already-qualified remainder of each chapter.
        if (process.env.FLICK_QA_TRACKING_CAPTURE_ONLY === '1') return;
        await solveTracking(page);
        await expect.poll(async () => {
          const current = await snapshot(page, key);
          return current.talking && !current.challenge;
        }).toBe(true);
        expect((await snapshot(page, key)).actions.find((candidate: any) => candidate.id === action.id).complete).toBe(false);
      }
      await finishDialogue(page, key, mode.touch, `${prefix}-${action.id}`);
      const actors = (await snapshot(page, key)).actors;
      if (action.id === 'rain-tracks') expect(actors.find((actor: any) => actor.id === 'flick').visible).toBe(true);
      if (action.id === 'scout-tree-route') {
        expect(actors.find((actor: any) => actor.id === 'flick').visible).toBe(false);
        await restartScene(page, key);
        await expect.poll(async () => (await snapshot(page, key))?.talking).toBe(false);
        expect((await snapshot(page, key)).actors.find((actor: any) => actor.id === 'flick').visible).toBe(false);
      }
      if (action.id === 'market-distraction') expect(actors.find((actor: any) => actor.id === 'flick').visible).toBe(true);
      await save(page, `${prefix}-${action.id}-complete`);
      if (action.id === 'meet-flick') {
        const diagnostic = await page.evaluate(key => {
          const scene = (window as any).game.scene.getScene(key);
          const actor = scene.chapterActors.get('flick');
          return { published: scene.data.get('story:continuation').actors, sprite: {
            active: actor.active, visible: actor.visible, alpha: actor.alpha, x: actor.x, y: actor.y,
            scaleX: actor.scaleX, scaleY: actor.scaleY, texture: actor.texture.key,
            frame: actor.frame.name, renderFlags: actor.renderFlags, willRender: actor.willRender(scene.cameras.main),
          }, root: { x: scene.areaRoot.x, y: scene.areaRoot.y, alpha: scene.areaRoot.alpha, visible: scene.areaRoot.visible } };
        }, key);
        await test.info().attach(`${prefix}-flick-render`, { body: JSON.stringify(diagnostic), contentType: 'application/json' });
      }
    }
    const done = await snapshot(page, key);
    expect(done.actions.every((action: any) => action.complete)).toBe(true);
    expect(done.exit.available).toBe(true);
    expect(await page.evaluate(() => (window as any).game.registry.get('world').inv)).toEqual(initial);
    await restartScene(page, key);
    await expect.poll(async () => (await snapshot(page, key))?.talking).toBe(false);
    expect((await snapshot(page, key)).actions.every((action: any) => action.complete)).toBe(true);
    await save(page, `${prefix}-reentry`);
    await page.setViewportSize(mode.name === 'desktop' ? { width: 844, height: 390 } : { width: 1280, height: 800 });
    await save(page, `${prefix}-resized`);
    await clickMap(page, done.exit.at, mode.touch);
    await page.waitForFunction(key => (window as any).game.scene.isActive(key), done.exit.to);
    await save(page, `${prefix}-next-scene`);
    expect(errors).toEqual([]);
  });
});
