import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Math: { Between: (min: number) => min } } }));
vi.mock("../../app/audio", () => ({ sfx: { bird: vi.fn() } }));
import { Critter } from "./critters";

function harness() {
  const callbacks = new Map<string, (() => void)[]>();
  const events = {
    once: (event: string, callback: () => void) => callbacks.set(event, [...callbacks.get(event) ?? [], callback]),
    off: (event: string, callback: () => void) => callbacks.set(event, (callbacks.get(event) ?? []).filter(entry => entry !== callback)),
  };
  const sprite: any = { x: 20, y: 20 };
  for (const name of ['setOrigin', 'setVisible', 'setPosition', 'setFlipX', 'setDepth']) sprite[name] = vi.fn(() => sprite);
  const timers: Array<{ callback: () => void; remove: ReturnType<typeof vi.fn> }> = [];
  const tweens: Array<{ config: any; remove: ReturnType<typeof vi.fn> }> = [];
  const scene: any = { events, add: { sprite: () => sprite }, anims: { exists: () => false },
    time: { delayedCall: (_delay: number, callback: () => void) => { const timer = { callback, remove: vi.fn() }; timers.push(timer); return timer; } },
    tweens: { add: (config: any) => { const tween = { config, remove: vi.fn() }; tweens.push(tween); return tween; } },
  };
  const critter: any = new Critter(scene, { kind: 'bird', at: [20, 20] }, () => true);
  const shutdown = () => [...callbacks.get('shutdown') ?? []].forEach(callback => callback());
  return { critter, sprite, timers, tweens, shutdown };
}

describe('animal lifetime', () => {
  it('cancels a returning bird timer and ignores a stale callback after leaving the map', () => {
    const { critter, sprite, timers, tweens, shutdown } = harness();
    critter.flyAway({ x: 10, y: 20 }); tweens[0].config.onComplete();
    expect(timers).toHaveLength(1); shutdown(); shutdown();
    expect(timers[0].remove).toHaveBeenCalledExactlyOnceWith(false);
    sprite.setPosition.mockClear(); timers[0].callback();
    expect(sprite.setPosition).not.toHaveBeenCalled(); expect(critter.mode).toBe('gone');
  });

  it('removes active flight tweens and rejects their stale completion before any return is scheduled', () => {
    const { critter, timers, tweens, shutdown } = harness();
    critter.flyAway({ x: 10, y: 20 }); shutdown();
    expect(tweens[0].remove).toHaveBeenCalledOnce(); tweens[0].config.onComplete();
    expect(timers).toHaveLength(0);
  });
});
