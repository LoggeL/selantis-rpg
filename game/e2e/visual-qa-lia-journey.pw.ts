import { test, expect, type Page } from '@playwright/test';

const output = '../output/qa/visual-playtest/lia-journey';
test.describe.configure({ mode: 'parallel' });
const sizes = [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }];
async function shot(page: Page, name: string) {
  const size = page.viewportSize()!;
  await page.screenshot({ path: `${output}/${size.width}x${size.height}-${name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function clickMap(page: Page, x: number, y: number) {
  const frame = await page.evaluate(() => (window as any).game.loop.frame);
  await page.waitForFunction(frame => (window as any).game.loop.frame > frame + 3, frame);
  const bounds = (await page.locator('canvas').boundingBox())!;
  const px = bounds.x + bounds.width * x / 640, py = bounds.y + bounds.height * y / 360;
  if (page.viewportSize()!.width === 1280) await page.mouse.click(px, py);
  else await page.touchscreen.tap(px, py);
}
async function active(page: Page, key: string) {
  await page.waitForFunction(key => (window as any).game?.scene?.isActive(key), key);
}
async function read(page: Page, key: string) {
  await page.waitForFunction(key => !(window as any).game.scene.getScene(key).data.get('dialogue:typing'), key);
  if (page.viewportSize()!.width === 1280) await page.keyboard.press('KeyE', { delay: 60 });
  else await page.locator('.mobile-action[data-key="E"]').tap();
}
async function spot(page: Page, key: string, id: string) {
  const at = await page.evaluate(({ key, id }) => (window as any).game.scene.getScene(key).spots.find((s: any) => s.id === id).at, { key, id });
  await clickMap(page, at[0], at[1]);
}
async function settings(page: Page, name: string) {
  const button = page.getByRole('button', { name: 'Einstellungen', exact: true });
  if (page.viewportSize()!.width !== 1280 && await button.isVisible()) await button.click();
  else await page.keyboard.press('KeyO');
  await active(page, 'Settings');
  await page.waitForTimeout(150);
  const paused = await page.evaluate(() => (window as any).game.scene.getScenes(false).filter((s: any) => s.sys.isPaused()).map((s: any) => s.sys.settings.key));
  expect(paused.length).toBeGreaterThan(0);
  await shot(page, `${name}-settings`);
  const back = page.getByRole('button', { name: 'Zurück zum Spiel', exact: true });
  if (await back.isVisible()) await back.click();
  else await page.keyboard.press('KeyO');
  await page.waitForFunction(() => !(window as any).game.scene.isActive('Settings'));
}

for (const viewport of sizes) {
  test.describe(`Lia and journey visual playtest ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: viewport.width !== 1280, isMobile: viewport.width !== 1280 });
    test.beforeEach(async ({ page }) => {
      await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
    });
    test('settings pause fire timing and Foltan conversation without consuming their actions', async ({ page }) => {
      test.setTimeout(90000);
      await page.goto('/?scene=camp'); await active(page, 'journey');
      for (const [id, next] of [['bedroll', 'stones'], ['stones', 'ring'], ['fire', 'twigs'], ['twigs', 'fire']]) {
        await spot(page, 'journey', id);
        await page.waitForFunction(next => (window as any).game.scene.getScene('journey').campStep === next, next);
      }
      await spot(page, 'journey', 'fire');
      await page.waitForFunction(() => (window as any).game.scene.getScene('journey').fireBusy);
      const options = page.getByRole('button', { name: 'Einstellungen', exact: true });
      if (viewport.width !== 1280 && await options.isVisible()) await options.click(); else await page.keyboard.press('KeyO');
      await active(page, 'Settings');
      const before = await page.evaluate(() => { const s = (window as any).game.scene.getScene('journey'); return { clock: s.fireGame.elapsedMs, heat: s.fireGame.heat }; });
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => { const s = (window as any).game.scene.getScene('journey'); return { clock: s.fireGame.elapsedMs, heat: s.fireGame.heat }; })).toEqual(before);
      await shot(page, 'fire-timing-settings');
      if (await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).isVisible()) await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
      else await page.keyboard.press('KeyO');
      await page.waitForFunction(clock => (window as any).game.scene.getScene('journey').fireGame.elapsedMs > clock, before.clock);
      expect(await page.evaluate(() => (window as any).game.scene.getScene('journey').fireGame.heat)).toBe(before.heat);
      await page.goto('/?scene=strangers'); await active(page, 'journey');
      await spot(page, 'journey', 'foltan');
      await page.waitForFunction(() => (window as any).game.scene.getScene('journey').campConversationActive);
      const dialogue = await page.evaluate(() => (window as any).game.scene.getScene('journey').data.get('dialogue:fullText'));
      await settings(page, 'foltan-conversation');
      expect(await page.evaluate(() => (window as any).game.scene.getScene('journey').campConversationActive)).toBe(true);
      expect(await page.evaluate(() => (window as any).game.scene.getScene('journey').data.get('dialogue:fullText'))).toBe(dialogue);
      if (viewport.width === 1280) await page.keyboard.press('Escape'); else await page.locator('.mobile-action[data-key="ESC"]').tap();
      await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').campConversationActive);
    });
    test('Kyra introduction, sister dialogue, meadow details and normal homeward transition', async ({ page }) => {
      test.setTimeout(130000);
      await page.goto('/?scene=lia'); await active(page, 'lia');
      await page.waitForTimeout(1000); await shot(page, '01-lia-chapter-card');
      for (let index = 0; index < 3; index++) {
        await page.waitForFunction(index => { const s = (window as any).game.scene.getScene('lia'); return s.phase === 'kyra' && s.kyraLine === index; }, index);
        await page.waitForFunction(() => !(window as any).game.scene.getScene('lia').data.get('dialogue:typing'));
        await shot(page, `02-kyra-${index}`); await read(page, 'lia');
      }
      for (let index = 0; index < 12; index++) {
        await page.waitForFunction(index => { const s = (window as any).game.scene.getScene('lia'); return s.phase === 'sisters' && s.sisterLine === index; }, index);
        if ([0, 4, 11].includes(index)) { await page.waitForFunction(() => !(window as any).game.scene.getScene('lia').data.get('dialogue:typing')); await shot(page, `03-sisters-${index}`); }
        await read(page, 'lia');
      }
      await page.waitForFunction(() => (window as any).game.scene.getScene('lia').phase === 'reading');
      await read(page, 'lia');
      await page.waitForFunction(() => (window as any).game.scene.getScene('lia').phase === 'free');
      await shot(page, '04-lia-free');
      await clickMap(page, 409, 218);
      await page.waitForFunction(() => (window as any).game.scene.getScene('lia').found.has('flowers'));
      await shot(page, '05-flower-bookmark');
      await clickMap(page, 552, 262);
      await active(page, 'world');
      expect(await page.evaluate(() => (window as any).game.scene.getScene('world').map.id)).toBe('hohlweg');
      await shot(page, '06-lia-homeward-hohlweg');
    });
    test('all five world maps have readable hotspots, controls and bag', async ({ page }) => {
      test.setTimeout(60000);
      for (const map of ['wiese', 'felder', 'waldrand', 'hohlweg', 'hof']) {
        await page.goto(`/?scene=world&map=${map}`); await active(page, map === 'hof' ? 'raid' : 'world');
        await page.waitForTimeout(900); await shot(page, `07-world-${map}`);
        if (map === 'waldrand') { await page.getByRole('button', { name: 'Tasche', exact: true }).click(); await shot(page, '08-world-bag'); await page.keyboard.press('Escape'); }
      }
    });
    test('raid witness, both grief phases and house packing through normal interactions', async ({ page }) => {
      test.setTimeout(360000);
      const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('/?scene=raid'); await active(page, 'raid');
      await page.waitForTimeout(800); await shot(page, '09-raid-approach');
      await spot(page, 'raid', 'hide');
      for (let index = 0; index < 40; index++) {
        const progress = await page.evaluate(() => (window as any).game.scene.getScene('raid').data.get('story:raid'));
        if (progress.step === 'seek-parents') break;
        await page.waitForFunction(() => (window as any).game.scene.getScene('raid').data.get('story:raid')?.ready);
        const ready = await page.evaluate(() => (window as any).game.scene.getScene('raid').data.get('story:raid'));
        await page.waitForFunction(() => !(window as any).game.scene.getScene('raid').data.get('dialogue:typing'));
        await shot(page, `10-raid-${ready.step}`);
        if (ready.index === 0) await settings(page, 'raid-dialogue');
        await read(page, 'raid');
        await page.waitForFunction(step => (window as any).game.scene.getScene('raid').data.get('story:raid')?.step !== step, ready.step);
      }
      await shot(page, '11-raid-corpses'); await spot(page, 'raid', 'parents');
      for (let index = 0; index < 4; index++) {
        await page.waitForFunction(() => (window as any).game.scene.getScene('raid').data.get('story:raid')?.ready);
        await page.waitForFunction(() => !(window as any).game.scene.getScene('raid').data.get('dialogue:typing'));
        await shot(page, `12-parents-grief-${index}`); await read(page, 'raid');
      }
      await active(page, 'aftermath');
      for (let index = 0; index < 6; index++) {
        await page.waitForFunction(index => { const p = (window as any).game.scene.getScene('aftermath').data.get('story:grief'); return p?.index === index && p.ready; }, index);
        await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').data.get('dialogue:typing'));
        await shot(page, `13-aftermath-grief-${index}`); await read(page, 'aftermath');
      }
      await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').locked);
      await shot(page, '14-aftermath-farm'); await spot(page, 'aftermath', 'door');
      await page.waitForFunction(() => (window as any).game.scene.getScene('aftermath').inside);
      await shot(page, '15-house-full');
      for (const [id, flag] of [['clothing', 'packedClothes'], ['food', 'packedFood'], ['water', 'packedWater'], ['cupboard', 'foundCache'], ['medicine', 'packedMedicine'], ['books', 'packedBooks']]) {
        await spot(page, 'aftermath', id);
        await page.waitForFunction(flag => (window as any).game.registry.get('world').flags[flag], flag);
        expect(await page.evaluate(id => (window as any).game.scene.getScene('aftermath').spots.some((s: any) => s.id === id), id)).toBe(false);
        await shot(page, `16-house-${id}-gone`);
      }
      await page.getByRole('button', { name: 'Tasche', exact: true }).click(); await shot(page, '17-packed-bag'); await page.keyboard.press('Escape');
      await spot(page, 'aftermath', 'exit-door');
      await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').inside);
      await spot(page, 'aftermath', 'pig-gate');
      await page.waitForFunction(() => (window as any).game.registry.get('world').flags.departureReady);
      await spot(page, 'aftermath', 'east-departure'); await active(page, 'world');
      expect(errors).toEqual([]);
    });
    test('road to camp, fire timing, meal, strangers and companion trail', async ({ page }) => {
      test.setTimeout(360000);
      const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('/?scene=journey'); await active(page, 'journey');
      await page.waitForTimeout(800); await shot(page, '18-road-arrival');
      for (const [id, flag] of [['stream', 'streamVisited'], ['fork', 'journeyEastChosen']]) {
        await spot(page, 'journey', id); await page.waitForFunction(flag => (window as any).game.registry.get('world').flags[flag], flag);
        await shot(page, `19-road-${id}`);
      }
      await spot(page, 'journey', 'east');
      await page.waitForFunction(() => (window as any).game.scene.getScene('journey').locked);
      await shot(page, '20-evening-arrival'); await read(page, 'journey');
      await page.waitForFunction(() => { const s = (window as any).game.scene.getScene('journey'); return s.inCamp && !s.locked; });
      await shot(page, '21-camp-empty');
      for (const [id, next] of [['bedroll', 'stones'], ['stones', 'ring'], ['fire', 'twigs'], ['twigs', 'fire']]) {
        await spot(page, 'journey', id); await page.waitForFunction(next => (window as any).game.scene.getScene('journey').campStep === next, next);
        await shot(page, `22-camp-${next}`);
      }
      await spot(page, 'journey', 'fire');
      await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:fire-minigame')?.active);
      await shot(page, '23-fire-timing'); await settings(page, 'fire-timing');
      for (let heat = 1; heat <= 6; heat++) {
        await page.waitForFunction(() => { const f = (window as any).game.scene.getScene('journey').data.get('story:fire-minigame'); return f?.active && f.ready && f.marker > .43 && f.marker < .57; });
        await page.getByRole('button', { name: 'Holz bohren', exact: true }).click();
        await page.waitForFunction(heat => (window as any).game.scene.getScene('journey').data.get('story:fire-minigame')?.heat >= heat, heat);
      }
      await page.waitForFunction(() => (window as any).game.scene.getScene('journey').campStep === 'meal');
      await shot(page, '24-camp-fire-lit');
      await page.getByRole('button', { name: 'Tasche', exact: true }).click();
      await page.locator('#bag-dialog').getByRole('button', { name: 'Reiseproviant auswählen', exact: true }).click();
      await shot(page, '25-camp-meal');
      await page.locator('#bag-dialog').getByRole('button', { name: 'Reiseproviant: Essen', exact: true }).click();
      await page.waitForFunction(() => (window as any).game.scene.getScene('journey').campStep === 'sleep');
      await spot(page, 'journey', 'bedroll');
      await page.waitForFunction(() => (window as any).game.scene.getScene('journey').arrivalActive);
      await shot(page, '26-camp-strangers-entering');
      await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:camp-arrival') === 'observing');
      for (let index = 0; index < 25; index++) {
        if (await page.evaluate(() => !!(window as any).game.registry.get('world').flags.metFoltanAzar)) break;
        await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').data.get('dialogue:typing'));
        await shot(page, `27-companion-intro-${index}`); await read(page, 'journey');
      }
      await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').locked); await shot(page, '28-camp-companions');
      await spot(page, 'journey', 'bedroll'); await active(page, 'companions-road');
      await shot(page, '29-companions-morning');
      await spot(page, 'companions-road', 'rest');
      await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').talking);
      for (let index = 0; index < 12; index++) {
        if (await page.evaluate(() => !!(window as any).game.registry.get('world').flags.companionRestTaken)) break;
        await page.waitForFunction(() => !(window as any).game.scene.getScene('companions-road').data.get('dialogue:typing'));
        await shot(page, `30-companions-rest-${index}`); await read(page, 'companions-road');
      }
      await spot(page, 'companions-road', 'continue');
      await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').phase === 'afternoon');
      await shot(page, '31-companions-afternoon');
      await spot(page, 'companions-road', 'rest-return');
      await page.waitForFunction(() => (window as any).game.scene.getScene('companions-road').phase === 'morning');
      await shot(page, '32-companions-backtrack');
      expect(errors).toEqual([]);
    });
  });
}
