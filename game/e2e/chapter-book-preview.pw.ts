import { expect, test, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';
import { disableReloads } from './noReloads';

test.use({ viewport: { width: 1280, height: 720 } });
test.beforeEach(async ({ page }) => { await disableReloads(page); });

interface BookStart {
  reached?: string[];
  current?: string;
  all?: boolean;
  reduced?: boolean;
}

/** Use real title navigation, with progress independent of the current campaign save. */
async function openBook(page: Page, { reached = [], current, all = false, reduced = false }: BookStart = {}): Promise<Locator> {
  await page.addInitScript(({ reached, current, all, reduced }) => {
    localStorage.clear();
    localStorage.setItem('selantis.settings.v1', JSON.stringify({ music: 0, voice: 0, sfx: 0, textSpeed: 0, reducedMotion: reduced }));
    localStorage.setItem('selantis.progress.v1', JSON.stringify({ reached, all }));
    if (current) localStorage.setItem('selantis.save.v1', JSON.stringify({ version: 1, scene: current, savedAt: new Date(0).toISOString() }));
  }, { reached, current, all, reduced });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Kapitel', exact: true }).click();
  const spread = page.locator('.title-panel-body > .chap-spread');
  await expect(spread).toBeVisible();
  await expect(spread).toHaveAttribute('data-state', 'idle');
  return spread;
}

async function atBook(spread: Locator, id: number): Promise<void> {
  await expect(spread).toHaveAttribute('data-state', 'idle');
  await expect(spread).toHaveAttribute('data-book', String(id));
  await expect(spread.locator('.chap-book-leaf')).toHaveCount(0);
}

async function screenshot(page: Page, info: TestInfo, name: string): Promise<void> {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

async function holdBookImages(page: Page) {
  const held = new Map<string, Route[]>();
  const released = new Set<string>();
  await page.route(/\/assets\/(?:bg|cut)\/[^?]+\.(?:png|jpe?g|webp)(?:\?.*)?$/, async route => {
    const path = new URL(route.request().url()).pathname;
    if (released.has(path)) { await route.continue(); return; }
    held.set(path, [...held.get(path) ?? [], route]);
  });
  const release = async (path: string) => {
    released.add(path);
    const routes = held.get(path) ?? [];
    held.delete(path);
    await Promise.all(routes.map(route => route.continue()));
  };
  return { held, release };
}

test('saved-current section wins over later progress, and locked titles stay concealed', async ({ page }, info) => {
  const spread = await openBook(page, { reached: ['prolog-rat', 'e2-urmacht', 'e3-valentus'], current: 'e2-urmacht', reduced: true });
  await atBook(spread, 2);
  const [leftPage, rightPage] = await spread.evaluate(node => ['is-left', 'is-right'].map(side => {
    const rect = node.querySelector(`:scope > .chap-page.${side}`)!.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }));
  await info.attach('desktop-page-geometry', { contentType: 'application/json', body: JSON.stringify({ leftPage, rightPage }, null, 2) });
  expect(rightPage!.y).toBeCloseTo(leftPage!.y, 0);
  expect(rightPage!.height).toBeCloseTo(leftPage!.height, 0);
  expect(rightPage!.width).toBeGreaterThan(400);
  expect(rightPage!.width).toBeCloseTo(leftPage!.width, 0);
  expect(rightPage!.x).toBeGreaterThanOrEqual(leftPage!.x + leftPage!.width - 1);
  expect(rightPage!.x + rightPage!.width).toBeLessThanOrEqual(1280);
  await expect(spread.locator(':scope > .is-right .chap-head.is-open')).toBeVisible();
  await expect(spread.locator(':scope > .is-left .chap-book-title')).toHaveText('Letzte Hoffnung');
  const heads = spread.locator(':scope > .is-right .chap-head');
  await expect(heads).toHaveCount(4);
  await expect(heads.filter({ hasText: 'Der Fremde im Wald' })).toHaveAttribute('aria-expanded', 'true');
  await expect(spread.locator(':scope > .is-right .chap-scene:not(.is-locked)')).toHaveCount(1);
  await expect(spread.locator(':scope > .is-right .chap-scene:not(.is-locked)').first()).toBeVisible();
  await expect(spread.locator(':scope > .is-right .chap-scene.is-locked')).toHaveCount(5);
  await expect(spread.locator(':scope > .is-right .chap-scene.is-locked .chap-scene-title')).toHaveText(Array(5).fill('???'));
  expect(await spread.locator(':scope > .is-right .chap-scene.is-locked').evaluateAll(rows => rows.every(row => (row as HTMLButtonElement).disabled))).toBe(true);
  await expect(heads.filter({ hasText: 'Noch nicht erreicht' })).toHaveCount(3);
  await expect(spread).not.toContainText('Kyras Widerstand');
  await expect(spread).not.toContainText('Schattentöter');
  const art = spread.locator(':scope > .is-left .chap-art');
  await expect(art.locator('.chap-art-img')).toHaveAttribute('data-image-source', /\/assets\/cut\/chap-teil-2-3\./);
  await expect(art).not.toHaveAttribute('data-scene', /.+/);
  await screenshot(page, info, 'saved-current-and-locked');
});

test('group covers remain available and native Tab focus previews the real scene through a delayed download', async ({ page }, info) => {
  const images = await holdBookImages(page);
  const spread = await openBook(page, { reached: ['prolog-rat', 'prolog-schlacht'], current: 'prolog-rat', reduced: true });
  const art = spread.locator(':scope > .is-left .chap-art');
  const img = art.locator('.chap-art-img');
  await expect(img).toHaveAttribute('data-image-source', /\/assets\/cut\/chap-prolog\./);
  await expect(img).toHaveAttribute('data-image-state', 'loading');
  await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/);
  const head = spread.locator(':scope > .is-right .chap-head.is-open');
  await head.focus();
  await page.keyboard.press('Tab');
  const first = spread.locator(':scope > .is-right .chap-scene:not(.is-locked)').first();
  await expect(first).toBeFocused();
  await expect(art).toHaveAttribute('data-scene', 'prolog-rat');
  await expect(img).toHaveAttribute('data-image-source', '/assets/cut/prolog-buendnis.jpg');
  const firstSource = await img.getAttribute('data-image-source');
  await page.keyboard.press('Tab');
  await expect(art).toHaveAttribute('data-scene', 'prolog-schlacht');
  await expect(img).toHaveAttribute('data-image-source', '/assets/cut/prolog-hoehle.jpg');
  const secondSource = await img.getAttribute('data-image-source');
  expect(secondSource).not.toBe(firstSource);
  await expect(img).toHaveAttribute('data-image-state', 'loading');
  await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect.poll(() => images.held.has(secondSource!)).toBe(true);
  await screenshot(page, info, 'scene-blurhash-pending');
  await images.release(secondSource!);
  await expect(img).toHaveAttribute('data-image-state', 'ready');
  await expect(img).toHaveAttribute('src', secondSource!);
  // A previous request arriving late must not replace the focused scene's illustration.
  await images.release(firstSource!);
  await expect(art).toHaveAttribute('data-scene', 'prolog-schlacht');
  await expect(img).toHaveAttribute('src', secondSource!);
  expect(await img.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(32);
  await img.evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))); });
  await screenshot(page, info, 'scene-full-art');
});

test('next and previous turns use a two-sided, inaccessible sheet and settle on the target book', async ({ page }, info) => {
  const spread = await openBook(page, { all: true, current: 'prolog-rat' });
  await atBook(spread, 1);
  await spread.locator(':scope > .is-right .chap-turn.is-next').click();
  await expect(spread).toHaveAttribute('data-state', 'turning');
  const leaf = spread.locator('.chap-book-leaf');
  await expect(leaf).toHaveCount(1);
  await expect(leaf).toHaveAttribute('aria-hidden', 'true');
  expect(await leaf.evaluate(node => (node as HTMLElement).inert)).toBe(true);
  const faces = leaf.locator(':scope > .chap-book-face');
  await expect(faces).toHaveCount(2);
  expect(await faces.nth(0).textContent()).not.toBe(await faces.nth(1).textContent());
  await expect(leaf).toHaveCSS('transform-style', 'preserve-3d');
  await expect(faces.nth(0)).toHaveCSS('backface-visibility', 'hidden');
  await expect(faces.nth(1)).toHaveCSS('backface-visibility', 'hidden');
  // Capture a deterministic mid-turn frame without changing the completed target.
  await leaf.evaluate(node => { for (const animation of node.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = Number(animation.effect?.getTiming().duration ?? 0) * .45; } });
  await screenshot(page, info, 'next-sheet-mid-turn');
  await leaf.evaluate(node => { for (const animation of node.getAnimations({ subtree: true })) animation.play(); });
  await atBook(spread, 2);
  await expect(spread.locator(':scope > .is-right .chap-head')).toHaveCount(4);
  await page.keyboard.press('ArrowLeft');
  await expect(spread).toHaveAttribute('data-state', 'turning');
  await expect(spread.locator('.chap-book-leaf')).toHaveCount(1);
  await atBook(spread, 1);
  await expect(spread.locator(':scope > .is-right .chap-head')).toHaveCount(6);
  await screenshot(page, info, 'first-book-settled');
});

test('direction keys do not start concurrent turns, and each public book retains its grouping', async ({ page }) => {
  const spread = await openBook(page, { all: true, current: 'prolog-rat' });
  await page.keyboard.press('ArrowRight');
  await expect(spread).toHaveAttribute('data-state', 'turning');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(spread.locator('.chap-book-leaf')).toHaveCount(1);
  await atBook(spread, 2);
  await expect(spread.locator(':scope > .is-right .chap-head')).toHaveCount(4);
  await page.keyboard.press('ArrowRight');
  await atBook(spread, 3);
  await expect(spread.locator(':scope > .is-right .chap-head')).toHaveCount(6);
  await expect(spread.locator(':scope > .is-right .chap-turn.is-next')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await atBook(spread, 3);
  await page.keyboard.press('ArrowLeft');
  await atBook(spread, 2);
});

test('Enter repeatedly toggles the selected chapter head while retaining its group cover', async ({ page }) => {
  const spread = await openBook(page, { reached: ['prolog-rat', 'prolog-schlacht'], current: 'prolog-rat', reduced: true });
  const head = spread.locator(':scope > .is-right .chap-head').filter({ hasText: 'Die Urmacht' });
  await head.focus();
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Enter');
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await expect(spread.locator(':scope > .is-right .chap-scene')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await expect(head).toHaveClass(/is-sel/);
  await expect(spread.locator(':scope > .is-left .chap-art')).not.toHaveAttribute('data-scene', /.+/);
  await expect(spread.locator(':scope > .is-left .chap-art-img')).toHaveAttribute('data-image-source', '/assets/cut/chap-prolog.jpg');
  await page.keyboard.press('Enter');
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await expect(spread.locator(':scope > .is-right .chap-scene')).toHaveCount(0);
  await expect(spread).toBeVisible();
});

for (const reduction of ['game-setting', 'system-preference'] as const) {
  test(`reduced motion through ${reduction} turns immediately without a 3D sheet`, async ({ page }, info) => {
    if (reduction === 'system-preference') await page.emulateMedia({ reducedMotion: 'reduce' });
    const spread = await openBook(page, { all: true, current: 'prolog-rat', reduced: reduction === 'game-setting' });
    await page.keyboard.press('ArrowRight');
    await atBook(spread, 2);
    await page.keyboard.press('ArrowLeft');
    await atBook(spread, 1);
    await screenshot(page, info, `reduced-${reduction}`);
  });
}

test('chapter choice still requires a second activation before replacing a saved game', async ({ page }) => {
  const spread = await openBook(page, { reached: ['prolog-rat', 'prolog-schlacht'], current: 'prolog-rat', reduced: true });
  const row = spread.locator(':scope > .is-right .chap-scene:not(.is-locked)').nth(1);
  await row.click();
  await expect(row).toHaveClass(/is-confirm/);
  await expect(row.locator('.chap-warn')).toContainText('Spielstand wird überschrieben');
  await expect(spread).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('selantis.save.v1')!).scene)).toBe('prolog-rat');
  await row.click();
  await page.waitForFunction(() => (window as any).G?.currentScene === 'prolog-schlacht');
});

test('the title cheat still unlocks every grouped book and chooses the latest reached section', async ({ page }) => {
  const spread = await openBook(page, { reduced: true });
  await atBook(spread, 1);
  await expect(spread.locator(':scope > .is-right .chap-head.is-locked')).toHaveCount(6);
  await expect(spread.locator(':scope > .is-left .chap-art-img')).not.toHaveAttribute('src', /.+/);
  await page.keyboard.press('Escape');
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) await page.keyboard.press(key);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('selantis.progress.v1') ?? '{}').all)).toBe(true);
  await page.getByRole('button', { name: 'Kapitel', exact: true }).click();
  await atBook(spread, 3);
  await expect(spread.locator(':scope > .is-right .chap-head.is-locked')).toHaveCount(0);
  await expect(spread.locator(':scope > .is-right .chap-head.is-open')).toContainText('Hüterin');
  await page.keyboard.press('ArrowLeft');
  await atBook(spread, 2);
  await expect(spread.locator(':scope > .is-right .chap-head.is-locked')).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  await atBook(spread, 1);
  await expect(spread.locator(':scope > .is-right .chap-head.is-locked')).toHaveCount(0);
});

test('the filtered compact debug select remains a flat, complete scene list', async ({ page }) => {
  await openBook(page, { reduced: true });
  await page.evaluate(async () => {
    const source = '/src/ui/chapters.ts';
    const { buildChapterSelect } = await import(/* @vite-ignore */ source);
    const host = document.createElement('div');
    host.id = 'chapter-book-compact-test';
    host.style.cssText = 'position:fixed;inset:1rem;background:#17202f;padding:1rem;z-index:9999;overflow:auto;pointer-events:auto';
    document.body.append(host);
    buildChapterSelect(host, { compact: true, includeHidden: true, filter: 'e2-urmacht', onPick: (id: string) => { (window as any).__chapterBookPick = id; } });
  });
  const host = page.locator('#chapter-book-compact-test');
  await expect(host.locator('.chap-spread')).toHaveCount(0);
  await expect(host.locator('.chap-list.is-compact')).toHaveCount(1);
  await expect(host.locator('.chap-scene')).toHaveCount(1);
  await expect(host.locator('.chap-scene-id')).toHaveText('e2-urmacht');
  await host.locator('.chap-scene').click();
  await expect.poll(() => page.evaluate(() => (window as any).__chapterBookPick)).toBe('e2-urmacht');
});

test.describe('touch chapter book', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('portrait pages stay inside the viewport and turn in both directions', async ({ page }, info) => {
    const spread = await openBook(page, { all: true, current: 'prolog-rat' });
    const bounds = await spread.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845);
    await screenshot(page, info, 'phone-first-book');
    await spread.locator(':scope > .is-right .chap-turn.is-next').tap();
    await atBook(spread, 2);
    await expect(spread.locator(':scope > .is-right .chap-head')).toHaveCount(4);
    await screenshot(page, info, 'phone-second-book');
    await spread.locator(':scope > .is-left .chap-turn.is-prev').tap();
    await atBook(spread, 1);
    await expect(spread.locator(':scope > .is-right .chap-head')).toHaveCount(6);
  });
});
