import { expect, test, type Page } from '@playwright/test';
import { disableReloads } from './noReloads';
import {
  continueGame, drive, driveLog, fixtureSave, gotoTitle, LOUD, QUIET, readSave, reloadAndContinue, shot, shots, snap, useSettings,
  watchErrors, writeSave, type Snap,
} from './teil2Helpers';

/**
 * Teil II „Letzte Hoffnung“ in the browser (docs/teil-2/umsetzung.md). Real inputs only: keys, canvas clicks computed
 * from the world camera, touch via CDP; game state is only read. See teil2Helpers.ts for the two documented exceptions
 * (AI planning of battle turns, last-resort teleport when a walk makes no progress).
 *   cd game && SELANTIS_E2E_PORT=5197 SELANTIS_E2E_OUTPUT=test-results/teil-2 npx playwright test e2e/teil-2.pw.ts --workers=1
 */
test.use({ viewport: { width: 1280, height: 720 } });

const E2_SCENES = [
  'e2-taverne', 'e2-bruderschaft', 'e2-pruefung', 'e2-flicks-herkunft', 'e2-lagerangriff', 'e2-der-fremde',
  'e2-gefangene', 'e2-urmacht', 'e2-flicks-verhoer', 'e2-konzentration', 'e2-flicks-erinnerungen',
  'e2-kyras-widerstand', 'e2-ignatius', 'e2-zellengespraeche', 'e2-stabtraining', 'e2-flick-entkommt',
  'e2-kontrolle', 'e2-aufbruch',
] as const;

const BASE_ABILITIES = ['spurenblick', 'schleichen', 'ausweichen', 'ablenken', 'urmacht'];

/** A grown book-one campaign that just chose „Teil II“ (finale, without the optional Lichtstoß). */
const GROWN = {
  version: 1, chapter: 'teil-2', scene: 'e2-taverne',
  flags: { 'k4-verrat': true, 'k5-flick-dabei': true, 'k5-urmacht': true, 'k5-erwacht': true, 'k5-weiter': true, 'k5-ende': true },
  inventory: { dagger: 1, coins: 3, 'book-herbs': 1, bead: 2, apple: 3, tinder: 1, bread: 1, cheese: 1, tincture: 2, 'book-alana': 1 },
  characters: {
    lia: { level: 4, exp: 37, weapon: null, mastered: ['steinwurf'], abilityAp: { versorgen: 6 } },
    flick: { level: 9, exp: 12, weapon: null, mastered: [], abilityAp: { bogen: 3 } },
    kyra: { level: 2, exp: 55, weapon: null, mastered: [], abilityAp: {} },
  },
  party: ['flick', 'kyra'], objectives: [], memories: ['k5-mem-gewitter'], clues: [], lore: ['k5-lore-tuerkis', 'k3-lore-verbannungsfest'],
  abilities: BASE_ABILITIES, playtimeSec: 3600, savedAt: new Date(0).toISOString(),
};

const state = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).G.state.data)));
const count = (page: Page, item: string) => page.evaluate(i => (window as any).G.state.count(i), item);
const lia = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).G.state.character('lia') ?? null)));

/** Fresh campaign page: settings, title, a save written by `save`, then Fortsetzen. */
async function campaign(page: Page, save: (p: Page) => Promise<void>, scene: string, settings = QUIET): Promise<string[]> {
  const errors = watchErrors(page);
  await disableReloads(page);
  await useSettings(page, settings);
  await gotoTitle(page);
  await save(page);
  await page.reload();
  await expect(page.getByRole('button', { name: /Fortsetzen/ })).toBeVisible({ timeout: 30000 });
  await continueGame(page, scene);
  return errors;
}

/** Screenshot moments of the playthrough (each once). */
function moments(page: Page, list: [string, (s: Snap) => boolean, number?][]): (s: Snap) => Promise<void> {
  const done = new Set<string>();
  return async s => {
    for (const [name, cond, delay = 0] of list) {
      if (done.has(name) || !cond(s)) continue;
      done.add(name);
      // The driver pauses here: fades and plate pans settle before the picture is taken.
      await page.waitForTimeout(delay);
      await shot(page, name);
    }
  };
}

const idleOn = (map: string) => (s: Snap) => s.map === map && s.worldActive && !s.locked && !s.busy && Boolean(s.objective);

// ---------------------------------------------------------------------------------------------------------------
// 1. Smoke: every scene loads directly
// ---------------------------------------------------------------------------------------------------------------

test.describe('smoke', () => {
  for (const id of E2_SCENES) {
    test(`direct entry ${id}`, async ({ page }) => {
      test.setTimeout(90000);
      const errors = watchErrors(page);
      await disableReloads(page);
      await useSettings(page);
      await page.goto(`/?scene=${id}`);
      await page.waitForFunction(id => (window as any).G?.currentScene === id, id, { timeout: 30000 });
      let shown = '';
      for (let n = 0; n < 120 && !shown; n++) {
        const s = await snap(page);
        const objective = await page.locator('.hud-obj-text').textContent().catch(() => '') ?? '';
        const gesture = s.action ? await page.locator('.scene-action .ch-title').first().textContent() : null;
        if ((s.world || s.tactics) && (objective.trim() || s.line || s.plate || gesture)) shown = objective.trim() || s.line || s.plate || `Geste: ${gesture}`;
        else if (s.choices.length) await page.keyboard.press('1');
        else if (s.busy) await page.keyboard.press('Enter');
        await page.waitForTimeout(250);
      }
      expect(shown, `${id}: no objective or dialogue`).not.toBe('');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: test.info().outputPath(`smoke-${id}.png`) });
      expect((await snap(page)).scene).toBe(id);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------
// 2. The full playthrough in one campaign
// ---------------------------------------------------------------------------------------------------------------

test('full playthrough from the grown book-one save to the end of Teil II with real inputs', async ({ page }) => {
  test.setTimeout(100 * 60 * 1000);
  const errors = await campaign(page, p => writeSave(p, GROWN), 'e2-taverne');
  await page.evaluate(() => {
    const w = window as any;
    w.__warps = 0;
    const orig = w.G.warp.bind(w.G);
    w.G.warp = (id: string) => { w.__warps++; return orig(id); }; // counts warps only; the campaign must not use any
    w.__gotos = [];
    w.G.events.on('scene:goto', (e: { id: string }) => w.__gotos.push(e.id));
  });
  const start = await state(page);
  const onSnap = moments(page, [
    ['01-taverne-gaeste', idleOn('e2-eber'), 600],
    ['02-waldposten', idleOn('e2-waldposten'), 600],
    ['03-lager-tag', idleOn('e2-lager-tag'), 600],
    ['04-pruefung-tafel', s => s.plate === 'Die Prüfung', 1200],
    ['05-sehkugel', s => s.plate === 'Weit entfernt', 1200],
    ['06-lager-nacht', idleOn('e2-lager-nacht'), 600],
    ['07-lagerangriff-kampf', s => s.tactics && s.scene === 'e2-lagerangriff', 1500],
    ['08-bach-flucht', idleOn('e2-bach-lauf'), 600],
    ['09-trennung-tafel', s => s.plate === 'Das Lager im Morgengrauen', 1200],
    ['10-ignatius-lager', s => s.scene === 'e2-der-fremde' && s.worldActive && !s.locked && !s.busy, 600],
    ['11-halle-gefangene', idleOn('e2-halle-koeder'), 600],
    ['12-bericht-tafel', s => s.plate === 'Nach der Erzählung des Fremden', 1200],
    ['13-verhoer', s => s.scene === 'e2-flicks-verhoer' && Boolean(s.objective) && !s.busy, 600],
    ['14-konzentration-minispiel', s => s.sammlung, 2500],
    ['15-erinnerung-tafel', s => s.scene === 'e2-flicks-erinnerungen' && Boolean(s.plate), 1200],
    ['16-ignatius-schattentoeter', s => s.plate === 'Schattentöter', 1200],
    ['17-nachtweg', idleOn('e2-ignatius-nachtweg'), 600],
    ['18-kerker-zellen', idleOn('e2-kerker-zellen'), 600],
    ['19-stab-training', s => Boolean(s.zielen), 800],
    ['20-uebungskampf', s => s.tactics && s.scene === 'e2-stabtraining', 1500],
    ['21-kerker-flucht', idleOn('e2-kerker-alarm'), 600],
    ['22-kontrolle-tafel', s => s.scene === 'e2-kontrolle' && Boolean(s.plate), 1200],
    ['23-flick-farn', s => s.map === 'e2-flick-versteck' && s.worldActive && !s.busy, 1500],
    ['24-aufbruch-morgen', idleOn('e2-aufbruch-lager'), 600],
    ['25-aufbruch-hang', idleOn('e2-herbsthang'), 600],
    ['26-aufbruch-tafel', s => s.plate === 'Letzte Hoffnung', 1500],
    ['27-credits', s => s.credits, 2500],
  ]);
  const visited: string[] = [];
  const track = async (s: Snap) => { if (s.scene && visited[visited.length - 1] !== s.scene) visited.push(s.scene); await onSnap(s); };
  for (const id of E2_SCENES) {
    await test.step(id, async () => {
      const last = id === 'e2-aufbruch';
      await drive(page, {
        label: id, timeoutMs: 12 * 60 * 1000, onSnap: track,
        until: last ? async s => s.title && await page.evaluate(() => (window as any).G.state.is('e2-finished')) : s => s.scene !== id,
      });
      if (!last) expect((await snap(page)).scene).toBe(E2_SCENES[E2_SCENES.indexOf(id) + 1]);
    });
  }
  // End state of the campaign (the save written before the credits as well as the live state).
  const end = await state(page);
  const saved = await readSave(page);
  for (const data of [end, saved]) {
    for (const f of ['e2-staff-received', 'e2-training-complete', 'e2-flick-escaped', 'e2-kyra-controlled', 'e2-elnon-struck', 'e2-finished']) {
      expect(data.flags[f], f).toBe(true);
    }
    expect(data.inventory['e2-schattentoeter']).toBe(1);
    expect(data.abilities).toEqual(expect.arrayContaining(['lichtstoss', 'e2-stabimpuls', ...BASE_ABILITIES]));
    expect(data.abilities.filter((a: string) => a === 'lichtstoss')).toHaveLength(1);
    expect(data.party).toEqual([]);
    for (const id of Object.keys(GROWN.inventory)) expect(data.inventory[id] ?? 0, `item ${id}`).toBeGreaterThanOrEqual(1);
    const a = start.characters.lia, b = data.characters.lia;
    expect(b.level * 10000 + b.exp, `Lia ${JSON.stringify(a)} → ${JSON.stringify(b)}`).toBeGreaterThanOrEqual(a.level * 10000 + a.exp);
    expect(data.memories).toEqual(expect.arrayContaining(GROWN.memories));
    expect(data.lore).toEqual(expect.arrayContaining([...GROWN.lore, 'e2-lore-pruefung', 'e2-lore-xenovia', 'e2-lore-valentus', 'e2-lore-rat', 'e2-lore-vamir']));
  }
  expect(saved.scene).toBe('e2-aufbruch');
  const flow = await page.evaluate(() => ({ warps: (window as any).__warps, gotos: (window as any).__gotos }));
  expect(flow.warps).toBe(0);
  expect(flow.gotos.filter((g: string, i: number, all: string[]) => all.indexOf(g) === i)).toEqual(E2_SCENES.slice(1));
  expect(visited.filter((v, i, all) => all.indexOf(v) === i)).toEqual([...E2_SCENES]);
  test.info().annotations.push({ type: 'drive', description: JSON.stringify({ ...driveLog, shots: shots.length }) });
  console.log(`DRIVE ${JSON.stringify(driveLog)}`);
  expect(errors, errors.join('\n')).toEqual([]);
  // Places where following the objective marker with real inputs did not progress (game bugs, see report).
  expect.soft(driveLog.workarounds, driveLog.workarounds.join('\n')).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------
// 3. Lichtstoß both ways
// ---------------------------------------------------------------------------------------------------------------

test('Lichtstoß: a save without it learns it exactly once in e2-konzentration', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  const errors = await campaign(page, p => fixtureSave(p, 'e2-konzentration'), 'e2-konzentration');
  expect(await page.evaluate(() => (window as any).G.state.knows('lichtstoss'))).toBe(false);
  const lines: string[] = [];
  await drive(page, { label: 'konz-ohne', until: s => s.scene !== 'e2-konzentration', onSnap: async s => { if (s.line && lines[lines.length - 1] !== s.line) lines.push(s.line); } });
  const data = await state(page);
  expect(data.abilities.filter((a: string) => a === 'lichtstoss')).toHaveLength(1);
  expect(data.flags['e2-konz-lichtstoss']).toBe(true);
  expect(data.flags['e2-konz-kontrolle']).toBeUndefined();
  expect(lines.join('\n')).toContain('Das … war ich');
  const saved = await readSave(page);
  expect(saved.scene).toBe('e2-flicks-erinnerungen');
  expect(saved.abilities.filter((a: string) => a === 'lichtstoss')).toHaveLength(1);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Lichtstoß: a save that already knows it completes e2-konzentration with the „already known“ path', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  const errors = await campaign(page, p => fixtureSave(p, 'e2-konzentration', "data.abilities.push('lichtstoss'); data.flags['e2-lichtstoss-vorher'] = true;"), 'e2-konzentration');
  const lines: string[] = [];
  await drive(page, { label: 'konz-mit', until: s => s.scene !== 'e2-konzentration', onSnap: async s => { if (s.line && lines[lines.length - 1] !== s.line) lines.push(s.line); } });
  const data = await state(page);
  expect(data.abilities.filter((a: string) => a === 'lichtstoss')).toHaveLength(1);
  expect(data.flags['e2-konz-kontrolle']).toBe(true);
  expect(data.flags['e2-konz-lichtstoss']).toBeUndefined();
  const all = lines.join('\n');
  expect(all).toContain('Auf der Reise mit Kyra und Flick');
  expect(all).toContain('Das nennt man Kontrolle');
  expect(all).not.toContain('Das … war ich');
  expect(errors, errors.join('\n')).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------
// 4. Reload / once-only
// ---------------------------------------------------------------------------------------------------------------

test('reload in e2-ignatius after receiving the staff keeps exactly one Schattentöter and stays playable', async ({ page }) => {
  test.setTimeout(15 * 60 * 1000);
  const errors = await campaign(page, p => fixtureSave(p, 'e2-ignatius'), 'e2-ignatius');
  await drive(page, { label: 'ignatius-stab', until: async () => (await count(page, 'e2-schattentoeter')) === 1 });
  // Reload in the middle of the morning part, right after the staff was handed over.
  await reloadAndContinue(page, 'e2-ignatius');
  expect(await count(page, 'e2-schattentoeter')).toBeLessThanOrEqual(1);
  await drive(page, { label: 'ignatius-morgen', until: s => s.map === 'e2-ignatius-nachtweg' && s.worldActive });
  expect(await count(page, 'e2-schattentoeter')).toBe(1);
  expect((await readSave(page)).params?.part).toBe('nachtweg');
  await reloadAndContinue(page, 'e2-ignatius');
  await page.waitForFunction(() => (window as any).__world?.map?.id === 'e2-ignatius-nachtweg', undefined, { timeout: 30000 });
  expect(await count(page, 'e2-schattentoeter')).toBe(1);
  await drive(page, { label: 'ignatius-nachtweg', until: s => s.scene === 'e2-zellengespraeche' });
  const data = await state(page);
  expect(data.inventory['e2-schattentoeter']).toBe(1);
  expect(data.flags['e2-staff-received']).toBe(true);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('e2-uebungskampf: the victory EXP is granted once, also after a reload', async ({ page }) => {
  test.setTimeout(15 * 60 * 1000);
  const errors = await campaign(page, p => fixtureSave(p, 'e2-stabtraining'), 'e2-stabtraining');
  const before = await lia(page);
  await drive(page, {
    label: 'uebungskampf',
    until: async s => s.worldActive && !s.tactics && await page.evaluate(() => (window as any).G.state.is('e2-uebungskampf-gewonnen')),
  });
  const won = await lia(page);
  expect(won, 'the first win grants progress').not.toEqual(before);
  expect(await page.evaluate(() => (window as any).G.state.flag('e2-uebungskampf-siege'))).toBe(1);
  await reloadAndContinue(page, 'e2-stabtraining');
  await page.waitForFunction(() => (window as any).__world?.player, undefined, { timeout: 30000 });
  expect(await lia(page)).toEqual(won);
  await drive(page, { label: 'uebungskampf-nach-reload', until: s => s.scene === 'e2-flick-entkommt' });
  expect(await lia(page)).toEqual(won);
  const data = await state(page);
  expect(data.flags['e2-uebungskampf-siege']).toBe(1);
  expect(data.abilities.filter((a: string) => a === 'e2-stabimpuls')).toHaveLength(1);
  expect(data.flags['e2-training-complete']).toBe(true);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('e2-lagerangriff: reloads in the alarm, the battle and the flight restart the right part without double rewards', async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);
  const errors = await campaign(page, p => fixtureSave(p, 'e2-lagerangriff'), 'e2-lagerangriff');
  await drive(page, { label: 'alarm', until: s => s.map === 'e2-lager-alarm' && s.worldActive && !s.locked && Boolean(s.objective) });
  await reloadAndContinue(page, 'e2-lagerangriff');
  await page.waitForFunction(() => (window as any).__world?.map?.id === 'e2-lager-alarm', undefined, { timeout: 30000 });
  expect(await page.evaluate(() => (window as any).G.state.data.party)).toEqual(['flick', 'kyra']);
  await drive(page, { label: 'alarm-2', until: s => s.tactics });
  expect((await readSave(page)).params?.part).toBe('kampf');
  await reloadAndContinue(page, 'e2-lagerangriff');
  await page.waitForFunction(() => (window as any).__tactics?.ready, undefined, { timeout: 30000 });
  await drive(page, { label: 'kampf', until: s => s.map === 'e2-bach-flucht' && s.worldActive });
  const afterWin = await state(page);
  expect(afterWin.flags['e2-ueberfall-gewonnen']).toBe(true);
  expect((await readSave(page)).params?.part).toBe('flucht');
  await reloadAndContinue(page, 'e2-lagerangriff');
  await page.waitForFunction(() => (window as any).__world?.map?.id === 'e2-bach-flucht', undefined, { timeout: 30000 });
  expect(await page.evaluate(() => (window as any).G.state.flag('e2-ueberfall-runden'))).toBe(afterWin.flags['e2-ueberfall-runden']);
  expect(await lia(page)).toEqual(afterWin.characters.lia ?? null);
  await drive(page, { label: 'flucht', until: s => s.scene === 'e2-der-fremde' });
  const data = await state(page);
  expect(data.party).toEqual([]);
  expect(data.flags['e2-getrennt']).toBe(true);
  expect(data.flags['e2-ueberfall-runden']).toBe(afterWin.flags['e2-ueberfall-runden']);
  expect(errors, errors.join('\n')).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------
// 5. Old book-one save: chapter select and F2
// ---------------------------------------------------------------------------------------------------------------

const OLD_SAVE = {
  version: 1, chapter: 'kapitel-5', scene: 'finale',
  flags: { 'k5-erwacht': true, 'k5-weiter': true, 'k5-urmacht': true, 'k5-ende': true },
  inventory: { dagger: 1, coins: 1 }, characters: {}, party: ['flick', 'kyra'], objectives: [], memories: [], clues: [], lore: [],
  abilities: BASE_ABILITIES, playtimeSec: 0, savedAt: new Date(0).toISOString(),
};

test('an old book-one save (k5-ende) shows Teil II in the chapter select and warps into e2-urmacht', async ({ page }) => {
  test.setTimeout(120000);
  const errors = watchErrors(page);
  await disableReloads(page);
  await useSettings(page);
  await gotoTitle(page);
  await writeSave(page, OLD_SAVE);
  await page.reload();
  await expect(page.getByRole('button', { name: /Fortsetzen/ })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: /^Kapitel/ }).click();
  const head = page.locator('.chap-head', { hasText: 'Teil II' });
  await expect(head).toBeVisible();
  await expect(head).toContainText('Letzte Hoffnung');
  await head.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shot(page, '30-kapitelwahl-teil-2');
  const row = page.locator('.chap-scene', { hasText: 'Was Valentus tat' });
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(row).toHaveClass(/is-confirm/); // the campaign save would be overwritten: a second pick confirms
  await row.click();
  await page.waitForFunction(() => (window as any).G.currentScene === 'e2-urmacht' && (window as any).__world?.player, undefined, { timeout: 30000 });
  const warped = await state(page);
  expect(warped.flags['e2-getrennt']).toBe(true);
  expect(warped.party).toEqual([]);
  await drive(page, { label: 'urmacht-start', until: s => s.worldActive && !s.locked && Boolean(s.objective), timeoutMs: 60000 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('F2 debug select warps from a loaded book-one save into e2-urmacht', async ({ page }) => {
  test.setTimeout(120000);
  const errors = watchErrors(page);
  await disableReloads(page);
  await useSettings(page);
  await gotoTitle(page);
  await writeSave(page, { ...OLD_SAVE, flags: { ...OLD_SAVE.flags } });
  await page.reload();
  await continueGame(page, 'finale');
  await drive(page, { label: 'finale', until: s => s.worldActive && !s.locked && !s.busy, timeoutMs: 60000 });
  await page.keyboard.press('F2');
  const filter = page.locator('.debug-filter');
  await expect(filter).toBeVisible();
  await filter.fill('e2-urmacht');
  await page.locator('.debug-list .chap-scene', { hasText: 'e2-urmacht' }).click();
  await page.waitForFunction(() => (window as any).G.currentScene === 'e2-urmacht' && (window as any).__world?.player, undefined, { timeout: 30000 });
  await drive(page, { label: 'urmacht-f2', until: s => s.worldActive && !s.locked && Boolean(s.objective), timeoutMs: 60000 });
  expect((await state(page)).flags['e2-fremder-done']).toBe(true);
  expect(errors, errors.join('\n')).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------
// 6. Phone
// ---------------------------------------------------------------------------------------------------------------

test.describe('phone portrait', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('390x844 portrait shows the rotate hint', async ({ page }) => {
    const errors = watchErrors(page);
    await disableReloads(page);
    await useSettings(page);
    // The hint greets portrait phones on the title and steps aside after 12 s (ui/rotate.ts).
    await page.goto('/');
    const hint = page.locator('.rotate-hint.is-in');
    await expect(hint).toBeVisible({ timeout: 10000 });
    await expect(hint).toContainText('Querformat');
    await page.waitForTimeout(700);
    expect(await hint.evaluate(e => Number(getComputedStyle(e).opacity))).toBeGreaterThan(0.9);
    await shot(page, '40-phone-hochformat');
    // A Teil-II scene in portrait still runs (the hint may already have retired by then).
    await page.goto('/?scene=e2-taverne');
    await page.waitForFunction(() => (window as any).G?.currentScene === 'e2-taverne', undefined, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: test.info().outputPath('phone-hochformat-taverne.png') });
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('phone landscape', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  /** Real touch: tap = touchStart/touchEnd, hold = touchStart … touchEnd through CDP. */
  async function touchHold(page: Page, x: number, y: number, ms: number): Promise<void> {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }
  const center = async (page: Page, sel: string) => {
    const b = await page.locator(sel).first().boundingBox();
    return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
  };

  /** Touch-only driver for the two phone checks. */
  async function touchDrive(page: Page, until: (s: Snap) => boolean | Promise<boolean>, label: string, onSnap?: (s: Snap) => Promise<void>): Promise<void> {
    const deadline = Date.now() + 8 * 60 * 1000;
    for (;;) {
      const s = await snap(page);
      if (await until(s)) return;
      if (onSnap) await onSnap(s);
      if (Date.now() > deadline) { await shot(page, `stuck-phone-${label}`); throw new Error(`touchDrive(${label}) timed out: ${JSON.stringify({ scene: s.scene, map: s.map, objective: s.objective, busy: s.busy })}`); }
      if (s.sammlung) {
        const d = await page.evaluate(() => { const r = document.querySelector<HTMLElement>('.e2s-root')!; return { phase: r.dataset.phase, used: r.dataset.used, x: Number(r.dataset.x), y: Number(r.dataset.y), dist: Number(r.dataset.dist), done: r.dataset.done }; });
        if (d.done) { await page.waitForTimeout(150); continue; }
        if (d.phase === 'full' && d.used === '0' && d.dist <= 0.24) { await page.locator('.e2s-go').tap(); await page.waitForTimeout(120); continue; }
        if (d.dist > 0.08) {
          const dir = Math.abs(d.x) > Math.abs(d.y) ? (d.x > 0 ? 'left' : 'right') : (d.y > 0 ? 'up' : 'down');
          const p = await center(page, `.e2s-pad [data-d="${dir}"]`);
          if (p) await touchHold(page, p.x, p.y, Math.max(40, Math.min(160, (Math.max(Math.abs(d.x), Math.abs(d.y)) / 0.95) * 700)));
        }
        await page.waitForTimeout(30);
        continue;
      }
      if (s.choices.length) {
        await page.waitForTimeout(750);
        const rows = page.locator('.choices:not(.is-out) .choice:not(.is-disabled)');
        if (await rows.count()) await rows.first().tap();
        await page.waitForTimeout(300);
        continue;
      }
      if (s.busy) {
        const catcher = page.locator('.ui-catcher').last();
        const b = await catcher.boundingBox().catch(() => null);
        await page.touchscreen.tap(b ? b.x + b.width / 2 : 422, b ? b.y + b.height * 0.4 : 150);
        await page.waitForTimeout(200);
        continue;
      }
      if (s.worldActive && !s.locked) {
        const target = await page.evaluate(() => {
          const w = (window as any).__world, t = w.objective?.target;
          if (t == null) return null;
          const it = typeof t === 'string' ? w.interactives.find((i: any) => i.id === t && !i.removed) : null;
          const pos = it?.enabled() ? it.pos() : w.resolveTarget(t);
          if (!pos) return null;
          const c = document.querySelector('canvas')!.getBoundingClientRect();
          const sc = w.toScreen(pos.x, pos.y - (it ? 6 : 0));
          const inside = sc.x > 20 && sc.x < 620 && sc.y > 80 && sc.y < 330;
          const p = w.player;
          const tx = inside ? sc : w.toScreen(p.x + Math.sign(pos.x - p.x) * Math.min(120, Math.abs(pos.x - p.x)), p.y + Math.sign(pos.y - p.y) * Math.min(80, Math.abs(pos.y - p.y)));
          return { x: c.left + tx.x * c.width / 640, y: c.top + tx.y * c.height / 360 };
        });
        if (target) await page.touchscreen.tap(target.x, target.y);
        await page.waitForTimeout(500);
        continue;
      }
      await page.waitForTimeout(150);
    }
  }

  async function phoneCampaign(page: Page, save: (p: Page) => Promise<void>, scene: string): Promise<string[]> {
    const errors = watchErrors(page);
    await disableReloads(page);
    await useSettings(page);
    await gotoTitle(page);
    await save(page);
    await page.reload();
    await page.getByRole('button', { name: /Fortsetzen/ }).tap();
    await page.waitForFunction(s => (window as any).G?.currentScene === s, scene, { timeout: 30000 });
    return errors;
  }

  test('844x390 landscape: the tavern opening with touch taps', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);
    const errors = await phoneCampaign(page, p => writeSave(p, GROWN), 'e2-taverne');
    await expect(page.locator('.rotate-hint')).toBeHidden();
    await touchDrive(page, s => s.map === 'e2-eber' && s.worldActive && !s.locked && !s.busy && Boolean(s.objective), 'taverne-auftakt');
    await page.waitForTimeout(600);
    await shot(page, '41-phone-quer-taverne');
    // First source by touch: tap Flick/Craupor and listen.
    await touchDrive(page, () => page.evaluate(() => (window as any).G.state.hasClue('e2-hinweis-craupor') && !(window as any).G.ui.busy()), 'taverne-craupor');
    expect(await page.evaluate(() => (window as any).G.state.data.clues)).toContain('e2-hinweis-craupor');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('844x390 landscape: the concentration minigame with touch', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);
    const errors = await phoneCampaign(page, p => fixtureSave(p, 'e2-konzentration'), 'e2-konzentration');
    let pictured = false;
    await touchDrive(page, s => s.scene !== 'e2-konzentration', 'konzentration', async s => {
      if (s.sammlung && !pictured) { pictured = true; await page.waitForTimeout(1800); await shot(page, '42-phone-quer-konzentration'); }
    });
    expect(pictured).toBe(true);
    expect(await page.evaluate(() => (window as any).G.state.knows('lichtstoss'))).toBe(true);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 7. Sound and motion settings
// ---------------------------------------------------------------------------------------------------------------

test('reduced motion off and sound on: the camp alarm plays without errors', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  const errors = await campaign(page, p => fixtureSave(p, 'e2-lagerangriff'), 'e2-lagerangriff', LOUD);
  const settings = await page.evaluate(() => ({ ...(window as any).G.settings }));
  expect(settings).toMatchObject({ reducedMotion: false, music: 0.6, voice: 0.6, sfx: 0.6 });
  expect(await page.locator('#ui').evaluate(e => e.classList.contains('reduced-motion'))).toBe(false);
  await drive(page, { label: 'laut', until: s => s.tactics, timeoutMs: 4 * 60 * 1000 });
  await page.waitForTimeout(1500);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('sound off: a scene with many sounds plays without audio errors', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  const errors = await campaign(page, p => fixtureSave(p, 'e2-pruefung'), 'e2-pruefung', { ...QUIET, reducedMotion: false });
  expect(await page.evaluate(() => (window as any).G.settings)).toMatchObject({ music: 0, voice: 0, sfx: 0 });
  await drive(page, { label: 'leise', until: s => s.scene !== 'e2-pruefung', timeoutMs: 4 * 60 * 1000 });
  expect(errors, errors.join('\n')).toEqual([]);
});
