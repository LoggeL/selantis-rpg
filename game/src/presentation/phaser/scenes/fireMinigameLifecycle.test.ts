import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));
vi.mock("../../../app/audio", () => ({ setSceneMusic: vi.fn(), sfx: { select: vi.fn() } }));
vi.mock("../FireMinigameUI", () => ({ FireMinigameUI: class {
  update = vi.fn(); result = vi.fn(); destroy = vi.fn();
  constructor(_scene: unknown, public stroke: () => void, public cancel: () => void) {}
} }));
import { JourneyScene } from "./JourneyScene";
import { sceneInput } from "../../../platform/input/router";
import { updateSettings } from "../../../app/settings";

function camp() {
  const scene: any = new JourneyScene();
  const world = { flags: { journeyCloakSpread: true, journeyStonesGathered: true, journeyFirepitBuilt: true, journeyTwigsGathered: true } as Record<string, boolean>, inv: { zunderholz: 2, proviant: 1 } };
  scene.registry = { get: () => world };
  scene.events = { once: vi.fn() };
  scene.data = { set: vi.fn() };
  const removeTimer = vi.fn();
  scene.time = { delayedCall: vi.fn(() => ({ remove: removeTimer })) };
  scene.keys = { E: { isDown: true, on: vi.fn(), off: vi.fn() }, ESC: { isDown: false, on: vi.fn(), off: vi.fn() } };
  scene.inventory = { close: vi.fn() };
  for (const method of ['say', 'setLocked', 'setCinematic', 'campSpots', 'drawFire']) scene[method] = vi.fn();
    scene.lightFire();
  const tick = (delta = 100) => scene.updateFire(delta);
  const waitStroke = () => { for (let i = 0; i < 4; i++) tick(); };
  return { scene, world, tick, waitStroke };
}

beforeEach(() => updateSettings({ reducedMotion: true }));

describe('camp fire interaction and inventory lifecycle', () => {
  it('requires releasing the opening E and a distinct press for each stroke', () => {
    const { scene, world, tick } = camp();
    for (let i = 0; i < 20; i++) tick();
    expect(scene.fireGame.heat).toBe(0);
    expect(world.flags.campfireLit).toBeUndefined();
    const input = sceneInput(scene);
    input.dispatch({ action: 'interact', phase: 'begin', source: 'keyboard', owner: 'keyboard:E' }); tick();
    expect(scene.fireGame.heat).toBe(1);
    for (let i = 0; i < 20; i++) {
      input.dispatch({ action: 'interact', phase: 'begin', source: 'keyboard', owner: 'keyboard:E' }); tick();
    }
    expect(scene.fireGame.heat).toBe(1);
    expect(world.inv.zunderholz).toBe(2);
  });

  it('shares touch strokes with keyboard progress and consumes gathered wood only on success', () => {
    const { scene, world, waitStroke } = camp();
    const ui = scene.fireUI;
    ui.stroke();
    // A repeated pointer event cannot generate another immediate stroke.
    ui.stroke();
    expect(scene.fireGame.heat).toBe(1);
    for (let i = 0; i < 4; i++) { waitStroke(); ui.stroke(); }
    expect(scene.fireGame.heat).toBe(5);
    expect(world.flags.campfireLit).toBeUndefined();
    expect(world.inv.zunderholz).toBe(2);
    waitStroke(); ui.stroke();
    expect(world.flags.campfireLit).toBe(true);
    expect(world.inv.zunderholz).toBe(1);
    expect(world.inv.proviant).toBe(1);
    expect(world.flags.journeyAte).toBeUndefined();
    expect(scene.campStep).toBe('meal');
    expect(ui.destroy).not.toHaveBeenCalled();
    expect(scene.fireBusy).toBe(true);
    expect(scene.time.delayedCall).toHaveBeenLastCalledWith(700, expect.any(Function));
    scene.fireStroke(); scene.lightFire();
    ui.cancel();
    expect(world.inv.zunderholz).toBe(1);
    expect(scene.fireBusy).toBe(true);
    scene.time.delayedCall.mock.lastCall[1]();
    expect(ui.destroy).toHaveBeenCalledOnce();
    expect(scene.fireBusy).toBe(false);
  });

  it('cancels ignition completion on cleanup and ignores a stale completion callback', () => {
    const { scene, waitStroke } = camp();
    const ui = scene.fireUI;
    for (let i = 0; i < 6; i++) { ui.stroke(); waitStroke(); }
    const callback = scene.time.delayedCall.mock.lastCall[1];
    const timer = scene.fireCompletionTimer;
    scene.closeFireUI();
    expect(timer.remove).toHaveBeenCalledOnce();
    const refreshes = scene.campSpots.mock.calls.length;
    callback();
    expect(scene.campSpots.mock.calls.length).toBe(refreshes);
    expect(ui.destroy).toHaveBeenCalledOnce();
  });

  it('preserves collected wood, unfinished flags, and earned heat through a pause and resume', () => {
    const { scene, world } = camp();
    const ui = scene.fireUI;
    ui.stroke(); ui.cancel();
    expect(ui.destroy).toHaveBeenCalledOnce();
    expect(scene.fireBusy).toBe(false);
    expect(world.flags.campfireLit).toBeUndefined();
    expect(world.inv.zunderholz).toBe(2);
    expect(scene.campStep).toBe('fire');
    scene.lightFire();
    expect(scene.fireGame.heat).toBe(1);
    expect(scene.fireBusy).toBe(true);
    expect(scene.fireUI).not.toBe(ui);
  });

  it('blocks exploration while active, releases held strokes on pause, and restores controls', () => {
    const { scene, world, waitStroke } = camp();
    const input = sceneInput(scene), walk = vi.fn(), bag = vi.fn();
    input.on('move-up', walk); input.on('inventory', bag);
    expect(input.dispatch({ action: 'move-up', phase: 'begin', source: 'keyboard' })).toBe(false);
    expect(input.dispatch({ action: 'inventory', phase: 'activate', source: 'touch' })).toBe(false);
    input.dispatch({ action: 'interact', phase: 'begin', source: 'touch', owner: 'touch:E' });
    waitStroke();
    input.dispatch({ action: 'cancel', phase: 'activate', source: 'keyboard' });
    expect(scene.fireBusy).toBe(false); expect(scene.fireGame.heat).toBe(1);
    expect(input.isHeld('interact')).toBe(false);
    expect(world.inv.zunderholz).toBe(2);
    expect(input.dispatch({ action: 'move-up', phase: 'begin', source: 'keyboard' })).toBe(true);
    expect(walk).toHaveBeenCalledOnce(); expect(bag).not.toHaveBeenCalled();
  });

  it('applies reduced motion during an existing attempt without resetting its heat', () => {
    const { scene, tick } = camp();
    scene.fireUI.stroke();
    updateSettings({ reducedMotion: false }); tick();
    expect(scene.fireGame.reducedMotion).toBe(false);
    expect(scene.fireGame.heat).toBe(1);
    updateSettings({ reducedMotion: true }); tick();
    expect(scene.fireGame.reducedMotion).toBe(true);
    expect(scene.fireGame.heat).toBe(1);
    expect(scene.data.set).toHaveBeenLastCalledWith('story:fire-minigame', expect.objectContaining({ marker: 0.5, active: true }));
  });
});
