import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
it('defaults existing saved settings to audible speech and persists the independent voice slider', async () => {
  const storage = { getItem: vi.fn(() => '{"music":0.2,"sfx":0.3}'), setItem: vi.fn() };
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
  const { settings, updateSettings } = await import('../core/settings');
  expect(settings.voice).toBe(.9);
  updateSettings({ voice: .4 });
  expect(settings.music).toBe(.2);
  expect(settings.sfx).toBe(.3);
  expect(JSON.parse(storage.setItem.mock.calls[0][1]).voice).toBe(.4);
});
it('clamps invalid saved voice settings', async () => {
  vi.stubGlobal('localStorage', { getItem: () => '{"voice":5}' });
  vi.resetModules();
  expect((await import('../core/settings')).settings.voice).toBe(1);
});
