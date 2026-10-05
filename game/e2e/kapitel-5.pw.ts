import { expect, test, type Page } from '@playwright/test';

/**
 * Kapitel V „Regen“: warps into every scene and drives the critical path to its end with real inputs (clicks on the
 * map, E/Enter/Space/Q/C, number keys for choices, clicks on battle tiles). window.G is used for assertions only.
 *   cd game && SELANTIS_E2E_PORT=5326 npx playwright test e2e/kapitel-5.pw.ts
 */

const NOISE = /GPU stall|GL Driver Message|Automatic fallback to software WebGL|WebGL.*(performance|software)/i;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Ctx { page: Page; errors: string[]; picks: number[] }

async function boot(page: Page, scene: string): Promise<Ctx> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('response', r => { if (r.status() >= 400 && /\/assets\/|\/output\//.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(`/?scene=${scene}`);
  await page.waitForFunction(id => (window as any).G?.currentScene === id, scene, { timeout: 30000 });
  return { page, errors, picks: [] };
}

const busy = (page: Page) => page.evaluate(() => (window as any).G.ui.busy() as boolean);
const scene = (page: Page) => page.evaluate(() => (window as any).G.currentScene as string);
const flag = (page: Page, f: string) => page.evaluate(f => (window as any).G.state.flag(f), f);
const objective = (page: Page) => page.evaluate(() => document.querySelector('.hud-obj-text')?.textContent ?? '');
const pos = (page: Page) => page.evaluate(() => {
  const p = (window as any).__world?.player;
  return p ? [Math.round(p.x), Math.round(p.y)] as [number, number] : null;
});

/** One dialogue step: a choice gets a deliberate number key (next of c.picks, default 1); text gets Enter; a hold prompt is held. */
async function step(c: Ctx): Promise<void> {
  const { page } = c;
  const state = await page.evaluate(() => ({
    hold: Boolean(document.querySelector('.hold:not(.is-complete)')),
    choice: document.querySelectorAll('.choices .choice').length,
  }));
  if (state.hold) { await page.keyboard.down('e'); await wait(3400); await page.keyboard.up('e'); await wait(400); return; }
  if (state.choice) { await wait(750); await page.keyboard.press(String(c.picks.shift() ?? 1)); await wait(400); return; }
  await page.keyboard.press('Enter');
  await wait(260);
}

/** Advances dialogue until fn() is true. */
async function until(c: Ctx, fn: () => Promise<boolean>, timeout = 90000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await fn()) return;
    if (await busy(c.page)) await step(c); else await wait(200);
  }
  throw new Error('until: timeout');
}

/** Clicks a map pixel (towards it at the view edge if it is off screen). */
async function clickMap(page: Page, x: number, y: number): Promise<void> {
  const pt = await page.evaluate(([x, y]) => {
    const s = (window as any).__world; if (!s?.player) return null;
    const cam = s.cam;
    const canvas = document.querySelector('#game canvas')!; const r = canvas.getBoundingClientRect();
    let sx = (x - cam.worldView.x) * cam.zoom, sy = (y - cam.worldView.y) * cam.zoom;
    const px = (s.player.x - cam.worldView.x) * cam.zoom, py = (s.player.y - cam.worldView.y) * cam.zoom;
    const onScreen = sx > 6 && sx < 634 && sy > 6 && sy < 354 && !(sy < 50 && (sx < 230 || sx > 530));
    if (!onScreen) {
      const ks = [sx < 60 ? (px - 60) / (px - sx) : 1, sx > 580 ? (580 - px) / (sx - px) : 1, sy < 70 ? (py - 70) / (py - sy) : 1, sy > 310 ? (310 - py) / (sy - py) : 1];
      const k = Math.min(1, ...ks.map(v => (Number.isFinite(v) ? Math.max(0, v) : 1)));
      sx = px + (sx - px) * k; sy = py + (sy - py) * k;
    }
    return [r.left + sx * r.width / 640, r.top + sy * r.height / 360];
  }, [x, y]);
  if (pt) await page.mouse.click(pt[0], pt[1]);
}

/** Walks to a map point by clicking; dialogue that opens on the way is advanced (or the walk stops: stopOnBusy). */
async function walkTo(c: Ctx, x: number, y: number, opts: { near?: number; timeout?: number; stopOnBusy?: boolean } = {}): Promise<void> {
  const t0 = Date.now();
  let last = 0;
  while (Date.now() - t0 < (opts.timeout ?? 30000)) {
    if (await busy(c.page)) { if (opts.stopOnBusy) return; await step(c); continue; }
    const p = await pos(c.page);
    if (p && Math.hypot(p[0] - x, p[1] - y) < (opts.near ?? 14)) return;
    if (Date.now() - last > 900) { await clickMap(c.page, x, y); last = Date.now(); }
    await wait(150);
  }
  throw new Error(`walkTo ${x},${y}: timeout at ${JSON.stringify(await pos(c.page))}`);
}

/** Stands next to a Spurenblick clue, holds Q and presses E. */
async function inspectClue(c: Ctx, standX: number, standY: number): Promise<void> {
  await walkTo(c, standX, standY, { near: 10 });
  await c.page.keyboard.down('q');
  await wait(450);
  await c.page.keyboard.press('e');
  await wait(400);
  await c.page.keyboard.up('q');
  await until(c, async () => !(await busy(c.page)), 30000);
}

function expectClean(c: Ctx): void {
  expect(c.errors, c.errors.join('\n')).toEqual([]);
}

test.use({ viewport: { width: 1280, height: 720 } });

// --------------------------------------------------------------------------------------------------------------
test('regenwald: rain, the Urmacht hint, Flick, the Leichenfresser, story → faehrte', async ({ page }) => {
  test.setTimeout(240000);
  const c = await boot(page, 'regenwald');
  await page.waitForFunction(() => Boolean((window as any).__world?.player), undefined, { timeout: 30000 });
  await until(c, async () => (await objective(page)).includes('Osten'));
  for (const [x, y] of [[150, 590], [330, 420], [450, 370], [600, 330], [730, 250]] as const) await walkTo(c, x, y);
  await until(c, async () => Boolean(await flag(page, 'k5-regen-wich')) && !(await busy(page)));
  expect(await page.evaluate(() => (window as any).__world.weather.kind)).toBe('rain');
  await walkTo(c, 840, 320);
  await until(c, async () => Boolean(await flag(page, 'k5-flick-weg')) && !(await busy(page)));
  // The ghoul: walk on, then dodge three swings with Space while the ring glows.
  await walkTo(c, 1075, 300, { stopOnBusy: true });
  await until(c, async () => page.evaluate(() => Boolean(document.querySelector('.k5-qte'))), 30000);
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const st = await page.evaluate(() => { const e = document.querySelector<HTMLElement>('.k5-qte'); return e ? (e.dataset.state ?? 'none') : null; });
    if (st === null) break;
    if (st === 'window') { await page.keyboard.press('Space'); await wait(300); }
    await wait(25);
  }
  expect(await flag(page, 'k5-ghul-treffer')).toBe(0);
  await until(c, async () => Boolean(await flag(page, 'k5-flick-dabei')) && !(await busy(page)));
  expect(await page.evaluate(() => (window as any).G.state.data.party)).toEqual(['flick']);
  await walkTo(c, 1272, 284, { near: 30, stopOnBusy: true }).catch(() => {});
  await page.waitForFunction(() => (window as any).G.currentScene === 'faehrte', undefined, { timeout: 20000 });
  expectClean(c);
});

// --------------------------------------------------------------------------------------------------------------
test('faehrte: read the signs at both forks, a dead end, the night talk → schattenlager', async ({ page }) => {
  test.setTimeout(300000);
  const c = await boot(page, 'faehrte');
  await page.waitForFunction(() => Boolean((window as any).__world?.player), undefined, { timeout: 30000 });
  await until(c, async () => (await objective(page)).includes('Spuren'));
  await inspectClue(c, 150, 630);
  expect(await page.evaluate(() => (window as any).G.state.hasClue('k5-spur-hufe'))).toBe(true);
  // Rushing past the first fork: Flick stops Lia.
  await walkTo(c, 760, 420, { timeout: 15000 }).catch(() => {});
  await until(c, async () => !(await busy(page)));
  expect((await pos(page))![0]).toBeLessThan(700);
  await inspectClue(c, 596, 424);
  await inspectClue(c, 650, 436);
  expect(await flag(page, 'k5-gabel1-klar')).toBe(true);
  // The wrong trail ends at the brook.
  await walkTo(c, 352, 172, { timeout: 40000 });
  await until(c, async () => Boolean(await flag(page, 'k5-umwege')) && !(await busy(page)));
  await walkTo(c, 612, 446, { timeout: 40000 });
  await inspectClue(c, 810, 428);
  await walkTo(c, 1030, 410, { timeout: 30000 });
  await inspectClue(c, 1040, 452);
  await inspectClue(c, 1046, 396);
  await inspectClue(c, 1084, 286);
  expect(await page.evaluate(() => (window as any).G.state.count('bead'))).toBe(2);
  await walkTo(c, 1095, 214, { timeout: 30000 });
  await until(c, async () => (await objective(page)).includes('Feuerstelle') && !(await busy(page)));
  await walkTo(c, 1053, 190, { near: 10 });
  await page.keyboard.press('e');
  await until(c, async () => (await scene(page)) === 'schattenlager', 150000);
  const lore = await page.evaluate(() => (window as any).G.state.data.lore as string[]);
  expect(lore).toContain('k5-lore-grunwald');
  expectClean(c);
});

// --------------------------------------------------------------------------------------------------------------
test('schattenlager: scout three vantage points unseen, the tree, the plan, the bluff → rettung', async ({ page }) => {
  test.setTimeout(300000);
  const c = await boot(page, 'schattenlager');
  await page.waitForFunction(() => Boolean((window as any).__world?.player), undefined, { timeout: 30000 });
  await until(c, async () => (await objective(page)).includes('Kundschafte'));
  await walkTo(c, 420, 146, { timeout: 30000 });
  await page.keyboard.press('e');
  await until(c, async () => Boolean(await flag(page, 'k5-sp-felsen')) && !(await busy(page)), 60000);
  await walkTo(c, 380, 368, { timeout: 30000 });
  await page.keyboard.press('e');
  await until(c, async () => Boolean(await flag(page, 'k5-sp-stamm')) && !(await busy(page)), 60000);
  // Sneak through the tall grass and the wheat to the bush below the fire.
  const crossbow = () => page.evaluate(() => {
    const g = (window as any).__world.guards.find((g: any) => (g.id ?? g.def?.id) === 'schuetze');
    const a = g?.actor ?? g;
    return a ? Math.round(a.y) : 0;
  });
  await page.keyboard.down('c');
  await walkTo(c, 430, 556, { timeout: 30000 });
  await walkTo(c, 530, 636, { timeout: 30000 });
  for (let i = 0; i < 100 && (await crossbow()) > 450; i++) await wait(200);
  await walkTo(c, 740, 660, { timeout: 30000 });
  await walkTo(c, 850, 540, { timeout: 30000 });
  await walkTo(c, 888, 494, { timeout: 30000, near: 12, stopOnBusy: true }).catch(() => {});
  await until(c, async () => Boolean(await flag(page, 'k5-lauschen')), 30000);
  await until(c, async () => (await objective(page)).includes('Flick') && !(await busy(page)), 150000);
  expect(await page.evaluate(() => (window as any).G.state.hasClue('k5-lager-kyra'))).toBe(true);
  // Back the same way while the crossbowman is up at the fire.
  await walkTo(c, 850, 540, { timeout: 30000 });
  for (let i = 0; i < 100 && (await crossbow()) > 450; i++) await wait(200);
  await walkTo(c, 740, 660, { timeout: 30000 });
  await walkTo(c, 530, 636, { timeout: 30000 });
  await page.keyboard.up('c');
  await walkTo(c, 340, 490, { timeout: 30000, stopOnBusy: true }).catch(() => {});
  await until(c, async () => (await objective(page)).includes('Feuer') && !(await busy(page)), 120000);
  c.picks.push(1, 1, 1);
  await walkTo(c, 790, 400, { timeout: 40000, stopOnBusy: true }).catch(() => {});
  await until(c, async () => (await scene(page)) === 'rettung', 150000);
  const points = await flag(page, 'k5-ablenkung');
  expect(points).toBeGreaterThanOrEqual(2);
  expectClean(c);
});

// --------------------------------------------------------------------------------------------------------------
type TacState = { input: boolean; ended: boolean; round: number; active: string; units: Record<string, { x: number; y: number; down: unknown; bound: boolean; acted: boolean }> };
const tac = (page: Page) => page.evaluate(() => {
  const t = (window as any).__tactics; if (!t?.ctrl) return null;
  const b = t.ctrl.battle;
  return {
    input: t.ctrl.inputEnabled(), ended: t.ctrl.isEnded, round: b.round, active: b.activeUnit,
    units: Object.fromEntries(b.units.map((u: any) => [u.id, { x: u.x, y: u.y, down: u.down, bound: Boolean(u.statuses.bound), acted: u.acted }])),
  } as TacState;
});

async function clickTile(page: Page, x: number, y: number): Promise<void> {
  const pt = await page.evaluate(([x, y]) => {
    const t = (window as any).__tactics; const b = t.ctrl.battle; const cam = t.cameras.main;
    const ctr = t.iso.center(x, y, b.grid.height(x, y));
    const r = document.querySelector('#game canvas')!.getBoundingClientRect();
    return [r.left + (ctr.x - cam.worldView.x) * cam.zoom * r.width / 640, r.top + (ctr.y - cam.worldView.y) * cam.zoom * r.height / 360];
  }, [x, y]);
  await page.mouse.move(pt[0], pt[1]);
  await wait(80);
  await page.mouse.click(pt[0], pt[1]);
  await wait(250);
}

/** Waits for the player's input in battle (advancing dialogue, confirming hint cards and the outcome banner). */
async function battleReady(c: Ctx, timeout = 90000): Promise<'input' | 'ended'> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await tac(c.page);
    if (!s || s.ended) return 'ended';
    if (await busy(c.page)) { await step(c); continue; }
    if (await c.page.evaluate(() => { const b = document.querySelector<HTMLElement>('.tac-hint:not(.hidden) button'); if (b) { b.click(); return true; } return false; })) { await wait(300); continue; }
    if (s.input && await c.page.evaluate(() => (window as any).__tactics.animating === 0)) return 'input';
    await wait(200);
  }
  throw new Error('battleReady: timeout');
}

type Rescuer = 'lia' | 'flick' | 'kyra';

async function act(c: Ctx, unit: Rescuer, key: number, target?: [number, number]): Promise<void> {
  await c.page.getByRole('button', { name: { lia: 'Lia', flick: 'Flick', kyra: 'Kyra' }[unit], exact: true }).click();
  await c.page.waitForFunction(id => (window as any).__tactics.sel.unit === id, unit);
  await wait(300); // the unit portrait also pans the camera
  await battleReady(c);
  await c.page.keyboard.press(String(key));
  await wait(300);
  if (target) await clickTile(c.page, target[0], target[1]);
  await battleReady(c);
}

/** Move through the visible battle controls; read the movement range only to pick a legal tile. */
async function moveToward(c: Ctx, unit: Rescuer, goal: [number, number]): Promise<void> {
  const target = await c.page.evaluate(({ unit, goal }) => {
    const b = (window as any).__tactics.ctrl.battle;
    if (!b.canMove(unit)) return null;
    const u = b.unit(unit);
    if (u.x === goal[0] && u.y === goal[1]) return null;
    const tiles = [...b.reach(unit).values()] as { x: number; y: number; cost: number }[];
    return tiles.filter(p => p.x !== u.x || p.y !== u.y)
      .sort((a, b) => (Math.abs(a.x - goal[0]) + Math.abs(a.y - goal[1])) - (Math.abs(b.x - goal[0]) + Math.abs(b.y - goal[1])) || a.cost - b.cost)[0] ?? null;
  }, { unit, goal });
  if (!target) return;
  await c.page.getByRole('button', { name: { lia: 'Lia', flick: 'Flick', kyra: 'Kyra' }[unit], exact: true }).click();
  await wait(300);
  await clickTile(c.page, target.x, target.y);
  await battleReady(c);
  const moved = (await tac(c.page))!.units[unit];
  expect([moved.x, moved.y]).toEqual([target.x, target.y]);
}

test('rettung: cut Kyra free, hold out, the Urmacht bursts out → finale', async ({ page }) => {
  test.setTimeout(300000);
  const c = await boot(page, 'rettung');
  await page.waitForFunction(() => Boolean((window as any).__tactics?.ready), undefined, { timeout: 30000 });
  await battleReady(c);
  // Round 1: Flick cuts the first strand (ability 3), Lia distracts (2).
  await act(c, 'flick', 3, [7, 4]);
  expect((await tac(page))!.units.kyra.bound).toBe(true);
  await page.keyboard.press('Space');
  await battleReady(c);
  await act(c, 'lia', 2);
  await page.keyboard.press('Space');
  await battleReady(c);
  // Round 2: the last strand.
  await act(c, 'flick', 3, [7, 4]);
  expect((await tac(page))!.units.kyra.bound).toBe(false);
  await page.keyboard.press('Space');
  for (let r = 0; r < 24; r++) {
    if ((await battleReady(c)) === 'ended') break;
    const s = (await tac(page))!;
    expect(s.units.lia.down).toBe(false);
    if (s.active === 'kyra') await moveToward(c, 'kyra', [0, 4]);
    if (s.active === 'lia') await moveToward(c, 'lia', [2, 8]);
    const defence = s.active === 'lia' ? await page.evaluate(() => {
      const b = (window as any).__tactics.ctrl.battle, u = b.unit('lia');
      return !u.acted && !u.down ? ['ausweichen', 'ablenken'].find(id => b.abilityReady(u, id)) : null;
    }) : null;
    if (defence) await act(c, 'lia', defence === 'ausweichen' ? 1 : 2);
    await page.keyboard.press('Space');
  }
  await until(c, async () => {
    await expect(page.locator('.tac-out.show.lose')).toHaveCount(0);
    if (await page.locator('.tac-out.show.win').count()) await page.keyboard.press('Enter');
    return (await scene(page)) === 'finale';
  }, 120000);
  const st = await page.evaluate(() => ({ urmacht: (window as any).G.state.knows('urmacht'), party: (window as any).G.state.data.party }));
  expect(st).toEqual({ urmacht: true, party: ['flick', 'kyra'] });
  expectClean(c);
});

// --------------------------------------------------------------------------------------------------------------
test('finale: waking up, the Master, the beads, Flick’s plan, departure under Crios, credits → title', async ({ page }) => {
  test.setTimeout(240000);
  const c = await boot(page, 'finale');
  await until(c, async () => (await objective(page)).includes('Sprich mit') && !(await busy(page)), 150000);
  // Give Kyra her beads back (click on her), then talk to Flick.
  await clickMap(page, 770, 384);
  await until(c, async () => Boolean(await flag(page, 'k5-perlen-zurueck')) && !(await busy(page)), 30000);
  await clickMap(page, 832, 396);
  await until(c, async () => (await objective(page)).includes('Brich') && !(await busy(page)), 90000);
  await walkTo(c, 650, 704, { stopOnBusy: true });
  await until(c, async () => page.evaluate(() => Boolean(document.querySelector('.k5-credits'))), 90000);
  await wait(4500);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Neues Spiel', { exact: true })).toBeVisible({ timeout: 20000 });
  expectClean(c);
});

// --------------------------------------------------------------------------------------------------------------
test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  for (const id of ['regenwald', 'faehrte', 'schattenlager', 'rettung', 'finale']) {
    test(`${id} loads on a phone`, async ({ page }) => {
      const c = await boot(page, id);
      await page.waitForFunction(() => Boolean((window as any).__world?.player || (window as any).__tactics?.ready), undefined, { timeout: 30000 });
      await wait(2500);
      await expect(page.locator('.rotate-hint')).toBeVisible();
      expectClean(c);
    });
  }
});
