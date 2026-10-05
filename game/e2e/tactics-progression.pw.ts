import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page, id?: string) => {
  await page.waitForFunction(id => {
    const t = (window as any).__tactics;
    return t?.ready && t.ctrl.inputEnabled() && t.animating === 0 && (!id || t.ctrl.battle.activeUnit === id);
  }, id, { timeout: 30000 });
};
async function boot(page: Page): Promise<void> {
  await page.goto('/?scene=tactics-sandbox');
  await ready(page, 'flick');
}
async function hoverUnit(page: Page, id: string): Promise<void> {
  await page.waitForFunction(() => !(window as any).__tactics.cameras.main.panEffect.isRunning);
  const p = await page.evaluate(id => (window as any).__tactics.debugPage(id), id);
  await page.mouse.move(p.x, p.y);
}

for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
  test(`stats, equipment, hover and paired forecast at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize(viewport);
    await boot(page);
    const card = page.locator('.tac-card');
    await expect(card).toContainText('HP'); await expect(card).toContainText('MP');
    await expect(card).toContainText('Lvl'); await expect(card).toContainText('Exp');
    await page.getByRole('button', { name: 'Jagdmesser', exact: true }).click();
    await expect(card.locator('button[data-ab="bogen"]')).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('button', { name: 'Jagdbogen', exact: true }).click();
    await expect(card.locator('button[data-ab="bogen"]')).not.toHaveAttribute('aria-disabled', 'true');
    await hoverUnit(page, 's-north');
    await expect(page.locator('.tac-tcard:not(.hidden)')).toContainText('HP');
    await expect(page.locator('.tac-tcard:not(.hidden)')).toContainText('MP');
    await expect(page.locator('.tac-tcard:not(.hidden)')).toContainText('Tempo');
    await page.locator('.tac-endturn').click();
    await ready(page, 'valentus');
    await page.locator('.tac-card button[data-ab="handstoss"]').click();
    await hoverUnit(page, 's-south');
    const forecast = page.locator('.tac-tcard.forecast:not(.hidden)');
    await expect(forecast.locator('.tac-combatant')).toHaveCount(2);
    await expect(forecast).toContainText('Treffer'); await expect(forecast).toContainText('Schaden');
    const sides = await forecast.locator('.tac-combatant').evaluateAll(es => es.map(e => e.getBoundingClientRect().toJSON()));
    expect(sides[0].right).toBeLessThan(sides[1].left);
    expect(sides[0].top).toBeCloseTo(sides[1].top, 0);
    const root = await page.locator('.tac').boundingBox();
    await expect.poll(async () => {
      const box = await forecast.boundingBox();
      return box ? box.x + box.width : Infinity;
    }).toBeLessThanOrEqual(root!.x + root!.width + 1);
    const box = await forecast.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(root!.x);
    await page.screenshot({ path: `../output/references/ffta/selantis-forecast-${viewport.width}.png` });
    // Executing the preview consumes the action and grants one reward.
    const before = await page.evaluate(() => {
      const b = (window as any).__tactics.ctrl.battle; return { exp: b.unit('valentus').exp, target: b.unit('s-south').hp };
    });
    const target = await page.evaluate(() => (window as any).__tactics.debugPage('s-south'));
    await page.mouse.click(target.x, target.y);
    await page.waitForFunction(() => (window as any).__tactics.ctrl.battle.unit('valentus').acted);
    await page.waitForFunction(() => (window as any).__tactics.animating === 0);
    const after = await page.evaluate(() => {
      const b = (window as any).__tactics.ctrl.battle; return { exp: b.unit('valentus').exp, target: b.unit('s-south').hp };
    });
    expect(after.exp).toBeGreaterThan(before.exp); expect(after.target).toBeLessThan(before.target);
    expect(errors).toEqual([]);
  });
}

test('battle panels follow the canvas when resizing during a turn', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 }); await boot(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => {
    const a = await page.locator('.tac').boundingBox(), b = await page.locator('#game canvas').boundingBox();
    return Math.abs(a!.width - b!.width) + Math.abs(a!.height - b!.height) + Math.abs(a!.y - b!.y);
  }).toBeLessThan(2);
});

async function noOverlap(page: Page, panel: string, others: string[]): Promise<void> {
  await expect.poll(() => page.evaluate(({ panel, others }) => {
    const e = document.querySelector<HTMLElement>(panel);
    if (!e) return ['missing panel'];
    const a = e.getBoundingClientRect();
    return others.flatMap(selector => Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter(o => !o.classList.contains('hidden') && getComputedStyle(o).visibility !== 'hidden' && getComputedStyle(o).display !== 'none')
      .filter(o => { const b = o.getBoundingClientRect(); return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1; })
      .map(o => o.className));
  }, { panel, others })).toEqual([]);
}

for (const viewport of [{ width: 1280, height: 720 }, { width: 771, height: 880 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
  test(`hints, ability tooltips and Escape remain clear at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize(viewport); await boot(page);
    await expect(page.getByRole('button', { name: 'Menü', exact: true })).not.toHaveAttribute('title');
    await noOverlap(page, '.tac-rot', ['.hud-btn-menu', '.hud-btn-menu .hud-btn-key', '.tac-phase', '.tac-order']);
    await noOverlap(page, '.tac-obj', ['.tac-phase', '.tac-order']);
    const ability = page.locator('.tac-card button[data-ab="bogen"]');
    await ability.hover();
    await expect(page.locator('.tac-tip')).toBeVisible();
    await noOverlap(page, '.tac-tip', ['.tac-card', '.tac-menu', '.tac-obj', '.tac-phase', '.tac-order', '.tac-rot', '.tac-end', '.hud-btn-menu']);
    await ability.click();
    await expect(page.locator('.tac-tip')).toBeHidden();
    await page.keyboard.press('Escape');
    await ability.hover();
    await page.getByRole('button', { name: 'Menü', exact: true }).click();
    await expect(page.locator('.tac-tip')).toBeHidden();
    await page.keyboard.press('Escape');

    // Exercise a long tutorial through the same hook interface used by story battles.
    await page.evaluate(() => {
      void (window as any).__tactics.ctrl.ctx.hint('Das Tempo bestimmt die Zugreihenfolge. Wähle eine Fähigkeit und fahre über ein Ziel, um Trefferchance und Schaden zu sehen. Jede Figur darf einmal bewegen und einmal handeln. Beende danach ihren Zug.', { title: 'Zugreihenfolge' });
    });
    await expect(page.locator('.tac-hint')).toBeVisible();
    await noOverlap(page, '.tac-hint', ['.tac-obj', '.tac-phase', '.tac-order', '.tac-rot', '.tac-end', '.tac-menu', '.hud-btn-menu']);
    if (!(await page.locator('.tac-menu button[data-ab="bogen"]').count())) await page.locator('.tac-menu button[data-m="act"]').click();
    await noOverlap(page, '.tac-menu', ['.tac-hint', '.tac-obj', '.tac-phase', '.tac-order', '.tac-rot', '.tac-end', '.hud-btn-menu']);
    await page.locator('.tac-menu button[data-ab="bogen"]').hover();
    await noOverlap(page, '.tac-tip', ['.tac-hint', '.tac-menu', '.tac-obj', '.tac-phase', '.tac-order', '.tac-rot', '.tac-end', '.hud-btn-menu']);
    await page.mouse.move(1, 1);
    await expect(page.locator('.tac-tip')).toBeHidden();
    await expect(page.locator('.tac-hint')).toBeVisible();
    await page.screenshot({ path: `../output/references/ffta/selantis-clear-hints-${viewport.width}.png` });
    await page.locator('.tac-hint button').click();
    await expect(page.locator('.tac-hint')).toBeHidden();
    await expect(page.locator('.tac-card')).toBeVisible();
  });
}
