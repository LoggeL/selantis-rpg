import { expect, test, type Page } from '@playwright/test';

/**
 * Kapitel I – „Der letzte Sommertag“: warps into every scene and plays its critical path with real inputs
 * (mouse clicks on the map, E, Ctrl for sneaking, held E for „Halte still“, number keys for choices, buttons for packing).
 *   cd game && npx playwright test e2e/kapitel-1.pw.ts
 */

test.use({ viewport: { width: 1280, height: 720 } });
test.describe.configure({ mode: 'parallel' });

const NOISE = /GPU stall|GL Driver Message|Automatic fallback to software WebGL|WebGL.*(performance|software)/i;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  return errors;
}

async function warp(page: Page, scene: string): Promise<void> {
  await page.goto(`/?scene=${scene}`);
  await page.waitForFunction(() => Boolean((window as any).__world?.player), undefined, { timeout: 30000 });
}

const busy = (page: Page) => page.evaluate(() => Boolean((window as any).G?.ui?.busy?.())).catch(() => false);
const holdOpen = (page: Page) => page.evaluate(() => Boolean(document.querySelector('.hold:not(.is-out):not(.is-complete)'))).catch(() => false);
const choicesOpen = (page: Page) => page.evaluate(() => Boolean(document.querySelector('.choices:not(.is-out)'))).catch(() => false);
const objective = (page: Page) => page.evaluate(() => document.querySelector('.hud-obj-text')?.textContent ?? '');
const scene = (page: Page) => page.evaluate(() => (window as any).G.currentScene as string);
const mapId = (page: Page) => page.evaluate(() => (window as any).__world?.map?.id as string | undefined);
const flag = (page: Page, k: string) => page.evaluate(k => (window as any).G.state.data.flags[k], k);
const pos = (page: Page) => page.evaluate(() => {
  const p = (window as any).__world?.player;
  return p ? [Math.round(p.x), Math.round(p.y)] as [number, number] : null;
});

/** Advances dialogue (Enter), picks the first choice (1) and holds E through „Halte still“ until cond() holds. */
async function playUntil(page: Page, cond: () => Promise<boolean>, timeout = 120000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await cond()) return;
    if (await holdOpen(page)) {
      await sleep(250);
      await page.keyboard.down('e');
      for (let i = 0; i < 40 && await holdOpen(page); i++) await sleep(200);
      await page.keyboard.up('e');
      await sleep(300);
      continue;
    }
    if (await choicesOpen(page)) { await sleep(900); await page.keyboard.press('1'); await sleep(500); continue; }
    if (await busy(page)) await page.keyboard.press('Enter');
    await sleep(250);
  }
  throw new Error('playUntil: timed out');
}
const idle = (page: Page) => playUntil(page, async () => !(await busy(page)) && !(await holdOpen(page)), 60000);

async function clickMap(page: Page, x: number, y: number): Promise<void> {
  const c = await page.evaluate(([x, y]) => {
    const cam = (window as any).__world?.cameras.main;
    if (!cam) return null;
    const r = document.querySelector('#game canvas')!.getBoundingClientRect();
    return { x: r.left + (x - cam.worldView.x) * cam.zoom * r.width / 640, y: r.top + (y - cam.worldView.y) * cam.zoom * r.height / 360 };
  }, [x, y]);
  if (c) await page.mouse.click(c.x, c.y);
}

/** Click-to-walk towards a map point (in on-screen steps), advancing any dialogue on the way. */
async function walkTo(page: Page, x: number, y: number, tol = 14, timeout = 30000): Promise<void> {
  const t0 = Date.now();
  const startScene = await scene(page);
  const startMap = await mapId(page);
  while (Date.now() - t0 < timeout) {
    // Walking into an exit/trigger may change the scene or map: that is the goal reached.
    if (await scene(page) !== startScene || await mapId(page) !== startMap) return;
    const p = await pos(page);
    if (p && Math.hypot(p[0] - x, p[1] - y) < tol) return;
    if (await busy(page)) { await page.keyboard.press('Enter'); await sleep(300); continue; }
    const v = await page.evaluate(() => { const c = (window as any).__world?.cameras.main.worldView; return c ? [c.x, c.y, c.width, c.height] : null; });
    // A transition can tear down the old world between the checks above.
    if (!v) { await sleep(100); continue; }
    let tx = x, ty = y;
    if (p) {
      const m = 24;
      const inside = (qx: number, qy: number) => qx >= v[0] + m && qx <= v[0] + v[2] - m && qy >= v[1] + m && qy <= v[1] + v[3] - m;
      let t = 1;
      for (let k = 0; k < 20 && !inside(p[0] + (x - p[0]) * t, p[1] + (y - p[1]) * t); k++) t *= 0.8;
      tx = p[0] + (x - p[0]) * t; ty = p[1] + (y - p[1]) * t;
    }
    await clickMap(page, tx, ty);
    await sleep(600);
  }
  throw new Error(`walkTo ${x},${y}: stuck at ${JSON.stringify(await pos(page))}`);
}

/** Walks next to a hotspot and presses E until `done()` holds. */
async function use(page: Page, stand: [number, number], done: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await idle(page);
    await walkTo(page, stand[0], stand[1], 10);
    await page.keyboard.press('e');
    await sleep(1200);
    await idle(page);
    if (await done()) return;
  }
  throw new Error(`use at ${stand}: nothing happened`);
}

test('wiese: Kyra, the promise, the book, the fledgling, Spurenblick', async ({ page }) => {
  test.setTimeout(240000);
  const errors = watchErrors(page);
  await warp(page, 'wiese');
  await playUntil(page, async () => (await objective(page)).includes('Buch'));
  expect(await flag(page, 'k1-versprochen')).toBe(true);
  await use(page, [532, 482], async () => Boolean(await flag(page, 'k1-buch-aufgehoben')));
  await idle(page);
  // The fledgling: chirping in the birch, follow the trail with Spurenblick (Q), put it back.
  await walkTo(page, 440, 200);
  await playUntil(page, async () => (await page.evaluate(() => (window as any).G.state.knows('spurenblick'))) && !(await busy(page)));
  await page.keyboard.down('q');
  await sleep(500);
  await use(page, [304, 210], async () => Boolean(await flag(page, 'k1-kueken')));
  await page.keyboard.up('q');
  await use(page, [449, 140], async () => Boolean(await flag(page, 'k1-nest')));
  await use(page, [940, 214], async () => page.evaluate(() => (window as any).G.state.has('flowers')));
  await walkTo(page, 1258, 652, 30, 40000);
  await page.waitForFunction(() => (window as any).G.currentScene === 'heimweg', undefined, { timeout: 20000 });
  const st = await page.evaluate(() => (window as any).G.state.data);
  expect(st.inventory['book-alana']).toBe(1);
  expect(st.memories).toContain('k1-mem-nest');
  expect(errors).toEqual([]);
});

for (const route of ['hohlweg', 'felder'] as const) test(`heimweg: ${route} reaches the farm without locking movement`, async ({ page }) => {
  test.setTimeout(180000);
  const errors = watchErrors(page);
  await warp(page, 'heimweg');
  await idle(page);
  await page.keyboard.down('q');
  const points: [number, number][] = route === 'hohlweg'
    ? [[140, 340], [220, 440], [440, 532], [660, 570], [900, 590], [1100, 606], [1272, 615]]
    : [[140, 320], [300, 272], [430, 264], [700, 230], [960, 192], [1120, 176], [1272, 148]];
  for (const p of points) {
    await walkTo(page, p[0], p[1], 16, 40000);
    await idle(page);
    if (await scene(page) !== 'heimweg') break;
  }
  await page.keyboard.up('q');
  await page.waitForFunction(() => (window as any).G.currentScene === 'ueberfall', undefined, { timeout: 20000 });
  const st = await page.evaluate(() => (window as any).G.state.data);
  expect(st.flags['k1-heimweg-route']).toBe(route);
  expect(st.abilities).toContain('spurenblick');
  expect(st.clues).toEqual(expect.arrayContaining(['k1-stille', 'k1-pferde']));
  await playUntil(page, async () => (await objective(page)).includes('Böschung'));
  await page.waitForFunction(() => (window as any).__world?.playerLocked === false, undefined, { timeout: 5000 });
  expect(errors).toEqual([]);
});

test('ueberfall: sneak along the embankment, hold still, slip past Harro', async ({ page }) => {
  test.setTimeout(420000);
  const errors = watchErrors(page);
  await warp(page, 'ueberfall');
  await playUntil(page, async () => (await objective(page)).includes('Böschung'));
  expect(await page.evaluate(() => (window as any).G.state.knows('schleichen'))).toBe(true);
  // Sneak from bush to bush up the embankment (Ctrl held).
  await page.keyboard.down('Control');
  for (const p of [[240, 525], [350, 465], [430, 375]] as [number, number][]) await walkTo(page, p[0], p[1]);
  await clickMap(page, 505, 290);
  await page.keyboard.up('Control');
  // The confrontation: three hold-still moments, the riders, Harro stays behind.
  await playUntil(page, async () => (await mapId(page)) === 'k1-hof-harro' && (await objective(page)).includes('Feldgatter'), 300000);
  expect(await flag(page, 'k1-buch-verloren')).toBe(true);
  // Slip from bush to bush down to the old field gate while Harro is busy in the yard.
  await page.keyboard.down('Control');
  for (const p of [[432, 372], [352, 462], [244, 528], [180, 572]] as [number, number][]) {
    for (let i = 0; i < 80; i++) {
      const hy = await page.evaluate(() => (window as any).__world.actors.get('harro')?.y ?? 0);
      if (hy < 290) break;
      await sleep(200);
    }
    await walkTo(page, p[0], p[1]);
  }
  await clickMap(page, 96, 594); // the old field gate: Lia slips through, Harro gives up and rides off
  await page.keyboard.up('Control');
  await playUntil(page, async () => (await scene(page)) === 'trauer', 120000);
  expect(errors).toEqual([]);
});

test('trauer: cairns, cornflowers, the book, packing, pigs, east', async ({ page }) => {
  test.setTimeout(420000);
  const errors = watchErrors(page);
  await warp(page, 'trauer');
  await page.evaluate(() => (window as any).G.state.give('flowers'));
  await playUntil(page, async () => (await objective(page)).includes('Eltern'));
  await use(page, [586, 252], async () => Boolean(await flag(page, 'k1-eltern')));
  for (let i = 0; i < 10 && (Number(await flag(page, 'k1-steine')) || 0) < 4; i++) {
    await use(page, [1010, 432], async () => Boolean(await flag(page, 'k1-traegt')));
    await use(page, [586, 256], async () => !(await flag(page, 'k1-traegt')));
  }
  expect(await flag(page, 'k1-steine')).toBe(4);
  await use(page, [618, 258], async () => Boolean(await flag(page, 'k1-blumen-grab')));
  await playUntil(page, async () => (await objective(page)).includes('reisefertig'), 120000);
  await use(page, [522, 312], async () => Boolean(await flag(page, 'k1-buch-gefunden')));
  // Into the house.
  await use(page, [583, 204], async () => (await mapId(page)) === 'k1-stube');
  await use(page, [254, 134], async () => Boolean(await flag(page, 'k1-geheimfach')));
  await use(page, [336, 132], async () => Boolean(await flag(page, 'k1-tinktur')));
  await use(page, [392, 196], async () => Boolean(await flag(page, 'k1-reisekleidung')));
  await idle(page);
  await walkTo(page, 60, 220, 10);
  // Click-to-walk may already interact with the bag. E would toggle its first item.
  if (!(await page.locator('.k1-pack').count())) await page.keyboard.press('e');
  await page.waitForSelector('.k1-pack', { timeout: 15000 });
  const herbs = page.locator('.k1-pack-item[data-item="book-herbs"]');
  const tinder = page.locator('.k1-pack-item[data-item="tinder"]');
  const alana = page.locator('.k1-pack-item[data-item="book-alana"]');
  if (!(await herbs.evaluate(el => el.classList.contains('is-in')))) await herbs.click();
  await expect(herbs).toHaveClass(/is-in/);
  if (!(await tinder.evaluate(el => el.classList.contains('is-in')))) await tinder.click();
  await expect(tinder).toHaveClass(/is-in/);
  await expect(page.locator('.k1-pack-room')).toContainText('3 / 4');
  await alana.click(); // The second book needs two places and cannot fit.
  await expect(alana).not.toHaveClass(/is-in/);
  await expect(page.locator('.k1-pack-thought')).toContainText('passt nicht mehr');
  await page.click('.k1-pack-done');
  await playUntil(page, async () => Boolean(await flag(page, 'k1-gepackt')) && (await objective(page)).includes('Schweine') && !(await busy(page)));
  const inv = await page.evaluate(() => (window as any).G.state.data.inventory);
  expect(inv).toMatchObject({ bread: 2, cheese: 1, bacon: 1, waterskin: 1, blanket: 1, cloak: 1, coins: 1, tincture: 1, dagger: 1, tinder: 1, 'book-herbs': 1 });
  expect(inv['book-alana']).toBeUndefined();
  expect(await page.evaluate(() => (window as any).__world.player.sprite.texture.key)).toContain('lia-cloak');
  // Out, free the pigs, follow the hoofprints east.
  await walkTo(page, 268, 345, 16);
  await page.waitForFunction(() => (window as any).__world?.map?.id === 'k1-hof-trauer', undefined, { timeout: 15000 });
  await use(page, [420, 214], async () => Boolean(await flag(page, 'k1-schweine-frei')));
  for (const p of [[520, 330], [420, 470], [300, 560], [160, 640], [50, 690]] as [number, number][]) await walkTo(page, p[0], p[1], 18, 40000);
  await playUntil(page, async () => (await scene(page)) !== 'trauer', 60000);
  expect(await scene(page)).toBe('strasse');
  expect(errors).toEqual([]);
});
