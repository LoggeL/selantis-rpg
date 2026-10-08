import { expect, test, type Page } from '@playwright/test';

/**
 * Input routing between the DOM UI and the gameplay scenes (DESIGN.md §5): overlays lock movement, Esc/Tab/J/I/F1/F2
 * do the right thing in world and battle, and nothing stays locked afterwards.
 */

const visible = (page: Page, sel: string) => page.evaluate(s => {
  const el = document.querySelector(s);
  if (!el) return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && !el.classList.contains('is-closing');
}, sel);
const press = async (page: Page, key: string, ms = 350) => { await page.keyboard.press(key); await page.waitForTimeout(ms); };
const playerPos = (page: Page) => page.evaluate(() => {
  const p = (window as any).__world?.player;
  return p ? [Math.round(p.x), Math.round(p.y)] : null;
});
const busy = (page: Page) => page.evaluate(() => (window as any).G.ui.busy() as boolean);
async function settle(page: Page): Promise<void> {
  for (let i = 0; i < 12 && await busy(page); i++) await press(page, 'Enter', 250);
}

test.use({ viewport: { width: 1280, height: 720 } });

test('world: overlays, debug keys and movement', async ({ page }) => {
  await page.goto('/?scene=world-demo');
  await page.waitForFunction(() => Boolean((window as any).__world?.player), undefined, { timeout: 20000 });
  await page.waitForTimeout(2500);
  await settle(page);

  await press(page, 'j');
  expect(await visible(page, '.journal-ov')).toBe(true);
  const before = await playerPos(page);
  await page.keyboard.down('d'); await page.waitForTimeout(500); await page.keyboard.up('d');
  expect(await playerPos(page)).toEqual(before); // modal UI blocks walking
  await press(page, 'j');
  expect(await visible(page, '.journal-ov')).toBe(false);

  await press(page, 'Tab');
  expect(await visible(page, '.journal-ov')).toBe(true);
  await press(page, 'Escape');
  expect(await visible(page, '.journal-ov')).toBe(false);
  expect(await visible(page, '.menu-ov')).toBe(false);

  await press(page, 'i');
  expect(await visible(page, '.bag-ov')).toBe(true);
  await press(page, 'Escape');
  expect(await visible(page, '.bag-ov')).toBe(false);

  await press(page, 'Escape');
  expect(await visible(page, '.menu-ov')).toBe(true);
  await press(page, 'j');
  expect(await visible(page, '.journal-ov')).toBe(false); // no stacking on top of the menu
  await press(page, 'Escape');
  expect(await visible(page, '.menu-ov')).toBe(false);

  await press(page, 'F1');
  expect(await page.evaluate(() => Boolean(document.getElementById('world-debug')))).toBe(true);
  await press(page, 'F1');
  expect(await page.evaluate(() => Boolean(document.getElementById('world-debug')))).toBe(false);

  await press(page, 'F2');
  expect(await visible(page, '.debug-ov')).toBe(true);
  await press(page, 'F2'); // also works while the filter field has focus
  expect(await visible(page, '.debug-ov')).toBe(false);

  const p1 = await playerPos(page);
  await page.keyboard.down('a'); await page.waitForTimeout(600); await page.keyboard.up('a');
  expect(await playerPos(page)).not.toEqual(p1);
  expect(await busy(page)).toBe(false);
});

test('battle: the active unit stays selected, Esc steps back to its menu before the game menu, J/I/F1 ignored', async ({ page }) => {
  await page.goto('/?scene=tactics-sandbox');
  await page.waitForFunction(() => Boolean((window as any).__tactics?.ready), undefined, { timeout: 20000 });
  await page.waitForTimeout(1500);
  await settle(page);
  await page.waitForFunction(() => (window as any).__tactics.ctrl.inputEnabled(), undefined, { timeout: 15000 });
  const sel = () => page.evaluate(() => (window as any).__tactics?.sel?.unit ?? null);
  const mode = () => page.evaluate(() => (window as any).__tactics?.sel?.mode ?? null);

  // The unit whose turn it is starts selected with its menu open; Tab keeps it.
  const active = await page.evaluate(() => (window as any).__tactics.ctrl.battle.activeUnit);
  expect(await sel()).toBe(active);
  expect(await visible(page, '.tac-menu')).toBe(true);
  await press(page, 'Tab', 500);
  expect(await sel()).toBe(active);
  expect(await visible(page, '.journal-ov')).toBe(false);
  await press(page, 'j');
  await press(page, 'i');
  expect(await visible(page, '.journal-ov')).toBe(false);
  expect(await visible(page, '.bag-ov')).toBe(false);

  await press(page, 'm');
  expect(await mode()).toBe('move');
  await press(page, 'Escape'); // back to the turn menu, never deselected
  expect(await mode()).toBe('none');
  expect(await sel()).toBe(active);
  expect(await visible(page, '.menu-ov')).toBe(false);
  await press(page, 'Escape'); // nothing left to cancel: the game menu opens
  expect(await visible(page, '.menu-ov')).toBe(true);
  expect(await sel()).toBe(active);
  await press(page, 'Escape');
  expect(await visible(page, '.menu-ov')).toBe(false);

  await press(page, 'F1');
  expect(await page.evaluate(() => Boolean(document.getElementById('world-debug')))).toBe(false);
  await press(page, 'Tab', 400);
  expect(await sel()).not.toBeNull();
});

test('leaving the world removes its key listeners (F1 overlay)', async ({ page }) => {
  await page.goto('/?scene=world-demo-2');
  await page.waitForFunction(() => Boolean((window as any).__world?.player), undefined, { timeout: 20000 });
  await page.evaluate(() => (window as any).G.warp('tactics-sandbox'));
  await page.waitForFunction(() => Boolean((window as any).__tactics?.ready), undefined, { timeout: 20000 });
  await press(page, 'F1');
  expect(await page.evaluate(() => Boolean(document.getElementById('world-debug')))).toBe(false);
});

test('warping from one world map to another restarts the world scene cleanly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?scene=world-demo');
  await page.waitForFunction(() => Boolean((window as any).__world?.player), undefined, { timeout: 20000 });
  await page.waitForTimeout(800);
  // Phaser restarts the same WorldScene object; until the new map is built it must not keep the old (destroyed) player.
  const stale = await page.evaluate(async () => {
    const G = (window as any).G;
    void G.warp('world-demo-2');
    const seen: boolean[] = [];
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 25));
      const w = G.game.scene.getScene('World');
      if (w?.sys.settings.status === 5 /* RUNNING */) seen.push(Boolean(w.player) && w.map?.id === 'dev-meadow');
    }
    return seen.some(Boolean);
  });
  expect(stale).toBe(false);
  await page.waitForFunction(() => (window as any).__world?.map?.id === 'dev-clearing' && Boolean((window as any).__world?.player), undefined, { timeout: 20000 });
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});
