import type Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installApplicationViewport } from "./viewport";

function fixture() {
  const touch = Object.assign(new EventTarget(), { matches: false });
  const visualViewport = new EventTarget();
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const browser = Object.assign(new EventTarget(), {
    matchMedia: () => touch, visualViewport,
    requestAnimationFrame: (fn: FrameRequestCallback) => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
  });
  const dataset: Record<string, string> = {};
  vi.stubGlobal('window', browser);
  vi.stubGlobal('document', { documentElement: { dataset } });
  const observe = vi.fn(); const disconnect = vi.fn();
  let changed: () => void = () => {};
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { changed = callback; }
    observe = observe; disconnect = disconnect;
  });
  const dimensions = { clientWidth: 1280, clientHeight: 720 };
  const host = dimensions as HTMLElement;
  const controls = {} as HTMLElement;
  const scale = { setZoom: vi.fn(), refresh: vi.fn() };
  const game = { scale } as unknown as Phaser.Game;
  const flush = () => { for (const [id, fn] of [...frames]) { frames.delete(id); fn(0); } };
  return { game, host, dimensions, controls, browser, touch, frames, flush, dataset, scale, observe, disconnect, changed: () => changed() };
}
afterEach(() => vi.unstubAllGlobals());

describe('app viewport lifecycle', () => {
  it('sizes the game and keeps touch mode and action bar sizing current', () => {
    const f = fixture(); const dispose = installApplicationViewport(f.game, f.host, f.controls);
    expect(f.observe.mock.calls.map(([element]) => element)).toEqual([f.host, f.controls]);
    expect(f.dataset.touchEnabled).toBe('false');
    f.flush(); expect(f.scale.setZoom).toHaveBeenLastCalledWith(2);
    f.touch.matches = true; f.touch.dispatchEvent(new Event('change'));
    expect(f.dataset.touchEnabled).toBe('true');
    f.dimensions.clientWidth = 1000; f.dataset.actionBar = 'true'; f.changed();
    f.flush(); expect(f.scale.setZoom).toHaveBeenLastCalledWith(1.5625);
    dispose();
  });

  it('removes listeners and pending frames once, restoring the prior touch attribute', () => {
    const f = fixture(); f.dataset.touchEnabled = 'existing';
    const dispose = installApplicationViewport(f.game, f.host);
    dispose(); dispose();
    f.browser.dispatchEvent(new Event('resize'));
    f.browser.visualViewport.dispatchEvent(new Event('resize'));
    f.touch.dispatchEvent(new Event('change')); f.changed();
    expect(f.frames.size).toBe(0);
    expect(f.disconnect).toHaveBeenCalledOnce();
    expect(f.dataset.touchEnabled).toBe('existing');
    expect(f.scale.refresh).not.toHaveBeenCalled();
  });
});
