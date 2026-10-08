import { expect, test, type Page } from '@playwright/test';
import { playSceneAction } from './sceneActions';

/**
 * Kapitel IV „Die Freie Bruderschaft“: warps into each scene and plays its critical path with real inputs
 * (clicks to walk, keys for dialogue and story gestures, sneaking and the dodge drill).
 *   cd game && SELANTIS_E2E_PORT=5325 npx playwright test e2e/kapitel-4.pw.ts
 */

/**
 * Several agents edit the working tree at the same time; Vite's HMR client would reload the page mid-playthrough.
 * The test serves a minimal stand-in for /@vite/client (styles still work, no HMR socket, no reloads).
 */
const VITE_CLIENT_STUB = `
const sheets = new Map();
export function updateStyle(id, css) {
  let el = sheets.get(id);
  if (!el) { el = document.createElement('style'); el.setAttribute('data-vite-dev-id', id); document.head.appendChild(el); sheets.set(id, el); }
  el.textContent = css;
}
export function removeStyle(id) { sheets.get(id)?.remove(); sheets.delete(id); }
export function injectQuery(url) { return url; }
export function createHotContext() {
  return { data: {}, accept() {}, acceptExports() {}, dispose() {}, prune() {}, invalidate() {}, decline() {}, on() {}, off() {}, send() {} };
}
export class ErrorOverlay {}
`;

async function noReloads(page: Page): Promise<void> {
  await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: VITE_CLIENT_STUB }));
}

const NOISE = /GPU stall|GL Driver Message|Automatic fallback to software WebGL|WebGL.*(performance|software)/i;

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('response', r => { if (r.status() >= 400 && /\/assets\//.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return errors;
}

const busy = (page: Page) => page.evaluate(() => (window as any).G.ui.busy() as boolean);
const flag = (page: Page, f: string) => page.evaluate(f => (window as any).G.state.is(f) as boolean, f);
const scene = (page: Page) => page.evaluate(() => (window as any).G.currentScene as string);
const mapId = (page: Page) => page.evaluate(() => (window as any).__world?.map?.id as string | undefined);
const choicesVisible = (page: Page) => page.locator('.choices').first().isVisible().catch(() => false);

async function waitWorld(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as any).__world?.player), undefined, { timeout: 30000 });
}

/** Presses Enter while a dialogue is open, until the predicate holds. */
async function advanceUntil(page: Page, pred: () => Promise<boolean>, max = 120): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await pred()) return;
    if (await playSceneAction(page)) continue;
    if (await busy(page)) await page.keyboard.press('Enter');
    await page.waitForTimeout(280);
  }
  throw new Error('advanceUntil: condition not reached');
}

async function settle(page: Page): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (await playSceneAction(page)) continue;
    if (!(await busy(page))) { await page.waitForTimeout(250); if (!(await busy(page))) return; }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(260);
  }
}

async function advanceToChoices(page: Page): Promise<void> {
  await advanceUntil(page, () => choicesVisible(page));
  await page.waitForTimeout(350);
}

/** Canvas click on a map point (map px → canvas → page). */
async function clickWorld(page: Page, x: number, y: number): Promise<void> {
  const p = await page.evaluate(([x, y]) => {
    const s = (window as any).__world.toScreen(x, y);
    const c = document.querySelector('#game canvas')!.getBoundingClientRect();
    return { x: c.left + Math.max(4, Math.min(636, s.x)) * c.width / 640, y: c.top + Math.max(4, Math.min(356, s.y)) * c.height / 360 };
  }, [x, y]);
  await page.mouse.click(p.x, p.y);
}

/** Click-walks to a map point (intermediate clicks while it is off screen). */
async function goWorld(page: Page, x: number, y: number, near = 24, max = 50): Promise<void> {
  const map = await mapId(page);
  for (let i = 0; i < max; i++) {
    if ((await mapId(page)) !== map) return;
    const d = await page.evaluate(([x, y]) => { const p = (window as any).__world.player; return Math.hypot(p.x - x, p.y - y); }, [x, y]);
    if (d <= near) return;
    if (await busy(page)) { await page.keyboard.press('Enter'); await page.waitForTimeout(280); continue; }
    await clickWorld(page, x, y);
    await page.waitForTimeout(900);
  }
}

const actorAt = (page: Page, id: string) => page.evaluate(id => {
  const w = (window as any).__world;
  const a = w.actors.get(id) ?? w.guards.find((g: any) => g.actor.id === id)?.actor;
  return a ? [a.x, a.y] as [number, number] : null;
}, id);

/** Walks to an NPC, talks, answers every choice with option 1. */
async function talk(page: Page, id: string): Promise<void> {
  const p = (await actorAt(page, id))!;
  await goWorld(page, p[0], p[1], 60);
  const q = (await actorAt(page, id))!;
  await clickWorld(page, q[0], q[1] - 10);
  for (let i = 0, idle = 0; i < 60 && idle < 6; i++) {
    await page.waitForTimeout(300);
    if (await choicesVisible(page)) { await page.waitForTimeout(250); await page.keyboard.press('1'); idle = 0; }
    else if (await busy(page)) { await page.keyboard.press('Enter'); idle = 0; }
    else idle++;
  }
}

test.describe('Kapitel IV', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test.setTimeout(420_000);

  test('augenbinde: morning at the brook, then the blindfolded walk', async ({ page }) => {
    const errors = watchErrors(page);
    await noReloads(page);
    await page.goto('/?scene=augenbinde');
    await page.waitForFunction(() => (window as any).G?.currentScene === 'augenbinde', undefined, { timeout: 20000 });
    await page.waitForTimeout(1200);
    await page.keyboard.press('Enter'); // chapter card
    await waitWorld(page);
    await advanceUntil(page, async () => ((await page.locator('.hud-obj-text').textContent()) ?? '').includes('Wasch dich'));
    await settle(page);
    expect(await mapId(page)).toBe('k4-bach');

    await clickWorld(page, 170, 132);
    await advanceUntil(page, () => flag(page, 'k4-gewaschen'));
    await settle(page);
    expect(await page.evaluate(() => (window as any).G.state.data.memories)).toContain('k4-mem-weiher');

    await clickWorld(page, 420, 116);
    await advanceToChoices(page);
    await page.keyboard.press('1'); // Mutters Tinktur (the choice is the decision; applying it is staged)
    await advanceUntil(page, () => flag(page, 'k4-ferse'));

    // Azar and Foltan wake up; the blindfold question.
    await advanceToChoices(page);
    await page.keyboard.press('2');
    await advanceUntil(page, async () => (await mapId(page)) === 'k4-waldpfad');

    // Blindfolded: follow Azar's voice (click towards it), duck under the fallen trunk.
    await waitWorld(page);
    let sneaking = false;
    for (let t = 0; t < 300_000; t += 700) {
      if ((await scene(page)) !== 'augenbinde' || (await mapId(page)) !== 'k4-waldpfad') break;
      if (await busy(page)) { await page.keyboard.press('Enter'); await page.waitForTimeout(300); continue; }
      const s = await page.evaluate(() => {
        const w = (window as any).__world; const a = w.actors.get('azar');
        return { p: [w.player.x, w.player.y], a: a ? [a.x, a.y] : null };
      });
      const nearTrunk = Math.hypot(s.p[0] - 975, s.p[1] - 255) < 90;
      if (nearTrunk !== sneaking) { sneaking = nearTrunk; if (sneaking) await page.keyboard.down('c'); else await page.keyboard.up('c'); }
      if (s.a && Math.hypot(s.a[0] - s.p[0], s.a[1] - s.p[1]) > 40) await clickWorld(page, s.a[0], s.a[1] + 10);
      await page.waitForTimeout(700);
    }
    if (sneaking) await page.keyboard.up('c');
    await page.waitForFunction(() => (window as any).G.currentScene === 'bruderschaft', undefined, { timeout: 30000 });
    expect(await flag(page, 'k4-augenbinde-done')).toBe(true);
    expect(await flag(page, 'k4-blinzeln')).toBe(true);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('bruderschaft: arrival, the camp, training Ausweichen and Ablenken', async ({ page }) => {
    const errors = watchErrors(page);
    await noReloads(page);
    await page.goto('/?scene=bruderschaft');
    await waitWorld(page);
    await advanceToChoices(page);
    await page.keyboard.press('1'); // „Ich kann selbst reden.“
    await advanceUntil(page, () => flag(page, 'k4-ankunft'));
    await page.waitForFunction(() => !(window as any).G.ui.busy(), undefined, { timeout: 15000 });
    await expect(page.locator('.hud-obj-text')).toContainText('Azar');

    // Azar at the forge: Lia treads the bellows (staged).
    await page.waitForFunction(() => { const a = (window as any).__world.actors.get('azar'); return a && Math.hypot(a.x - 968, a.y - 292) < 8; }, undefined, { timeout: 30000 });
    await goWorld(page, 968, 304, 60);
    await clickWorld(page, 968, 282);
    await advanceUntil(page, () => flag(page, 'k4-t-azar'));
    await settle(page);

    for (const id of ['k4-ilvy', 'k4-berta', 'k4-jorin']) await talk(page, id);
    expect(await page.evaluate(() => (window as any).G.state.data.lore)).toEqual(expect.arrayContaining(['k4-lore-destar', 'k4-lore-bruderschaft']));

    // Foltan comes out of Elnon's tent and calls Lia to the palisade.
    await advanceUntil(page, () => flag(page, 'k4-training-bereit'));
    await settle(page);
    await talk(page, 'foltan');

    // „Foltans Gewohnheiten“: a reader who knows the combination moves as soon as Foltan raises the sword.
    await page.waitForFunction(() => Boolean((window as any).__k4drill), undefined, { timeout: 60000 });
    for (let i = 0; i < 900 && !(await page.evaluate(() => (window as any).G.state.knows('ausweichen'))); i++) {
      const d = await page.evaluate(() => (window as any).__k4drill);
      if (d.armed) {
        await page.keyboard.press(d.coming === 'left' ? 'ArrowRight' : d.coming === 'right' ? 'ArrowLeft' : 'ArrowDown');
        await page.waitForTimeout(500);
      } else if (await busy(page)) { await page.keyboard.press('Enter'); await page.waitForTimeout(250); }
      else await page.waitForTimeout(40);
    }
    expect(await page.evaluate(() => (window as any).G.state.knows('ausweichen'))).toBe(true);

    // Distraction: a stone at the wrong target first (Gundrik spots Jorin), then the right one, then words.
    await advanceUntil(page, () => page.evaluate(() => (window as any).G.state.flag('k4-ablenken-phase') === 1));
    await settle(page);
    await goWorld(page, 250, 306, 30);
    await clickWorld(page, 76, 244);
    await page.waitForTimeout(1200);
    await settle(page);
    expect(await flag(page, 'k4-ablenken-stein-ok')).toBe(false);
    await clickWorld(page, 396, 236);
    await advanceUntil(page, () => flag(page, 'k4-ablenken-stein-ok'));
    await advanceUntil(page, () => page.evaluate(() => (window as any).G.state.flag('k4-ablenken-phase') === 2));
    await settle(page);
    const g = (await actorAt(page, 'k4-gundrik'))!;
    await clickWorld(page, g[0], g[1] - 10);
    await advanceToChoices(page);
    await page.keyboard.press('1');
    await advanceUntil(page, () => flag(page, 'k4-training-done'));
    expect(await page.evaluate(() => (window as any).G.state.knows('ablenken'))).toBe(true);
    await settle(page);

    // Supper at the big fire leads to „verrat“.
    await goWorld(page, 636, 384, 16, 60);
    await page.waitForFunction(() => (window as any).G.currentScene === 'verrat', undefined, { timeout: 30000 });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('verrat: sneak to Elnon’s tent, overhear Foltan, flee into the night', async ({ page }) => {
    const errors = watchErrors(page);
    await noReloads(page);
    await page.goto('/?scene=verrat');
    await waitWorld(page);
    await advanceUntil(page, () => flag(page, 'k4-verrat-intro'));
    await settle(page);
    await page.waitForTimeout(1800);

    for (let attempt = 0; attempt < 10 && !(await flag(page, 'k4-gehoert')); attempt++) {
      if (await busy(page)) { await settle(page); continue; }
      await page.keyboard.down('c');
      const p = (await page.evaluate(() => [(window as any).__world.player.x, (window as any).__world.player.y])) as [number, number];
      if (p[1] > 300) {
        await goWorld(page, 262, 394, 12);
        for (let i = 0; i < 60; i++) { const j = await actorAt(page, 'k4-jorin'); if (j && j[0] < 190) break; await page.waitForTimeout(250); }
        await goWorld(page, 330, 210, 14);
      }
      await goWorld(page, 450, 200, 16);
      await goWorld(page, 520, 222, 16);
      await page.keyboard.up('c');
      if (await busy(page)) continue; // spotted on the way: back at the checkpoint
      await clickWorld(page, 582, 186);
      await page.waitForTimeout(2500);
      await advanceUntil(page, async () => (await flag(page, 'k4-gehoert')) || !(await busy(page)), 200);
    }
    expect(await flag(page, 'k4-gehoert')).toBe(true);
    expect(await page.evaluate(() => (window as any).G.state.data.clues)).toContain('k4-clue-fuenf');
    await settle(page);

    // Out through the gate into the night forest, down to the brook.
    await goWorld(page, 634, 714, 4, 60);
    await page.waitForFunction(() => (window as any).__world?.map?.id === 'k4-nachtwald', undefined, { timeout: 30000 });
    await page.waitForTimeout(800);
    await settle(page);
    await goWorld(page, 660, 360, 30, 90);
    for (let i = 0; i < 120 && !(await flag(page, 'k4-done')); i++) {
      if (await choicesVisible(page)) await page.keyboard.press('2');
      else await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
    }
    expect(await flag(page, 'k4-done')).toBe(true);
    expect(await page.evaluate(() => (window as any).G.state.data.party)).toEqual([]);
    // Hands over to Kapitel V („regenwald“) when it exists, otherwise back to the title (scene stays 'verrat').
    expect(['regenwald', 'verrat']).toContain(await scene(page));
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('phone landscape: camp loads with touch controls', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    await noReloads(page);
    await page.goto('/?scene=bruderschaft');
    await waitWorld(page);
    await advanceToChoices(page);
    await page.keyboard.press('1');
    await advanceUntil(page, () => flag(page, 'k4-ankunft'));
    await page.waitForTimeout(1500);
    await expect(page.locator('.hud-obj-text')).toContainText('Azar');
    expect(errors, errors.join('\n')).toEqual([]);
    await ctx.close();
  });
});
