import { expect, test } from '@playwright/test';

test('pause holds actual recorded speech and word reveal, then resumes the same take', async ({ page }) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    localStorage.setItem('selantis.settings.v1', JSON.stringify({ textSpeed: 45, reducedMotion: true, music: 0, sfx: 0, voice: .9 }));
  });
  await page.goto('/?scene=prolog-zuflucht');
  await page.mouse.click(4, 4);
  const audio = page.locator('audio[data-recorded-voice]');
  await page.waitForFunction(() => {
    const a = document.querySelector<HTMLAudioElement>('audio[data-recorded-voice]');
    return a && !a.paused && a.currentTime > .05;
  });
  const source = await audio.getAttribute('src');
  expect(source).toMatch(/^\/audio\/prolog\/.*\.mp3\?v=[a-f0-9]{64}$/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Pause', exact: true })).toBeVisible();
  const snapshot = () => page.evaluate(() => {
    const a = document.querySelector<HTMLAudioElement>('audio[data-recorded-voice]')!;
    return { time: a.currentTime, paused: a.paused, revealed: [...document.querySelectorAll('.tc.on')].map(e => e.textContent).join('') };
  });
  const before = await snapshot();
  expect(before.paused).toBe(true);
  // Longer than the take plus its load watchdog, without simulating any media events.
  await page.waitForTimeout(20000);
  expect(await audio.getAttribute('src')).toBe(source);
  expect(await snapshot()).toEqual(before);
  await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
  await page.waitForFunction(time => {
    const a = document.querySelector<HTMLAudioElement>('audio[data-recorded-voice]');
    return a && !a.paused && a.currentTime > time + .1;
  }, before.time);
  expect(await audio.getAttribute('src')).toBe(source);
  await page.waitForFunction(() => !document.querySelector('audio[data-recorded-voice]'));
  await expect(page.locator('.tc:not(.on)')).toHaveCount(0);
});
