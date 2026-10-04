import { expect, test, type Page } from '@playwright/test';
import { restartScene } from './helpers/scenes';
import { winRescue, returnFromRescue } from './helpers/rescue';
import { solveTracking } from './helpers/tracking';

type Snapshot = {
  chapter: string; talking: boolean; ended: boolean;
  sequence: { index: number; total: number; status: string; ready: boolean } | null;
  actions: { id: string; at: [number, number]; radius: number; flag: string; challenge: 'rescue' | 'tracking' | null; available: boolean; complete: boolean }[];
  exit: { at: [number, number]; available: boolean; to: string };
  actors: { id: string; texture: string; visible: boolean }[];
};
const chapters = ['golden-boar', 'reading-camp', 'brotherhood', 'betrayal', 'rain-forest', 'flick-trail', 'shadow-camp', 'sisters-reunited', 'film-one-finale'];
const output = process.env.CONTINUATION_QA_OUTPUT ?? '../output/qa/continuation-browser';

async function snapshot(page: Page, chapter: string): Promise<Snapshot> {
  return page.evaluate(key => (window as any).game.scene.getScene(key).data.get('story:continuation'), chapter);
}

async function waitChapter(page: Page, chapter: string) {
  await page.waitForFunction(key => {
    const game = (window as any).game;
    return game?.scene.isActive(key) && game.scene.getScene(key).data.get('story:continuation')?.chapter === key;
  }, chapter);
}

async function clickMap(page: Page, point: readonly number[], touch: boolean) {
  await page.waitForTimeout(80);
  const transformed = await page.evaluate(pt => {
    const scene = (window as any).game.scene.getScenes(true).find((candidate: any) => candidate.areaRoot);
    if (!scene) return { x: pt[0], y: pt[1] };
    return scene.areaRoot.getWorldTransformMatrix().transformPoint(pt[0], pt[1]);
  }, [...point]);
  const bounds = (await page.locator('canvas').boundingBox())!;
  const x = bounds.x + bounds.width * transformed.x / 640;
  const y = bounds.y + bounds.height * transformed.y / 360;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Only diagnostic reads occur here. Every story advance is a physical input. */
async function readSequence(page: Page, chapter: string, touch: boolean) {
  const advance = async () => {
    if (touch) await page.locator('.mobile-action[data-key="E"]').click();
    else await page.keyboard.press('KeyE');
  };
  for (let guard = 0; guard < 100; guard++) {
    const before = await snapshot(page, chapter);
    if (!before.talking) return;
    if (await page.evaluate(key => !!(window as any).game.scene.getScene(key).data.get('dialogue:typing'), chapter)) {
      await advance();
      // The typewriter may finish between observation and physical input on CI.
      // A ready beat may then advance once, which is valid player behaviour.
      await page.waitForTimeout(35);
      const revealed = await snapshot(page, chapter);
      if (!revealed.talking) return;
      expect(revealed.sequence!.index).toBeLessThanOrEqual(before.sequence!.index + 1);
      if (revealed.sequence!.index !== before.sequence!.index) continue;
    }
    if (!(await snapshot(page, chapter)).sequence!.ready) {
      // Cue readiness and one-shot early input are covered by the scene unit
      // regression. Wait here instead of racing the cue's last render frame.
      await page.waitForFunction(key => (window as any).game.scene.getScene(key).data.get('story:continuation')?.sequence?.ready, chapter);
    }
    await page.waitForFunction(key => {
      const scene = (window as any).game.scene.getScene(key);
      return scene.data.get('story:continuation')?.sequence?.ready && !scene.data.get('dialogue:typing');
    }, chapter);
    const ready = (await snapshot(page, chapter)).sequence!;
    expect(ready.status).toBe('active');
    await advance();
    await expect.poll(async () => {
      const after = await snapshot(page, chapter);
      return !after.talking || after.sequence?.index !== ready.index;
    }).toBe(true);
    const after = await snapshot(page, chapter);
    if (after.talking) expect(after.sequence!.index, 'one press consumes exactly one ready beat').toBe(ready.index + 1);
  }
  throw new Error(`Dialogue did not finish in ${chapter}`);
}

async function world(page: Page) {
  return page.evaluate(() => {
    const state = (window as any).game.registry.get('world');
    return { inv: { ...state.inv }, picked: { ...state.picked }, flags: { ...state.flags } };
  });
}

async function actors(page: Page, chapter: string) {
  return page.evaluate(key => {
    const scene = (window as any).game.scene.getScene(key);
    return { lia: { angle: scene.lia.angle, alpha: scene.lia.alpha },
      actors: [...scene.chapterActors.entries()].map(([id, actor]: [string, any]) => ({ id, visible: actor.visible, angle: actor.angle, alpha: actor.alpha, x: actor.x, y: actor.y })) };
  }, chapter);
}

async function assertParty(page: Page, expected: string[]) {
  await page.getByRole('button', { name: 'Gruppe ansehen · C', exact: true }).click();
  await expect(page.locator('#character-dialog [data-party-member]')).toHaveCount(expected.length);
  expect(await page.locator('#character-dialog [data-party-member]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-party-member')))).toEqual(expected);
  await expect(page.locator('#character-dialog')).not.toContainText('Strahl');
  await expect(page.locator('#character-dialog')).not.toContainText('Druckwelle');
  await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
}

test('the existing companion day continues through the evening conversation into the inn', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
  await page.addInitScript(() => localStorage.setItem('selantis.settings.v1', JSON.stringify({ reducedMotion: true })));
  await page.goto('/?scene=companions-road');
  await page.waitForFunction(() => (window as any).game?.scene.isActive('companions-road'));
  const before = await world(page);
  await clickMap(page, [320, 214], false);
  await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').talking);
  for (let guard = 0; guard < 30; guard++) {
    if ((await world(page)).flags.companionRestTaken) break;
    await page.keyboard.press('KeyE');
  }
  expect((await world(page)).flags.companionRestTaken).toBe(true);
  await clickMap(page, [604, 154], false);
  await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').data.get('story:companions-phase') === 'afternoon');
  await clickMap(page, [600, 185], false);
  await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').talking);
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyE');
  await waitChapter(page, 'golden-boar');
  expect((await world(page)).flags.companionDayComplete).toBe(true);
  expect((await world(page)).inv).toEqual(before.inv);
  expect((await world(page)).picked).toEqual(before.picked);
  await page.screenshot({ path: `${output}/companion-day-to-inn.png`, fullPage: true });
});

for (const mode of [{ name: 'desktop', viewport: { width: 1280, height: 800 }, touch: false }, { name: 'touch', viewport: { width: 390, height: 844 }, touch: true }]) {
  test.describe(mode.name, () => {
    test.use({ viewport: mode.viewport, hasTouch: mode.touch });
    test('all continuation chapters reach the first film ending through player inputs and preserve reentry state', async ({ page }) => {
      test.setTimeout(360_000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' || /texture.*(?:missing|not found)|failed to load/i.test(message.text())) errors.push(message.text()); });
      await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
      await page.addInitScript(reducedMotion => localStorage.setItem('selantis.settings.v1', JSON.stringify({ reducedMotion })), mode.touch);
      // The URL checkpoint is the sole initial-state operation. The subsequent
      // nine chapters use real map taps/clicks and dialogue input throughout.
      await page.goto('/?scene=golden-boar');
      await waitChapter(page, 'golden-boar');
      const initial = await world(page);
      expect(Object.keys(initial.inv).length, 'checkpoint retains the packed travel inventory').toBeGreaterThan(0);
      const durableFlags: string[] = [];
      let actionsCompleted = 0;
      for (const chapter of chapters) {
        await waitChapter(page, chapter);
        await readSequence(page, chapter, mode.touch);
        expect(await page.evaluate(key => {
          const scene = (window as any).game.scene.getScene(key);
          return [scene.chapter.area.bg, ...scene.chapter.actors.map((actor: any) => actor.texture),
            ...(scene.chapter.entry ?? []).map((beat: any) => beat.shot),
            ...scene.chapter.actions.flatMap((action: any) => action.beats.map((beat: any) => beat.shot))]
            .filter(Boolean).filter(texture => !scene.textures.exists(texture));
        }, chapter), `all ${chapter} backgrounds, actors and shots loaded`).toEqual([]);
        if (chapter === 'golden-boar') await assertParty(page, ['lia', 'foltan', 'azar']);
        for (let guard = 0; guard < 30; guard++) {
          const current = await snapshot(page, chapter);
          const pending = current.actions.filter(action => !action.complete);
          if (!pending.length) break;
          const action = pending.find(candidate => candidate.available);
          expect(action, `an unfinished action must be reachable in ${chapter}`).toBeDefined();
          await clickMap(page, action!.at, mode.touch);
          await expect.poll(async () => (await snapshot(page, chapter)).talking, { timeout: 15_000 }).toBe(true);
          if (action!.challenge === 'rescue') {
            await winRescue(page, { touch: mode.touch }); await returnFromRescue(page); await waitChapter(page, chapter);
          }
          if (action!.challenge === 'tracking') { await solveTracking(page); await waitChapter(page, chapter); }
          await readSequence(page, chapter, mode.touch);
          await expect.poll(async () => (await world(page)).flags[action!.flag]).toBe(true);
          durableFlags.push(action!.flag); actionsCompleted++;
          if (action!.id === 'protect-kyra') {
            const before = await world(page), beforeActors = await actors(page, chapter);
            expect(beforeActors.lia.angle).toBe(78);
            expect(beforeActors.actors.filter(actor => ['captain', 'guard'].includes(actor.id)).every(actor => !actor.visible)).toBe(true);
            await page.screenshot({ path: `${output}/${mode.name}-magic-aftermath.png`, fullPage: true });
            await restartScene(page, chapter); await waitChapter(page, chapter);
            expect(await world(page)).toEqual(before);
            expect(await actors(page, chapter)).toEqual(beforeActors);
            expect(await page.evaluate(() => Number((window as any).game.scene.getScene('sisters-reunited').chapterActors.get('kyra').frame.name))).toBe(0);
            expect((await snapshot(page, chapter)).talking).toBe(false);
            await expect(page.locator('[data-key="Q"]')).toBeHidden();
            await expect(page.locator('[data-key="R"]')).toBeHidden();
          }
        }
        const complete = await snapshot(page, chapter);
        expect(complete.actions.every(action => action.complete)).toBe(true);
        expect(complete.exit.available).toBe(true);
        expect((await world(page)).inv).toEqual(initial.inv);
        expect((await world(page)).picked).toEqual(initial.picked);
        for (const flag of durableFlags) expect((await world(page)).flags[flag], flag).toBe(true);
        if (chapter === 'brotherhood' || chapter === 'sisters-reunited') {
          const before = await world(page), beforeActors = await actors(page, chapter);
          await restartScene(page, chapter); await waitChapter(page, chapter);
          expect(await world(page)).toEqual(before);
          expect(await actors(page, chapter)).toEqual(beforeActors);
          const reentry = await snapshot(page, chapter);
          expect(reentry.talking).toBe(false);
          expect(reentry.actions.every(action => action.complete && !action.available)).toBe(true);
        }
        if (chapter === 'film-one-finale') {
          await assertParty(page, ['lia', 'flick', 'kyra']);
          expect(complete.actors.filter(actor => actor.visible).map(actor => actor.id)).toEqual(['flick', 'kyra']);
        }
        await page.screenshot({ path: `${output}/${mode.name}-${chapter}.png`, fullPage: true });
        await clickMap(page, complete.exit.at, mode.touch);
        if (chapter === 'film-one-finale') {
          await expect.poll(async () => (await snapshot(page, chapter)).ended).toBe(true);
        } else await waitChapter(page, complete.exit.to);
      }
      const final = await world(page);
      expect(final.flags['film.film-one-complete']).toBe(true);
      expect(final.flags['novel.trust-broken']).toBe(true);
      expect(final.flags['film.sisters-reunited']).toBe(true);
      expect(final.inv).toEqual(initial.inv);
      expect(final.picked).toEqual(initial.picked);
      expect(actionsCompleted).toBeGreaterThan(25);
      expect(await page.evaluate(() => (window as any).game.scene.getScenes(true).map((scene: any) => scene.scene.key))).toEqual(['film-one-finale']);
      await page.screenshot({ path: `${output}/${mode.name}-first-film-ending.png`, fullPage: true });
      await restartScene(page, 'film-one-finale'); await waitChapter(page, 'film-one-finale');
      expect((await snapshot(page, 'film-one-finale')).ended).toBe(true);
      expect(await world(page)).toEqual(final);
      // Replay is the actual on-screen control, and reaches the same boundary.
      await page.getByRole('button', { name: 'Letzten Abschnitt wiederholen', exact: true }).click();
      await waitChapter(page, 'film-one-finale');
      await expect.poll(async () => {
        const restarting = await snapshot(page, 'film-one-finale');
        return !restarting.ended && restarting.sequence?.status === 'active' && restarting.sequence.index === 0;
      }).toBe(true);
      await readSequence(page, 'film-one-finale', mode.touch);
      for (let guard = 0; guard < 10; guard++) {
        const replay = await snapshot(page, 'film-one-finale');
        const action = replay.actions.find(candidate => candidate.available && !candidate.complete);
        if (!action) break;
        await clickMap(page, action.at, mode.touch);
        await expect.poll(async () => (await snapshot(page, 'film-one-finale')).talking, { timeout: 15_000 }).toBe(true);
        await readSequence(page, 'film-one-finale', mode.touch);
      }
      const replay = await snapshot(page, 'film-one-finale');
      expect(replay.actions.every(action => action.complete)).toBe(true);
      await clickMap(page, replay.exit.at, mode.touch);
      await expect.poll(async () => (await snapshot(page, 'film-one-finale')).ended).toBe(true);
      expect(await world(page)).toEqual(final);
      expect(errors).toEqual([]);
    });

    test('the first film ending has readable controls and replays without changing supplies', async ({ page }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
      await page.addInitScript(reducedMotion => localStorage.setItem('selantis.settings.v1', JSON.stringify({ reducedMotion })), mode.touch);
      await page.goto('/?scene=film-one-finale');
      await waitChapter(page, 'film-one-finale');
      const initial = await world(page);
      const finish = async () => {
        await readSequence(page, 'film-one-finale', mode.touch);
        for (let guard = 0; guard < 10; guard++) {
          const current = await snapshot(page, 'film-one-finale');
          const action = current.actions.find(candidate => candidate.available && !candidate.complete);
          if (!action) break;
          await clickMap(page, action.at, mode.touch);
          await expect.poll(async () => (await snapshot(page, 'film-one-finale')).talking, { timeout: 15_000 }).toBe(true);
          await readSequence(page, 'film-one-finale', mode.touch);
        }
        const current = await snapshot(page, 'film-one-finale');
        expect(current.actions.every(action => action.complete)).toBe(true);
        await clickMap(page, current.exit.at, mode.touch);
        await expect.poll(async () => (await snapshot(page, 'film-one-finale')).ended).toBe(true);
      };
      await finish();
      const completed = await world(page);
      expect(completed.inv).toEqual(initial.inv);
      expect(completed.picked).toEqual(initial.picked);
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Ende des ersten Teils');
      const replay = page.getByRole('button', { name: 'Letzten Abschnitt wiederholen', exact: true });
      const title = page.getByRole('button', { name: 'Zurück zum Titel', exact: true });
      for (const button of [replay, title]) {
        await expect(button).toBeVisible();
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(mode.viewport.width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(mode.viewport.width);
      await page.screenshot({ path: `${output}/${mode.name}-native-first-film-ending.png`, fullPage: true });
      await restartScene(page, 'film-one-finale'); await waitChapter(page, 'film-one-finale');
      await expect(dialog).toBeVisible();
      await expect(replay).toHaveCount(1);
      expect(await world(page)).toEqual(completed);
      await replay.click();
      await expect(dialog).toBeHidden();
      await expect.poll(async () => {
        const current = await snapshot(page, 'film-one-finale');
        return !current.ended && current.sequence?.status === 'active' && current.sequence.index === 0;
      }).toBe(true);
      await finish();
      await expect(dialog).toBeVisible();
      expect(await world(page)).toEqual(completed);
      await title.click();
      await page.waitForFunction(() => (window as any).game.scene.isActive('title'));
      await expect(dialog).toBeHidden();
      expect(errors).toEqual([]);
    });

    test('named continuation speakers show their own portraits after fresh chapter entry', async ({ page }) => {
      test.setTimeout(90_000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
      await page.addInitScript(() => localStorage.setItem('selantis.settings.v1', JSON.stringify({ reducedMotion: true })));
      const advance = async () => {
        if (mode.touch) await page.locator('.mobile-action[data-key="E"]').tap();
        else await page.keyboard.press('KeyE');
      };
      const assertSpeaker = async (chapter: string, speaker: string, portrait: string) => {
        for (let guard = 0; guard < 20; guard++) {
          const name = await page.evaluate(key => (window as any).game.scene.getScene(key).data.get('dialogue:speaker'), chapter);
          if (name === speaker) break;
          const current = await snapshot(page, chapter);
          expect(current.talking, `${speaker} has an authored spoken beat`).toBe(true);
          await page.waitForFunction(key => (window as any).game.scene.getScene(key).data.get('story:continuation').sequence.ready, chapter);
          const previous = current.sequence!.index;
          await advance();
          await expect.poll(async () => (await snapshot(page, chapter)).sequence?.index).not.toBe(previous);
        }
        expect(await page.evaluate(key => {
          const scene = (window as any).game.scene.getScene(key);
          return { name: scene.data.get('dialogue:speaker'), src: scene.data.get('dialogue:portraitSrc'),
            texture: scene.closeup.dialogue.portrait.texture.key, visible: scene.closeup.dialogue.portraitCard.visible,
            illustration: scene.closeup.art.visible };
        }, chapter)).toEqual({ name: speaker, src: expect.stringMatching(new RegExp(`^/assets/portraits/${portrait}\\.png(?:\\?v=[0-9a-f]{12})?$`)), texture: `portrait-${portrait}`, visible: !mode.touch, illustration: chapter === 'film-one-finale' });
        if (mode.touch) {
          await expect(page.locator('[data-mobile-speaker]')).toHaveText(speaker);
          await expect(page.locator('[data-mobile-portrait]')).toBeVisible();
          await expect(page.locator('[data-mobile-portrait]')).toHaveAttribute('src', new RegExp(`^/assets/portraits/${portrait}\\.png(?:\\?v=[0-9a-f]{12})?$`));
          await expect.poll(() => page.locator('[data-mobile-portrait]').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
        }
        await page.screenshot({ path: `${output}/${mode.name}-portrait-${speaker.toLowerCase()}.png`, fullPage: true });
      };
      const use = async (chapter: string, id: string) => {
        const action = (await snapshot(page, chapter)).actions.find(candidate => candidate.id === id)!;
        expect(action.available).toBe(true);
        await clickMap(page, action.at, mode.touch);
        await expect.poll(async () => (await snapshot(page, chapter)).talking, { timeout: 15_000 }).toBe(true);
      };
      await page.goto('/?scene=golden-boar'); await waitChapter(page, 'golden-boar');
      await readSequence(page, 'golden-boar', mode.touch);
      await use('golden-boar', 'sister-description'); await readSequence(page, 'golden-boar', mode.touch);
      await use('golden-boar', 'craupor-questioning'); await assertSpeaker('golden-boar', 'Craupor', 'dialogue-craupor');
      await page.goto('/?scene=brotherhood'); await waitChapter(page, 'brotherhood');
      await readSequence(page, 'brotherhood', mode.touch);
      await use('brotherhood', 'elnon-welcome'); await assertSpeaker('brotherhood', 'Elnon', 'dialogue-elnon');
      await page.goto('/?scene=flick-trail'); await waitChapter(page, 'flick-trail');
      await readSequence(page, 'flick-trail', mode.touch);
      await use('flick-trail', 'follow-hoofprints'); await assertSpeaker('flick-trail', 'Flick', 'dialogue-flick');
      await page.goto('/?scene=film-one-finale'); await waitChapter(page, 'film-one-finale');
      expect(await page.evaluate(() => (window as any).game.scene.getScene('film-one-finale').closeup.image.texture.key)).toBe('cinematic-master-rebuke');
      await assertSpeaker('film-one-finale', 'Vardis', 'dialogue-vardis');
      expect(errors).toEqual([]);
    });
  });
}
