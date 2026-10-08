import { expect, test, type Page } from '@playwright/test';
import { disableReloads } from './noReloads';
import { continueGame, driveLog, gotoTitle, QUIET, readSave, reloadAndContinue, snap, useSettings, watchErrors, type Snap } from './teil2Helpers';
import {
  battleLog3, drive3, drive3Log, E3_SCENES, e3ChapterRow, fixtureSave3, NOT_LIAS_BODY, playBattleUi, probe3, reachAllE3, shot3, shots3, state3, type E3Scene, type Probe3,
} from './teil3Helpers';

/**
 * Teil III „Falscher Glaube“ in the browser (docs/teil-3/umsetzung.md). Real inputs only: keys, canvas clicks computed
 * from the world camera, touch via CDP; game state is only read. Battles go through the battle UI (teil3Helpers
 * playBattleUi: the turn is planned by reading the battle, every action is a menu click, cursor key, Enter or tap).
 * The documented exceptions of teil2Helpers apply (last-resort teleport, recorded in driveLog.teleports).
 *   cd game && SELANTIS_E2E_PORT=5223 SELANTIS_E2E_OUTPUT=test-results/teil3/teil-3 npx playwright test e2e/teil-3.pw.ts --workers=1
 */
test.use({ viewport: { width: 1280, height: 720 }, actionTimeout: 15000 });

const OWN = 'e3-lia-staff';
const SCHATTEN = 'e2-schattentoeter';

/** Inventory the documented direct-entry state holds at the start of each scene (shared.ts prepareE3). */
function entryStaffs(id: E3Scene): { own: number; schatten: number } {
  const i = E3_SCENES.indexOf(id);
  const at = (s: E3Scene) => E3_SCENES.indexOf(s);
  const own = i === at('e3-paladine') || i >= at('e3-vamir') ? 1 : 0;
  const schatten = i <= at('e3-eigener-stab') || i >= at('e3-ignatius-abschied') ? 1 : 0;
  return { own, schatten };
}

const count = (page: Page, item: string) => page.evaluate(i => (window as any).G.state.count(i), item);
const lia = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).G.state.character('lia') ?? null)));

/** Fresh campaign page: settings, title, a save written by `save`, then Fortsetzen. */
async function campaign(page: Page, save: (p: Page) => Promise<void>, scene: string, settings: Record<string, unknown> = QUIET): Promise<string[]> {
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

/** Screenshot moments (each once). */
function moments(page: Page, list: [string, (s: Snap) => boolean, number?][]): (s: Snap) => Promise<void> {
  const done = new Set<string>();
  return async s => {
    for (const [name, cond, delay = 0] of list) {
      if (done.has(name) || !cond(s)) continue;
      done.add(name);
      await page.waitForTimeout(delay);
      await shot3(page, name);
    }
  };
}

const idleIn = (scene: string) => (s: Snap) => s.scene === scene && s.worldActive && !s.locked && !s.busy && Boolean(s.objective);

// ---------------------------------------------------------------------------------------------------------------
// 1. Direct entry without a Teil-II save: ?scene= and the chapter select
// ---------------------------------------------------------------------------------------------------------------

test.describe('direct entry', () => {
  for (const id of E3_SCENES) {
    test(`?scene=${id}`, async ({ page }) => {
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
      await shot3(page, `direkt-${id}`);
      expect((await snap(page)).scene).toBe(id);
      // The documented direct-entry state: Teil-II end state plus every earlier Teil-III scene (prepareE3).
      const data = await state3(page);
      expect(data.flags['e3-eingang']).toBe('direkt');
      expect(data.flags['e2-finished']).toBe(true);
      const staffs = entryStaffs(id);
      expect(data.inventory[OWN] ?? 0, `${id}: own staff`).toBe(staffs.own);
      expect(data.inventory[SCHATTEN] ?? 0, `${id}: Schattentöter`).toBe(staffs.schatten);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }

  test('chapter select starts every Teil-III scene', async ({ page }) => {
    test.setTimeout(15 * 60 * 1000);
    const errors = watchErrors(page);
    await disableReloads(page);
    await useSettings(page);
    await reachAllE3(page);
    await gotoTitle(page);
    const titles: string[] = await page.evaluate(async () => {
      const reg = await import(/* @vite-ignore */ String('/src/core/registry.ts'));
      return reg.getChapters().find((c: any) => c.id === 'teil-3').scenes.map((s: any) => s.title);
    });
    expect(titles).toHaveLength(E3_SCENES.length);
    for (const [i, id] of E3_SCENES.entries()) {
      await test.step(id, async () => {
        await gotoTitle(page);
        expect(await page.evaluate(() => localStorage.getItem('selantis.save.v1'))).toBeNull();
        // The chapter select is a book since 81d098b: third book (left page title), section head, scene row.
        const row = await e3ChapterRow(page, id);
        await expect(page.locator('.title-panel-body > .chap-spread .chap-book-title')).toContainText('Falscher Glaube');
        await expect(row.locator('.chap-scene-title')).toHaveText(titles[i]);
        if (i === 0) { await page.waitForTimeout(400); await shot3(page, 'kapitelwahl-teil-3'); }
        await row.click();
        await page.waitForFunction(s => (window as any).G.currentScene === s && ((window as any).__world?.player || (window as any).__tactics?.ready || (window as any).G.ui.busy()), id, { timeout: 30000 });
        await page.waitForTimeout(1200);
        const data = await state3(page);
        expect(data.flags['e3-eingang']).toBe('direkt');
        expect(data.inventory[OWN] ?? 0).toBe(entryStaffs(id).own);
        // The warp started a fresh campaign at this scene; clear it so the next pick needs no confirmation.
        expect((await readSave(page))?.scene).toBe(id);
        await page.evaluate(() => localStorage.removeItem('selantis.save.v1'));
      });
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 2. One complete playthrough from e3-valentus to the title
// ---------------------------------------------------------------------------------------------------------------

/** A grown campaign right after Teil II (fixture state plus levels, items, memories, a choice). */
const GROW = `
  data.characters = {
    lia: { level: 6, exp: 41, weapon: 'vatersdolch', mastered: ['dolch'], abilityAp: { versorgen: 6 } },
    flick: { level: 10, exp: 12, weapon: 'jagdbogen', mastered: ['bogen'], abilityAp: {} },
    kyra: { level: 3, exp: 55, weapon: null, mastered: [], abilityAp: {} },
  };
  Object.assign(data.inventory, { apple: 3, bead: 2, 'book-herbs': 1, tincture: 2 });
  data.memories.push('k5-mem-gewitter');
  data.lore.push('k5-lore-tuerkis', 'e2-lore-valentus');
  data.flags['e2-abschied'] = 'brief';
  delete data.flags['e3-eingang'];
`;

/** Contract flags and inventory each scene must have left behind when the next one starts (umsetzung.md §2). */
const AFTER_SCENE: Partial<Record<E3Scene, (d: any) => void>> = {
  'e3-valentus': d => { expect(d.flags['e3-valentus-getroffen']).toBe(true); expect(d.inventory[SCHATTEN]).toBe(1); expect(d.inventory[OWN] ?? 0).toBe(0); },
  'e3-eigener-stab': d => {
    expect(d.flags['e3-stab-erhalten']).toBe(true);
    expect(d.inventory[OWN]).toBe(1);
    expect(d.flags['e3-schattentoeter-zurueck']).toBe(true);
    expect(d.inventory[SCHATTEN] ?? 0, 'Schattentöter returned to Ignatius').toBe(0);
    expect(d.abilities.filter((a: string) => a === 'e3-stabstrahl')).toHaveLength(1);
    expect(d.flags['e3-stab-ort']).toBe('lia');
  },
  'e3-paladine': d => { expect(d.inventory[OWN] ?? 0, 'staff confiscated').toBe(0); expect(d.flags['e3-stab-ort']).toBe('waffenkammer'); expect(d.lore).toContain('e3-lore-lichterorden'); },
  'e3-schutzreaktion': d => { expect(d.flags['e3-schutz-ausgeloest']).toBe(true); },
  'e3-macht-und-schutz': d => { expect(d.flags['e3-untersucht']).toBe(true); expect(d.flags['e3-verhandelt']).toBe(true); },
  'e3-falscher-glaube': d => { expect(d.flags['e3-gelauscht']).toBe(true); expect(d.clues).toContain('e3-hinweis-gwynn'); },
  'e3-kyras-fluchtweg': d => {
    expect(d.flags['e3-geflohen']).toBe(true);
    expect(d.flags['e3-stab-zurueckgelassen'], 'staff left behind').toBe(true);
    expect(d.inventory[OWN] ?? 0).toBe(0);
    expect(d.clues).toContain('e3-kyras-bericht');
  },
  'e3-waldgegner': d => { expect(d.flags['e3-flick-ghule']).toBe(true); },
  'e3-vertraute-schwester': d => { expect(d.flags['e3-vergiftet']).toBe(true); },
  'e3-falle': d => { expect(d.flags['e3-gefangen']).toBe(true); },
  'e3-innere-zuflucht': d => { expect(d.flags['e3-zuflucht-1']).toBe(true); },
  'e3-flicks-hilfe': d => { expect(d.flags['e3-stab-ort'], 'staff carried by Flick').toBe('flick'); expect(d.inventory[OWN] ?? 0).toBe(0); },
  'e3-hoffnung-und-weigerung': d => { expect(d.flags['e3-geweigert']).toBe(true); },
  'e3-ritual': d => { expect(d.flags['e3-ritual-begonnen']).toBe(true); expect(d.inventory[OWN] ?? 0).toBe(0); },
  'e3-ritualangriff': d => {
    expect(d.flags['e3-kyra-frei'], 'Kyra freed').toBe(true);
    expect(d.flags['e3-stab-zurueck'], 'staff returned').toBe(true);
    expect(d.inventory[OWN]).toBe(1);
    expect(d.flags['e3-stab-ort']).toBe('lia');
    expect(d.flags['e3-ritual-gebrochen']).toBe(true);
    expect(d.flags['e3-ritual-gewonnen']).toBe(true);
  },
  'e3-vamir': d => { expect(d.flags['e3-vamir-besiegt'], 'Vamir defeated').toBe(true); },
  'e3-ignatius-abschied': d => { expect(d.flags['e3-ignatius-tot'], 'Ignatius dead').toBe(true); expect(d.party).toEqual(['kyra', 'flick']); },
  'e3-hueterin': d => {
    expect(d.inventory['e3-ordensfibel']).toBe(1);
    expect(d.flags['e3-gift-abklingend']).toBe(true);
    expect(d.flags['e3-orden-auftrag']).toBe('schutz');
  },
};

test('full playthrough from e3-valentus to the title with real inputs', async ({ page }) => {
  test.setTimeout(150 * 60 * 1000);
  // The logs live per worker: start them empty for this run.
  battleLog3.length = 0;
  for (const list of [driveLog.teleports, driveLog.workarounds, driveLog.mouseIssues, driveLog.battles]) list.length = 0;
  const errors = await campaign(page, p => fixtureSave3(p, 'e3-valentus', GROW), 'e3-valentus');
  await page.evaluate(() => {
    const w = window as any;
    w.__warps = 0;
    const orig = w.G.warp.bind(w.G);
    w.G.warp = (id: string) => { w.__warps++; return orig(id); }; // counts warps only; the campaign must not use any
    w.__gotos = [];
    w.G.events.on('scene:goto', (e: { id: string }) => w.__gotos.push(e.id));
  });
  const start = await state3(page);
  expect(start.inventory[SCHATTEN]).toBe(1);

  // Watchers over the whole run: item maxima, the poisoned gait per map, the staff in battle, the tincture.
  const max = { own: 0, schatten: 0, fibel: 0 };
  const gait = new Map<string, { scene: string; poisoned: boolean; walk: number; run: number; k: number; look: string }>();
  const battleStaff: string[] = [];
  let tincture: { before: number; after: number; line: string; walkBefore: number; walkAfter: number } | null = null;
  const shoot = moments(page, [
    ['01-valentus-pfad', idleIn('e3-valentus'), 600],
    ['02-lichtung-geister', idleIn('e3-eigener-stab'), 600],
    ['03-landstrasse', idleIn('e3-paladine'), 600],
    ['04-ordenssaal', s => s.scene === 'e3-schutzreaktion' && s.worldActive && !s.busy, 600],
    ['05-falscher-glaube', idleIn('e3-falscher-glaube'), 600],
    ['06-keller', idleIn('e3-kyras-fluchtweg'), 600],
    ['07-waldgegner', idleIn('e3-waldgegner'), 600],
    ['08-vertraute-schwester', idleIn('e3-vertraute-schwester'), 600],
    ['09-falle', idleIn('e3-falle'), 600],
    ['10-innere-zuflucht', idleIn('e3-innere-zuflucht'), 600],
    ['11-flicks-hilfe', idleIn('e3-flicks-hilfe'), 600],
    ['12-ritual', idleIn('e3-ritual'), 600],
    ['13-ritualkampf', s => s.tactics && s.scene === 'e3-ritualangriff', 1500],
    ['14-nach-dem-kampf', idleIn('e3-ritualangriff'), 600],
    ['15-duell', s => s.tactics && s.scene === 'e3-vamir', 1500],
    ['16-abschied', idleIn('e3-ignatius-abschied'), 600],
    ['17-hueterin', idleIn('e3-hueterin'), 600],
    ['18-epilog', idleIn('e3-epilog'), 600],
    ['19-credits', s => s.credits, 2500],
  ]);
  /** In the ritual battle Lia has the Stabstrahl exactly when her own staff is back in the inventory. */
  const staffInBattle = (p: Probe3) => {
    if (!p.battle?.liaAbilities || p.battle.id !== 'e3-ritualangriff') return;
    const has = p.battle.liaAbilities.includes('e3-stabstrahl');
    const note = `${p.own ? 'with' : 'without'} staff: Stabstrahl ${has ? 'yes' : 'no'}`;
    if (!battleStaff.includes(note)) battleStaff.push(note);
    expect(has, `ritual battle: ${note}`).toBe(p.own > 0);
  };
  const onSnap = async (s: Snap) => {
    const p: Probe3 = await probe3(page);
    max.own = Math.max(max.own, p.own); max.schatten = Math.max(max.schatten, p.schatten); max.fibel = Math.max(max.fibel, p.fibel);
    expect(p.own, `own staff duplicated in ${p.scene}`).toBeLessThanOrEqual(1);
    expect(p.fibel, `fibula duplicated in ${p.scene}`).toBeLessThanOrEqual(1);
    if (p.free && p.map && p.walk && p.run && p.k && p.look && !NOT_LIAS_BODY.includes(p.look)) {
      gait.set(`${p.map}|${p.poisoned ? 'vergiftet' : 'gesund'}`, { scene: p.scene, poisoned: p.poisoned, walk: p.walk, run: p.run, k: p.k, look: p.look });
    }
    staffInBattle(p);
    // Mother's tincture while poisoned: used from the bag with real input, it must do nothing (umsetzung.md §2 Gift).
    if (!tincture && p.poisoned && p.free && p.look && !NOT_LIAS_BODY.includes(p.look) && p.tincture > 0 && !s.busy) {
      await page.waitForTimeout(500);
      await page.keyboard.press('i');
      await expect(page.locator('.bag-ov')).toBeVisible({ timeout: 5000 });
      await page.locator('.bag-slot[title="Mutters Wundtinktur"]').click();
      await expect(page.locator('.bag-use')).toBeVisible();
      await expect(page.locator('.bag-use')).not.toHaveClass(/is-disabled/);
      await shot3(page, '20-tasche-tinktur');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => /kein Kratzer/.test(document.querySelector('.thought')?.textContent ?? document.querySelector('.dlg-text')?.textContent ?? ''), undefined, { timeout: 8000 });
      const line = await page.evaluate(() => document.querySelector('.thought')?.textContent ?? document.querySelector('.dlg-text')?.textContent ?? '');
      const after = await probe3(page);
      tincture = { before: p.tincture, after: after.tincture, line, walkBefore: p.walk!, walkAfter: after.walk! };
    }
    await shoot(s);
  };

  const visited: string[] = [];
  const track = async (s: Snap) => { if (s.scene && visited[visited.length - 1] !== s.scene) visited.push(s.scene); await onSnap(s); };
  for (const id of E3_SCENES) {
    await test.step(id, async () => {
      const last = id === 'e3-epilog';
      await drive3(page, {
        label: id, timeoutMs: 20 * 60 * 1000, onSnap: track,
        battle: { onTurn: async () => { const p = await probe3(page); staffInBattle(p); expect(p.own).toBeLessThanOrEqual(1); } },
        until: last ? async s => s.title && await page.evaluate(() => (window as any).G.state.is('e3-finished')) : s => s.scene !== id,
      });
      if (!last) expect((await snap(page)).scene).toBe(E3_SCENES[E3_SCENES.indexOf(id) + 1]);
      const check = AFTER_SCENE[id];
      if (check) check(await state3(page));
      // The poison stays until the order's healer: still active at the start of every scene up to e3-hueterin.
      const d = await state3(page);
      const poisonedNow = Boolean(d.flags['e3-vergiftet']) && !d.flags['e3-gift-abklingend'];
      const i = E3_SCENES.indexOf(id);
      expect(poisonedNow, `poison after ${id}`).toBe(i >= E3_SCENES.indexOf('e3-vertraute-schwester') && i < E3_SCENES.indexOf('e3-hueterin'));
    });
  }

  // End state: live and as saved before the credits.
  const end = await state3(page);
  const saved = await readSave(page);
  for (const data of [end, saved]) {
    for (const f of ['e3-kyra-frei', 'e3-vamir-besiegt', 'e3-ignatius-tot', 'e3-hueterin', 'e3-finished', 'e2-finished']) expect(data.flags[f], f).toBe(true);
    expect(data.flags['e3-eingang']).toBe('teil-2');
    expect(data.party).toEqual(['kyra', 'flick']);
    expect(data.inventory[OWN]).toBe(1);
    expect(data.inventory['e3-ordensfibel']).toBe(1);
    expect(data.abilities.filter((a: string) => a === 'e3-stabstrahl')).toHaveLength(1);
    expect(new Set(data.abilities).size, 'no ability twice').toBe(data.abilities.length);
    for (const it of ['apple', 'bead', 'book-herbs', 'dagger']) expect(data.inventory[it] ?? 0, `item ${it}`).toBeGreaterThanOrEqual(1);
    const a = start.characters.lia, b = data.characters.lia;
    expect(b.level * 10000 + b.exp, `Lia ${JSON.stringify(a)} → ${JSON.stringify(b)}`).toBeGreaterThanOrEqual(a.level * 10000 + a.exp);
    expect(data.memories).toEqual(expect.arrayContaining(['k5-mem-gewitter']));
    expect(data.flags['e2-abschied']).toBe('brief');
  }
  expect(saved.scene).toBe('e3-epilog');
  expect(max).toEqual({ own: 1, schatten: 1, fibel: 1 });

  // Poisoned gait: every map where poisoned Lia walked freely was slower (walk 0.6 × 64k, run at most 1.25 × walk);
  // before the poison and after the healer she walks at the engine speed.
  const gaits = [...gait.entries()].map(([key, g]) => ({ map: key.split('|')[0], ...g, walkShare: +(g.walk / (64 * g.k)).toFixed(3), runShare: +(g.run / g.walk).toFixed(3) }));
  console.log(`GAIT ${JSON.stringify(gaits)}`);
  const poisonedMaps = gaits.filter(g => g.poisoned);
  expect(poisonedMaps.length, 'poisoned Lia walked somewhere').toBeGreaterThan(2);
  for (const g of poisonedMaps) {
    expect(g.walkShare, `${g.map} (${g.scene}) poisoned walk`).toBeCloseTo(0.6, 2);
    expect(g.runShare, `${g.map} (${g.scene}) poisoned run`).toBeLessThanOrEqual(1.251);
  }
  // Before the poison and after the healer's scene (the weakness wears off „from here on“: e3-hueterin itself stays slow).
  const healthy = (scene: string) => E3_SCENES.indexOf(scene as E3Scene) < E3_SCENES.indexOf('e3-vertraute-schwester') || E3_SCENES.indexOf(scene as E3Scene) > E3_SCENES.indexOf('e3-hueterin');
  for (const g of gaits.filter(x => !x.poisoned && healthy(x.scene))) expect(g.walkShare, `${g.map} (${g.scene}) normal walk`).toBeCloseTo(1, 2);
  expect(gaits.some(g => g.scene === 'e3-epilog' && !g.poisoned), 'normal gait again in the epilogue').toBe(true);

  // The tincture was tried while poisoned: Lia's line, nothing used up, nothing healed.
  console.log(`TINCTURE ${JSON.stringify(tincture)}`);
  expect(tincture, 'tincture tried while poisoned').not.toBeNull();
  expect(tincture!.line).toContain('kein Kratzer');
  expect(tincture!.after).toBe(tincture!.before);
  expect(tincture!.walkAfter).toBe(tincture!.walkBefore);
  console.log(`BATTLE-STAFF ${JSON.stringify(battleStaff)}`);
  expect(battleStaff).toEqual(expect.arrayContaining(['without staff: Stabstrahl no', 'with staff: Stabstrahl yes']));

  const flow = await page.evaluate(() => ({ warps: (window as any).__warps, gotos: (window as any).__gotos }));
  expect(flow.warps).toBe(0);
  expect(flow.gotos.filter((g: string, i: number, all: string[]) => all.indexOf(g) === i)).toEqual(E3_SCENES.slice(1));
  expect(visited.filter((v, i, all) => all.indexOf(v) === i)).toEqual([...E3_SCENES]);
  expect(battleLog3.filter(b => b.outcome === 'win').map(b => b.id)).toEqual(['e3-ritualangriff', 'e3-vamir-duell']);
  const report = { ...driveLog, drive3: drive3Log, battles3: battleLog3.map(b => ({ id: b.id, outcome: b.outcome, rounds: b.rounds, turns: b.turns, defeats: b.defeats, notes: b.notes.filter(n => !n.startsWith('r')) })), shots: shots3.length };
  test.info().annotations.push({ type: 'drive', description: JSON.stringify(report) });
  console.log(`DRIVE ${JSON.stringify(report)}`);
  expect(errors, errors.join('\n')).toEqual([]);
  expect(driveLog.teleports, driveLog.teleports.join('\n')).toEqual([]);
  expect.soft(driveLog.workarounds, driveLog.workarounds.join('\n')).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------
// 3. Reload / re-entry never duplicates staff, fibula, EXP or abilities
// ---------------------------------------------------------------------------------------------------------------

const once = (list: string[], id: string) => list.filter(a => a === id).length;

test('e3-eigener-stab: reloads after the staff and in the reunion keep one staff and one Stabstrahl', async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);
  const errors = await campaign(page, p => fixtureSave3(p, 'e3-eigener-stab'), 'e3-eigener-stab');
  const before = await lia(page);
  await drive3(page, { label: 'stab', until: async () => (await count(page, OWN)) === 1 });
  // Reload right after the branch became her staff (the save is the scene start: the part restarts).
  await reloadAndContinue(page, 'e3-eigener-stab');
  expect(await count(page, OWN)).toBeLessThanOrEqual(1);
  await drive3(page, { label: 'stab-2', until: async s => s.worldActive && (await readSave(page))?.params?.part === 'ignatius' });
  expect(await count(page, OWN)).toBe(1);
  const mid = await state3(page);
  expect(once(mid.abilities, 'e3-stabstrahl')).toBe(1);
  expect(mid.flags['e3-stab-erhalten']).toBe(true);
  // Reload in the reunion part (saved with the staff): still one staff, nothing granted twice.
  await reloadAndContinue(page, 'e3-eigener-stab');
  await page.waitForFunction(() => (window as any).__world?.player, undefined, { timeout: 30000 });
  expect(await count(page, OWN)).toBe(1);
  await drive3(page, { label: 'stab-3', until: s => s.scene === 'e3-paladine' });
  const data = await state3(page);
  expect(data.inventory[OWN]).toBe(1);
  expect(data.inventory[SCHATTEN] ?? 0).toBe(0);
  expect(once(data.abilities, 'e3-stabstrahl')).toBe(1);
  expect(new Set(data.abilities).size).toBe(data.abilities.length);
  expect(await lia(page)).toEqual(before);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('e3-ritualangriff: reloads in the battle and after the win pay EXP once and keep one staff', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  const errors = await campaign(page, p => fixtureSave3(p, 'e3-ritualangriff', `data.flags['e3-ritual-weg'] = 'hohlweg';`), 'e3-ritualangriff');
  await page.waitForFunction(() => (window as any).__tactics?.ready, undefined, { timeout: 30000 });
  const before = await state3(page);
  // A few turns into the battle (the staff is with Flick, Lia bound), then reload: the battle restarts.
  await playBattleUi(page, { until: async () => (await page.evaluate(() => (window as any).__tactics?.ctrl.battle.round ?? 0)) >= 2 });
  await reloadAndContinue(page, 'e3-ritualangriff');
  await page.waitForFunction(() => (window as any).__tactics?.ready, undefined, { timeout: 30000 });
  expect(await count(page, OWN)).toBe(0);
  expect(await lia(page)).toEqual(before.characters.lia ?? null);
  await drive3(page, { label: 'ritual-kampf', until: async s => s.worldActive && !s.tactics && (await readSave(page))?.params?.part === 'nach' });
  const won = await state3(page);
  expect(won.flags['e3-ritual-gewonnen']).toBe(true);
  expect(won.inventory[OWN]).toBe(1);
  expect(JSON.stringify(won.characters), 'the first win grants progress').not.toBe(JSON.stringify(before.characters));
  // Reload after the win: the beat on the hilltop again, no second reward, still one staff.
  await reloadAndContinue(page, 'e3-ritualangriff');
  await page.waitForFunction(() => (window as any).__world?.player, undefined, { timeout: 30000 });
  expect((await state3(page)).characters).toEqual(won.characters);
  expect(await count(page, OWN)).toBe(1);
  await drive3(page, { label: 'ritual-nach', until: s => s.scene === 'e3-vamir' });
  const data = await state3(page);
  expect(data.characters).toEqual(won.characters);
  expect(data.inventory[OWN]).toBe(1);
  expect(once(data.abilities, 'e3-stabstrahl')).toBe(1);
  expect(new Set(data.abilities).size).toBe(data.abilities.length);
  expect(data.flags['e3-kyra-frei']).toBe(true);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('e3-hueterin: reloads around the ceremony give the fibula exactly once', async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);
  const errors = await campaign(page, p => fixtureSave3(p, 'e3-hueterin'), 'e3-hueterin');
  const before = await state3(page);
  expect(before.inventory['e3-ordensfibel'] ?? 0).toBe(0);
  await drive3(page, { label: 'hueterin', until: async () => (await count(page, 'e3-ordensfibel')) === 1 });
  await reloadAndContinue(page, 'e3-hueterin');
  expect(await count(page, 'e3-ordensfibel')).toBeLessThanOrEqual(1);
  await drive3(page, { label: 'hueterin-2', until: s => s.scene === 'e3-epilog' });
  expect(await count(page, 'e3-ordensfibel')).toBe(1);
  // Reload at the epilogue (saved with the fibula) and play to the title; continuing the finished save.
  await reloadAndContinue(page, 'e3-epilog');
  expect(await count(page, 'e3-ordensfibel')).toBe(1);
  await drive3(page, { label: 'epilog', timeoutMs: 15 * 60 * 1000, until: async s => s.title && await page.evaluate(() => (window as any).G.state.is('e3-finished')) });
  const data = await state3(page);
  expect(data.inventory['e3-ordensfibel']).toBe(1);
  expect(data.characters).toEqual(before.characters);
  expect(new Set(data.abilities).size).toBe(data.abilities.length);
  await reloadAndContinue(page, 'e3-epilog');
  await drive3(page, { label: 'epilog-fertig', timeoutMs: 60000, until: s => s.choices.length > 0 });
  const choices = (await snap(page)).choices.map(c => c.text);
  expect(choices).toEqual(['Den Abspann noch einmal ansehen.', 'Zurück zum Titel.']);
  expect(await count(page, 'e3-ordensfibel')).toBe(1);
  expect(errors, errors.join('\n')).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------
// 5. Phone: portrait and landscape with touch, reduced motion switched on at the title, sound off
// ---------------------------------------------------------------------------------------------------------------

const PHONE_SETTINGS = { textSpeed: 0, reducedMotion: false, music: 0, voice: 0, sfx: 0 };

/** Title → Einstellungen (tap) → „Reduzierte Bewegung“ switched on by tap → back. */
async function reduceMotionAtTitle(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Einstellungen/ }).tap();
  const sw = page.getByRole('button', { name: 'Reduzierte Bewegung' });
  await sw.scrollIntoViewIfNeeded();
  await expect(sw).toHaveAttribute('aria-pressed', 'false');
  await sw.tap();
  await expect(sw).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => (window as any).G.settings.reducedMotion)).toBe(true);
  await shot3(page, `phone-${page.viewportSize()!.width}-einstellungen`);
  const back = page.locator('.set-back');
  await back.scrollIntoViewIfNeeded();
  await back.tap();
  await expect(page.getByRole('button', { name: /^Kapitel/ })).toBeVisible();
}

/** Title (touch) → Kapitel → the Teil-III row of `id` (two taps confirm when a save would be overwritten). */
async function tapChapterRow(page: Page, id: E3Scene): Promise<void> {
  const row = await e3ChapterRow(page, id, true);
  await row.tap();
  if (await row.evaluate(e => e.classList.contains('is-confirm')).catch(() => false)) await row.tap();
  await page.waitForFunction(s => (window as any).G.currentScene === s, id, { timeout: 30000 });
}

async function phonePage(page: Page): Promise<string[]> {
  const errors = watchErrors(page);
  page.on('crash', () => { errors.push('page crashed'); console.log('PAGE CRASHED'); });
  await disableReloads(page);
  await reachAllE3(page);
  // Only the first load gets these settings; the switch at the title is then kept by the game across reloads.
  await page.addInitScript(s => { if (!localStorage.getItem('selantis.settings.v1')) localStorage.setItem('selantis.settings.v1', JSON.stringify(s)); }, PHONE_SETTINGS);
  await gotoTitle(page);
  await reduceMotionAtTitle(page);
  return errors;
}

/** Touch-only driver: taps dialogue, choices and world targets (no keyboard). */
async function touchDrive(page: Page, until: (s: Snap) => boolean | Promise<boolean>, label: string, maxMs = 6 * 60 * 1000): Promise<void> {
  const deadline = Date.now() + maxMs;
  for (;;) {
    const s = await snap(page);
    if (await until(s)) return;
    if (Date.now() > deadline) { await shot3(page, `stuck-phone-${label}`); throw new Error(`touchDrive(${label}) timed out: ${JSON.stringify({ scene: s.scene, map: s.map, objective: s.objective, busy: s.busy, line: s.line })}`); }
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
      const vp = page.viewportSize()!;
      await page.touchscreen.tap(b ? b.x + b.width / 2 : vp.width / 2, b ? b.y + b.height * 0.4 : vp.height * 0.4);
      await page.waitForTimeout(200);
      continue;
    }
    await page.waitForTimeout(150);
  }
}

/** Every visible battle panel lies inside the viewport (the name plate above a unit follows the figure, not the screen). */
async function panelsInside(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const e of document.querySelectorAll<HTMLElement>('.tac-panel:not(.hidden):not(.tac-plate), .tac-end, .tac-menu')) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || Number(getComputedStyle(e).opacity) < 0.05) continue;
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) out.push(`${e.className} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
}

for (const phone of [
  { name: 'portrait', viewport: { width: 390, height: 844 } },
  { name: 'landscape', viewport: { width: 844, height: 390 } },
]) {
  test.describe(`phone ${phone.name}`, () => {
    test.use({ viewport: phone.viewport, hasTouch: true, isMobile: true });

    test(`${phone.viewport.width}x${phone.viewport.height}: e3-valentus, e3-falscher-glaube and e3-epilog by touch`, async ({ page }) => {
      test.setTimeout(15 * 60 * 1000);
      const errors = await phonePage(page);
      if (phone.name === 'portrait') await expect(page.locator('.rotate-hint')).toBeVisible();
      else await expect(page.locator('.rotate-hint')).toBeHidden();
      expect(await page.evaluate(() => ({ ...(window as any).G.settings }))).toMatchObject({ reducedMotion: true, music: 0, voice: 0, sfx: 0 });
      for (const id of ['e3-valentus', 'e3-falscher-glaube', 'e3-epilog'] as const) {
        await test.step(id, async () => {
          if (id !== 'e3-valentus') await gotoTitle(page);
          await tapChapterRow(page, id);
          await expect(page.locator('#ui')).toHaveClass(/reduced-motion/);
          let pictured = false;
          await touchDrive(page, async s => {
            if (s.worldActive && !s.locked && !s.busy && Boolean(s.objective)) return true;
            if (!pictured && (s.line || s.plate)) { pictured = true; await page.waitForTimeout(700); await shot3(page, `phone-${phone.name}-${id}-dialog`); }
            return false;
          }, `${phone.name}-${id}`);
          await page.waitForTimeout(800);
          await shot3(page, `phone-${phone.name}-${id}`);
          await expect(page.locator('.hud-obj-text')).not.toBeEmpty();
          const box = await page.locator('canvas').boundingBox();
          expect(box!.width).toBeLessThanOrEqual(phone.viewport.width + 1);
          // No horizontal page scroll on the phone.
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone.viewport.width + 1);
          // One touch step into the world: tap the objective (when it is on screen) and see Lia react.
          const before = await page.evaluate(() => { const p = (window as any).__world.player; return { x: p.x, y: p.y }; });
          const target = await page.evaluate(() => {
            const w = (window as any).__world, t = w.objective?.target;
            const it = typeof t === 'string' ? w.interactives.find((i: any) => i.id === t && !i.removed) : null;
            const pos = it?.enabled() ? it.pos() : (t != null ? w.resolveTarget(t) : null) ?? { x: w.player.x + 40, y: w.player.y };
            const c = document.querySelector('canvas')!.getBoundingClientRect();
            const gw: number = (window as any).G.game.scale.width, gh: number = (window as any).G.game.scale.height;
            const p = w.player;
            const q = { x: p.x + Math.sign(pos.x - p.x) * Math.min(60, Math.abs(pos.x - p.x)), y: p.y + Math.sign(pos.y - p.y) * Math.min(40, Math.abs(pos.y - p.y)) };
            const sc = w.toScreen(q.x, q.y);
            return { x: c.left + sc.x * c.width / gw, y: c.top + sc.y * c.height / gh };
          });
          await page.touchscreen.tap(target.x, target.y);
          await page.waitForTimeout(1500);
          const moved = await page.evaluate(b => { const w = (window as any).__world; return Math.hypot(w.player.x - b.x, w.player.y - b.y) > 4 || (window as any).G.ui.busy() || w.playerLocked; }, before);
          expect(moved, `${id}: Lia reacts to a tap`).toBe(true);
          expect(errors, errors.join('\n')).toEqual([]);
        });
      }
    });

    test(`${phone.viewport.width}x${phone.viewport.height}: the ritual battle UI by touch`, async ({ page }) => {
      test.setTimeout(30 * 60 * 1000);
      const errors = await phonePage(page);
      await tapChapterRow(page, 'e3-ritualangriff');
      await page.waitForFunction(() => (window as any).__tactics?.ready, undefined, { timeout: 30000 });
      await expect(page.locator('#ui')).toHaveClass(/reduced-motion/);
      await page.waitForTimeout(1500);
      await shot3(page, `phone-${phone.name}-ritualkampf`);
      const turns: string[] = [];
      const rec = await playBattleUi(page, {
        touch: true,
        onTurn: async info => {
          turns.push(`${info.round}:${info.unit}`);
          const out = await panelsInside(page);
          expect(out, `battle panels outside the ${phone.name} viewport`).toEqual([]);
          if (info.turn === 2 || info.turn === 6) await shot3(page, `phone-${phone.name}-ritualkampf-zug-${info.turn}`);
        },
        // Portrait is a hint, not the intended way to play: a few turns there, the whole battle in landscape.
        until: phone.name === 'portrait' ? () => turns.length >= 3 : undefined,
      });
      console.log(`PHONE BATTLE ${phone.name} ${JSON.stringify({ outcome: rec.outcome, rounds: rec.rounds, turns: rec.turns, defeats: rec.defeats, notes: rec.notes.filter(n => !n.startsWith('r')) })}`);
      expect(rec.notes.filter(n => /off screen|not accepted|failed|not usable/.test(n)), 'every touch action reached its tile').toEqual([]);
      if (phone.name === 'landscape') {
        expect(rec.outcome).toBe('win');
        await page.waitForFunction(() => (window as any).__world?.player, undefined, { timeout: 60000 });
        expect(await count(page, OWN)).toBe(1);
        await page.waitForTimeout(1200);
        await shot3(page, `phone-${phone.name}-nach-dem-kampf`);
      } else expect(turns.length).toBeGreaterThanOrEqual(3);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  });
}
