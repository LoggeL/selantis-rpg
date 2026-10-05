import { expect, test, type Page } from '@playwright/test';

/**
 * Kapitel II – „Die Straße nach Osten“: warps into every scene and drives its critical path with real inputs
 * (keyboard, mouse clicks on the world and on minigame panels). window.G / window.__world are used for assertions
 * and to find where to click.
 */

test.use({ viewport: { width: 1280, height: 720 } });
test.describe.configure({ mode: 'parallel' });

type Chooser = (options: string[]) => number;

const errorsOf = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  return errors;
};

const busy = (page: Page) => page.evaluate(() => (window as any).G.ui.busy() as boolean);
const objective = (page: Page) => page.evaluate(() => (window as any).G.state.activeObjective()?.id ?? null);

/** Answers whatever UI is open: choices (via `choose`), hold prompts, dialogue/narration (Enter). */
async function answer(page: Page, choose?: Chooser): Promise<void> {
  const ui = await page.evaluate(() => {
    const vis = (el: Element | null) => !!el && getComputedStyle(el).display !== 'none' && !el.classList.contains('is-closing');
    const choices = [...document.querySelectorAll('.choices .choice')].filter(vis).map(b => ({ text: b.querySelector('.choice-text')?.textContent ?? '', disabled: (b as HTMLButtonElement).disabled || b.classList.contains('is-disabled') }));
    return { choices, hold: vis(document.querySelector('.hold')) };
  });
  if (ui.choices.length) {
    let i = choose ? choose(ui.choices.map(c => c.text)) : 0;
    if (i < 0 || ui.choices[i]?.disabled) i = ui.choices.findIndex(c => !c.disabled);
    // Choices arm only after a short pause (early presses push the arming out): wait, then pick deliberately.
    await page.waitForTimeout(700);
    await page.keyboard.press(String(i + 1));
    await page.waitForTimeout(450);
    return;
  }
  if (ui.hold) {
    await page.keyboard.down('e');
    await page.waitForTimeout(1900);
    await page.keyboard.up('e');
    await page.waitForTimeout(200);
    return;
  }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(180);
}

/** Advances dialogue until `done` is true. */
async function advance(page: Page, done: () => Promise<boolean>, choose?: Chooser, timeout = 60000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await done()) return;
    if (await busy(page)) await answer(page, choose);
    else await page.waitForTimeout(150);
  }
  throw new Error('advance: timeout');
}

/** True once the objective is `id` and no UI has been open for a moment (scripts often chain lines). */
const objectiveIs = (page: Page, id: string) => async () => {
  for (let i = 0; i < 3; i++) {
    if ((await objective(page)) !== id || (await busy(page))) return false;
    await page.waitForTimeout(250);
  }
  return true;
};

async function screenOf(page: Page, x: number, y: number): Promise<{ x: number; y: number; inside: boolean }> {
  return page.evaluate(([wx, wy]) => {
    const w = (window as any).__world;
    const c = w.cameras.main;
    const r = document.querySelector('#game canvas')!.getBoundingClientRect();
    const k = r.width / w.scale.width;
    const sx = r.x + (wx - c.worldView.x) * k, sy = r.y + (wy - c.worldView.y) * k;
    return { x: sx, y: sy, inside: sx > r.x + 6 && sx < r.right - 6 && sy > r.y + 6 && sy < r.bottom - 6 };
  }, [x, y]);
}

const playerAt = (page: Page) => page.evaluate(() => { const p = (window as any).__world.player; return { x: p.x as number, y: p.y as number }; });

/** Clicks a world position; if it is off screen, clicks towards it first (tap-to-walk) until it is visible. */
async function clickWorld(page: Page, x: number, y: number, choose?: Chooser): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (await busy(page)) { await answer(page, choose); continue; }
    const s = await screenOf(page, x, y);
    if (s.inside) { await page.mouse.click(s.x, s.y); return; }
    // Off screen: tap-to-walk towards it (A* routes around obstacles); if that does not move Lia, use the keys.
    const p = await playerAt(page);
    const ps = await screenOf(page, p.x, p.y);
    const dx = s.x - ps.x, dy = s.y - ps.y, d = Math.hypot(dx, dy) || 1;
    const step = Math.min(240, d);
    await page.mouse.click(ps.x + (dx / d) * step, ps.y + (dy / d) * step);
    await page.waitForTimeout(1500);
    const q = await playerAt(page);
    if (Math.hypot(q.x - p.x, q.y - p.y) < 8 && !(await busy(page))) {
      const keys = [x - p.x > 30 ? 'd' : x - p.x < -30 ? 'a' : '', y - p.y > 30 ? 's' : y - p.y < -30 ? 'w' : ''].filter(Boolean);
      for (const k of keys) await page.keyboard.down(k);
      await page.waitForTimeout(700);
      for (const k of keys) await page.keyboard.up(k);
    }
  }
  throw new Error(`clickWorld: (${x}, ${y}) never became visible`);
}

/** Clicks an NPC's current position (they wander) until its conversation opens (the name band shows `name`). */
async function talkTo(page: Page, id: string, name: string): Promise<void> {
  const speaking = () => page.evaluate(n => {
    const band = document.querySelector('.dlg .dlg-name');
    return Boolean(band && band.textContent?.trim() === n && (window as any).G.ui.busy());
  }, name);
  for (let i = 0; i < 8; i++) {
    if (await busy(page)) { await answer(page); continue; }
    const a = await page.evaluate(n => { const x = (window as any).__world.actors.get(n); return { x: x.x as number, y: x.y as number }; }, id);
    await clickWorld(page, a.x, a.y - 14);
    for (let t = 0; t < 24; t++) {
      if (await speaking()) return;
      if (await busy(page)) break;
      await page.waitForTimeout(250);
    }
    if (await speaking()) return;
  }
  throw new Error(`talkTo: ${id} never answered`);
}

async function warp(page: Page, scene: string): Promise<void> {
  // Several agents edit the shared tree: keep Vite's HMR socket away from the page so no full reload hits a run.
  await page.routeWebSocket(/\/(\?token=.*)?$/, () => { /* mocked: never connects, never reloads */ });
  await page.goto(`/?scene=${scene}`);
  await page.waitForFunction(() => Boolean((window as any).G), undefined, { timeout: 20000 });
}

const sceneIs = (page: Page, id: string) => async () => page.evaluate(s => (window as any).G.currentScene === s, id);
const mapIs = (page: Page, id: string) => async () => page.evaluate(m => (window as any).__world?.map?.id === m, id);

// ---------------------------------------------------------------------------------------------------------------

test('strasse: tracks, signpost, deduction east, jugglers, on to the camp', async ({ page }) => {
  test.setTimeout(240000);
  const errors = errorsOf(page);
  await warp(page, 'strasse');
  await advance(page, objectiveIs(page, 'k2-spur'));
  // Spurenblick reveals the hoofprints; the last one on the cobbles is where they get lost.
  await page.keyboard.down('q'); await page.waitForTimeout(900); await page.keyboard.up('q');
  await clickWorld(page, 238, 404);
  await advance(page, objectiveIs(page, 'k2-wegweiser'));
  expect(await page.evaluate(() => (window as any).G.state.hasClue('k2-hufspuren'))).toBe(true);
  // Reading the signpost (tracks already lost) leads straight into Lia's deduction: garrison against Trapas,
  // many villages for Portas, then east.
  const reasoning: Chooser = o => o.findIndex(t => /Garnison|Dörfern|Nach Osten/.test(t));
  await clickWorld(page, 262, 250, reasoning);
  await advance(page, objectiveIs(page, 'k2-osten'), reasoning);
  expect(await page.evaluate(() => (window as any).G.state.data.memories)).toContain('k2-mem-markt');
  expect(await page.evaluate(() => (window as any).G.state.flag('k2-entschieden'))).toBe('osten');
  expect(await page.evaluate(() => (window as any).G.state.flag('k2-denkfehler'))).toBe(0);

  // Optional: correct the juggler's story (chain pastry), then ask about the riders.
  await talkTo(page, 'gaukler', 'Gaukler');
  const juggler: Chooser = o => {
    const i = o.findIndex(t => /Zehn|Reitern begegnet/.test(t));
    return i >= 0 ? i : 0;
  };
  await advance(page, async () => (await page.evaluate(() => (window as any).G.state.hasClue('k2-gaukler-reiter'))) && !(await busy(page)), juggler);
  expect(await page.evaluate(() => (window as any).G.state.has('chain-pastry'))).toBe(true);
  expect(await page.evaluate(() => (window as any).G.state.data.lore)).toContain('k2-lore-xenovia');

  // East along the road into the forest.
  await clickWorld(page, 1000, 340);
  await page.waitForTimeout(800);
  await clickWorld(page, 1268, 340);
  await advance(page, sceneIs(page, 'erstes-lager'));
  expect(errors).toEqual([]);
});

test('erstes-lager: stones, twigs, fire drilling (secret spark), eat, sleep', async ({ page }) => {
  test.setTimeout(240000);
  const errors = errorsOf(page);
  await warp(page, 'erstes-lager');
  await advance(page, objectiveIs(page, 'k2-lager-sammeln'));
  for (const [x, y] of [[152, 236], [182, 158], [262, 114], [372, 120], [446, 164], [568, 220]]) {
    await clickWorld(page, x, y - 2);
    await page.waitForTimeout(1800);
    await advance(page, async () => !(await busy(page)), undefined, 8000);
  }
  await advance(page, objectiveIs(page, 'k2-lager-ring'));
  await clickWorld(page, 300, 190);
  await advance(page, objectiveIs(page, 'k2-lager-feuer'));
  expect(await page.evaluate(() => (window as any).G.state.has('tinder'))).toBe(false);
  await clickWorld(page, 300, 190);
  // No tinder: three failed attempts (pressing outside the bright zone) – then the turquoise spark lights it anyway.
  for (let attempt = 0; attempt < 3; attempt++) {
    await advance(page, async () => page.evaluate(() => Boolean((window as any).__k2fire)), undefined, 20000);
    for (let slip = 0; slip < 3; slip++) {
      await page.waitForFunction(() => { const f = (window as any).__k2fire; return f && !f.inZone() && Math.abs(f.state.pos - f.state.zoneAt) > 0.2; }, undefined, { timeout: 5000 });
      await page.keyboard.press(' ');
      await page.waitForTimeout(220);
    }
    await page.waitForFunction(() => !(window as any).__k2fire, undefined, { timeout: 5000 });
  }
  await advance(page, objectiveIs(page, 'k2-lager-essen'));
  expect(await page.evaluate(() => (window as any).G.state.is('k2-funke'))).toBe(true);
  expect(await page.evaluate(() => (window as any).G.state.is('k2-feuer'))).toBe(true);
  await clickWorld(page, 300, 196);
  let ate = false;
  const food: Chooser = o => {
    if (!ate && o.some(t => /Brot/.test(t))) { ate = true; return o.findIndex(t => /Brot/.test(t)); }
    return o.findIndex(t => /Genug/.test(t));
  };
  await advance(page, objectiveIs(page, 'k2-lager-schlafen'), food);
  expect(await page.evaluate(() => (window as any).G.state.count('bread'))).toBe(1);
  await clickWorld(page, 488, 172);
  await advance(page, sceneIs(page, 'foltan-azar'));
  expect(errors).toEqual([]);
});

test('erstes-lager: with tinder the fire can be drilled for real', async ({ page }) => {
  test.setTimeout(180000);
  await warp(page, 'erstes-lager');
  await advance(page, objectiveIs(page, 'k2-lager-sammeln'));
  await page.evaluate(() => { const G = (window as any).G; G.state.give('tinder'); G.state.set('k2-steine', 3); G.state.set('k2-reisig', 3); });
  await clickWorld(page, 300, 190);
  await advance(page, objectiveIs(page, 'k2-lager-feuer'));
  await clickWorld(page, 300, 190);
  await advance(page, async () => page.evaluate(() => Boolean((window as any).__k2fire)), undefined, 20000);
  for (let i = 0; i < 40; i++) {
    const live = await page.evaluate(() => Boolean((window as any).__k2fire));
    if (!live) break;
    await page.waitForFunction(() => { const f = (window as any).__k2fire; return !f || Math.abs(f.state.pos - f.state.zoneAt) < 0.035; }, undefined, { timeout: 8000, polling: 'raf' });
    await page.keyboard.press(' ');
    await page.waitForTimeout(160);
  }
  await advance(page, objectiveIs(page, 'k2-lager-essen'));
  expect(await page.evaluate(() => (window as any).G.state.is('k2-feuer'))).toBe(true);
});

test('foltan-azar: woken, caught sneaking off, interrogation, Crios, Kyra in the stable', async ({ page }) => {
  test.setTimeout(240000);
  const errors = errorsOf(page);
  await warp(page, 'foltan-azar');
  await advance(page, objectiveIs(page, 'k2-nacht-flucht'), o => o.findIndex(t => /beißen/.test(t)));
  expect(await page.evaluate(() => (window as any).G.state.flag('k2-foltan-respekt'))).toBe(1);
  // Sneak off while they bicker: Foltan catches her (she is not tied up).
  await page.keyboard.down('c');
  await clickWorld(page, 132, 320);
  await page.waitForTimeout(2500);
  await page.keyboard.up('c');
  await advance(page, async () => page.evaluate(() => Boolean(document.querySelector('.k2-sky canvas'))), o => {
    const i = o.findIndex(t => /Schuhe|Ihr zuerst|Mit\? Wohin|mit euch beiden/.test(t));
    return i >= 0 ? i : 0;
  });
  expect(await page.evaluate(() => (window as any).G.state.is('k2-fluchtversuch'))).toBe(true);
  expect(await page.evaluate(() => (window as any).G.state.data.party)).toEqual(['foltan', 'azar']);
  // The night sky: a wrong star first (east), then Crios in the west.
  const star = async (sx: number, sy: number) => {
    const r = await page.evaluate(() => { const b = document.querySelector('.k2-sky canvas')!.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    await page.mouse.click(r.x + (sx / 1600) * r.w, r.y + (sy / 900) * r.h);
  };
  const skyText = () => page.evaluate(() => document.querySelector('.k2-sky-text')?.textContent ?? '');
  await page.waitForTimeout(800);
  for (let i = 0; i < 10 && !/Osten/.test(await skyText()); i++) { await star(1250, 330); await page.waitForTimeout(400); }
  expect(await skyText()).toMatch(/im Osten/);
  for (let i = 0; i < 10 && !/Crios\.$/.test((await skyText()).trim()); i++) { await star(430, 360); await page.waitForTimeout(400); }
  await page.waitForTimeout(1200);
  await page.keyboard.press('e');
  await advance(page, sceneIs(page, 'waldweg'));
  const lore = await page.evaluate(() => (window as any).G.state.data.lore);
  expect(lore).toEqual(expect.arrayContaining(['k2-lore-crios', 'k2-lore-kodex', 'k2-lore-rat-der-drei']));
  expect(errors).toEqual([]);
});

test('waldweg: breakfast, the fork, midday rest and her name, Speikraut, on to the Golden Boar', async ({ page }) => {
  test.setTimeout(240000);
  const errors = errorsOf(page);
  await warp(page, 'waldweg');
  await advance(page, objectiveIs(page, 'k2-morgen-essen'));
  await talkTo(page, 'azar', 'Azar');
  await advance(page, objectiveIs(page, 'k2-aufbruch'), o => o.findIndex(t => /Danke/.test(t)));
  await clickWorld(page, 132, 352);
  await advance(page, mapIs(page, 'k2-waldweg'));
  await advance(page, objectiveIs(page, 'k2-waldweg'));
  expect(await page.evaluate(() => (window as any).__world.companionDefs.map((c: any) => c.id))).toEqual(['foltan', 'azar']);
  await clickWorld(page, 400, 410);
  await clickWorld(page, 590, 360);
  await advance(page, objectiveIs(page, 'k2-gabelung'));
  await page.keyboard.down('q'); await page.waitForTimeout(900); await page.keyboard.up('q');
  await clickWorld(page, 708, 300);
  await advance(page, objectiveIs(page, 'k2-waldweg'));
  expect(await page.evaluate(() => (window as any).G.state.hasClue('k2-zeichen'))).toBe(true);
  await clickWorld(page, 880, 330);
  await advance(page, objectiveIs(page, 'k2-rast'), o => o.findIndex(t => /brauche wirklich eine Pause/.test(t)));
  expect(await page.evaluate(() => (window as any).G.state.is('k2-azar-stolz'))).toBe(true);
  await clickWorld(page, 872, 574);
  await advance(page, objectiveIs(page, 'k2-osten'));
  expect(await page.evaluate(() => (window as any).G.state.is('k2-name-genannt'))).toBe(true);
  await clickWorld(page, 952, 428);
  await advance(page, async () => (await page.evaluate(() => (window as any).G.state.is('k2-speikraut-gepflueckt'))) && !(await busy(page)), o => o.findIndex(t => /Azar/.test(t)));
  expect(await page.evaluate(() => (window as any).G.state.is('k2-speikraut-azar'))).toBe(true);
  await clickWorld(page, 1060, 318);
  await page.waitForTimeout(1500);
  await clickWorld(page, 1268, 272);
  await advance(page, async () => page.evaluate(() => (window as any).G.currentScene !== 'waldweg' || Boolean(document.querySelector('.title-ov, .title'))));
  expect(errors).toEqual([]);
});
