import type Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock("./audio", () => ({ unlockAudio: vi.fn() }));
import { unlockAudio } from "./audio";
import { startInitialScene } from "./bootstrap";

function fixture() {
  const browser = new EventTarget(); vi.stubGlobal('window', browser);
  const values = new Map<string, unknown>();
  const destroy = new Map<string, () => void>();
  const start = vi.fn();
  const scene = {
    registry: { get: (key: string) => values.get(key), set: (key: string, value: unknown) => values.set(key, value) },
    game: { events: { once: (name: string, fn: () => void) => destroy.set(name, fn), off: (name: string) => destroy.delete(name) } },
    scene: { start },
  } as unknown as Phaser.Scene;
  return { browser, values, destroy, start, scene };
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('initial scene composition', () => {
  it('unknown entry opens title without creating or changing campaign state', () => {
    const f = fixture(); startInitialScene(f.scene, '?scene=missing');
    expect(f.start).toHaveBeenCalledExactlyOnceWith('title', {});
    expect(f.values.size).toBe(0);
    expect(f.destroy.size).toBe(0);
  });

  it('uses canonical equipment and progress for URL checkpoint aliases', () => {
    const f = fixture(); startInitialScene(f.scene, '?scene=strangers');
    expect(f.start).toHaveBeenCalledExactlyOnceWith('journey', {});
    const campaign = f.values.get('world') as { inv: Record<string, number>; flags: Record<string, boolean> };
    expect(campaign.inv).toMatchObject({ proviant: 1, kupfer: 22, silber: 7 });
    expect(campaign.flags).toMatchObject({ departureReady: true, firstCampRested: true, metFoltanAzar: true, criosObserved: false });
  });

  it('unlocks direct entry once and removes both gesture listeners', () => {
    const f = fixture(); startInitialScene(f.scene, '?scene=flight');
    f.browser.dispatchEvent(new Event('pointerdown'));
    f.browser.dispatchEvent(new Event('keydown'));
    expect(unlockAudio).toHaveBeenCalledOnce();
    expect(f.destroy.size).toBe(0);
  });

  it('cleans pending gestures when the game is destroyed', () => {
    const f = fixture(); startInitialScene(f.scene, '?scene=battle');
    f.destroy.get('destroy')?.();
    f.browser.dispatchEvent(new Event('pointerdown'));
    expect(unlockAudio).not.toHaveBeenCalled();
  });
});
