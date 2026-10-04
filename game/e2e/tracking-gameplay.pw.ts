import { expect, test, type Page } from '@playwright/test';
import { solveTracking } from './helpers/tracking';

test.describe.configure({ mode: 'parallel' });
const output = '../output/qa/visual-playtest/gameplay-tracking';
async function chapter(page: Page) {
  // The diagnostic mirror is published by scene.update. Observe the next
  // animation frame so a completed input cannot leave us reading its old beat.
  return page.evaluate(() => new Promise<any>(resolve => requestAnimationFrame(() =>
    resolve((window as any).game.scene.getScene('flick-trail').data.get('story:continuation')))));
}
async function tracking(page: Page) {
  return page.evaluate(() => (window as any).game.registry.get('tracking:state'));
}
async function world(page: Page) {
  return page.evaluate(() => JSON.parse(JSON.stringify((window as any).game.registry.get('world'))));
}
async function mapClick(page: Page, at: number[], touch: boolean) {
  // Dialogue/modal returns publish exploration controls before the viewport
  // finishes its layout pass. Calculate a tap only after that layout settles.
  await page.waitForFunction(() => document.documentElement.dataset.actionBar === 'true' && !document.querySelector('dialog[open]'), undefined, { timeout: 5000 });
  const box = await page.locator('canvas').evaluate(canvas => new Promise<{ x: number; y: number; width: number; height: number }>(resolve => {
    let previous = '', stable = 0;
    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      const key = `${rect.x},${rect.y},${rect.width},${rect.height}`;
      stable = key === previous ? stable + 1 : 0; previous = key;
      if (stable >= 2) resolve({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
      else requestAnimationFrame(measure);
    };
    requestAnimationFrame(measure);
  }));
  const x = box.x + box.width * at[0] / 640, y = box.y + box.height * at[1] / 360;
  if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
}
async function readDialogue(page: Page) {
  for (let guard = 0; guard < 35; guard++) {
    const before = await chapter(page);
    if (!before.talking || before.challenge) return;
    await page.keyboard.press('KeyE');
    await expect.poll(async () => {
      const next = await chapter(page);
      return !next.talking || next.sequence?.index !== before.sequence?.index || !(await page.evaluate(() => (window as any).game.scene.getScene('flick-trail').data.get('dialogue:typing')));
    }).toBe(true);
    const next = await chapter(page);
    if (next.sequence?.index === before.sequence?.index && next.talking) {
      await page.waitForFunction(() => {
        const current = (window as any).game.scene.getScene('flick-trail').data.get('story:continuation');
        return !current.talking || current.sequence?.ready;
      }, undefined, { timeout: 5000 });
      if (!(await chapter(page)).talking) return;
      await page.keyboard.press('KeyE');
    }
  }
  throw new Error('Flick dialogue did not finish');
}
for (const mode of [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, touch: false },
  { name: 'touch', viewport: { width: 390, height: 844 }, touch: true },
  { name: 'landscape', viewport: { width: 844, height: 390 }, touch: true },
]) {
  test.describe(mode.name, () => {
    test.use({ viewport: mode.viewport, hasTouch: mode.touch });
    test('tracking requires evidence, wrong route and cancel retain the locked chapter, success resumes real dialogue', async ({ page }) => {
      test.setTimeout(90_000);
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
      await page.addInitScript(() => localStorage.setItem('selantis.settings.v1', JSON.stringify({ reducedMotion: true })));
      await page.goto('/?scene=flick-trail');
      await page.waitForFunction(() => (window as any).game?.scene.isActive('flick-trail') && (window as any).game.scene.getScene('flick-trail').data.get('story:continuation'));
      await readDialogue(page);
      await mapClick(page, [162, 214], mode.touch);
      await expect.poll(async () => (await chapter(page)).talking).toBe(true);
      await readDialogue(page);
      expect((await world(page)).flags['film.hoofprints']).toBe(true);
      const before = await world(page);
      const openPuzzle = async () => {
        await mapClick(page, [311, 219], mode.touch);
        await expect(page.getByRole('dialog', { name: 'Flicks Fährte', exact: true })).toBeVisible();
      };
      await openPuzzle();
      await page.keyboard.press('KeyO');
      expect(await page.evaluate(() => (window as any).game.scene.isActive('Settings')), 'options cannot open behind the native challenge dialog').toBe(false);
      await page.getByRole('button', { name: 'Rechts hinter der Wurzel folgen', exact: true }).click();
      expect((await tracking(page)).phase).toBe('inspect');
      await expect(page.locator('[data-tracking-feedback]')).toContainText('geraten');
      await page.keyboard.press('KeyE'); await page.keyboard.press('KeyE');
      expect(await world(page)).toEqual(before);
      await page.screenshot({ path: `${output}/${mode.name}-01-evidence-required.png`, fullPage: true });
      await page.getByRole('button', { name: 'Hufabdrücke untersuchen', exact: true }).click();
      await page.getByRole('button', { name: 'Rindenspur untersuchen', exact: true }).click();
      await page.getByRole('button', { name: 'Links am Waldrand suchen', exact: true }).click();
      expect((await tracking(page)).phase).toBe('failed');
      expect(await world(page)).toEqual(before);
      await page.screenshot({ path: `${output}/${mode.name}-02-wrong-route.png`, fullPage: true });
      await page.getByRole('button', { name: 'Zur Wurzel zurück', exact: true }).click();
      expect((await tracking(page)).examined).toEqual(['hooves', 'bark']);
      await page.getByRole('button', { name: 'Zurück zur Wegplanung', exact: true }).click();
      await expect.poll(async () => (await chapter(page)).talking).toBe(false);
      expect(await world(page)).toEqual(before);
      expect((await chapter(page)).actions.find((action: any) => action.id === 'cross-fallen-trunk').complete).toBe(false);
      await openPuzzle();
      if (mode.name === 'desktop') {
        await page.keyboard.press('Digit1'); await page.keyboard.press('Digit2'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
        expect((await tracking(page)).phase).toBe('solved');
        await page.screenshot({ path: `${output}/${mode.name}-03-solved.png`, fullPage: true });
        await page.keyboard.press('Enter');
      } else await solveTracking(page);
      await expect(page.getByRole('dialog', { name: 'Flicks Fährte', exact: true })).toHaveCount(0);
      await expect.poll(async () => (await chapter(page)).talking && !(await chapter(page)).challenge).toBe(true);
      expect((await world(page)).flags['film.trail-direction']).not.toBe(true);
      await readDialogue(page);
      expect((await world(page)).flags['film.trail-direction']).toBe(true);
      expect((await world(page)).inv).toEqual(before.inv);
      await page.screenshot({ path: `${output}/${mode.name}-04-back-on-trail.png`, fullPage: true });
      expect(errors).toEqual([]);
    });
  });
}
