import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));
vi.mock('../audio', () => ({ setSceneMusic: vi.fn(), sfx: { select: vi.fn() } }));
import { JourneyScene } from './JourneyScene';
import { updateSettings } from '../settings';

function image(x: number, y: number, texture: string, frame: number) {
  const o: any = { x, y, texture, frame, flipX: false, active: true, anims: { stop: vi.fn() } };
  for (const method of ['setOrigin', 'setDepth', 'setPosition', 'setAngle', 'play']) o[method] = vi.fn(() => o);
  o.destroy = vi.fn(() => { o.active = false; return o; });
  o.setTexture = vi.fn((texture: string, frame: number) => { o.texture = texture; o.frame = frame; return o; });
  o.setFlipX = vi.fn((value: boolean) => { o.flipX = value; return o; });
  return o;
}
const cleanup: (() => void)[] = [];
function travelers() {
  const s: any = new JourneyScene();
  const images: any[] = [];
  s.textures = { exists: () => true };
  s.anims = { exists: () => true };
  s.add = { sprite: (...args: Parameters<typeof image>) => { const o = image(...args); images.push(o); return o; }, text: () => image(0, 0, '', 0) };
  s.areaRoot = { add: vi.fn() };
  s.tweens = { add: vi.fn(() => ({ isDestroyed: () => false, isPendingRemove: () => false, pause: vi.fn(), resume: vi.fn() })) };
  s.events = { once: vi.fn((_event: string, callback: () => void) => cleanup.push(callback)) };
  s.passingTravelers();
  return { s, images };
}
beforeEach(() => updateSettings({ reducedMotion: false }));
afterEach(() => { cleanup.splice(0).forEach(dispose => dispose()); });
describe('westbound road travelers', () => {
  it('keeps west-facing travelers in reduced-motion mode without starting movement', () => {
    updateSettings({ reducedMotion: true });
    const { s, images } = travelers();
    expect(images.map(o => o.flipX)).toEqual([true, true]);
    expect(images.map(o => o.x)).toEqual([110, 80]);
    expect(s.tweens.add).not.toHaveBeenCalled();
    for (const o of images) expect(o.play).not.toHaveBeenCalled();
  });
  it('faces the right-authored atlas left along its westbound velocity', () => {
    const { s, images } = travelers();
    for (const o of images) {
      const tween = s.tweens.add.mock.calls.find(([config]: any[]) => config.targets === o)[0];
      expect(tween.x).toBeLessThan(o.x);
      expect(o.flipX).toBe(true);
    }
  });
  it('plays real wagon and troupe cycles during their displacement and restores idle when stopped', () => {
    const { s, images } = travelers();
    expect(images[0].play).toHaveBeenCalledWith('road-wagon-walk', true);
    expect(images[1].play).toHaveBeenCalledWith('road-troupe-walk', true);
    for (let i = 0; i < images.length; i++) {
      const config = s.tweens.add.mock.calls.find(([config]: any[]) => config.targets === images[i])[0];
      config.onStop();
      expect(images[i].anims.stop).toHaveBeenCalled();
      expect(images[i].setTexture).toHaveBeenLastCalledWith('road-travelers', i);
      config.onComplete(); expect(images[i].destroy).toHaveBeenCalledTimes(1);
    }
  });
  it('pauses movement and steps together for reduced motion, then resumes only surviving actors', () => {
    const { s, images } = travelers();
    updateSettings({ reducedMotion: true });
    for (let i = 0; i < 2; i++) {
      expect(s.tweens.add.mock.results[i].value.pause).toHaveBeenCalled();
      expect(images[i].setTexture).toHaveBeenLastCalledWith('road-travelers', i);
    }
    images[0].active = false;
    const plays = images[0].play.mock.calls.length;
    updateSettings({ reducedMotion: false });
    expect(images[0].play).toHaveBeenCalledTimes(plays);
    expect(images[1].play).toHaveBeenLastCalledWith('road-troupe-walk', true);
    expect(s.tweens.add.mock.results[1].value.resume).toHaveBeenCalled();
  });
});

describe('camp capture movement', () => {
  function capture() {
    const s: any = new JourneyScene();
    s.lia = image(233, 260, 'lia-walk', 0);
    s.foltan = image(259, 245, 'story-actors', 5); s.azar = image(295, 242, 'story-actors', 6);
    s.anims = { exists: () => true };
    s.tweens = { add: vi.fn() };
    for (const method of ['campSpots', 'setLocked', 'say', 'setLiaPose', 'showCloseup', 'setCloseupText', 'setCloseupContinue']) s[method] = vi.fn();
    return s;
  }
  it('plays Lia walking during her escape, then installs the same bound dialogue card', () => {
    const s = capture(); s.caught();
    expect(s.lia.play).toHaveBeenCalledWith('lia-walk-e', true);
    expect(s.setCloseupText).not.toHaveBeenCalled();
    const movement = s.tweens.add.mock.calls[0][0];
    expect(movement).toMatchObject({ targets: s.lia, x: 470, y: 190 });
    movement.onComplete();
    expect(s.setLiaPose).toHaveBeenLastCalledWith('lia-bound-sit');
    expect(s.setCloseupText).toHaveBeenLastCalledWith('Der Schmale: "Damit du uns zuhörst."');
    expect(s.campStep).toBe('bound'); expect(s.conversation).toBe(0);
  });
  it('keeps capture narrative identical without a walking tween in reduced-motion mode', () => {
    updateSettings({ reducedMotion: true });
    const s = capture(); s.caught();
    expect(s.lia.play).not.toHaveBeenCalled(); expect(s.tweens.add).not.toHaveBeenCalled();
    expect(s.setLiaPose).toHaveBeenLastCalledWith('lia-bound-sit'); expect(s.campStep).toBe('bound');
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
