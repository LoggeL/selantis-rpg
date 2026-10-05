import { expect, test, type Page } from '@playwright/test';

async function menuOverlaps(page: Page): Promise<string[]> {
  return page.locator('.tac-menu:not(.hidden)').evaluate(menu => {
    const m = menu.getBoundingClientRect();
    const root = menu.closest('.tac')!;
    const panels = ['.tac-obj', '.tac-phase', '.tac-order', '.tac-card', '.tac-tcard', '.tac-end', '.tac-rot', '.tac-hint'];
    return panels.filter(selector => {
      const panel = root.querySelector<HTMLElement>(selector);
      if (!panel || panel.classList.contains('hidden')) return false;
      const p = panel.getBoundingClientRect();
      if (!p.width || !p.height) return false;
      return Math.min(m.right, p.right) - Math.max(m.left, p.left) > 1
        && Math.min(m.bottom, p.bottom) - Math.max(m.top, p.top) > 1;
    });
  });
}

for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
  test(`demo menus stay clear of text panels at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?scene=tactics-sandbox');
    await page.waitForFunction(() => {
      const scene = (window as any).__tactics;
      return scene?.ready && scene.ctrl.inputEnabled() && scene.animating === 0;
    });
    await page.getByRole('button', { name: 'Flick', exact: true }).click();
    await expect(page.locator('.tac-menu')).toBeVisible();
    await expect.poll(() => menuOverlaps(page)).toEqual([]);
    await page.getByRole('button', { name: /^Handeln(?: 1–4)?$/ }).click();
    await expect(page.locator('.tac-menu .sub')).toBeVisible();
    await expect.poll(() => menuOverlaps(page)).toEqual([]);
  });
}

test('tutorial text stays below the objective after resizing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?scene=prolog-schlacht');
  const hint = page.locator('.tac-hint:not(.hidden)');
  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 24 && !(await hint.isVisible()); i++) {
    if (await dialog.isVisible()) await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
  }
  await expect(hint).toBeVisible();
  const gap = () => page.locator('.tac').evaluate(root => {
    const objective = root.querySelector('.tac-obj')!.getBoundingClientRect();
    const help = root.querySelector('.tac-hint')!.getBoundingClientRect();
    return help.top - objective.bottom;
  });
  await expect.poll(gap).toBeGreaterThanOrEqual(11);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(gap).toBeGreaterThanOrEqual(11);
});
