import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 720 } });

async function loadSave(page: Page, scene: string, flags: Record<string, boolean> = {}): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(({ scene, flags }) => {
    localStorage.setItem('selantis.settings.v1', JSON.stringify({ textSpeed: 0, reducedMotion: true, music: 0, voice: 0, sfx: 0 }));
    if (!localStorage.getItem('selantis.save.v1')) localStorage.setItem('selantis.save.v1', JSON.stringify({
      version: 1, chapter: scene === 'waldweg' ? 'kapitel-2' : scene === 'eber' ? 'kapitel-3' : 'kapitel-5', scene,
      flags, inventory: { dagger: 1, coins: 1 }, characters: {}, party: scene === 'waldweg' || scene === 'eber' ? ['foltan', 'azar'] : ['flick', 'kyra'],
      objectives: [], memories: [], clues: [], lore: [], abilities: scene === 'weiterreise' ? ['urmacht', 'ausweichen', 'ablenken'] : [], playtimeSec: 0,
    }));
  }, { scene, flags });
  await page.goto('/');
  await page.getByRole('button', { name: /Fortsetzen/ }).click();
  await page.waitForFunction(scene => (window as any).G.currentScene === scene && (window as any).__world?.player, scene);
  return errors;
}

async function dialogues(page: Page, until: () => Promise<boolean>, choice = 0): Promise<void> {
  for (let n = 0; n < 100; n++) {
    if (await until()) return;
    const choices = page.locator('.choices .choice:visible');
    if (await choices.count()) {
      await page.waitForTimeout(750);
      if (await choices.count()) await page.keyboard.press(String(choice + 1));
    } else if (await page.evaluate(() => (window as any).G.ui.busy())) await page.keyboard.press('Enter');
    await page.waitForTimeout(180);
  }
  throw new Error('Dialogue did not reach the expected state');
}

async function idle(page: Page): Promise<void> {
  await dialogues(page, () => page.evaluate(() => !(window as any).G.ui.busy() && !(window as any).__world.playerLocked));
}

async function interact(page: Page, id: string): Promise<void> {
  await idle(page);
  await page.evaluate(id => {
    const w = (window as any).__world;
    const it = w.interactives.find((i: any) => i.id === id);
    const p = it.pos(); w.ctx.player.teleport([p.x, p.y + 16]);
  }, id);
  // Reopening the same hotspot requires the world's deliberate 650 ms gap after an interaction.
  await page.waitForTimeout(750);
  await page.keyboard.press('e');
}

/** Drive combat through its controller and real animations. World dialogue and confirmation use the UI. */
async function winBattle(page: Page, screenshot?: string): Promise<void> {
  await page.waitForFunction(() => (window as any).__tactics?.ready && (window as any).__tactics.ctrl.inputEnabled(), undefined, { timeout: 30000 });
  if (screenshot) await page.screenshot({ path: test.info().outputPath(screenshot) });
  for (let n = 0; n < 250; n++) {
    const outcome = page.locator('.tac-out.show');
    if (await outcome.count()) {
      await expect(outcome).toHaveClass(/win/);
      await outcome.locator('[data-o="continue"]').click();
      await page.waitForFunction(() => (window as any).__world?.sys.isActive());
      await idle(page);
      return;
    }
    const can = await page.evaluate(() => {
      const t = (window as any).__tactics;
      return t?.ctrl.inputEnabled() && t.animating === 0 && !t.cameras.main.panEffect.isRunning;
    });
    if (can) {
      await page.evaluate(async () => {
        const aiUrl = '/src/tactics/rules/ai.ts';
        const { planTurn, executePlan } = await import(/* @vite-ignore */ aiUrl);
        const t = (window as any).__tactics, b = t.ctrl.battle, u = b.unit(b.activeUnit);
        if (u.id === 'reisender') b.aiOverrides.set(u.id, { profile: 'flee', goal: { x: 7, y: 2 } });
        else b.aiOverrides.set(u.id, { profile: u.id === 'azar' ? 'support' : u.id === 'flick' ? 'archer' : 'melee' });
        const plan = planTurn(b, u.id);
        void t.ctrl.perform(() => executePlan(b, plan)).then(() => t.ctrl.endTurn());
      });
    }
    await page.waitForTimeout(400);
  }
  throw new Error('Battle did not finish');
}

const forestFlags = { 'k2-waldweg-start': true, 'k2-fruehstueck': true, 'k2-rast': true, 'k2-rast-angesagt': true, 'k2-rast-fertig': true };

test('forest encounter preserves the party and return point; victory stays completed after reload', async ({ page }) => {
  test.setTimeout(120000);
  const errors = await loadSave(page, 'waldweg', forestFlags);
  await interact(page, 'wegelagerer');
  await dialogues(page, () => page.evaluate(() => (window as any).__tactics?.ready), 1);
  expect(await page.evaluate(() => (window as any).__world.sys.isSleeping())).toBe(true);
  await winBattle(page, 'forest-party.png');
  const progress = await page.evaluate(() => {
    const g = (window as any).G, w = (window as any).__world;
    return { lia: g.state.character('lia'), party: g.state.data.party, p: [w.player.x, w.player.y], done: g.state.is('k2-wegelagerer-besiegt') };
  });
  // Lia starts the first fight at level 1 and grows at most one level (budget 100 EXP, level cap 2).
  expect(progress.done).toBe(true); expect(progress.lia.level).toBeGreaterThanOrEqual(1); expect(progress.lia.level).toBeLessThanOrEqual(2);
  expect((progress.lia.level - 1) * 100 + progress.lia.exp).toBeLessThanOrEqual(100);
  expect(progress.party).toEqual(['foltan', 'azar']);
  await page.reload(); await page.getByRole('button', { name: /Fortsetzen/ }).click();
  await page.waitForFunction(() => (window as any).__world?.map.id === 'k2-waldweg');
  await idle(page);
  expect(await page.evaluate(() => (window as any).G.state.character('lia'))).toEqual(progress.lia);
  expect(await page.evaluate(() => (window as any).__world.interactives.find((i: any) => i.id === 'wegelagerer').enabled())).toBe(false);
  const p = await page.evaluate(() => { const w = (window as any).__world; return [w.player.x, w.player.y]; });
  expect(Math.hypot(p[0] - progress.p[0], p[1] - progress.p[1])).toBeLessThan(2);
  expect(errors).toEqual([]);
});

test('avoiding the forest encounter also closes it permanently and grants no EXP', async ({ page }) => {
  const errors = await loadSave(page, 'waldweg', forestFlags);
  await interact(page, 'wegelagerer');
  await dialogues(page, () => page.evaluate(() => (window as any).G.state.is('k2-wegelagerer-umgangen')), 0);
  await idle(page);
  expect(await page.evaluate(() => (window as any).G.state.character('lia'))).toBeUndefined();
  await page.reload(); await page.getByRole('button', { name: /Fortsetzen/ }).click();
  await page.waitForFunction(() => (window as any).__world?.map.id === 'k2-waldweg');
  expect(await page.evaluate(() => (window as any).__world.interactives.find((i: any) => i.id === 'wegelagerer').enabled())).toBe(false);
  expect(errors).toEqual([]);
});

test('voluntary escort pays once and returns to the inn with story clues unchanged', async ({ page }) => {
  test.setTimeout(120000);
  const errors = await loadSave(page, 'eber', { 'k3-intro': true, 'k3-haendler': true });
  await interact(page, 'haendler');
  await dialogues(page, () => page.evaluate(() => (window as any).__tactics?.ready), 1);
  await winBattle(page, 'escort-party.png');
  expect(await page.evaluate(() => (window as any).G.state.count('bread'))).toBe(1);
  expect(await page.evaluate(() => (window as any).G.state.count('tincture'))).toBe(1);
  expect(await page.evaluate(() => (window as any).G.state.data.clues)).toEqual([]);
  await interact(page, 'haendler'); await idle(page);
  expect(await page.evaluate(() => (window as any).G.state.count('bread'))).toBe(1);
  await page.reload(); await page.getByRole('button', { name: /Fortsetzen/ }).click();
  await page.waitForFunction(() => (window as any).__world?.map.id === 'k3-eber');
  await idle(page);
  expect(await page.evaluate(() => (window as any).G.state.is('k3-begleitung-erledigt'))).toBe(true);
  expect(await page.evaluate(() => (window as any).G.state.count('bread'))).toBe(1);
  expect(await page.evaluate(() => (window as any).G.state.count('tincture'))).toBe(1);
  expect(errors).toEqual([]);
});

test('the rescued trio progresses on the continuation and learns controlled light after two battles', async ({ page }) => {
  test.setTimeout(180000);
  const errors = await loadSave(page, 'weiterreise', { 'k5-urmacht': true, 'k5-weiterreise-start': true });
  for (let n = 0; n < 2; n++) {
    await interact(page, 'reiseweg');
    await dialogues(page, () => page.evaluate(() => (window as any).__tactics?.ready && !(window as any).__world.sys.isActive()), 0);
    await winBattle(page, n === 0 ? 'rescued-party.png' : undefined);
  }
  expect(await page.evaluate(() => (window as any).G.state.knows('lichtstoss'))).toBe(true);
  expect(await page.evaluate(() => (window as any).G.state.character('lia').level)).toBeGreaterThan(2);
  const trio = await page.evaluate(() => (window as any).G.state.data.characters);
  expect(Object.keys(trio)).toEqual(expect.arrayContaining(['lia', 'flick', 'kyra']));
  await page.reload(); await page.getByRole('button', { name: /Fortsetzen/ }).click();
  await page.waitForFunction(() => (window as any).__world?.map.id === 'k5-weiterreise'); await idle(page);
  expect(await page.evaluate(() => (window as any).G.state.data.characters)).toEqual(trio);
  expect(await page.evaluate(() => (window as any).G.state.flag('k5-reisekaempfe'))).toBe(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await interact(page, 'reiseweg');
  await dialogues(page, () => page.evaluate(() => (window as any).__tactics?.ready && !(window as any).__world.sys.isActive()), 0);
  await page.waitForFunction(() => (window as any).__tactics.ctrl.inputEnabled());
  expect(await page.evaluate(() => (window as any).__tactics.ctrl.battle.unit('lia').abilities)).toContain('lichtstoss');
  await page.screenshot({ path: test.info().outputPath('rescued-party-phone.png') });
  expect(errors).toEqual([]);
});

test('the finale opens the optional continuation through the departure choice', async ({ page }) => {
  test.setTimeout(60000);
  const errors = await loadSave(page, 'finale', { 'k5-erwacht': true, 'k5-weiter': true, 'k5-urmacht': true });
  await idle(page);
  await page.evaluate(() => (window as any).__world.ctx.player.teleport([650, 704]));
  await dialogues(page, () => page.evaluate(() => (window as any).G.currentScene === 'weiterreise'), 1);
  await page.waitForFunction(() => (window as any).__world?.map.id === 'k5-weiterreise');
  await idle(page);
  expect(await page.evaluate(() => (window as any).G.state.data.party)).toEqual(['flick', 'kyra']);
  expect(errors).toEqual([]);
});
