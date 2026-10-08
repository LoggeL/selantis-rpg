import { expect, test, type Page } from '@playwright/test';
import { disableReloads } from './noReloads';

test.beforeEach(async ({ page }) => disableReloads(page));

/**
 * Kapitel III „Der Goldene Eber“: warps into each scene and drives the critical path with real inputs
 * (keyboard, clicks into the world, minigames played on the beat / in the breath zone).
 */

test.use({ viewport: { width: 1280, height: 720 } });
// One retry: during development other edits trigger Vite full reloads, which restart a warped scene mid-test.
test.describe.configure({ timeout: 420_000, retries: 1 });

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
};

const wait = (page: Page, ms: number) => page.waitForTimeout(ms);
const busy = (page: Page) => page.evaluate(() => (window as any).G?.ui?.busy?.() ?? false).catch(() => false);
/** Dialogue open or a cutscene running (letterbox). */
const occupied = (page: Page) => page.evaluate(() => Boolean((window as any).G?.ui?.busy?.()) || Boolean(document.querySelector('#ui')?.classList.contains('has-letterbox'))).catch(() => false);
const modal = (page: Page) => page.evaluate(() => document.querySelector('#ui')?.getAttribute('data-modal') ?? '').catch(() => '');
const flag = (page: Page, k: string) => page.evaluate(k => (window as any).G.state.data.flags[k], k);
const scene = (page: Page) => page.evaluate(() => (window as any).G.currentScene as string);
const player = (page: Page) => page.evaluate(() => { const p = (window as any).__world?.player; return p ? [p.x, p.y] as [number, number] : null; });

/** One dialogue step: a deliberate digit for choices (they ignore mashing), Enter for everything else. */
async function step(page: Page, pick = 1): Promise<void> {
  if (await modal(page) === 'choose') { await wait(page, 650); await page.keyboard.press(String(pick)); await wait(page, 200); }
  else if (await busy(page)) await page.keyboard.press('Enter');
}

/** Steps through dialogue until `fn` (evaluated in the page) is true. */
async function until(page: Page, fn: () => unknown, opts: { max?: number; pick?: number } = {}): Promise<void> {
  for (let i = 0; i < (opts.max ?? 400); i++) {
    if (await page.evaluate(fn).catch(() => false)) return;
    await step(page, opts.pick ?? 1);
    await wait(page, 280);
  }
  throw new Error(`condition not reached: ${fn.toString()}`);
}

async function settle(page: Page): Promise<void> {
  for (let i = 0; i < 160; i++) {
    if (!(await occupied(page))) { await wait(page, 450); if (!(await occupied(page))) return; }
    await step(page); await wait(page, 260);
  }
}

/** Screen position of a map pixel. */
async function screenOf(page: Page, x: number, y: number) {
  return page.evaluate(([x, y]) => {
    const cam = (window as any).__world.cameras.main;
    const c = document.querySelector('#game canvas')!.getBoundingClientRect();
    return { x: c.left + (x - cam.worldView.x) * cam.zoom * c.width / 640, y: c.top + (y - cam.worldView.y) * cam.zoom * c.height / 360 };
  }, [x, y]);
}

/** Clicks a map point (tap-to-walk / click a hotspot) and waits until something happens. */
async function click(page: Page, x: number, y: number, done: () => Promise<boolean>, ms = 12000): Promise<void> {
  const p = await screenOf(page, x, y);
  await page.mouse.click(p.x, p.y);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await done()) return; await wait(page, 200); }
  throw new Error(`nothing happened after clicking ${x},${y}`);
}
const near = (page: Page, x: number, y: number, r = 10) => async () => { const p = await player(page); return Boolean(p && Math.hypot(p[0] - x, p[1] - y) < r) || busy(page); };
const actorAt = (page: Page, id: string) => page.evaluate(id => { const a = (window as any).__world.actors.get(id); return [a.x, a.y] as [number, number]; }, id);

async function talk(page: Page, id: string, pick = 1): Promise<void> {
  const [x, y] = await actorAt(page, id);
  await click(page, x, y - 12, () => busy(page));
  await settleWith(page, pick);
}
async function settleWith(page: Page, pick: number): Promise<void> {
  for (let i = 0; i < 160; i++) {
    if (!(await occupied(page))) { await wait(page, 450); if (!(await occupied(page))) return; }
    await step(page, pick); await wait(page, 260);
  }
}

test('eber: gather clues, combine them, Foltan lies — the player knows better', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('/?scene=eber');
  await until(page, () => (window as any).G?.state?.data?.flags?.['k3-intro'] && !(window as any).G.ui.busy(), { max: 600 });
  await settle(page);
  expect(await scene(page)).toBe('eber');

  // Spurenblick at the middle pillar: rope fibres.
  await click(page, 333, 242, near(page, 333, 242, 14));
  await page.keyboard.down('q'); await wait(page, 700);
  await page.keyboard.press('e'); await wait(page, 400);
  await page.keyboard.up('q');
  await settle(page);
  // Witnesses.
  await talk(page, 'schankmaid');
  await talk(page, 'spielmann');
  await talk(page, 'zwerg');
  const clues = await page.evaluate(() => (window as any).G.state.data.clues as string[]);
  expect(clues).toEqual(expect.arrayContaining(['k3-seilfasern', 'k3-schminke', 'k3-wette', 'k3-zwerg']));

  // Azar tells Foltan's story in secret.
  await talk(page, 'azar');
  expect(await flag(page, 'k3-azar-geschichte')).toBe(true);

  // The stable: chain and Kyra's ribbon (Spurenblick in the straw).
  await click(page, 365, 92, async () => (await page.evaluate(() => (window as any).__world?.map?.id)) === 'k3-stall');
  await wait(page, 1200);
  await click(page, 159, 160, () => busy(page)); await settle(page);
  await click(page, 124, 250, near(page, 124, 250, 14));
  await page.keyboard.down('q'); await wait(page, 700);
  await page.keyboard.press('e'); await wait(page, 400);
  await page.keyboard.up('q');
  await settle(page);
  expect(await page.evaluate(() => (window as any).G.state.has('ribbon'))).toBe(true);
  await click(page, 318, 352, async () => (await page.evaluate(() => (window as any).__world?.map?.id)) === 'k3-eber', 15000);
  await wait(page, 1200);

  // The clue board at the table: combine all three pairs (keyboard).
  await click(page, 125, 135, async () => Boolean(await page.$('.k3-notes')));
  await wait(page, 600);
  const pickCard = async (id: string) => { await page.click(`.k3-card[data-clue="${id}"]`); await wait(page, 350); };
  await pickCard('k3-seilfasern'); await pickCard('k3-zwerg');
  await pickCard('k3-kette'); await pickCard('k3-haarband');
  await pickCard('k3-schminke'); await pickCard('k3-wette');
  await wait(page, 1400);
  expect(await page.evaluate(() => (window as any).G.state.hasClue('k3-schluss-lebt'))).toBe(true);
  await page.keyboard.press('Escape');
  await settle(page);

  // Azar fetches Foltan: „Craupor weiß nichts.“ — Lia confronts him with the ribbon (first option).
  await talk(page, 'azar');
  await until(page, () => (window as any).G.currentScene === 'leselager', { max: 300 });
  expect(await flag(page, 'k3-luege-bemerkt')).toBe(true);
  expect(await flag(page, 'k3-foltan-konfrontiert')).toBe(true);
  expect(errors).toEqual([]);
});

test('leselager: stones, the fifth fire attempt, reading aloud, the promise', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('/?scene=leselager');
  await until(page, () => ((window as any).G?.state?.data?.objectives ?? []).some((o: any) => o.id === 'k3-steine') && !(window as any).G.ui.busy(), { max: 200 });
  for (const [x, y] of [[146, 165], [230, 114], [150, 232], [440, 128], [468, 140]]) {
    const before = await page.evaluate(() => (window as any).G.state.count('k3-stein'));
    await click(page, x, y, async () => (await page.evaluate(b => (window as any).G.state.count('k3-stein') > b, before)));
    await settle(page);
  }
  await click(page, 312, 204, () => busy(page));
  // Azar's fifth attempt is staged now: Lia blows on the glow without a minigame.
  await until(page, () => (window as any).G.state.is('k3-feuer'), { max: 300 });
  expect(await flag(page, 'k3-feuer')).toBe(true);
  await until(page, () => (window as any).G.currentScene === 'kyra', { max: 400 });
  expect(await flag(page, 'k3-gelesen')).toBe('kraeuter');
  expect(await flag(page, 'k3-versprechen')).toBe(true);
  expect(errors).toEqual([]);
});

test('kyra: free yourself while they bawl the refrain, sneak to the tent, overhear, get caught', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('/?scene=kyra');
  await until(page, () => Boolean(document.querySelector('.k3-stake')), { max: 300 });
  // Rock the stake only while the men bawl the refrain; stay still on quiet lines, during the rests and while someone looks.
  for (let i = 0; i < 900; i++) {
    const d = await page.evaluate(() => { const r = document.querySelector<HTMLElement>('.k3-stake'); return r ? { loud: r.dataset.loud === '1', watch: r.dataset.watch === '1' } : null; });
    if (!d) break;
    if (!d.loud || d.watch) { await wait(page, 120); continue; }
    await page.keyboard.press('e');
    await wait(page, 680);
  }
  await until(page, () => !(window as any).G.ui.busy() && ((window as any).G.state.data.objectives ?? []).some((o: any) => o.id === 'k3-lauschen'), { max: 100 });
  await settle(page);
  expect(await flag(page, 'k3-kyra-frei')).toBe(true);
  // Sneak (hold C) from cover to cover; slip past the drunk Algard behind his back.
  const algardX = async () => (await actorAt(page, 'algard'))[0];
  const waitFor = async (cond: () => Promise<boolean>, ms = 20000) => { const t0 = Date.now(); while (!(await cond())) { if (Date.now() - t0 > ms) throw new Error('timeout'); await wait(page, 100); } };
  await page.keyboard.down('c');
  await click(page, 132, 124, near(page, 132, 124, 9), 15000);
  await click(page, 212, 116, near(page, 212, 116, 9), 15000);
  await waitFor(async () => (await algardX()) > 286);   // he sways to the crates …
  await waitFor(async () => (await algardX()) < 246);   // … and back to the rack, looking at the fire
  await click(page, 280, 97, near(page, 280, 97, 9), 15000);
  await waitFor(async () => (await algardX()) > 286);   // he passes the crates and looks left
  await click(page, 358, 84, near(page, 358, 84, 9), 15000);
  await page.keyboard.up('c');
  await until(page, () => (window as any).G.state.data.flags['k3-kyra-lauscht'], { max: 60 });
  await until(page, () => (window as any).G.currentScene !== 'kyra', { max: 500 });
  const lore = await page.evaluate(() => (window as any).G.state.data.lore as string[]);
  expect(lore).toContain('k3-lore-geweih');
  expect(['augenbinde', '']).toContain(await scene(page));
  expect(errors).toEqual([]);
});
