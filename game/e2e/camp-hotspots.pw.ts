import { expect, test, type Page } from '@playwright/test';
import { campSpot } from './helpers/camp-controls';

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const game = (window as any).game, scene = game.scene.getScene('journey');
    return { step: scene.campStep, x: scene.lia.x, y: scene.lia.y, thought: scene.data.get('mobile:thought'),
      markers: scene.markers.map((marker: any) => ({ id: marker.spot.id, visible: marker.object.visible,
        alpha: marker.object.alpha, blocked: marker.object.list[2].visible })),
      world: game.registry.get('world'), destination: scene.destination ?? null };
  });
}

for (const layout of [
  { name: 'mouse', width: 1280, height: 800, touch: false },
  { name: 'touch', width: 390, height: 844, touch: true },
]) {
  test.describe(`camp hotspot ${layout.name}`, () => {
    test.use({ viewport: { width: layout.width, height: layout.height }, hasTouch: layout.touch });
    test('explains blocked actions and walks to each newly unlocked preparation', async ({ page }) => {
      test.setTimeout(60_000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
      await page.goto('/');
      await page.waitForFunction(() => (window as any).game?.scene?.isActive('title'));
      await page.getByRole('button', { name: 'Debug · Playtest' }).click();
      await page.getByLabel('Einstieg').selectOption('camp');
      await page.getByRole('button', { name: 'Zum Einstieg' }).click();
      await page.waitForFunction(() => (window as any).game?.scene?.isActive('journey'));
      await expect.poll(async () => (await snapshot(page)).step).toBe('cloak');

      const clickSpot = (id: string) => campSpot(page, id, layout.touch);
      const initial = await snapshot(page);
      for (const [id, hint] of [['stones', 'Regenmantel'], ['twigs', 'Regenmantel'], ['fire', 'Regenmantel'],
        ['fire-seat', 'Lagerfeuer brennen'], ['star', 'Nachtlager vorbereiten']]) {
        expect(initial.markers.find((marker: any) => marker.id === id)).toMatchObject({ visible: true, alpha: 0.42, blocked: true });
        await clickSpot(id);
        await expect.poll(async () => (await snapshot(page)).thought).toContain(hint);
        const after = await snapshot(page);
        expect(after).toMatchObject({ step: 'cloak', x: initial.x, y: initial.y, destination: null });
        expect(after.world).toEqual(initial.world);
      }
      for (const [id, next] of [['bedroll', 'stones'], ['stones', 'ring'], ['fire', 'twigs'], ['twigs', 'fire']]) {
        const before = await snapshot(page);
        expect(before.markers.find((marker: any) => marker.id === id)).toMatchObject({ visible: true, alpha: 1, blocked: false });
        await clickSpot(id);
        await expect.poll(async () => (await snapshot(page)).step, { timeout: 12_000 }).toBe(next);
        const after = await snapshot(page);
        expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(20);
        if (id === 'stones' || id === 'twigs') expect(after.markers.find((marker: any) => marker.id === id)?.visible).toBe(false);
      }
      expect(errors).toEqual([]);
    });

    test('optional activities remain reachable from the restored camp', async ({ page }) => {
      test.setTimeout(45_000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:\d+\/.*/, socket => socket.close());
      await page.goto('/?scene=strangers');
      await page.waitForFunction(() => {
        const scene = (window as any).game?.scene?.getScene('journey');
        return scene?.sys.isActive() && scene.campStep === 'star' && !scene.locked;
      });
      const clickSpot = (id: string) => campSpot(page, id, layout.touch);
      await clickSpot('foltan');
      await page.waitForFunction(() => (window as any).game.scene.getScene('journey').campConversationActive);
      if (layout.touch) await page.locator('.mobile-action[data-key="ESC"]').tap();
      else await page.keyboard.press('Escape');
      await page.waitForFunction(() => !(window as any).game.scene.getScene('journey').campConversationActive);
      await clickSpot('azar');
      await page.waitForFunction(() => (window as any).game.scene.getScene('journey').areaRoot.list.some((object: any) => object.active && object.text === 'Zzzzz'));
      await clickSpot('fire-seat');
      await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:camp-seated'));
      await clickSpot('fire');
      await expect.poll(async () => (await snapshot(page)).thought).toContain('Glut');
      await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('journey').data.get('story:camp-seated'))).toBe(false);
      await clickSpot('road');
      await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('journey').data.get('story:journey-beat')), { timeout: 12_000 }).toBe('first-journey/stayInCamp');
      await clickSpot('star');
      await page.waitForFunction(() => (window as any).game.scene.getScene('journey').data.get('story:star-reflection')?.active);
      expect(errors).toEqual([]);
    });
  });
}
