import { expect, test } from '@playwright/test';

test('camp arrival survives a restart and a motion-setting change without skipping the map', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, () => {});
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?scene=journey');
  await page.waitForFunction(() => (window as any).game?.scene.isActive('journey'));
  await page.evaluate(() => {
    const game = (window as any).game;
    Object.assign(game.registry.get('world').flags, { journeyCampReached: true, firstCampRested: true,
      journeyCloakSpread: true, journeyStonesGathered: true, journeyFirepitBuilt: true,
      journeyTwigsGathered: true, campfireLit: true, journeyAte: true });
    game.scene.getScene('journey').scene.restart();
  });
  await page.waitForFunction(() => (window as any).game.scene.getScene('journey').arrivalClock > 500);
  // Capture the restart at create(), before any arrival update can run. Hold the
  // restored scene until assertions finish, regardless of parallel test load.
  const restarted = await page.evaluate(() => new Promise(resolve => {
    const game = (window as any).game, s = game.scene.getScene('journey');
    const previous = [s.foltan, s.azar];
    s.events.once('create', () => {
      game.scene.pause('journey');
      resolve({ clock: s.arrivalClock, entering: s.arrivalActive,
        oldDestroyed: previous.every((actor: any) => !actor.active),
        newActors: s.foltan !== previous[0] && s.azar !== previous[1],
        foltan: [s.foltan.x, s.foltan.y], azar: [s.azar.x, s.azar.y],
        shot: !!s.closeup?.visible, pose: s.liaPose, controls: s.data.get('mobile:controls') });
    });
    s.scene.restart();
  }));
  expect(restarted).toMatchObject({ clock: 0, entering: true, oldDestroyed: true, newActors: true,
    foltan: [545, 282], azar: [563, 296], shot: false, pose: 'lia-sleep',
    controls: { directions: [], actions: {}, inventory: false, disabled: true } });
  const heldFrame = await page.evaluate(() => (window as any).game.loop.frame);
  await page.waitForFunction(frame => (window as any).game.loop.frame > frame + 30, heldFrame);
  expect(await page.evaluate(() => (window as any).game.scene.getScene('journey').arrivalClock)).toBe(0);
  await page.evaluate(() => (window as any).game.scene.resume('journey'));
  await expect(page.locator('.mobile-action[data-key="E"]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Tasche', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByLabel('Ruhige Bewegung', { exact: true }).check();
  await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
  await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:camp-arrival') === 'observing');
  expect(await page.evaluate(() => {
    const s = (window as any).game.scene.getScene('journey');
    return { foltan: [s.foltan.x, s.foltan.y, s.foltan.angle], azar: [s.azar.x, s.azar.y, s.azar.angle],
      pose: s.liaPose, shot: s.closeup.image.texture.key, speaker: s.data.get('dialogue:speaker'),
      text: s.data.get('dialogue:fullText'), locked: s.locked };
  })).toMatchObject({ foltan: [259, 245, 0], azar: [295, 242, 0], pose: 'lia-sleep',
    shot: 'cinematic-camp-observe', speaker: '???', text: '"Ist sie tot?"', locked: true });
  await page.screenshot({ path: '../output/qa/camp-arrival-restart-reduced-motion-phone.png', fullPage: true });
  expect(errors).toEqual([]);
});
