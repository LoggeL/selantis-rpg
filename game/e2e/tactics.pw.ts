import { expect, test, type Page } from '@playwright/test';

async function phase(page: Page, value: string, beat?: number) {
  await expect.poll(() => page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('battle');
    return { phase: scene.phase, beat: scene.beat };
  }), { timeout: 15_000 }).toMatchObject(beat === undefined ? { phase: value } : { phase: value, beat });
}

async function state(page: Page) {
  return page.evaluate(() => (window as any).game.registry.get('battle:state'));
}

async function enterBattle(page: Page, mobile = false) {
  await page.goto('/?scene=battle');
  await page.waitForFunction(() => (window as any).game?.scene.isActive('battle'));
  // Only remove the long approach. Arrival recognition and every combat callback
  // still run in the real scene after an actual direction input.
  await page.evaluate(() => (window as any).game.scene.getScene('battle').sprites.get('valentus').setPosition(160, 221));
  if (mobile) {
    const control = page.getByRole('button', { name: 'Nach unten', exact: true });
    await control.hover(); await page.mouse.down();
    await phase(page, 'busy', 0); await page.mouse.up();
  } else {
    await page.keyboard.down('ArrowDown');
    await phase(page, 'busy', 0); await page.keyboard.up('ArrowDown');
  }
  await phase(page, 'plan', 1);
}

async function cursor(page: Page, x: number, y: number) {
  const current = await page.evaluate(() => (window as any).game.scene.getScene('battle').cursor);
  for (let i = current.x; i < x; i++) { await page.keyboard.press('ArrowRight', { delay: 60 }); await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('battle').cursor.x)).toBe(i + 1); }
  for (let i = current.x; i > x; i--) { await page.keyboard.press('ArrowLeft', { delay: 60 }); await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('battle').cursor.x)).toBe(i - 1); }
  for (let i = current.y; i < y; i++) { await page.keyboard.press('ArrowDown', { delay: 60 }); await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('battle').cursor.y)).toBe(i + 1); }
  for (let i = current.y; i > y; i--) { await page.keyboard.press('ArrowUp', { delay: 60 }); await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('battle').cursor.y)).toBe(i - 1); }
}

async function readStabFrame(page: Page, mobile = false) {
  await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('battle').data.get('story:battleEnding')),
    { timeout: 15_000 }).toBe('stab');
  const frame = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('battle');
    const image = scene.stabCloseup.image, source = image.texture.getSourceImage(), bounds = image.getBounds();
    return { texture: image.texture.key, source: [source.width, source.height], cropped: image.isCropped,
      bounds: [bounds.left, bounds.top, bounds.right, bounds.bottom], hud: scene.data.get('mobile:hudVisible'),
      caption: scene.data.get('dialogue:fullText'), breakActive: (window as any).game.scene.isActive('break') };
  });
  expect(frame).toMatchObject({ texture: 'cinematic-valentus-stab', cropped: false, hud: false,
    caption: 'Eine Klinge trifft ihn von hinten.', breakActive: false });
  expect(frame.source[0]).toBeGreaterThan(1000);
  expect(frame.bounds[0]).toBeGreaterThanOrEqual(-0.5);
  expect(frame.bounds[1]).toBeGreaterThanOrEqual(-0.5);
  expect(frame.bounds[2]).toBeLessThanOrEqual(640.5);
  expect(frame.bounds[3]).toBeLessThanOrEqual(mobile ? 360.5 : 264.5);
  await page.waitForFunction(() => !(window as any).game.scene.getScene('battle').data.get('dialogue:typing'));
  // Reading the strike cannot be skipped by the previous automatic ending timer.
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => (window as any).game.scene.isActive('battle'))).toBe(true);
  const size = page.viewportSize()!;
  await page.screenshot({ path: `../output/qa/valentus-stab-${size.width}x${size.height}.png`, fullPage: true });
  if (mobile) {
    await expect(page.locator('.mobile-dialogue-portrait')).toBeHidden();
    await expect(page.locator('#character-stats-button')).toBeHidden();
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  } else await page.keyboard.press('KeyE', { delay: 60 });
  await page.waitForFunction(() => (window as any).game.scene.isActive('break'), { timeout: 15_000 });
}

for (const viewport of [{ width: 1280, height: 800, mobile: false }, { width: 390, height: 844, mobile: true }, { width: 844, height: 390, mobile: true }]) {
test(`real move/action inputs and facing carry the battle through both rescues to injury and flight at ${viewport.width}x${viewport.height}`, async ({ page }) => {
  test.setTimeout(80_000);
  await page.setViewportSize(viewport);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await enterBattle(page, viewport.mobile);
  expect((await state(page)).units.filter((u: any) => u.side === 'enemy').map((u: any) => [u.id, u.speed])).toEqual([['w1', 6], ['w2', 7]]);

  // Act then move: a wave hits warrior I and its push collides with warrior II.
  // A living opponent remains, so the action does not discard the move slot.
  await page.keyboard.press('KeyR', { delay: 60 });
  await phase(page, 'wave', 1); await cursor(page, 7, 4);
  await page.keyboard.press('Enter', { delay: 60 }); await phase(page, 'plan', 1);
  let snapshot = await state(page);
  expect([snapshot.moved, snapshot.acted]).toEqual([false, true]);
  expect(snapshot.units.find((u: any) => u.id === 'w1').alive).toBe(false);
  expect(snapshot.units.find((u: any) => u.id === 'w2').hp).toBe(20);
  await page.keyboard.press('KeyQ', { delay: 60 }); await phase(page, 'plan', 1);
  await cursor(page, 6, 4); await page.keyboard.press('Enter', { delay: 60 }); await phase(page, 'facing', 1);
  snapshot = await state(page);
  expect([snapshot.moved, snapshot.acted]).toEqual([true, true]);
  expect(snapshot.units.find((u: any) => u.id === 'valentus').cell).toEqual({ x: 6, y: 4 });
  expect(snapshot.units.find((u: any) => u.id === 'w2').cell).toEqual({ x: 10, y: 4 });
  await page.keyboard.press('ArrowRight', { delay: 60 });
  expect((await state(page)).facing).toBe('e');
  await page.keyboard.press('Enter', { delay: 60 }); await phase(page, 'plan', 1);
  expect((await state(page)).units.find((u: any) => u.id === 'w2').cell).toEqual({ x: 8, y: 4 });

  // Move then act on the next turn. Killing the last opponent still waits for
  // final facing confirmation instead of advancing the story automatically.
  await cursor(page, 7, 4); await page.keyboard.press('Enter', { delay: 60 }); await phase(page, 'plan', 1);
  expect([(await state(page)).moved, (await state(page)).acted]).toEqual([true, false]);
  await page.keyboard.press('KeyQ', { delay: 60 }); await cursor(page, 8, 4);
  await page.keyboard.press('Enter', { delay: 60 }); await phase(page, 'facing', 1);
  expect((await state(page)).units.find((u: any) => u.id === 'w2').alive).toBe(false);
  await page.keyboard.press('ArrowUp', { delay: 60 }); await page.keyboard.press('Enter', { delay: 60 }); await phase(page, 'plan', 2);

  // The boy is a real ally on the wave area; friendly protection preserves him.
  await page.keyboard.press('KeyR', { delay: 60 }); await cursor(page, 7, 3);
  await page.keyboard.press('Enter', { delay: 60 }); await phase(page, 'facing', 2);
  snapshot = await state(page);
  expect(snapshot.units.find((u: any) => u.id === 'axe')).toMatchObject({ alive: true, wounded: true, hp: 1 });
  expect(snapshot.units.find((u: any) => u.id === 'boy')).toMatchObject({ hp: 20, alive: true });
  await page.keyboard.press('ArrowRight', { delay: 60 }); await page.keyboard.press('Enter', { delay: 60 }); await phase(page, 'plan', 3);

  // Valentus occupies the actual bolt sightline at 7,4. Waiting, then facing
  // east, protects his front and consumes the crossbow turn as a real hit.
  await page.keyboard.press('Space', { delay: 60 }); await phase(page, 'facing', 3);
  await page.keyboard.press('ArrowRight', { delay: 60 });
  await page.screenshot({ path: `../output/qa/tactics-full-facing-${viewport.width}x${viewport.height}.png`, fullPage: true });
  await page.keyboard.press('Enter', { delay: 60 });
  await page.waitForFunction(() => (window as any).game.scene.getScene('battle').beat === 4, { timeout: 15_000 });
  snapshot = await state(page);
  expect(snapshot.units.find((u: any) => u.id === 'valentus').hp).toBe(94);
  expect(snapshot.units.find((u: any) => u.id === 'boy')).toMatchObject({ hp: 20, alive: true });
  await readStabFrame(page, viewport.mobile);
  expect(await page.evaluate(() => (window as any).game.registry.get('lastMagic').kind)).toBe('wave');
  expect(errors).toEqual([]);
});
}

test('actual enemy strikes apply frontal guard, side/rear damage and tutorial protection without deadlock', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await enterBattle(page);
  for (const [direction, hp] of [['ArrowRight', 95], ['ArrowUp', 81], ['ArrowLeft', 62], ['ArrowLeft', 43], ['ArrowLeft', 24], ['ArrowLeft', 5], ['ArrowLeft', 1]] as const) {
    // Position fixtures isolate a single attacker. No health, phase, budget,
    // completion flag or result is written by this test.
    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('battle');
      for (const [id, x, y] of [['w1', 4, 4], ['w2', 10, 6]]) {
        const unit = scene.units.find((u: any) => u.id === id); unit.cell = { x, y };
        scene.sprites.get(id).setPosition(48 + x * 32 + 16, 88 + y * 32 + 26);
      }
      scene.computeIntents(); scene.drawIntents(); scene.refreshTacticalStatus();
    });
    await page.keyboard.press('Space', { delay: 60 }); await phase(page, 'facing', 1);
    await page.keyboard.press(direction, { delay: 60 }); await page.keyboard.press('Enter', { delay: 60 }); await phase(page, 'plan', 1);
    const snapshot = await state(page);
    expect(snapshot.units.find((u: any) => u.id === 'valentus').hp).toBe(hp);
    expect([snapshot.moved, snapshot.acted]).toEqual([false, false]);
  }
  expect(await page.evaluate(() => (window as any).game.scene.getScene('battle').data.get('mobile:hp'))).toBe(0.01);
  await page.screenshot({ path: '../output/qa/tactics-dream-protection-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('waiting preserves the authored Falke rescue branches through the crossbow ending', async ({ page }) => {
  test.setTimeout(65_000); await page.setViewportSize({ width: 1280, height: 800 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await enterBattle(page);
  await cursor(page, 6, 4); await page.keyboard.press('Enter', { delay: 60 }); await phase(page, 'plan', 1);
  await page.keyboard.press('KeyQ', { delay: 60 }); await cursor(page, 7, 4);
  await page.keyboard.press('Enter', { delay: 60 }); await phase(page, 'facing', 1);
  await page.keyboard.press('Enter', { delay: 60 }); await phase(page, 'plan', 2);
  await page.keyboard.press('Space', { delay: 60 }); await phase(page, 'facing', 2);
  await page.keyboard.press('Enter', { delay: 60 }); await phase(page, 'plan', 3);
  let snapshot = await state(page);
  expect(snapshot.units.find((u: any) => u.id === 'axe')).toMatchObject({ alive: true, wounded: true, hp: 1 });
  expect(snapshot.units.find((u: any) => u.id === 'falke').alive).toBe(true);
  expect(snapshot.units.find((u: any) => u.id === 'boy')).toMatchObject({ hp: 20, alive: true });
  // At 6,4 Valentus is outside the 9,6 -> 6,3 bolt line. The Falke intervenes.
  await page.keyboard.press('Space', { delay: 60 }); await phase(page, 'facing', 3);
  await page.keyboard.press('Enter', { delay: 60 });
  await page.waitForFunction(() => (window as any).game.scene.getScene('battle').beat === 4, { timeout: 15_000 });
  snapshot = await state(page);
  expect(snapshot.units.find((u: any) => u.id === 'falke').alive).toBe(false);
  expect(snapshot.units.find((u: any) => u.id === 'boy')).toMatchObject({ hp: 20, alive: true });
  await readStabFrame(page);
  expect(await page.evaluate(() => (window as any).game.registry.get('lastMagic').kind)).toBe('beam');
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`final facing works through accessible mobile controls at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(35_000); await page.setViewportSize(viewport);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await enterBattle(page, true);
    await page.getByRole('button', { name: 'Warten', exact: true }).click();
    await phase(page, 'facing', 1);
    const finish = page.getByRole('button', { name: 'Zug beenden', exact: true });
    await expect(finish).toBeVisible(); await expect(finish).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Strahl', exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'Nach links', exact: true }).click();
    expect((await state(page)).facing).toBe('w');
    const status = page.locator('[data-mobile-battle-status]');
    await expect(status).toBeVisible();
    await expect(status).toContainText('LP 100/100');
    await expect(status).toContainText('West');
    await expect(status).toContainText('verbraucht');
    await expect(status).toContainText('Krieger II');
    expect(await status.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(viewport.height > viewport.width ? 18 : 16);
    for (const control of [finish, page.getByRole('button', { name: 'Nach links', exact: true })]) {
      const bounds = await control.boundingBox(); expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.y).toBeGreaterThanOrEqual(0); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `../output/qa/tactics-facing-${viewport.width}x${viewport.height}.png`, fullPage: true });
    await finish.click(); await phase(page, 'plan', 1);
    expect((await state(page)).units.find((u: any) => u.id === 'w1').cell).toEqual({ x: 6, y: 4 });
    expect(errors).toEqual([]);
  });
}

async function clickGame(page: Page, x: number, y: number) {
  const bounds = await page.locator('canvas').boundingBox();
  await page.mouse.click(bounds!.x + x / 640 * bounds!.width, bounds!.y + y / 360 * bounds!.height);
}

test('mouse alone moves from arrival through the battle, hourglass, wound and quiet forest transition', async ({ page }) => {
  test.setTimeout(80_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?scene=battle');
  await page.waitForFunction(() => (window as any).game?.scene.isActive('battle'));
  // The initial position is untouched: the real pointer takes Valentus to the marker.
  await clickGame(page, 160, 232); await phase(page, 'plan', 1);
  await clickGame(page, 256, 232); await phase(page, 'plan', 1);
  expect((await state(page)).units.find((u: any) => u.id === 'valentus').cell).toEqual({ x: 6, y: 4 });
  await clickGame(page, 286, 330); await phase(page, 'beam', 1);
  await clickGame(page, 320, 232); await phase(page, 'facing', 1);
  await clickGame(page, 280, 232);
  expect((await state(page)).facing).toBe('e');
  expect(await page.evaluate(() => (window as any).game.scene.getScene('battle').tacticalText.text)).toContain('Front weniger');
  await page.screenshot({ path: '../output/qa/tactics-mouse-hourglass.png', fullPage: true });
  await clickGame(page, 520, 323); await phase(page, 'plan', 2);
  await clickGame(page, 320, 330); await phase(page, 'wave', 2);
  await clickGame(page, 288, 200); await phase(page, 'facing', 2);
  expect((await state(page)).units.find((u: any) => u.id === 'axe')).toMatchObject({ alive: true, wounded: true, hp: 1 });
  await clickGame(page, 520, 323); await phase(page, 'plan', 3);
  expect(await page.evaluate(() => (window as any).game.scene.getScene('battle').data.get('mobile:battleStatus'))).toContain('Axtkämpfer · verwundet');
  // The wounded body remains visible after its former ash timer would have fired.
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('battle');
    const sprite = scene.sprites.get('axe');
    return { visible: sprite.visible, alpha: sprite.alpha, animation: sprite.anims.currentAnim.key,
      ordered: scene.registry.get('battle:state').units.find((u: any) => u.id === 'axe').wounded };
  })).toMatchObject({ visible: true, alpha: 1, animation: 'axe-land', ordered: true });
  await page.screenshot({ path: '../output/qa/tactics-wounded-axe.png', fullPage: true });
  await clickGame(page, 288, 232); await phase(page, 'plan', 3);
  await clickGame(page, 520, 323); await phase(page, 'facing', 3);
  await clickGame(page, 314, 232); await clickGame(page, 520, 323);
  await page.waitForFunction(() => (window as any).game.scene.getScene('battle').data.get('story:battleEnding') === 'retreat');
  expect(await page.evaluate(() => (window as any).game.scene.getScene('battle').backgroundSoldiers.every((s: any) => s.anims.currentAnim.key === 'falke-charge'))).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('battle').data.get('story:battleEnding'))).toBe('stab');
  await page.waitForFunction(() => !(window as any).game.scene.getScene('battle').data.get('dialogue:typing'));
  await clickGame(page, 580, 328);
  await page.waitForFunction(() => (window as any).game.scene.isActive('break'));
  await page.waitForFunction(() => (window as any).game.scene.getScene('break').data.get('story:breakStage') === 'flight');
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('break');
    return scene.children.list.filter((o: any) => o.texture?.key === 'prologue-valentus-flight').length;
  })).toBe(1);
  await page.waitForTimeout(900);
  await page.screenshot({ path: '../output/qa/valentus-flight-transition.png', fullPage: true });
  await page.waitForFunction(() => (window as any).game.scene.isActive('flight'), { timeout: 12_000 });
  expect(errors).toEqual([]);
});
