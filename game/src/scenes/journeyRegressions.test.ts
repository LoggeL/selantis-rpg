import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));
vi.mock('../audio', () => ({ setSceneMusic: vi.fn(), sfx: { select: vi.fn() } }));
import { JourneyScene } from './JourneyScene';
import { updateSettings } from '../settings';

function image(x: number, y: number, texture: string, frame: number) {
  const o: any = { x, y, texture, frame, flipX: false };
  for (const method of ['setOrigin', 'setDepth', 'destroy']) o[method] = vi.fn(() => o);
  o.setFlipX = vi.fn((value: boolean) => { o.flipX = value; return o; });
  return o;
}
function travelers() {
  const s: any = new JourneyScene();
  const images: any[] = [];
  s.textures = { exists: () => true };
  s.add = { image: (...args: Parameters<typeof image>) => { const o = image(...args); images.push(o); return o; }, text: () => image(0, 0, '', 0) };
  s.areaRoot = { add: vi.fn() };
  s.tweens = { add: vi.fn(() => ({ isDestroyed: () => false, isPendingRemove: () => false, pause: vi.fn(), resume: vi.fn() })) };
  s.events = { once: vi.fn() };
  s.passingTravelers();
  return { s, images };
}
beforeEach(() => updateSettings({ reducedMotion: false }));
describe('westbound road travelers', () => {
  it('keeps west-facing travelers in reduced-motion mode without starting movement', () => {
    updateSettings({ reducedMotion: true });
    const { s, images } = travelers();
    expect(images.map(o => o.flipX)).toEqual([true, true]);
    expect(images.map(o => o.x)).toEqual([110, 80]);
    expect(s.tweens.add).not.toHaveBeenCalled();
  });
  it('faces the right-authored atlas left along its westbound velocity', () => {
    const { s, images } = travelers();
    for (const o of images) {
      const tween = s.tweens.add.mock.calls.find(([config]: any[]) => config.targets === o)[0];
      expect(tween.x).toBeLessThan(o.x);
      expect(o.flipX).toBe(true);
    }
  });
});

describe('first camp ending', () => {
  it('labels Crios as the prototype end instead of promising an unavailable next objective', () => {
    const s: any = new JourneyScene();
    const world = { flags: {}, inv: {} };
    s.registry = { get: () => world };
    s.campStep = 'star';
    s.setObjective = vi.fn(); s.setSpots = vi.fn(); s.say = vi.fn(); s.drawStar = vi.fn();
    s.useCampSpot('star');
    expect(world.flags).toMatchObject({ criosObserved: true });
    expect(s.campStep).toBe('complete');
    expect(s.setObjective).toHaveBeenLastCalledWith('Ende des Prototyps · Die Reise geht morgen weiter.');
  });
});
