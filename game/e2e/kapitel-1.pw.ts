import { expect, test, type Page } from '@playwright/test';
import { playSceneAction } from './sceneActions';
import { disableReloads } from './noReloads';

/**
 * Kapitel I – „Der letzte Sommertag“: warps into every scene and plays its critical path with real inputs
 * (mouse clicks on the map, E, Ctrl for sneaking, directional hiding games, number keys for choices, buttons for packing).
 *   cd game && npx playwright test e2e/kapitel-1.pw.ts
 */

test.use({ viewport: { width: 1280, height: 720 } });
test.beforeEach(async ({ page }) => disableReloads(page));
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

/** Advances dialogue, choices and directional scene interactions until cond() holds. */
async function playUntil(page: Page, cond: () => Promise<boolean>, timeout = 120000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await cond()) return;
    if (await playSceneAction(page)) continue;
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

test('ueberfall: Harro uses the farm checkpoint after the prologue', async ({ page }) => {
  test.setTimeout(60000);
  const errors = watchErrors(page);
  await warp(page, 'prolog-flucht');
  await page.waitForFunction(() => Boolean((window as any).__world?.spottedHandler));
  // Reuse the same Phaser scene as the campaign does, with the actual prologue
  // capture handler installed. Skip only the riders' introduction on the farm.
  await page.evaluate(async () => {
    const worldModule = '/src/world/index.ts';
    const { startWorld, getMap } = await import(worldModule);
    await (window as any).G.ui.transition(() => startWorld({
      map: { ...getMap('k1-hof-harro'), onEnter: undefined }, spawn: 'versteck',
    }), { fadeMs: 10 });
  });
  await page.waitForFunction(() => !(window as any).__world?.playerLocked);
  expect(await page.evaluate(() => (window as any).__world.spottedHandler)).toBeNull();
  // The prologue's east-bank checkpoint lands inside the farm's stone heap.
  expect(await page.evaluate(() => (window as any).__world.grid.boxFree(1012, 470, 6, 3.5))).toBe(false);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.evaluate(() => {
      const w = (window as any).__world;
      w.ctx.stealth.resetGuards();
      w.ctx.player.teleport([640, 240]);
    });
    await page.waitForFunction(() => (window as any).__world?.spotting === true);
    await playUntil(page, async () => !(await page.evaluate(() => (window as any).__world?.playerLocked)));
    expect(await pos(page)).toEqual([510, 292]);
    expect(await page.evaluate(() => {
      const w = (window as any).__world;
      return w.grid.boxFree(w.player.x, w.player.y, 6, 3.5);
    })).toBe(true);
    // Move with actual keyboard input after each capture.
    await page.keyboard.down('ArrowDown');
    await page.waitForFunction(() => (window as any).__world.player.y > 310);
    await page.keyboard.up('ArrowDown');
  }
  expect(errors).toEqual([]);
});

test('ueberfall: sneak along the embankment, find cover, slip past Harro', async ({ page }) => {
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
  // The confrontation: two cover challenges, duck under the riders, Harro stays behind.
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

test('trauer: carry a stone at arm height without rectangular light edges', async ({ page }) => {
  test.setTimeout(60000);
  const errors = watchErrors(page);
  await warp(page, 'trauer');
  await page.evaluate(async () => {
    const worldModule = '/src/world/index.ts';
    const { startWorld, getMap } = await import(worldModule);
    const G = (window as any).G;
    await G.ui.transition(() => {
      G.state.set('k1-eltern');
      return startWorld({ map: { ...getMap('k1-hof-trauer'), weather: 'none' }, spawn: 'start' });
    }, { fadeMs: 10 });
  });
  await page.waitForFunction(() => (window as any).__world?.map.id === 'k1-hof-trauer' && !(window as any).__world.playerLocked);
  await page.evaluate(() => (window as any).__world.ctx.player.teleport([1010, 432], 'down'));
  await page.keyboard.press('e');
  await playUntil(page, async () => Boolean(await flag(page, 'k1-traegt')) && !(await busy(page)));
  await page.waitForFunction(() => !(window as any).__world.playerLocked);
  await page.evaluate(() => (window as any).__world.ctx.player.teleport([700, 330], 'right'));

  const carried = () => page.evaluate(() => {
    const w = (window as any).__world;
    const stone = w.children.list.find((o: any) => o.texture?.key === 'prop:iso-rock-0');
    const sprite = w.player.sprite;
    // Compare in figure pixels so map-specific artwork scales retain the same hand anchor and stone size.
    return stone ? { dx: Math.round((stone.x - sprite.x) / sprite.scaleX), dy: Math.round((stone.y - sprite.y) / sprite.scaleY),
      depth: stone.depth - sprite.depth, width: stone.displayWidth / sprite.scaleX } : null;
  });
  await expect.poll(carried).toMatchObject({ dx: 5, dy: -14 });
  expect((await carried())!.width).toBeLessThan(15);
  expect((await carried())!.depth).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).__world.ctx.player.face('up'));
  await expect.poll(carried).toMatchObject({ dx: 0, dy: -14 });
  expect((await carried())!.depth).toBeLessThan(0);
  await page.evaluate(() => (window as any).__world.ctx.player.face('left'));
  await expect.poll(carried).toMatchObject({ dx: -5, dy: -14 });

  // Read the rendered WebGL light mask. Corners inside the light's square quad
  // but outside its circle must match the surrounding night grade.
  const lightMask = () => page.evaluate(() => new Promise<{ center: number[]; corner: number[]; outside: number[] }>(resolve => {
    const w = (window as any).__world;
    const light = w.lighting.get('player-light');
    const cam = w.cameras.main;
    const cx = Math.round(light.x - cam.worldView.centerX + 320);
    const cy = Math.round(light.y - cam.worldView.centerY + 180);
    w.lighting.rt.snapshot((image: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const pixel = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data);
      resolve({ center: pixel(cx, cy), corner: pixel(cx + 60, cy + 60), outside: pixel(cx + 80, cy + 80) });
    });
  }));
  const mask = await lightMask();
  expect(mask.corner).toEqual(mask.outside);
  expect(mask.outside).toEqual([56, 71, 127, 255]);
  expect(mask.center[0]).toBeGreaterThan(mask.outside[0]);
  expect(mask.center[1]).toBeGreaterThan(mask.outside[1]);
  expect(mask.center[2]).toBeGreaterThan(mask.outside[2]);
  const clip = await page.evaluate(() => {
    const w = (window as any).__world;
    const cam = w.cameras.main;
    const r = document.querySelector('#game canvas')!.getBoundingClientRect();
    const x = r.left + (w.player.x - cam.worldView.x) * cam.zoom * r.width / 640;
    const y = r.top + (w.player.y - cam.worldView.y) * cam.zoom * r.height / 360;
    return { x: x - 140, y: y - 180, width: 280, height: 280 };
  });
  await page.screenshot({ path: test.info().outputPath('stone-carry.png'), clip });

  // A multiply gradient with no active lights must still produce an opaque,
  // visible mask, without carrying the previous frame's blend mode into the blit.
  for (const mood of ['dusk', 'dawn']) {
    await page.evaluate(async mood => {
      const w = (window as any).__world;
      w.lighting.get('player-light').intensity = 0;
      await w.ctx.lighting.set(mood, 0);
    }, mood);
    await expect.poll(async () => (await lightMask()).outside.slice(0, 3).every(v => v > 100)).toBe(true);
    expect((await lightMask()).outside[3]).toBe(255);
  }
  await page.evaluate(async () => (window as any).__world.ctx.lighting.set('day', 0));
  await page.waitForFunction(() => (window as any).__world.lighting.rt.visible === false);

  // Placing the stone removes the carried image and advances the grave counter.
  await page.evaluate(() => (window as any).__world.ctx.player.teleport([586, 256], 'up'));
  await page.keyboard.press('e');
  await playUntil(page, async () => Number(await flag(page, 'k1-steine')) === 1 && !(await busy(page)));
  expect(await carried()).toBeNull();
  expect(await flag(page, 'k1-traegt')).toBe(false);
  expect(errors).toEqual([]);
});

test('trauer: pigs stay behind the fence and leave through the opening gate', async ({ page }) => {
  test.setTimeout(90000);
  const errors = watchErrors(page);
  await warp(page, 'trauer');
  await page.evaluate(async () => {
    const worldModule = '/src/world/index.ts';
    const { startWorld, getMap } = await import(worldModule);
    const G = (window as any).G;
    await G.ui.transition(() => {
      G.state.set('k1-morgen'); G.state.set('k1-gepackt');
      return startWorld({ map: getMap('k1-hof-trauer'), spawn: 'start' });
    }, { fadeMs: 10 });
  });
  await page.waitForFunction(() => (window as any).__world?.map.id === 'k1-hof-trauer' && !(window as any).__world.playerLocked);
  await page.evaluate(() => {
    const win = window as any;
    const w = win.__world;
    w.ctx.player.teleport([338, 216], 'up');
    win.__pigTrace = [];
    const record = () => {
      for (const id of ['schwein-1', 'schwein-2', 'schwein-3']) {
        const p = w.actors.get(id);
        if (p) win.__pigTrace.push({ id, x: p.x, y: p.y, open: Boolean(win.G.state.is('k1-schweine-frei')),
          blocked: !w.grid.boxFree(p.x, p.y, 6, 3.5) });
      }
    };
    w.events.on('postupdate', record);
    win.__stopPigTrace = () => w.events.off('postupdate', record);
  });
  expect(await page.evaluate(() => (window as any).__world.grid.boxFree(332, 188, 6, 3.5))).toBe(false);
  // Try walking into the closed gate, then allow the pigs to wander for several seconds.
  await page.keyboard.down('ArrowUp');
  await sleep(1500);
  await page.keyboard.up('ArrowUp');
  expect((await pos(page))![1]).toBeGreaterThan(192);
  await sleep(6500);
  const confined = await page.evaluate(() => (window as any).__pigTrace as { id: string; x: number; y: number; open: boolean; blocked: boolean }[]);
  expect(confined.length).toBeGreaterThan(100);
  expect(confined.every(p => !p.open && !p.blocked && p.y < 198)).toBe(true);
  await page.evaluate(() => (window as any).__world.ctx.player.teleport([338, 216], 'up'));
  await page.keyboard.press('e');
  await playUntil(page, async () => Boolean(await flag(page, 'k1-schweine-frei')));
  expect(await page.evaluate(() => (window as any).__world.children.getByName('pigpen-gate-leaf').getData('open'))).toBe(true);
  expect(await page.evaluate(() => (window as any).__world.grid.boxFree(332, 188, 6, 3.5))).toBe(true);
  // The baked upper rail must be covered by ground when the leaf swings away.
  const gatePatch = await page.evaluate(() => {
    const texture = (window as any).__world.textures.get('k1-pigpen-gate-floor');
    return [[322, 169], [332, 165], [342, 161], [317, 180], [349, 175]]
      .map(([x, y]) => texture.context.getImageData(x - 314, y - 150, 1, 1).data[3]);
  });
  expect(gatePatch).toEqual([255, 255, 255, 0, 0]);
  await playUntil(page, async () => page.evaluate(() => {
    const w = (window as any).__world;
    return !w.playerLocked && ['schwein-1', 'schwein-2', 'schwein-3'].every(id => !w.actors.has(id));
  }), 45000);
  const trace = await page.evaluate(() => {
    const win = window as any;
    win.__stopPigTrace();
    return win.__pigTrace as { id: string; x: number; y: number; open: boolean; blocked: boolean }[];
  });
  expect(trace.every(p => !p.blocked)).toBe(true);
  for (const id of ['schwein-1', 'schwein-2', 'schwein-3']) {
    const firstOutside = trace.find(p => p.id === id && p.y > 200);
    expect(firstOutside).toBeDefined();
    expect(firstOutside!.open).toBe(true);
    expect(firstOutside!.x).toBeGreaterThan(320);
    expect(firstOutside!.x).toBeLessThan(350);
  }
  const fence = await page.evaluate(() => {
    const grid = (window as any).__world.grid;
    return [[224, 173], [274, 187], [379, 172], [302, 104]].map(([x, y]) => grid.solidAt(x, y));
  });
  expect(fence).toEqual([true, true, true, true]);
  await page.screenshot({ path: test.info().outputPath('pigpen-open.png') });
  // Returning from the house restores the open gate and keeps the freed pigs absent.
  await page.evaluate(async () => {
    const w = (window as any).__world;
    await w.ctx.changeMap('k1-stube', 'tuer', { fadeMs: 10 });
    await w.ctx.changeMap('k1-hof-trauer', 'tuer', { fadeMs: 10 });
  });
  expect(await page.evaluate(() => {
    const w = (window as any).__world;
    return { open: w.children.getByName('pigpen-gate-leaf').getData('open'),
      free: w.grid.boxFree(332, 188, 6, 3.5), pigs: [...w.actors.keys()].filter((id: string) => id.startsWith('schwein-')) };
  })).toEqual({ open: true, free: true, pigs: [] });
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
  await use(page, [338, 216], async () => Boolean(await flag(page, 'k1-schweine-frei')));
  for (const p of [[520, 330], [420, 470], [300, 560], [160, 640], [50, 690]] as [number, number][]) await walkTo(page, p[0], p[1], 18, 40000);
  await playUntil(page, async () => (await scene(page)) !== 'trauer', 60000);
  expect(await scene(page)).toBe('strasse');
  expect(errors).toEqual([]);
});
