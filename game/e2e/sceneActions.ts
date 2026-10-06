import type { Page } from '@playwright/test';

/** Plays one beat using the visible cursor/target and real keys. Never edits gameplay state. */
export async function playSceneAction(page: Page): Promise<boolean> {
  const action = await page.locator('.scene-action:not(.is-complete)').evaluateAll(nodes => {
    const r = nodes[0] as HTMLElement | undefined;
    return r ? { kind: r.dataset.kind!, phase: r.dataset.phase, position: Number(r.dataset.position), target: Number(r.dataset.target) } : null;
  });
  if (!action) return false;
  if (action.phase === 'ready') { await page.waitForTimeout(220); await page.keyboard.press('Enter'); return true; }
  const vertical = ['lift', 'open-eyes', 'bellows', 'duck'].includes(action.kind);
  const distance = action.target - action.position;
  if (Math.abs(distance) > 0.035 && action.phase !== 'danger') {
    const key = vertical ? (distance < 0 ? 'ArrowUp' : 'ArrowDown') : (distance < 0 ? 'ArrowLeft' : 'ArrowRight');
    const speed = action.phase ? 0.85 : action.kind === 'bellows' ? 2.8 : 1.05;
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.min(240, Math.max(25, Math.abs(distance) / speed * 1000)));
    await page.keyboard.up(key);
  }
  await page.waitForTimeout(70);
  return true;
}

export async function completeSceneAction(page: Page): Promise<void> {
  const started = Date.now();
  while (await playSceneAction(page)) {
    if (Date.now() - started > 20000) throw new Error('Scene action did not finish with directional inputs');
  }
}
