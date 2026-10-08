import { expect, test, type Page } from '@playwright/test';
import { disableReloads } from './noReloads';
import { continueGame, drive, driveLog, fixtureSave, gotoTitle, readSave, snap, useSettings, watchErrors } from './teil2Helpers';
import { drive3, shot3, state3 } from './teil3Helpers';

/**
 * Teil II → Teil III: a grown Teil-II campaign plays the end of e2-aufbruch with real input and arrives in e3-valentus
 * with everything it had (no reset); an old, already finished Teil-II save reaches Teil III through Fortsetzen and the
 * closing choice „Weiter: das dritte Buch.“ (docs/handoff/transition-contract.md, umsetzung.md §2 „Regulärer Einstieg“).
 *   cd game && SELANTIS_E2E_PORT=5223 SELANTIS_E2E_OUTPUT=test-results/teil3/uebergang npx playwright test e2e/teil-3-uebergang.pw.ts --workers=1
 */
test.use({ viewport: { width: 1280, height: 720 }, actionTimeout: 15000 });

/** Mutations of Teil II's own fixture (prepareE2('e2-aufbruch')): a campaign that grew on its way through both books. */
const GROWN_E2 = `
  data.characters = {
    lia: { level: 5, exp: 63, weapon: 'vatersdolch', mastered: ['dolch'], abilityAp: { lichtstoss: 4, 'e2-stabimpuls': 2 } },
    flick: { level: 10, exp: 7, weapon: 'jagdbogen', mastered: ['bogen'], abilityAp: {} },
    kyra: { level: 4, exp: 18, weapon: null, mastered: [], abilityAp: { schwert: 5 } },
  };
  Object.assign(data.inventory, { apple: 4, bead: 2, 'book-herbs': 1, coins: 6, tincture: 2 });
  for (const a of ['lichtstoss', 'e2-stabimpuls']) if (!data.abilities.includes(a)) data.abilities.push(a);
  data.memories.push('k5-mem-gewitter');
  data.lore.push('k5-lore-tuerkis');
  Object.assign(data.flags, { 'e2-abschied': 'brief', 'e2-uebungskampf-siege': 2, 'k5-weiterreise-start': true, 'k5-reisekaempfe': 3 });
  data.playtimeSec = 7777;
`;

/** Flags the end of e2-aufbruch itself resets or sets on its way (hang trail, finish). */
const TRANSIENT = /^e2-hang-|^e2-finished$/;

async function arrive(page: Page): Promise<void> {
  // e3-valentus runs enterBook3() at its start; wait until Lia can walk on the forest path.
  await drive3(page, { label: 'valentus-ankunft', timeoutMs: 3 * 60 * 1000, until: s => s.scene === 'e3-valentus' && s.worldActive && !s.locked && !s.busy && Boolean(s.objective) });
}

/** Everything the campaign had before the end of Teil II is still there, unchanged (umsetzung.md §2). */
async function expectKept(page: Page, before: any): Promise<void> {
  const data = await state3(page);
  expect(data.chapter).toBe('teil-3');
  expect(data.scene).toBe('e3-valentus');
  expect(data.characters, 'levels, EXP, AP unchanged').toEqual(before.characters);
  expect(data.inventory, 'inventory unchanged').toEqual(before.inventory);
  expect([...data.abilities].sort(), 'abilities unchanged').toEqual([...before.abilities].sort());
  expect(data.memories).toEqual(expect.arrayContaining(before.memories));
  expect(data.lore).toEqual(expect.arrayContaining(before.lore));
  expect(data.clues).toEqual(expect.arrayContaining(before.clues));
  for (const [f, v] of Object.entries(before.flags)) if (!TRANSIENT.test(f)) expect(data.flags[f], `flag ${f}`).toEqual(v);
  expect(data.flags['e2-finished']).toBe(true);
  expect(data.flags['e3-eingang'], 'recognised as a continued campaign').toBe('teil-2');
  expect(data.party).toEqual([]);
  expect(data.objectives.filter((o: any) => !o.done && !String(o.id).startsWith('e3-')), 'no Teil-II objective left open').toEqual([]);
  expect(data.playtimeSec).toBeGreaterThanOrEqual(before.playtimeSec);
  // The autosave at the scene start already holds the continued campaign.
  const saved = await readSave(page);
  expect(saved.scene).toBe('e3-valentus');
  expect(saved.chapter).toBe('teil-3');
  expect(saved.characters).toEqual(before.characters);
  expect(saved.inventory).toEqual(before.inventory);
}

test('a grown Teil-II campaign plays the end of e2-aufbruch and arrives in e3-valentus unchanged', async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);
  const errors = watchErrors(page);
  await disableReloads(page);
  await useSettings(page);
  await gotoTitle(page);
  await fixtureSave(page, 'e2-aufbruch', GROWN_E2, { part: 'hang' });
  await page.reload();
  await expect(page.getByRole('button', { name: /Fortsetzen/ })).toBeVisible({ timeout: 30000 });
  await continueGame(page, 'e2-aufbruch');
  await page.evaluate(() => {
    const w = window as any;
    w.__warps = 0;
    const orig = w.G.warp.bind(w.G);
    w.G.warp = (id: string) => { w.__warps++; return orig(id); };
    w.__gotos = [];
    w.G.events.on('scene:goto', (e: { id: string }) => w.__gotos.push(e.id));
  });
  const before = await state3(page);
  expect(before.characters.lia).toMatchObject({ level: 5, exp: 63, weapon: 'vatersdolch', mastered: ['dolch'] });
  let credits = false;
  // The slope with real input (Spurenblick trail, the path up), the plate, the narrator, the book-two credits.
  await drive(page, {
    label: 'aufbruch-hang', timeoutMs: 12 * 60 * 1000,
    until: s => s.scene === 'e3-valentus',
    onSnap: async s => { if (s.credits && !credits) { credits = true; await page.waitForTimeout(1500); await shot3(page, 'uebergang-abspann-teil-2'); } },
  });
  expect(credits, 'the book-two credits rolled').toBe(true);
  await arrive(page);
  await shot3(page, 'uebergang-ankunft-valentus');
  await expectKept(page, before);
  const flow = await page.evaluate(() => ({ warps: (window as any).__warps, gotos: (window as any).__gotos }));
  expect(flow.warps, 'no warp (= no reset) on the way').toBe(0);
  expect(flow.gotos).toEqual(['e3-valentus']);
  expect(driveLog.teleports, driveLog.teleports.join('\n')).toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('an old finished Teil-II save reaches Teil III through Fortsetzen and „Weiter: das dritte Buch.“', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  const errors = watchErrors(page);
  await disableReloads(page);
  await useSettings(page);
  await gotoTitle(page);
  // As finishBook() in e2-aufbruch leaves it: e2-finished, empty party, checkpoint at e2-aufbruch.
  await fixtureSave(page, 'e2-aufbruch', `${GROWN_E2}
    data.flags['e2-finished'] = true; data.party = [];
    data.objectives = [{ id: 'e2-hang-weg', text: 'Weiter, den Pfad hinauf.', done: false }];
  `, { book2Finished: true });
  await page.reload();
  await expect(page.getByRole('button', { name: /Fortsetzen/ })).toBeVisible({ timeout: 30000 });
  const raw = await page.evaluate(() => JSON.parse(localStorage.getItem('selantis.save.v1')!));
  await continueGame(page, 'e2-aufbruch');
  // The loaded campaign (the loader normalises character records; nothing of the grown state may get lost there).
  const before = await state3(page);
  expect(before.characters.lia).toMatchObject({ level: 5, exp: 63, weapon: 'vatersdolch', mastered: ['dolch'] });
  expect(before.inventory).toEqual(raw.inventory);
  await page.evaluate(() => {
    const w = window as any;
    w.__warps = 0;
    const orig = w.G.warp.bind(w.G);
    w.G.warp = (id: string) => { w.__warps++; return orig(id); };
  });
  await drive(page, { label: 'abschluss', timeoutMs: 60000, until: s => s.choices.length === 3 });
  const choices = (await snap(page)).choices.map(c => c.text);
  expect(choices).toEqual(['Den Abspann noch einmal ansehen.', 'Zurück zum Titel.', 'Weiter: das dritte Buch.']);
  await shot3(page, 'uebergang-abschlusswahl');
  await page.waitForTimeout(750);
  await page.keyboard.press('3');
  await page.waitForFunction(() => (window as any).G.currentScene === 'e3-valentus', undefined, { timeout: 30000 });
  await arrive(page);
  await expectKept(page, before);
  expect(await page.evaluate(() => (window as any).__warps)).toBe(0);
  expect(errors, errors.join('\n')).toEqual([]);
});
