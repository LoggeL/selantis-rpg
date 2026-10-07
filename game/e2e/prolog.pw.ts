import { expect, test, type Page } from '@playwright/test';
import { playSceneAction } from './sceneActions';
import { disableReloads } from './noReloads';

test.beforeEach(async ({ page }) => disableReloads(page));

/**
 * Prolog („Die Urmacht“): warps into each scene and drives its critical path to the next scene with real inputs
 * (keyboard for walking, talking, dialogue, story gestures and the whole tactics battle).
 *   cd game && SELANTIS_E2E_PORT=5322 npx playwright test e2e/prolog.pw.ts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Win = any;
const NOISE = /GPU stall|GL Driver Message|Automatic fallback to software WebGL|WebGL.*(performance|software)/i;

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('response', r => { if (r.status() >= 400 && /\/assets\/|\/output\//.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return errors;
}

async function warp(page: Page, scene: string): Promise<void> {
  await page.goto(`/?scene=${scene}`);
  await page.waitForFunction(id => (window as Win).G?.currentScene === id, scene, { timeout: 30000 });
  await page.mouse.click(4, 4); // unlock audio like a player would
}

const busy = (page: Page) => page.evaluate(() => (window as Win).G.ui.busy() as boolean);
const scene = (page: Page) => page.evaluate(() => (window as Win).G.currentScene as string);
const flag = (page: Page, k: string) => page.evaluate(k => (window as Win).G.state.is(k) as boolean, k);

/** Advances dialogue, choices and story gestures with real keys. */
async function advance(page: Page, { max = 80, idleMs = 1500, pick = 1 } = {}): Promise<void> {
  let idle = 0, n = 0;
  while (n < max && idle <= idleMs) {
    if (await busy(page)) {
      idle = 0;
      if (await playSceneAction(page)) {
        continue;
      } else if (await page.locator('.hold.is-in').count()) {
        await page.waitForTimeout(300);
        await page.keyboard.down('e'); await page.waitForTimeout(3800); await page.keyboard.up('e');
      } else {
        const choices = await page.locator('.choice:visible').count();
        if (choices) { await page.waitForTimeout(800); await page.keyboard.press(String(Math.min(choices, pick))); }
        else await page.keyboard.press('Enter');
      }
      n++;
      await page.waitForTimeout(400);
    } else { idle += 200; await page.waitForTimeout(200); }
  }
}

/** Walks with the arrow keys (optionally running) until the player is within `near` px of the map point. */
async function walkKeys(page: Page, x: number, y: number, near = 18, maxMs = 30000, run = false): Promise<boolean> {
  const t0 = Date.now();
  let lastD = Infinity, stuck = 0;
  while (Date.now() - t0 < maxMs) {
    const p = await page.evaluate(() => { const w = (window as Win).__world; return w?.player ? { x: w.player.x, y: w.player.y, busy: (window as Win).G.ui.busy() } : null; });
    if (!p) return false;
    if (p.busy) { await advance(page, { max: 1, idleMs: 0 }); continue; }
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d <= near) return true;
    stuck = d > lastD - 1 ? stuck + 1 : 0; lastD = d;
    const jx = stuck > 3 ? dx + (Math.random() - 0.5) * 200 : dx, jy = stuck > 3 ? dy + (Math.random() - 0.5) * 200 : dy;
    const keys: string[] = [];
    if (Math.abs(jx) > 6) keys.push(jx > 0 ? 'ArrowRight' : 'ArrowLeft');
    if (Math.abs(jy) > 6) keys.push(jy > 0 ? 'ArrowDown' : 'ArrowUp');
    if (run) await page.keyboard.down('Shift');
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(Math.min(260, 40 + d * 3));
    for (const k of keys) await page.keyboard.up(k);
    if (run) await page.keyboard.up('Shift');
  }
  return false;
}

/** Walks next to an NPC or hotspot and presses E. */
async function interact(page: Page, id: string, dy = 18): Promise<void> {
  const a = await page.evaluate(id => {
    const w = (window as Win).__world;
    const act = w.actors.get(id);
    if (act) return { x: act.x, y: act.y };
    const p = w.interactives.find((i: Win) => i.id === id).pos();
    return { x: p.x, y: p.y };
  }, id);
  for (let attempt = 0; attempt < 4; attempt++) {
    await advance(page, { max: 6, idleMs: 600 });
    await walkKeys(page, a.x, a.y + dy, 16);
    await page.keyboard.press('e');
    const ok = await page.waitForFunction(() => (window as Win).G.ui.busy(), undefined, { timeout: 5000 }).then(() => true, () => false);
    if (ok) return;
  }
  throw new Error(`could not interact with ${id}`);
}

/** Runs a sneaking route; if a guard spots the player (respawn at the checkpoint), waits and tries again. */
async function sneakRoute(page: Page, route: [number, number][], done: () => Promise<boolean>, waitFor?: () => Promise<void>): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await done()) return;
    await advance(page, { max: 6, idleMs: 600 });
    if (await done()) return;
    if (waitFor) await waitFor();
    if (await done()) return;
    for (const [x, y] of route) {
      await walkKeys(page, x, y, 16, 15000, true);
      if (await done()) return;
    }
    if (await done()) return;
    await advance(page, { max: 6, idleMs: 1500 });
  }
  throw new Error('sneak route failed');
}

// ------------------------------------------------------------------------------------------------ tactics autopilot
async function tstate(page: Page) {
  return page.evaluate(() => {
    const s = (window as Win).__tactics;
    if (!s?.ctrl) return null;
    const out = document.querySelector('.tac-out.show.win, .tac-out.show.lose');
    return { input: s.ctrl.inputEnabled(), busy: (window as Win).G.ui.busy(), anim: s.animating, sel: s.sel.unit as string | null, mode: s.sel.mode as string, out: out ? out.querySelector('.t')!.textContent : null };
  });
}
async function settle(page: Page) {
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const st = await tstate(page);
    if (!st || st.out) return st;
    if (st.busy) { await page.waitForTimeout(500); await page.keyboard.press('Enter'); await page.waitForTimeout(250); continue; }
    if (st.input && st.anim === 0) return st;
    await page.waitForTimeout(200);
  }
  return tstate(page);
}
async function cursorTo(page: Page, t: { x: number; y: number }) {
  for (let i = 0; i < 40; i++) {
    const r = await page.evaluate(t => {
      const s = (window as Win).__tactics;
      const u = s.sel.unit ? s.ctrl.battle.unit(s.sel.unit) : null;
      const h = s.hover ?? (u ? { x: u.x, y: u.y } : { x: 0, y: 0 });
      if (h.x === t.x && h.y === t.y) return null;
      const f = h.x !== t.x ? (t.x > h.x ? 'e' : 'w') : (t.y > h.y ? 's' : 'n');
      for (const k of ['up', 'right', 'down', 'left']) if (s.iso.facingForScreen(k) === f) return ({ up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' } as Record<string, string>)[k];
      return 'ArrowUp';
    }, t);
    if (!r) return;
    await page.keyboard.press(r);
    await page.waitForTimeout(60);
  }
}
/** The active player's turn, planned by the rules AI and executed with visible controls. */
async function playPhase(page: Page, ids: string[]): Promise<void> {
  const active = await page.evaluate(() => (window as Win).__tactics.ctrl.battle.activeUnit as string | null);
  ids = ids.filter(id => id === active);
  for (const id of ids) {
    let st = await settle(page);
    if (!st || st.out || !st.input) return;
    const can = await page.evaluate(id => { const b = (window as Win).__tactics.ctrl.battle; const u = b.findUnit(id); return !!u && !u.down && !b.isDone(id); }, id);
    if (!can) continue;
    for (let i = 0; i < 6 && (await tstate(page))?.sel !== id; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(250); }
    const plan = await page.evaluate(async id => {
      const aiUrl = '/src/tactics/rules/ai.ts';
      const ai = await import(/* @vite-ignore */ aiUrl);
      const b = (window as Win).__tactics.ctrl.battle;
      const had = b.aiOverrides.get(id);
      b.aiOverrides.set(id, { profile: 'melee' });
      const p = ai.planTurn(b, id);
      if (had) b.aiOverrides.set(id, had); else b.aiOverrides.delete(id);
      return { moveTo: p.moveTo, action: p.action, idx: p.action ? b.unit(id).abilities.indexOf(p.action.ability) : -1 };
    }, id);
    if (plan.moveTo) {
      st = await tstate(page);
      if (st?.mode !== 'move') { await page.keyboard.press('m'); await page.waitForTimeout(150); }
      await cursorTo(page, plan.moveTo);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      await settle(page);
    }
    if (plan.action && plan.idx >= 0) {
      await page.keyboard.press(String(plan.idx + 1));
      await page.waitForTimeout(200);
      await cursorTo(page, plan.action.target);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      const confirm = page.locator('.tac-confirm-target:enabled');
      if (await confirm.isVisible()) await confirm.click();
      await settle(page);
    }
    const done = await page.evaluate(id => { const b = (window as Win).__tactics.ctrl.battle; const u = b.findUnit(id); return !u || u.down || b.isDone(id); }, id);
    if (!done && (await tstate(page))?.input) { await page.keyboard.press('f'); await page.waitForTimeout(300); }
  }
  const st = await settle(page);
  if (st && !st.out && st.input) { await page.keyboard.press(' '); await page.waitForTimeout(300); }
  const facing = page.locator('.tac-confirm-facing');
  if (await facing.isVisible()) { await facing.click(); await page.waitForTimeout(300); }
}

// ------------------------------------------------------------------------------------------------ tests
test.describe('Prolog', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('prolog-rat: book pages, hear the council, vote, the Four leave, alliance tableau', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await warp(page, 'prolog-rat');
    await expect(page.getByText('Die Urmacht').first()).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Enter');
    for (const t0 = Date.now(); Date.now() - t0 < 180000 && !(await flag(page, 'prolog-rat-intro'));) {
      await advance(page, { max: 1, idleMs: 0 });
      await page.waitForTimeout(150);
    }
    await advance(page, { max: 10, idleMs: 1500 });
    await page.waitForFunction(() => (window as Win).G.state.activeObjective()?.id === 'prolog-anhoeren', undefined, { timeout: 15000 });
    for (const id of ['ignatius', 'aelteste', 'hagere', 'wortfuehrer']) {
      await interact(page, id);
      await advance(page, { max: 30, idleMs: 1500, pick: 2 });
      expect(await flag(page, `prolog-gehoert-${id}`)).toBe(true);
    }
    await page.waitForFunction(() => (window as Win).G.state.activeObjective()?.id === 'prolog-abstimmen', undefined, { timeout: 15000 });
    await interact(page, 'wortfuehrer');
    await advance(page, { max: 200, idleMs: 12000, pick: 2 });
    await page.waitForFunction(() => (window as Win).G.currentScene === 'prolog-schlacht', undefined, { timeout: 60000 });
    expect(await flag(page, 'prolog-abstimmung')).toBe(true);
    expect(await page.evaluate(() => (window as Win).G.state.data.lore.includes('lore-dunkelhain'))).toBe(true);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('prolog-schlacht: tactics tutorial on the hill, young Baris survives, cave, arrow, fade', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await warp(page, 'prolog-schlacht');
    await page.waitForFunction(() => Boolean((window as Win).__tactics?.ready), undefined, { timeout: 30000 });
    await expect(page.locator('.tac-endturn')).toBeAttached();
    let outcome: string | null = null;
    for (let r = 0; r < 30 && !outcome; r++) {
      const st = await settle(page);
      outcome = st?.out ?? null;
      if (!outcome) await playPhase(page, ['valentus', 'falke']);
    }
    expect(outcome).toBe('Sieg');
    // Baris is kampfunfähig or still standing — never dead.
    expect(await page.evaluate(() => { const b = (window as Win).__tactics.ctrl.battle; const u = b.findUnit('baris'); return !u || u.down !== 'dead'; })).toBe(true);
    await page.keyboard.press('Enter');
    await advance(page, { max: 60, idleMs: 8000 });
    await page.waitForFunction(() => (window as Win).G.currentScene === 'prolog-flucht', undefined, { timeout: 60000 });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('prolog-flucht: sneak past the torches, hounds lose the scent in the stream, slip, lantern', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await warp(page, 'prolog-flucht');
    await page.waitForFunction(() => Boolean((window as Win).__world?.player), undefined, { timeout: 30000 });
    await advance(page, { max: 14, idleMs: 2500 });
    await page.waitForFunction(() => (window as Win).G.state.activeObjective()?.id === 'prolog-flucht', undefined, { timeout: 15000 });
    // Wait until the first torch bearer looks away at the north end of the bend, then slip through the ferns.
    const torchAway = async () => {
      for (const started = Date.now(); Date.now() - started < 40000;) {
        if (await flag(page, 'prolog-hunde-los')) return;
        if (await busy(page)) { await advance(page, { max: 1, idleMs: 0 }); continue; }
        const ready = await page.evaluate(() => {
          const w = (window as Win).__world;
          const g = w.guards.find((g: Win) => g.def.id === 'fackel-1');
          return !w.playerLocked && g.idx === 2 && g.state === 'wait';
        });
        if (ready) return;
        await page.waitForTimeout(100);
      }
      throw new Error('first torch did not reach the safe patrol position');
    };
    await sneakRoute(page, [[200, 372], [280, 440], [440, 480]], () => flag(page, 'prolog-hunde-los'), torchAway);
    // Run to the stream with the hounds behind, wade downstream and climb out on the east bank.
    await sneakRoute(page, [[600, 560], [760, 590], [860, 560], [1000, 500]], () => flag(page, 'prolog-hunde-verloren'));
    await advance(page, { max: 10, idleMs: 1000 });
    await walkKeys(page, 1080, 430, 14, 20000);
    await walkKeys(page, 1150, 410, 20, 20000);
    await advance(page, { max: 40, idleMs: 6000 });
    await page.waitForFunction(() => (window as Win).G.currentScene === 'prolog-zuflucht', undefined, { timeout: 60000 });
    expect(await flag(page, 'prolog-hunde-los')).toBe(true);
    expect(await flag(page, 'prolog-hunde-verloren')).toBe(true);
    expect(await flag(page, 'prolog-gestuerzt')).toBe(true);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('prolog-zuflucht: wake, the cradle, raise the hand, light and bang, „Sechzehn Jahre später“', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await warp(page, 'prolog-zuflucht');
    await page.waitForFunction(() => Boolean((window as Win).__world?.player), undefined, { timeout: 30000 });
    await advance(page, { max: 40, idleMs: 3000 });
    await page.waitForFunction(() => (window as Win).G.state.activeObjective()?.id === 'prolog-kinder', undefined, { timeout: 15000 });
    await interact(page, 'wiege-ansehen', 6);
    await advance(page, { max: 40, idleMs: 3000 });
    await page.waitForFunction(() => (window as Win).G.state.activeObjective()?.id === 'prolog-geschenk', undefined, { timeout: 30000 });
    await interact(page, 'wiege-ansehen', 6);
    await expect(page.locator('.action-lift')).toBeVisible({ timeout: 20000 }).catch(() => {});
    await advance(page, { max: 60, idleMs: 9000 });
    expect(await flag(page, 'prolog-geschenk')).toBe(true);
    // The prologue hands over to Kapitel I.
    await page.waitForFunction(() => (window as Win).G.currentScene === 'wiese', undefined, { timeout: 60000 });
    expect(await scene(page)).toBe('wiese');
    expect(errors.filter(e => !/wiese|k1-/.test(e)), errors.join('\n')).toEqual([]);
  });
});
