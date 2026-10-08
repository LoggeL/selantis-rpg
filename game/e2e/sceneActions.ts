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

/**
 * One step in a scene pick (word cards over a scene): continue a shown reply, else pick a card with real keys.
 * `prefer` names card ids to try first (e.g. the right answer); otherwise the first card still open is taken –
 * wrong cards are struck through, so every round ends. Returns false when no scene pick is open.
 */
export async function playScenePick(page: Page, prefer: readonly string[] = []): Promise<boolean> {
  const s = await page.evaluate(prefer => {
    const r = document.querySelector<HTMLElement>('.scene-pick:not(.is-out)');
    if (!r) return null;
    if (r.querySelector('.pick-reply.is-shown')) return { key: 'Enter' };
    if (!r.classList.contains('is-picking')) return { key: '' };
    const cards = [...r.querySelectorAll<HTMLButtonElement>('.pick-card')];
    const open = cards.map((c, i) => ({ id: c.dataset.id!, i, ok: !c.disabled })).filter(c => c.ok);
    const pick = open.find(c => prefer.includes(c.id)) ?? open[0];
    return { key: pick ? String(pick.i + 1) : '' };
  }, [...prefer]);
  if (!s) return false;
  if (s.key) await page.keyboard.press(s.key);
  await page.waitForTimeout(s.key ? 180 : 120);
  return true;
}
