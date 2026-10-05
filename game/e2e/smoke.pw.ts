import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke test: the title and every dev demo load at desktop (1280x720) and phone portrait (390x844) size,
 * show their key UI, load their painted assets without 404s and log no console errors.
 *   cd game && npx playwright test          (starts its own dev server, see playwright.config.ts)
 */

type Check = (page: Page) => Promise<void>;

const SCENES: { id: string; title: string; check: Check }[] = [
  {
    id: 'title', title: 'Titel',
    check: async page => {
      await expect(page.getByText('Neues Spiel', { exact: true })).toBeVisible();
      await expect(page.locator('.tb img.is-loaded').first()).toBeAttached({ timeout: 15000 });
    },
  },
  {
    id: 'art-gallery', title: 'Kunstgalerie',
    check: async page => {
      await expect(page.locator('.art-gallery-overlay .tabs button')).toHaveCount(6);
      await page.waitForFunction(() => {
        const s = (window as any).G.game.scene.getScene('ArtGallery');
        return s?.spots?.size > 10;
      });
    },
  },
  {
    id: 'ui-demo', title: 'UI-Vorführung',
    check: async page => { await expect(page.getByText('Der letzte Sommertag').first()).toBeVisible(); },
  },
  {
    id: 'audio-demo', title: 'Klangwerkstatt',
    check: async page => { await expect(page.getByText('Klangwerkstatt').first()).toBeVisible(); },
  },
  {
    id: 'world-demo', title: 'Welt: Wiese',
    check: async page => {
      await waitWorld(page);
      await expect(page.locator('.hud-obj-text')).toContainText('Kyra');
    },
  },
  {
    id: 'world-demo-2', title: 'Welt: Lichtung',
    check: async page => {
      await waitWorld(page);
      await expect(page.locator('.hud-obj-text')).toContainText('Lagerfeuer');
    },
  },
  {
    id: 'world-stress', title: 'Welt: Belastungstest',
    check: async page => {
      await waitWorld(page);
      expect(await page.evaluate(() => (window as any).__world.actors.size)).toBeGreaterThanOrEqual(24);
    },
  },
  { id: 'tactics-demo', title: 'Taktik: Dunkelhain', check: page => waitBattle(page) },
  { id: 'tactics-rescue-demo', title: 'Taktik: Rettung', check: page => waitBattle(page) },
  { id: 'tactics-sandbox', title: 'Taktik: Übungsplatz', check: page => waitBattle(page) },
];

async function waitWorld(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as any).__world?.player), undefined, { timeout: 20000 });
}

async function waitBattle(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as any).__tactics?.ready), undefined, { timeout: 20000 });
  await expect(page.locator('.tac-endturn')).toBeAttached();
}

const SIZES = [
  { name: 'desktop', viewport: { width: 1280, height: 720 }, touch: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
];

/** Software GL in headless Chromium logs driver chatter as warnings/errors; that is not ours. */
const NOISE = /GPU stall|GL Driver Message|Automatic fallback to software WebGL|WebGL.*(performance|software)/i;

for (const size of SIZES) {
  test.describe(`smoke @${size.name}`, () => {
    test.use({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch });

    for (const scene of SCENES) {
      test(`${scene.title} (${scene.id})`, async ({ page }) => {
        const errors: string[] = [];
        page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text()); });
        page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
        page.on('response', r => { if (r.status() >= 400 && /\/assets\/|\/output\//.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`); });

        await page.goto(scene.id === 'title' ? '/' : `/?scene=${scene.id}`);
        if (scene.id !== 'title') await page.waitForFunction(id => (window as any).G?.currentScene === id, scene.id, { timeout: 20000 });
        await scene.check(page);
        await page.waitForTimeout(1500); // let late asset loads and first frames settle
        if (size.touch) await expect(page.locator('.rotate-hint')).toBeVisible();
        expect(errors, errors.join('\n')).toEqual([]);
      });
    }
  });
}

test('painted assets: manifest is complete and every demo character has a walk sheet', async ({ page }) => {
  await page.goto('/?scene=ui-sandbox');
  await page.waitForFunction(() => (window as any).G?.currentScene === 'ui-sandbox');
  const missing = await page.evaluate(() => {
    const G = (window as any).G;
    const need = ['lia', 'kyra', 'kyra-bound', 'flick', 'valentus', 'falke-soldier', 'baris-young', 'shadow-sword', 'shadow-spear', 'shadow-crossbow',
      'villager-m', 'villager-f', 'merchant', 'bard', 'juggler', 'dwarf', 'elf-m', 'elf-f', 'barmaid', 'guard-brotherhood', 'dog', 'chicken'];
    return [
      ...need.filter(id => !G.art.hasAsset('character', id)).map(id => `character ${id}`),
      ...['lia', 'kyra', 'valentus', 'flick'].filter(id => !G.art.hasAsset('portrait', id)).map(id => `portrait ${id}`),
      ...['dev-meadow', 'dev-clearing'].filter(id => !G.art.hasAsset('background', id)).map(id => `background ${id}`),
      ...(G.art.hasAsset('plate', 'wiese-lia-liest') ? [] : ['plate wiese-lia-liest']),
    ];
  });
  expect(missing).toEqual([]);
});
