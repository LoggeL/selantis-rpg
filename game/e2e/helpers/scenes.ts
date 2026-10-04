import type { Page } from '@playwright/test';

/** Wait for actual shutdown/preload/create, including same-instance revisits. */
export async function restartScene(page: Page, key: string, data?: Record<string, unknown>): Promise<void> {
  await page.evaluate(({ key, data }) => new Promise<void>(resolve => {
    const scene = (window as any).game.scene.getScene(key);
    scene.events.once('create', () => resolve());
    scene.scene.restart(data);
  }), { key, data });
}
