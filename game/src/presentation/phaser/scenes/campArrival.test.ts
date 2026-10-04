import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));
vi.mock("../../../app/audio", () => ({ setSceneMusic: vi.fn(), sfx: { select: vi.fn() } }));
import { JourneyScene } from "./JourneyScene";
import { updateSettings } from "../../../app/settings";

function road() {
  const scene: any = new JourneyScene();
  const world: any = { flags: { streamVisited: true, journeyEastChosen: true }, inv: {} };
  scene.registry = { get: () => world };
  scene.data = { set: vi.fn() };
  scene.events = { once: vi.fn() };
  for (const method of ['setObjective', 'setSpots', 'setLocked', 'setCinematic', 'showCloseup', 'hideCloseup', 'setCloseupText', 'setCloseupContinue', 'say']) {
    scene[method] = vi.fn();
  }
  const veil: any = { destroy: vi.fn() };
  for (const method of ['setDepth', 'setScrollFactor', 'setAlpha', 'setOrigin']) veil[method] = vi.fn(() => veil);
  scene.add = { rectangle: vi.fn(() => veil) };
  scene.tweens = { add: vi.fn() };
  scene.time = { delayedCall: vi.fn() };
  scene.enterCamp = vi.fn(() => { world.flags.journeyCampReached = true; });
  scene.roadSpots();
  const east = scene.setSpots.mock.lastCall[0].find((spot: any) => spot.id === 'east');
  const advance = () => scene.setCloseupContinue.mock.lastCall[0]();
  return { scene, world, veil, east, advance };
}

beforeEach(() => updateSettings({ reducedMotion: false }));

describe('reader-controlled arrival at the first camp', () => {
  it('holds the road at an evening narration until the reader continues', () => {
    const { scene, world, east } = road();
    east.onUse();
    expect(scene.campDeparturePending).toBe(true);
    expect(scene.setLocked).toHaveBeenLastCalledWith(true);
    expect(scene.enterCamp).not.toHaveBeenCalled();
    expect(world.flags.journeyCampReached).toBeUndefined();
    const narration = scene.setCloseupText.mock.lastCall[0] as string;
    expect(narration).toMatch(/Abend|Sonne|dämmer/i);
    expect(narration).toMatch(/müde/i);
    expect(narration).toMatch(/Lager/i);
    expect(scene.setCloseupContinue.mock.lastCall[0]).toBeTypeOf('function');
    expect(scene.tweens.add).not.toHaveBeenCalled();
    expect(scene.time.delayedCall).not.toHaveBeenCalled();
  });

  it('fades into camp once even if the arrival or continue input repeats', () => {
    const { scene, world, veil, east, advance } = road();
    east.onUse();
    const continueReading = scene.setCloseupContinue.mock.lastCall[0];
    east.onUse();
    expect(scene.setCloseupText).toHaveBeenCalledTimes(1);
    advance();
    continueReading();
    expect(scene.tweens.add).toHaveBeenCalledTimes(1);
    expect(scene.enterCamp).not.toHaveBeenCalled();
    expect(world.flags.journeyCampReached).toBeUndefined();
    const fadeOut = scene.tweens.add.mock.calls[0][0];
    expect(fadeOut.targets).toBe(veil);
    expect(fadeOut.alpha).toBe(1);
    expect(fadeOut.duration).toBeGreaterThan(0);
    fadeOut.onComplete();
    expect(scene.enterCamp).toHaveBeenCalledTimes(1);
    expect(world.flags.journeyCampReached).toBe(true);
    expect(scene.tweens.add).toHaveBeenCalledTimes(2);
    const fadeIn = scene.tweens.add.mock.calls[1][0];
    expect(fadeIn.targets).toBe(veil);
    expect(fadeIn.alpha).toBe(0);
    fadeIn.onComplete();
    expect(veil.destroy).toHaveBeenCalledTimes(1);
  });

  it('removes fade duration with reduced motion while keeping narration reader-controlled', () => {
    updateSettings({ reducedMotion: true });
    const { scene, world, east, advance } = road();
    east.onUse();
    expect(scene.enterCamp).not.toHaveBeenCalled();
    expect(world.flags.journeyCampReached).toBeUndefined();
    expect(scene.tweens.add).not.toHaveBeenCalled();
    advance();
    const fadeOut = scene.tweens.add.mock.calls[0][0];
    expect(fadeOut.duration).toBe(0);
    fadeOut.onComplete();
    expect(scene.enterCamp).toHaveBeenCalledTimes(1);
    expect(scene.tweens.add.mock.calls[1][0].duration).toBe(0);
  });
});
