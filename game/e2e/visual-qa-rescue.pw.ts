import { test, expect, type Page } from '@playwright/test';
import { restartScene } from './helpers/scenes';
import { rescueSnapshot, returnFromRescue, waitForRescue, winRescue } from './helpers/rescue';

const output = process.env.RESCUE_QA_OUTPUT ?? '../output/qa/visual-playtest/rescue';
const sizes = [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }];
async function snapshot(page: Page, key: string) {
  return page.evaluate(key => {
    const scene = (window as any).game.scene.getScene(key);
    return { ...scene.data.get('story:continuation'), beat: scene.data.get('story:chapter-beat'), typing: scene.data.get('dialogue:typing'),
      shot: scene.closeup?.image.texture.key, art: scene.closeup?.art.visible, speaker: scene.data.get('dialogue:speaker'), portrait: scene.data.get('dialogue:portraitSrc'),
      lia: { x: scene.lia.x, y: scene.lia.y, angle: scene.lia.angle }, flags: { ...(window as any).game.registry.get('world').flags } };
  }, key);
}
async function shot(page: Page, name: string) {
  const size = page.viewportSize()!;
  await page.screenshot({ path: `${output}/${size.width}x${size.height}-${name}.png`, fullPage: true });
}
async function map(page: Page, point: number[]) {
  const transformed = await page.evaluate(point => {
    const game = (window as any).game;
    const scene = game.scene.getScenes(true).find((scene: any) => scene.areaRoot);
    const position = scene.areaRoot.getWorldTransformMatrix().transformPoint(point[0], point[1]);
    return [position.x, position.y];
  }, point);
  const box = (await page.locator('canvas').boundingBox())!;
  const x = box.x + box.width * transformed[0] / 640, y = box.y + box.height * transformed[1] / 360;
  if (page.viewportSize()!.width === 1280) await page.mouse.click(x, y);
  else await page.touchscreen.tap(x, y);
}
async function advance(page: Page) {
  if (page.viewportSize()!.width === 1280) await page.keyboard.press('KeyE');
  else await page.locator('.mobile-action[data-key="E"]').tap();
}
async function read(page: Page, key: string, capture = true) {
  for (let guard = 0; guard < 30; guard++) {
    await page.waitForTimeout(50);
    const before = await snapshot(page, key);
    if (!before.talking) return;
    if (before.typing) { await advance(page); await page.waitForFunction(key => !(window as any).game.scene.getScene(key).data.get('dialogue:typing'), key); }
    await page.waitForFunction(key => (window as any).game.scene.getScene(key).data.get('story:continuation').sequence.ready, key);
    const settled = await snapshot(page, key);
    if (before.beat === 'sisters-reunited.free.flick') {
      expect(settled.art, 'the unbinding shows the captive, before Lia collapses').toBe(false);
      expect(settled.actors.find((actor: any) => actor.id === 'kyra')).toMatchObject({ frame: 0, bound: false });
    }
    if (before.beat.startsWith('film-one-finale.entry.') && !before.beat.endsWith('.forest')) {
      expect(settled.art, 'the distant rebuke stays at the ruin').toBe(true);
      expect(settled.shot).toBe('cinematic-master-rebuke');
      if (before.beat.endsWith('.admission')) {
        expect(settled.speaker).toBe('Vardis');
        expect(settled.portrait).toContain('dialogue-vardis.png');
      }
    }
    if (before.beat === 'sisters-reunited.burst.flight') expect(settled.actors.filter((actor: any) => ['captain', 'guard'].includes(actor.id)).every((actor: any) => actor.visible)).toBe(true);
    if (before.beat === 'sisters-reunited.free.retreat') expect(settled.actors.find((actor: any) => actor.id === 'guard').angle).toBe(0);
    if (capture) await shot(page, before.beat);
    await advance(page);
    await expect.poll(async () => { const after = await snapshot(page, key); return !after.talking || after.beat !== before.beat; }).toBe(true);
  }
  throw new Error(`Sequence stuck in ${key}`);
}
async function action(page: Page, key: string, id: string) {
  await page.waitForTimeout(80);
  const current = await snapshot(page, key);
  await map(page, current.actions.find((action: any) => action.id === id).at);
  await expect.poll(async () => (await snapshot(page, key)).currentAction, { timeout: 20000 }).toBe(id);
}
async function completeRescue(page: Page, capture = true) {
  await action(page, 'sisters-reunited', 'hold-guards-attention');
  await waitForRescue(page);
  expect((await snapshot(page, 'sisters-reunited')).flags['film.kyra-unbound']).not.toBe(true);
  expect((await rescueSnapshot(page)).freed).toBe(false);
  if (capture) await shot(page, 'battle-01-captive-board');
  let rounds = 0;
  await winRescue(page, { touch: page.viewportSize()!.width !== 1280, onRound: async current => {
    rounds++;
    expect(current.units.find((unit: any) => unit.id === 'kyra').hp).toBeGreaterThan(0);
    if (capture) await shot(page, `battle-0${rounds + 1}-round-${rounds}`);
  } });
  expect(rounds).toBe(3);
  const won = await rescueSnapshot(page);
  expect(won.phase).toBe('won'); expect(won.freed).toBe(true);
  expect(won.guarding).toContain('lia');
  expect((await snapshot(page, 'sisters-reunited')).flags['film.kyra-unbound']).not.toBe(true);
  if (capture) await shot(page, 'battle-05-victory');
  await returnFromRescue(page);
  await expect.poll(async () => (await snapshot(page, 'sisters-reunited')).flags['film.kyra-unbound']).toBe(true);
  expect((await snapshot(page, 'sisters-reunited')).actors.find((actor: any) => actor.id === 'kyra')).toMatchObject({ frame: 0, bound: false });
}

for (const viewport of sizes) {
  test.describe(`rescue visual QA ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: viewport.width !== 1280 });
    test('captivity, rescue, burst, recovery, master, party walk and replay through physical input', async ({ page }) => {
      test.setTimeout(220000);
      page.setDefaultTimeout(15000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
      await page.goto('/?scene=sisters-reunited');
      await page.waitForFunction(() => (window as any).game?.scene.getScene('sisters-reunited').data.get('story:continuation'));
      await read(page, 'sisters-reunited'); await shot(page, '01-captive-map');
      await page.keyboard.press('KeyI');
      await expect(page.getByRole('dialog')).toContainText('Tasche'); await shot(page, '01-inventory');
      await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
      expect((await snapshot(page, 'sisters-reunited')).actors.find((actor: any) => actor.id === 'kyra')).toMatchObject({ frame: 1, bound: true });
      await completeRescue(page); await shot(page, '02-freed-map');
      expect((await snapshot(page, 'sisters-reunited')).actors.find((actor: any) => actor.id === 'kyra')).toMatchObject({ frame: 0, bound: false });
      await action(page, 'sisters-reunited', 'protect-kyra'); await read(page, 'sisters-reunited'); await shot(page, '03-collapse-map');
      const collapsed = await snapshot(page, 'sisters-reunited');
      expect(collapsed.lia.angle).toBe(78);
      expect(collapsed.actors.filter((actor: any) => ['captain', 'guard'].includes(actor.id)).every((actor: any) => !actor.visible)).toBe(true);
      await restartScene(page, 'sisters-reunited');
      await expect.poll(async () => (await snapshot(page, 'sisters-reunited')).lia.angle).toBe(78);
      await action(page, 'sisters-reunited', 'answer-kyra'); await read(page, 'sisters-reunited'); await shot(page, '04-recovered-map');
      expect((await snapshot(page, 'sisters-reunited')).lia.angle).toBe(0);
      const recovered = await snapshot(page, 'sisters-reunited');
      const sister = recovered.actors.find((actor: any) => actor.id === 'kyra');
      expect(Math.abs(sister.at[0] - recovered.lia.x), 'Kyra leaves Lia visible after she stands up').toBeGreaterThanOrEqual(16);
      await page.getByRole('button', { name: 'Gruppe ansehen · C', exact: true }).click();
      await expect(page.locator('#character-dialog')).not.toContainText('Strahl');
      await expect(page.locator('#character-dialog')).not.toContainText('Druckwelle');
      await shot(page, '05-reunited-party');
      await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
      await map(page, (await snapshot(page, 'sisters-reunited')).exit.at);
      await page.waitForFunction(() => (window as any).game.scene.isActive('film-one-finale'));
      await read(page, 'film-one-finale'); await shot(page, '06-finale-map');
      for (const id of ['support-kyra', 'ask-next-way', 'walk-together']) { await action(page, 'film-one-finale', id); await read(page, 'film-one-finale'); await shot(page, id); }
      await map(page, (await snapshot(page, 'film-one-finale')).exit.at);
      await expect(page.getByRole('dialog')).toContainText('Ende des ersten Teils'); await shot(page, '07-ending');
      for (const name of ['Letzten Abschnitt wiederholen', 'Zurück zum Titel']) {
        const bounds = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      }
      await page.getByRole('button', { name: 'Letzten Abschnitt wiederholen', exact: true }).click();
      await expect.poll(async () => (await snapshot(page, 'film-one-finale')).beat).toBe('film-one-finale.entry.ruin');
      await read(page, 'film-one-finale', false);
      for (const id of ['support-kyra', 'ask-next-way', 'walk-together']) { await action(page, 'film-one-finale', id); await read(page, 'film-one-finale', false); }
      await map(page, (await snapshot(page, 'film-one-finale')).exit.at);
      await page.getByRole('button', { name: 'Zurück zum Titel', exact: true }).click();
      await page.waitForFunction(() => (window as any).game.scene.isActive('title')); await shot(page, '08-title');
      expect(errors).toEqual([]);
    });

    test('pause and resize freeze burst; interrupting burst and collapse preserves fresh input and state', async ({ page }) => {
      test.setTimeout(160000);
      page.setDefaultTimeout(15000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
      await page.goto('/?scene=sisters-reunited');
      await page.waitForFunction(() => (window as any).game?.scene.getScene('sisters-reunited').data.get('story:continuation'));
      await read(page, 'sisters-reunited', false);
      await completeRescue(page, false);
      const reachBurst = async () => {
        await action(page, 'sisters-reunited', 'protect-kyra');
        for (let i = 0; i < 2; i++) {
          await page.waitForTimeout(60);
          const before = await snapshot(page, 'sisters-reunited');
          if ((await snapshot(page, 'sisters-reunited')).typing) await advance(page);
          await page.waitForFunction(() => {
            const scene = (window as any).game.scene.getScene('sisters-reunited');
            return scene.data.get('story:continuation').sequence.ready && !scene.data.get('dialogue:typing');
          });
          await advance(page);
          await expect.poll(async () => (await snapshot(page, 'sisters-reunited')).beat).not.toBe(before.beat);
        }
        await expect.poll(async () => (await snapshot(page, 'sisters-reunited')).beat).toBe('sisters-reunited.burst.light');
      };
      await reachBurst();
      await page.keyboard.press('KeyI');
      await expect(page.locator('#character-dialog')).not.toBeVisible();
      await page.keyboard.press('KeyO');
      await page.waitForFunction(() => (window as any).game.scene.isPaused('sisters-reunited'));
      const paused = await snapshot(page, 'sisters-reunited');
      await page.waitForTimeout(200);
      expect((await snapshot(page, 'sisters-reunited')).actors).toEqual(paused.actors);
      await shot(page, 'stress-burst-options');
      await page.setViewportSize(viewport.width === 1280 ? { width: 390, height: 844 } : { width: 1280, height: 800 });
      await page.waitForTimeout(120); await page.setViewportSize(viewport);
      if (viewport.width === 1280) await page.keyboard.press('KeyO');
      else await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
      await page.waitForFunction(() => (window as any).game.scene.isActive('sisters-reunited'));
      await restartScene(page, 'sisters-reunited');
      expect((await snapshot(page, 'sisters-reunited')).flags['film.magic-erupted']).not.toBe(true);
      expect((await snapshot(page, 'sisters-reunited')).lia.angle).toBe(0);
      await reachBurst();
      // Early and rapid reads must reveal the line while its cue still owns advance.
      await page.keyboard.press('KeyE');
      if (!(await snapshot(page, 'sisters-reunited')).sequence.ready) {
        await page.keyboard.press('KeyE'); await page.keyboard.press('KeyE');
        const rapid = await snapshot(page, 'sisters-reunited');
        if (!rapid.sequence.ready) expect(rapid.beat).toBe('sisters-reunited.burst.light');
      }
      await page.waitForFunction(() => {
        const scene = (window as any).game.scene.getScene('sisters-reunited');
        return scene.data.get('story:continuation').sequence.ready && !scene.data.get('dialogue:typing');
      });
      if ((await snapshot(page, 'sisters-reunited')).beat === 'sisters-reunited.burst.light') await advance(page);
      await expect.poll(async () => (await snapshot(page, 'sisters-reunited')).lia.angle).toBe(78);
      await shot(page, 'stress-mid-collapse');
      await restartScene(page, 'sisters-reunited');
      expect((await snapshot(page, 'sisters-reunited')).lia.angle).toBe(0);
      await reachBurst(); await read(page, 'sisters-reunited', false);
      await action(page, 'sisters-reunited', 'answer-kyra'); await read(page, 'sisters-reunited', false);
      expect((await snapshot(page, 'sisters-reunited')).flags['film.lia-recovered']).toBe(true);
      await shot(page, 'stress-recovered'); expect(errors).toEqual([]);
    });
  });
}
