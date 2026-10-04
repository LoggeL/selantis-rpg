import { test, expect, type Page } from '@playwright/test';

const output = '../output/qa/visual-playtest/valentus';
const sizes = [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }];
test.describe.configure({ mode: 'parallel' });
for (const viewport of sizes) {
  test(`title exposes its start action without a character health readout at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
    await page.goto('/');
    await page.waitForFunction(() => (window as any).game?.scene?.isActive('title'));
    await page.waitForTimeout(1600);
    await expect(page.locator('.mobile-identity')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
    await shot(page, '01-title');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.waitForFunction(() => (window as any).game.scene.isActive('storyprologue'));
  });
}
async function shot(page: Page, name: string) {
  const size = page.viewportSize()!;
  await page.screenshot({ path: `${output}/${size.width}x${size.height}-${name}.png`, fullPage: true });
}

test('refuge observations follow the zoomed room camera without taking a walking step', async ({ page }) => {
  test.setTimeout(100000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
  await page.goto('/?scene=refuge');
  await page.waitForFunction(() => (window as any).game?.scene?.isActive('refuge'));
  for (let line = 0; line < 3; line++) {
    await page.waitForFunction(() => (window as any).game.scene.getScene('refuge').dialogue?.visible);
    await read(page, 'refuge');
    await page.waitForFunction(() => !(window as any).game.scene.getScene('refuge').dialogue?.visible);
  }
  await phase(page, 'refuge', 'rise');
  await page.waitForFunction(() => !(window as any).game.scene.getScene('refuge').hud?.dialogueVisible);
  await page.keyboard.down('KeyE'); await phase(page, 'refuge', 'walk'); await page.keyboard.up('KeyE');
  for (let step = 0; step < 2; step++) {
    await page.keyboard.press('KeyE', { delay: 60 });
    await page.waitForFunction(() => !(window as any).game.scene.getScene('refuge').stepping);
  }
  const point = await page.evaluate(() => {
    const camera = (window as any).game.scene.getScene('refuge').cameras.main;
    return camera.matrix.transformPoint(235 - camera.scrollX, 91 - camera.scrollY);
  });
  await clickGame(page, point.x, point.y);
  await shot(page, '27-refuge-water-observation');
  expect(await page.evaluate(() => ({
    observed: (window as any).game.scene.getScene('refuge').inspected.has('water'),
    step: (window as any).game.scene.getScene('refuge').step,
  }))).toEqual({ observed: true, step: 2 });
});
async function clickGame(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  const px = box.x + box.width * x / 640, py = box.y + box.height * y / 360;
  if (page.viewportSize()!.width === 1280) await page.mouse.click(px, py);
  else await page.touchscreen.tap(px, py);
}
async function phase(page: Page, key: string, value: string, beat?: number) {
  await page.waitForFunction(({ key, value, beat }) => {
    const scene = (window as any).game?.scene?.getScene(key);
    return scene?.phase === value && (beat === undefined || scene.beat === beat);
  }, { key, value, beat }, { timeout: 20000 });
}
async function read(page: Page, key: string) {
  await page.waitForFunction(key => !(window as any).game.scene.getScene(key).data.get('dialogue:typing'), key);
  if (page.viewportSize()!.width === 1280) await page.keyboard.press('KeyE', { delay: 70 });
  else await page.locator('.mobile-action[data-key="E"]').tap();
}
async function action(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  if (page.viewportSize()!.width === 1280) await button.click(); else await button.tap();
}
async function interact(page: Page) {
  if (page.viewportSize()!.width === 1280) await page.keyboard.press('KeyE', { delay: 60 });
  else await page.locator('.mobile-action[data-key="E"]').tap();
}
async function hold(page: Page, key: 'KeyD' | 'KeyE') {
  if (page.viewportSize()!.width === 1280) {
    await page.keyboard.down(key); return async () => { await page.keyboard.up(key); };
  }
  const button = page.locator(key === 'KeyD' ? '.mobile-direction[data-direction="right"]' : '.mobile-action[data-key="E"]');
  await expect(button).toBeEnabled();
  // Wait for Phaser's reader/profile change to reach the native layout before locating a contact.
  await button.hover();
  const bounds = (await button.boundingBox())!;
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
  await expect(button).toHaveClass(/is-pressed/);
  return async () => { await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await client.detach(); };
}

for (const viewport of sizes) {
  test.describe(`Valentus visual playtest ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: viewport.width !== 1280, isMobile: viewport.width !== 1280 });
    test('real title-to-Lia transitions with all prologue battle flight and refuge phases', async ({ page }) => {
      test.setTimeout(260000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
      await page.goto('/');
      await page.waitForFunction(() => (window as any).game?.scene?.isActive('title'));
      await page.waitForTimeout(1600); await shot(page, '01-title');
      await clickGame(page, 160, 230);
      await page.waitForFunction(() => (window as any).game.scene.isActive('storyprologue'));
      for (let index = 0; index < 4; index++) {
        await page.waitForFunction(index => (window as any).game.scene.getScene('storyprologue').data.get('story:prologue')?.index === index, index);
        await page.waitForFunction(() => !(window as any).game.scene.getScene('storyprologue').data.get('dialogue:typing'));
        await shot(page, `02-card-${index + 1}`); await read(page, 'storyprologue');
      }
      await page.waitForFunction(() => (window as any).game.scene.getScene('battle')?.sprites?.has('valentus'));
      await page.waitForTimeout(1100); await shot(page, '03-battle-arrival');
      await clickGame(page, 160, 232); await phase(page, 'battle', 'plan', 1);
      await shot(page, '04-battle-plan');
      expect(await page.evaluate(() => (window as any).game.scene.getScene('battle').tacticalPanel.visible)).toBe(viewport.width === 1280);
      await clickGame(page, 256, 232); await phase(page, 'battle', 'plan', 1);
      await action(page, 'Strahl'); await phase(page, 'battle', 'beam', 1);
      await shot(page, '05-beam-target');
      await clickGame(page, 320, 232); await phase(page, 'battle', 'facing', 1);
      await shot(page, '06-battle-facing');
      await page.keyboard.press('ArrowRight', { delay: 60 });
      await action(page, 'Zug beenden'); await phase(page, 'battle', 'plan', 2);
      await shot(page, '07-boy-rescue');
      await action(page, 'Druckwelle'); await phase(page, 'battle', 'wave', 2);
      await shot(page, '08-wave-target');
      await clickGame(page, 288, 200); await phase(page, 'battle', 'facing', 2);
      await shot(page, '09-axe-wounded');
      await action(page, 'Zug beenden'); await phase(page, 'battle', 'plan', 3);
      await shot(page, '10-crossbow-rescue');
      await action(page, 'Warten'); await phase(page, 'battle', 'facing', 3);
      await action(page, 'Zug beenden');
      await page.waitForFunction(() => (window as any).game.scene.getScene('battle').data.get('story:battleEnding') === 'retreat');
      await shot(page, '11-retreat');
      await page.waitForFunction(() => (window as any).game.scene.getScene('battle').data.get('story:battleEnding') === 'stab');
      await page.waitForFunction(() => !(window as any).game.scene.getScene('battle').data.get('dialogue:typing'));
      await shot(page, '12-stab'); await read(page, 'battle');
      await page.waitForFunction(() => (window as any).game.scene.getScene('break').data.get('story:breakStage') === 'wound');
      await page.waitForTimeout(700); await page.keyboard.press('KeyE'); await shot(page, '13-wound-breath');
      await page.waitForFunction(() => (window as any).game.scene.getScene('break').data.get('story:breakStage') === 'flight');
      await page.waitForTimeout(1000); await shot(page, '14-flight-illustration');
      await page.waitForFunction(() => (window as any).game.scene.isActive('flight'));
      await page.waitForTimeout(1400); await shot(page, '15-flight-first-screen');
      expect(await page.evaluate(() => {
        const scene = (window as any).game.scene.getScene('flight');
        const bounds = scene.v.getBounds();
        // The character's head and body must be visible outside the upper-left HUD.
        return bounds.top >= 65 || (bounds.left >= 58 && bounds.top >= 34);
      })).toBe(true);
      for (let station = 0; station < 5; station++) {
        const releaseDirection = await hold(page, 'KeyD');
        await page.waitForFunction(index => {
          const scene = (window as any).game.scene.getScene('flight');
          return scene.nextStation > index || scene.dist >= scene.stations[index].at - 0.5;
        }, station, { timeout: 35000 });
        await releaseDirection();
        await shot(page, `16-flight-station-${station}`);
        if (station === 0) {
          await page.waitForFunction(() => (window as any).game.scene.getScene('flight').v.anims.currentAnim?.key === 'vc-stumble');
          await shot(page, '16a-flight-stumble');
        }
        if (station === 1) { await interact(page); await page.waitForTimeout(200); await shot(page, '16b-flight-jump'); }
        if (station === 2 || station === 3) {
          const releaseHold = await hold(page, 'KeyE'); await page.waitForTimeout(650);
          await shot(page, `17-flight-hold-${station}`);
          await page.waitForFunction(index => (window as any).game.scene.getScene('flight').nextStation > index, station, { timeout: 12000 });
          await releaseHold();
        }
        if (station < 4) await page.waitForFunction(index => (window as any).game.scene.getScene('flight').nextStation > index, station);
      }
      await page.waitForFunction(() => (window as any).game.scene.getScene('flight').data.get('dialogue:fullText'));
      await page.waitForFunction(() => !(window as any).game.scene.getScene('flight').data.get('dialogue:typing'));
      await shot(page, '18-flight-rescue-arrival'); await read(page, 'flight');
      await page.waitForTimeout(1100);
      await shot(page, '19-flight-rescue-home'); await read(page, 'flight');
      await page.waitForFunction(() => (window as any).game.scene.isActive('refuge'));
      const lines = ['Wasser', 'gerettet', 'Angst'];
      for (let line = 0; line < 3; line++) {
        await page.waitForFunction(() => (window as any).game.scene.getScene('refuge').dialogue?.visible, undefined, { timeout: 30000 });
        await page.waitForFunction(() => !(window as any).game.scene.getScene('refuge').data.get('dialogue:typing'));
        await shot(page, `20-refuge-${lines[line]}`); await read(page, 'refuge');
        await page.waitForFunction(() => !(window as any).game.scene.getScene('refuge').dialogue?.visible);
      }
      await phase(page, 'refuge', 'wake'); await page.waitForTimeout(1100); await shot(page, '21-refuge-bed');
      await phase(page, 'refuge', 'rise');
      await page.waitForFunction(() => !(window as any).game.scene.getScene('refuge').hud?.dialogueVisible);
      const releaseRise = await hold(page, 'KeyE'); await page.waitForTimeout(1100); await shot(page, '22-refuge-rising');
      await phase(page, 'refuge', 'walk'); await releaseRise(); await shot(page, '23-refuge-standing');
      for (let step = 0; step < 8; step++) {
        await interact(page);
        await page.waitForFunction(step => (window as any).game.scene.getScene('refuge').step === step + 1, step);
        await page.waitForFunction(() => !(window as any).game.scene.getScene('refuge').stepping);
        if (step === 3 || step === 6) await shot(page, `24-refuge-step-${step + 1}`);
      }
      await phase(page, 'refuge', 'raise'); await shot(page, '25-refuge-cradle');
      await page.waitForFunction(() => !(window as any).game.scene.getScene('refuge').hud?.dialogueVisible);
      await interact(page); await phase(page, 'refuge', 'light');
      await page.waitForTimeout(1900); await shot(page, '26-refuge-light');
      await page.waitForFunction(() => (window as any).game.scene.isActive('lia'), undefined, { timeout: 15000 });
      expect(errors).toEqual([]);
    });
  });
}
