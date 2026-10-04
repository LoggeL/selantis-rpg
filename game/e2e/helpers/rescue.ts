import { expect, type Page } from '@playwright/test';

export async function rescueSnapshot(page: Page) {
  return page.evaluate(() => (window as any).game.registry.get('rescue:state'));
}
export async function waitForRescue(page: Page) {
  await page.waitForFunction(() => {
    const game = (window as any).game;
    return game?.scene.isActive('rescue-battle') && game.registry.get('rescue:state')?.phase === 'player';
  });
}
async function field(page: Page, x: number, y: number, touch: boolean) {
  if (touch) {
    const current = await page.evaluate(() => (window as any).game.scene.getScene('rescue-battle').data.get('rescue:cursor'));
    for (let i = current.x; i < x; i++) await page.getByRole('button', { name: 'Nach rechts', exact: true }).click();
    for (let i = current.x; i > x; i--) await page.getByRole('button', { name: 'Nach links', exact: true }).click();
    for (let i = current.y; i < y; i++) await page.getByRole('button', { name: 'Nach unten', exact: true }).click();
    for (let i = current.y; i > y; i--) await page.getByRole('button', { name: 'Nach oben', exact: true }).click();
    await page.getByRole('button', { name: 'Feld wählen', exact: true }).click();
  } else {
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.click(box!.x + (40 + x * 40) / 640 * box!.width, box!.y + (106 + y * 40) / 360 * box!.height);
  }
  await page.waitForFunction(() => !(window as any).game.scene.getScene('rescue-battle').data.get('rescue:animating'));
}
export async function rescueField(page: Page, x: number, y: number, touch = false) { await field(page, x, y, touch); }
export async function selectRescueAlly(page: Page, id: 'lia' | 'flick') {
  if ((await rescueSnapshot(page)).selected !== id) await page.getByRole('button', { name: `${id === 'lia' ? 'Lia' : 'Flick'} wählen`, exact: true }).click();
}
export async function rescueRound(page: Page, phase: 'player' | 'failed' | 'won' = 'player') {
  await page.getByRole('button', { name: 'Runde beenden', exact: true }).click();
  await expect.poll(async () => (await rescueSnapshot(page)).phase).toBe('enemy');
  await expect.poll(async () => (await rescueSnapshot(page)).phase).toBe(phase);
}
/** All commands are real UI actions; registry access is read-only observation. */
export async function winRescue(page: Page, options: { touch?: boolean; onRound?: (snapshot: any) => Promise<void> } = {}) {
  const touch = options.touch ?? false;
  await waitForRescue(page);
  await selectRescueAlly(page, 'lia'); await field(page, 4, 3, touch); await field(page, 6, 3, touch);
  await selectRescueAlly(page, 'flick'); await field(page, 7, 1, touch);
  await rescueRound(page); await options.onRound?.(await rescueSnapshot(page));
  await selectRescueAlly(page, 'lia'); await field(page, 6, 2, touch); await field(page, 7, 1, touch);
  await selectRescueAlly(page, 'flick'); await field(page, 8, 0, touch); await field(page, 7, 3, touch);
  await rescueRound(page); await options.onRound?.(await rescueSnapshot(page));
  await selectRescueAlly(page, 'lia'); await field(page, 6, 1, touch);
  await page.getByRole('button', { name: 'Decken', exact: true }).click();
  await selectRescueAlly(page, 'flick'); await field(page, 8, 1, touch); await field(page, 6, 3, touch);
  await rescueRound(page, 'won'); await options.onRound?.(await rescueSnapshot(page));
}
export async function returnFromRescue(page: Page) {
  await page.getByRole('button', { name: 'Geschichte fortsetzen', exact: true }).click();
  await page.waitForFunction(() => !(window as any).game.scene.isActive('rescue-battle'));
}
