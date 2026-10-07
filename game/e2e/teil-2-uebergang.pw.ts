import { expect, test, type Page } from '@playwright/test';

/**
 * Book one → Teil II: both existing end paths (finale departure, optional weiterreise) offer the explicit continuation,
 * also for saves that already finished book one (k5-ende). The regular transition keeps the grown campaign state.
 *   cd game && npx playwright test e2e/teil-2-uebergang.pw.ts --workers=1
 */
test.use({ viewport: { width: 1280, height: 720 } });

const GROWN = {
  inventory: { dagger: 1, coins: 1, 'book-herbs': 1, bead: 2, apple: 3, tinder: 1 },
  characters: {
    lia: { level: 4, exp: 37, weapon: null, mastered: ['steinwurf'], abilityAp: { versorgen: 6 } },
    flick: { level: 9, exp: 12, weapon: null, mastered: [], abilityAp: { bogen: 3 } },
    kyra: { level: 2, exp: 55, weapon: null, mastered: [], abilityAp: {} },
  },
  memories: ['k5-mem-gewitter'],
  lore: ['k5-lore-tuerkis'],
};

async function loadSave(page: Page, scene: 'finale' | 'weiterreise', flags: Record<string, unknown>, abilities: string[]): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(({ scene, flags, abilities, grown }) => {
    localStorage.setItem('selantis.settings.v1', JSON.stringify({ textSpeed: 0, reducedMotion: true, music: 0, voice: 0, sfx: 0 }));
    if (!localStorage.getItem('selantis.save.v1')) localStorage.setItem('selantis.save.v1', JSON.stringify({
      version: 1, chapter: 'kapitel-5', scene, flags, inventory: grown.inventory, characters: grown.characters,
      party: ['flick', 'kyra'], objectives: [], memories: grown.memories, clues: [], lore: grown.lore, abilities,
      playtimeSec: 0, savedAt: new Date(0).toISOString(),
    }));
  }, { scene, flags, abilities, grown: GROWN });
  await page.goto('/');
  await page.getByRole('button', { name: /Fortsetzen/ }).click();
  await page.waitForFunction(scene => (window as any).G.currentScene === scene && (window as any).__world?.player, scene);
  return errors;
}

/** Advances dialogue with Enter and answers a choice with `choice` (0-based) until `until` holds. */
async function dialogues(page: Page, until: () => Promise<boolean>, choice = 0): Promise<void> {
  for (let n = 0; n < 120; n++) {
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

const inBook2 = (page: Page) => () => page.evaluate(() => (window as any).G.currentScene === 'e2-taverne');

/** The loaded campaign right before the transition (the save loader may normalise character records). */
async function snapshot(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => JSON.parse(JSON.stringify((window as any).G.state.data.characters)));
}

async function expectGrownStateKept(page: Page, abilities: string[], characters: Record<string, unknown>): Promise<void> {
  const data = await page.evaluate(() => (window as any).G.state.data);
  expect(data.chapter).toBe('teil-2');
  expect(data.party).toEqual(['flick', 'kyra']);
  for (const [id, n] of Object.entries(GROWN.inventory)) expect(data.inventory[id]).toBe(n);
  expect(data.characters).toEqual(characters);
  expect((data.characters as any).lia.level).toBe(4);
  expect(data.abilities).toEqual(expect.arrayContaining(abilities));
  expect(data.memories).toEqual(expect.arrayContaining(GROWN.memories));
  expect(data.lore).toEqual(expect.arrayContaining(GROWN.lore));
  expect(data.flags['k5-ende']).toBe(true);
  // The autosave at the scene start already holds the continued campaign.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('selantis.save.v1')!));
  expect(saved.scene).toBe('e2-taverne');
  expect(saved.characters).toEqual(characters);
}

const BASE = ['spurenblick', 'schleichen', 'ausweichen', 'ablenken', 'urmacht'];
const FINALE_FLAGS = { 'k5-erwacht': true, 'k5-weiter': true, 'k5-urmacht': true };

test('the finale departure offers Teil II and keeps the grown state (without Lichtstoß)', async ({ page }) => {
  test.setTimeout(90000);
  const errors = await loadSave(page, 'finale', FINALE_FLAGS, BASE);
  await idle(page);
  const characters = await snapshot(page);
  await page.evaluate(() => (window as any).__world.ctx.player.teleport([650, 704]));
  await dialogues(page, () => page.evaluate(() => document.querySelectorAll('.choices .choice').length === 4));
  await expect(page.locator('.choices .choice')).toHaveCount(4);
  await expect(page.locator('.choices .choice').nth(2)).toContainText('Teil II');
  await dialogues(page, inBook2(page), 2);
  await expectGrownStateKept(page, BASE, characters);
  expect(await page.evaluate(() => (window as any).G.state.knows('lichtstoss'))).toBe(false);
  expect(errors).toEqual([]);
});

test('an already finished book-one save (k5-ende) still reaches Teil II from the finale', async ({ page }) => {
  test.setTimeout(90000);
  const errors = await loadSave(page, 'finale', { ...FINALE_FLAGS, 'k5-ende': true }, [...BASE, 'lichtstoss']);
  await idle(page);
  const characters = await snapshot(page);
  await page.evaluate(() => (window as any).__world.ctx.player.teleport([650, 704]));
  await dialogues(page, inBook2(page), 2);
  await expectGrownStateKept(page, [...BASE, 'lichtstoss'], characters);
  expect(errors).toEqual([]);
});

test('the optional weiterreise also leads on to Teil II, keeping Lichtstoß', async ({ page }) => {
  test.setTimeout(90000);
  const errors = await loadSave(page, 'weiterreise', { ...FINALE_FLAGS, 'k5-ende': true, 'k5-weiterreise-start': true, 'k5-reisekaempfe': 2 } as Record<string, unknown>, [...BASE, 'lichtstoss']);
  await idle(page);
  const characters = await snapshot(page);
  await page.evaluate(() => {
    const w = (window as any).__world;
    const it = w.interactives.find((i: any) => i.id === 'reiseende');
    const p = it.pos(); w.ctx.player.teleport([p.x, p.y + 16]);
  });
  await page.waitForTimeout(750);
  await page.keyboard.press('e');
  await dialogues(page, inBook2(page), 2);
  await expectGrownStateKept(page, [...BASE, 'lichtstoss'], characters);
  expect(await page.evaluate(() => (window as any).G.state.flag('k5-reisekaempfe'))).toBe(2);
  expect(errors).toEqual([]);
});

test('the finale choice can be postponed and the other two book-one endings stay available', async ({ page }) => {
  test.setTimeout(90000);
  const errors = await loadSave(page, 'finale', { ...FINALE_FLAGS, 'k5-ende': true }, BASE);
  await idle(page);
  await page.evaluate(() => (window as any).__world.ctx.player.teleport([650, 704]));
  await dialogues(page, () => page.evaluate(() => document.querySelectorAll('.choices .choice').length === 4));
  const texts = await page.locator('.choices .choice').allInnerTexts();
  expect(texts[0]).toContain('Das erste Buch abschließen');
  expect(texts[1]).toContain('weiterreisen');
  await page.waitForTimeout(750);
  await page.keyboard.press('4');
  await page.waitForFunction(() => !(window as any).G.ui.busy() && (window as any).__world && !(window as any).__world.playerLocked);
  expect(await page.evaluate(() => (window as any).G.currentScene)).toBe('finale');
  await page.screenshot({ path: test.info().outputPath('finale-postponed.png') });
  expect(errors).toEqual([]);
});
