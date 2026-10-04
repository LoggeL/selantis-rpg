import { expect, test, type Page } from '@playwright/test';
import { restartScene } from './helpers/scenes';

test.describe.configure({ mode: 'parallel' });

const chapters = ['golden-boar', 'reading-camp', 'brotherhood', 'betrayal'];
const output = process.env.NOVEL_QA_OUTPUT ?? '../output/qa/visual-playtest/novel/after';
type Snapshot = { chapter: string; talking: boolean; sequence: { index: number; ready: boolean } | null;
  actions: { id: string; at: number[]; available: boolean; complete: boolean; flag: string }[];
  exit: { at: number[]; available: boolean; to: string }; actors: { id: string; visible: boolean }[] };
async function snapshot(page: Page, key: string): Promise<Snapshot> {
  return page.evaluate(key => (window as any).game.scene.getScene(key).data.get('story:continuation'), key);
}
async function waitChapter(page: Page, key: string) {
  await page.waitForFunction(key => (window as any).game?.scene.isActive(key) && (window as any).game.scene.getScene(key).data.get('story:continuation')?.chapter === key, key);
}
async function point(page: Page, at: number[], touch: boolean) {
  const box = (await page.locator('canvas').boundingBox())!;
  const x = box.x + box.width * at[0] / 640, y = box.y + box.height * at[1] / 360;
  if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
}
async function advance(page: Page, touch: boolean) {
  if (touch) await page.locator('.mobile-action[data-key="E"]').click(); else await page.keyboard.press('KeyE');
}
async function dialogue(page: Page, chapter: string, touch: boolean, phase?: string) {
  for (let guard = 0; guard < 70; guard++) {
    const before = await snapshot(page, chapter);
    if (!before.talking) return;
    const typing = await page.evaluate(key => !!(window as any).game.scene.getScene(key).data.get('dialogue:typing'), chapter);
    if (typing) {
      await advance(page, touch);
      // A short line can finish naturally while Playwright waits for a mobile
      // control to become actionable. The resulting press advances one beat.
      const after = await snapshot(page, chapter);
      if (!after.talking) return;
      if (after.sequence!.index !== before.sequence!.index) {
        expect(after.sequence!.index, 'one touch consumes at most one beat').toBe(before.sequence!.index + 1);
        continue;
      }
    }
    if (!(await snapshot(page, chapter)).sequence!.ready) {
      await page.keyboard.press('KeyE');
      expect((await snapshot(page, chapter)).sequence!.index, 'early input cannot skip actor choreography').toBe(before.sequence!.index);
    }
    await page.waitForFunction(key => {
      const scene = (window as any).game.scene.getScene(key);
      return scene.data.get('story:continuation')?.sequence?.ready && !scene.data.get('dialogue:typing');
    }, chapter);
    if (phase) await page.screenshot({ path: `${output}/${phase}-beat-${before.sequence!.index}.png`, fullPage: true });
    await advance(page, touch);
    await expect.poll(async () => {
      const next = await snapshot(page, chapter);
      return !next.talking || next.sequence?.index !== before.sequence!.index;
    }).toBe(true);
  }
  throw new Error(`Dialogue stuck in ${chapter}`);
}
async function campaign(page: Page) {
  return page.evaluate(() => JSON.parse(JSON.stringify((window as any).game.registry.get('world'))));
}

for (const mode of [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, touch: false },
  { name: 'touch', viewport: { width: 390, height: 844 }, touch: true },
  { name: 'landscape', viewport: { width: 844, height: 390 }, touch: true },
]) {
  test.describe(mode.name, () => {
    test.use({ viewport: mode.viewport, hasTouch: mode.touch });
    test('novel scenes preserve player progression through actions, interruptions, resize and reentry', async ({ page }) => {
      test.setTimeout(360_000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
      await page.addInitScript(() => localStorage.setItem('selantis.settings.v1', JSON.stringify({ reducedMotion: false })));
      await page.goto('/?scene=golden-boar');
      await waitChapter(page, 'golden-boar');
      const initial = await campaign(page);
      for (const chapter of chapters) {
        await waitChapter(page, chapter);
        const opening = await snapshot(page, chapter);
        const openingState = await campaign(page);
        await page.keyboard.press('KeyO');
        await page.waitForFunction(() => (window as any).game.scene.isActive('Settings'), undefined, { timeout: 5000 });
        await page.keyboard.press('KeyE');
        await page.keyboard.press('KeyD');
        expect((await snapshot(page, chapter)).sequence?.index).toBe(opening.sequence?.index);
        expect(await campaign(page)).toEqual(openingState);
        await page.screenshot({ path: `${output}/${mode.name}-${chapter}-options-interruption.png`, fullPage: true });
        if (mode.touch) await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
        else await page.keyboard.press('KeyO');
        await page.waitForFunction(() => !(window as any).game.scene.isActive('Settings'), undefined, { timeout: 5000 });
        await dialogue(page, chapter, mode.touch, `${mode.name}-${chapter}-entry`);
        await page.screenshot({ path: `${output}/${mode.name}-${chapter}-exploration.png`, fullPage: true });
        await page.getByRole('button', { name: 'Gruppe ansehen · C', exact: true }).click();
        await expect(page.locator('#character-dialog')).toBeVisible();
        await page.screenshot({ path: `${output}/${mode.name}-${chapter}-party.png`, fullPage: true });
        await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
        await page.getByRole('button', { name: 'Tasche', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Tasche', exact: true })).toBeVisible();
        const bagState = await campaign(page);
        await page.keyboard.press('KeyE');
        expect(await campaign(page)).toEqual(bagState);
        await page.screenshot({ path: `${output}/${mode.name}-${chapter}-bag.png`, fullPage: true });
        await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
        for (let guard = 0; guard < 12; guard++) {
          const current = await snapshot(page, chapter);
          const action = current.actions.find(action => action.available && !action.complete);
          if (!action) break;
          await point(page, action.at, mode.touch);
          await expect.poll(async () => (await snapshot(page, chapter)).talking, { timeout: 15_000 }).toBe(true);
          await dialogue(page, chapter, mode.touch, `${mode.name}-${chapter}-${action.id}`);
          expect((await campaign(page)).flags[action.flag], action.id).toBe(true);
          await page.screenshot({ path: `${output}/${mode.name}-${chapter}-${action.id}-complete.png`, fullPage: true });
          if (action.id === 'craupor-questioning') {
            const positions = await page.evaluate(key => {
              const scene = (window as any).game.scene.getScene(key);
              return { lia: scene.lia.x, foltan: scene.chapterActors.get('foltan').x };
            }, chapter);
            expect(positions.foltan - positions.lia, 'Lia stays at the table while Foltan speaks privately').toBeGreaterThan(110);
          }
        }
        const finished = await snapshot(page, chapter);
        expect(finished.actions.every(action => action.complete), chapter).toBe(true);
        expect(finished.exit.available).toBe(true);
        const beforeReentry = await campaign(page);
        await restartScene(page, chapter); await waitChapter(page, chapter);
        expect(await campaign(page)).toEqual(beforeReentry);
        expect((await snapshot(page, chapter)).talking).toBe(false);
        expect((await snapshot(page, chapter)).actions.every(action => action.complete)).toBe(true);
        await page.setViewportSize({ width: mode.viewport.width + 8, height: mode.viewport.height + 8 });
        await page.setViewportSize(mode.viewport);
        await page.screenshot({ path: `${output}/${mode.name}-${chapter}-reentry.png`, fullPage: true });
        expect((await campaign(page)).inv).toEqual(initial.inv);
        await point(page, finished.exit.at, mode.touch);
        await waitChapter(page, finished.exit.to);
      }
      expect(errors).toEqual([]);
      expect((await campaign(page)).flags['novel.trust-broken']).toBe(true);
    });
  });
}
