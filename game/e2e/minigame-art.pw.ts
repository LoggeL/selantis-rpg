import { expect, test, type Page } from '@playwright/test';
import { disableReloads } from './noReloads';
import { completeSceneAction } from './sceneActions';

test.use({ viewport: { width: 1280, height: 720 } });
test.beforeEach(async ({ page }) => disableReloads(page));

async function open(page: Page, kind: string) {
  await page.goto(`/?scene=interaction-demo&kind=${kind}`);
  await expect(page.getByRole('combobox', { name: 'Minispiel wählen' })).toBeVisible();
}

test('all previews load their distinct artwork and the selector keeps every game reachable', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  let forgeLoaded = false;
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => {
    if (r.status() >= 400 && r.url().includes('/assets/')) errors.push(`${r.status()} ${r.url()}`);
    if (r.url().endsWith('/assets/bg/minigame-forge.png') && r.ok()) forgeLoaded = true;
  });
  await open(page, 'cover');
  for (const kind of ['cover', 'duck', 'listen', 'reach', 'lift', 'open-eyes', 'tend', 'bellows', 'stake', 'fire']) {
    if (kind !== 'cover') await page.getByRole('combobox', { name: 'Minispiel wählen' }).selectOption(kind);
    await expect(page.getByRole('combobox', { name: 'Minispiel wählen' })).toHaveValue(kind);
    if (['cover', 'duck', 'listen'].includes(kind)) {
      await expect(page.locator('.action-stage')).toHaveAttribute('data-assets', 'ready');
      await expect(page.locator('.action-stage')).toHaveAttribute('data-character', kind === 'listen' ? 'lia-cloak' : 'lia');
      await expect(page.locator('.stealth-canvas')).toBeVisible();
    } else if (kind !== 'fire') {
      await expect(page.locator('.has-mini-art')).toHaveAttribute('data-art', 'ready');
      await expect(page.locator('.mini-illustration')).toBeVisible();
    } else await expect(page.locator('.k2-feuer')).toBeVisible();
  }
  expect(errors).toEqual([]);
  expect(forgeLoaded).toBe(true);
});

test('Lia walks into actual foreground cover and crouches there', async ({ page }) => {
  await open(page, 'cover');
  const stage = page.locator('.action-stage');
  await expect(stage).toHaveAttribute('data-assets', 'ready');
  await page.getByRole('button', { name: 'Bereit', exact: true }).click();
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(340); await page.keyboard.up('ArrowLeft');
  await expect(stage).toHaveAttribute('data-hidden', 'true');
  await expect(stage).toHaveAttribute('data-pose', 'crouch');
  await completeSceneAction(page);
  await page.waitForFunction(() => (window as any).G.state.is('demo-interaction-done'));
});

test('the illustrated ember game still responds to airflow and ignites', async ({ page }) => {
  await open(page, 'blow');
  await expect(page.locator('.has-mini-art')).toHaveAttribute('data-art', 'ready');
  for (let i = 0; i < 200; i++) {
    const state = await page.locator('.k3-blow').evaluateAll(nodes => {
      const root = nodes[0] as HTMLElement | undefined;
      return root ? { breath: Number(root.dataset.breath), lo: Number(root.dataset.lo), hi: Number(root.dataset.hi) } : null;
    });
    if (!state) break;
    const middle = (state.lo + state.hi) / 2;
    if (Math.abs(state.breath - middle) > 0.07) await page.keyboard.press(state.breath < middle ? 'ArrowRight' : 'ArrowLeft');
    await page.waitForTimeout(60);
  }
  await page.waitForFunction(() => (window as any).G.state.is('demo-interaction-done'));
});

test('Kyra frees the painted stake on the drum beats', async ({ page }) => {
  await open(page, 'stake');
  await expect(page.locator('.has-mini-art')).toHaveAttribute('data-art', 'ready');
  let pressed = 0;
  for (let i = 0; i < 400; i++) {
    const state = await page.locator('.k3-stake').evaluateAll(nodes => {
      const root = nodes[0] as HTMLElement | undefined;
      return root ? { next: Number(root.dataset.next), now: performance.now(), rest: root.dataset.rest === '1', watch: root.dataset.watch === '1' } : null;
    });
    if (!state) break;
    if (!state.rest && !state.watch && state.next !== pressed && state.next - state.now < 100 && state.next - state.now > 15) {
      await page.keyboard.press('e'); pressed = state.next;
    }
    await page.waitForTimeout(35);
  }
  await page.waitForFunction(() => (window as any).G.state.is('demo-interaction-done'));
});
