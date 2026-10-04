import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock("../../app/audio", () => ({ setSceneMusic: vi.fn(), sfx: { select: vi.fn() } }));
import { JourneyScene } from "../../presentation/phaser/scenes/JourneyScene";
import { STAR_REFLECTION_BEATS } from "../../content/chapters/firstJourney/starReflection";

function fixture(flags: Record<string, boolean> = { metFoltanAzar: true }) {
  const scene: any = new JourneyScene();
  const world = { flags: { ...flags }, inv: { proviant: 1 }, picked: {} };
  const data = new Map<string, unknown>();
  scene.registry = { get: () => world };
  scene.data = { set: (key: string, value: unknown) => data.set(key, value) };
  scene.inventory = { close: vi.fn() };
  for (const method of ['setLocked', 'setCinematic', 'drawStar', 'showCloseup', 'hideCloseup', 'setCloseupText', 'setCloseupContinue', 'campSpots', 'say']) scene[method] = vi.fn();
  const next = () => scene.setCloseupContinue.mock.lastCall[0]();
  const progress = () => data.get('story:star-reflection');
  return { scene, world, next, progress };
}

describe('optional Crios reflection', () => {
  it('holds every thought for input and records Crios only after the final thought', () => {
    const { scene, world, next, progress } = fixture();
    scene.beginStarReflection();
    expect(scene.inventory.close).toHaveBeenCalledOnce();
    expect(scene.showCloseup).toHaveBeenCalledWith('cut-crios-reflection', { fit: 'contain' });
    for (const [index, beat] of STAR_REFLECTION_BEATS.entries()) {
      expect(progress()).toEqual({ active: true, index, step: beat.id });
      expect(scene.setCloseupText).toHaveBeenLastCalledWith(beat.line);
      expect(world.flags.criosObserved).toBeUndefined();
      expect(scene.setLocked).toHaveBeenLastCalledWith(true);
      expect(scene.setCinematic).toHaveBeenLastCalledWith(true);
      next();
    }
    expect(world.flags.criosObserved).toBe(true);
    expect(world.inv).toEqual({ proviant: 1 });
    expect(scene.campStep).toBe('complete');
    expect(scene.hideCloseup).toHaveBeenCalledOnce();
    expect(scene.setCinematic).toHaveBeenLastCalledWith(false);
    expect(scene.setLocked).toHaveBeenLastCalledWith(false);
    expect(scene.campSpots).toHaveBeenCalledOnce();
    expect(progress()).toMatchObject({ active: false, step: 'complete' });
  });

  it('ignores repeated interactions and consumed callbacks; later observation is a short thought', () => {
    const { scene, world, next, progress } = fixture();
    scene.beginStarReflection();
    const first = scene.setCloseupContinue.mock.lastCall[0];
    scene.beginStarReflection();
    expect(scene.showCloseup).toHaveBeenCalledOnce();
    first(); first();
    expect(progress()).toMatchObject({ index: 1 });
    for (let i = 1; i < STAR_REFLECTION_BEATS.length; i++) next();
    const last = scene.setCloseupContinue.mock.lastCall[0];
    first(); last();
    expect(scene.hideCloseup).toHaveBeenCalledOnce();
    scene.beginStarReflection();
    expect(scene.say).toHaveBeenLastCalledWith('Crios steht noch im Westen. Vielleicht sieht Kyra ihn auch.', 2800);
    expect(scene.showCloseup).toHaveBeenCalledOnce();
    expect(world.flags.criosObserved).toBe(true);
  });

  it('keeps companions out of thoughts before they have been introduced', () => {
    const { scene, world } = fixture({});
    scene.beginStarReflection();
    expect(scene.showCloseup).not.toHaveBeenCalled();
    expect(world.flags.criosObserved).toBeUndefined();
  });

  it('an interrupted sequence cannot complete or advance the next scene', () => {
    const { scene, world, progress } = fixture();
    scene.beginStarReflection();
    const callback = scene.setCloseupContinue.mock.lastCall[0];
    scene.starReflectionRun++; scene.starReflectionIndex = -1;
    callback();
    expect(world.flags.criosObserved).toBeUndefined();
    expect(progress()).toMatchObject({ index: 0 });
    expect(scene.hideCloseup).not.toHaveBeenCalled();
  });
});
