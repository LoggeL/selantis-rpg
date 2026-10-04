import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));
vi.mock('../audio', () => ({ setSceneMusic: vi.fn(), sfx: { select: vi.fn() } }));
import { JourneyScene } from './JourneyScene';
import { updateSettings } from '../settings';

function image(x: number, y: number, texture: string, frame: number) {
  const o: any = { x, y, texture, frame, flipX: false, active: true, anims: { stop: vi.fn() } };
  for (const method of ['setOrigin', 'setDepth', 'setVisible', 'setScale', 'setAlpha', 'setAngle']) o[method] = vi.fn(() => o);
  o.setPosition = vi.fn((x: number, y: number) => { o.x = x; o.y = y; return o; });
  o.play = vi.fn((key: string) => { o.anims.currentAnim = { key }; return o; });
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
      expect(images[i].setTexture).toHaveBeenLastCalledWith('road-travelers-walk', i === 0 ? 0 : 4);
      config.onComplete(); expect(images[i].destroy).toHaveBeenCalledTimes(1);
    }
  });
  it('pauses movement and steps together for reduced motion, then resumes only surviving actors', () => {
    const { s, images } = travelers();
    updateSettings({ reducedMotion: true });
    for (let i = 0; i < 2; i++) {
      expect(s.tweens.add.mock.results[i].value.pause).toHaveBeenCalled();
      expect(images[i].setTexture).toHaveBeenLastCalledWith('road-travelers-walk', i === 0 ? 0 : 4);
    }
    images[0].active = false;
    const plays = images[0].play.mock.calls.length;
    updateSettings({ reducedMotion: false });
    expect(images[0].play).toHaveBeenCalledTimes(plays);
    expect(images[1].play).toHaveBeenLastCalledWith('road-troupe-walk', true);
    expect(s.tweens.add.mock.results[1].value.resume).toHaveBeenCalled();
  });
});

describe('friendly camp encounter', () => {
  function encounter() {
    const s: any = new JourneyScene();
    const world: any = { flags: { firstCampRested: true }, inv: {} };
    s.registry = { get: () => world };
    s.data = { set: vi.fn() };
    s.lia = image(233, 260, 'lia-walk', 0);
    s.blanket = { setVisible: vi.fn() };
    s.add = { image, sprite: image };
    s.anims = { exists: () => true }; s.areaRoot = { add: vi.fn(), sort: vi.fn() };
    s.tweens = { add: vi.fn() }; s.time = { delayedCall: vi.fn() };
    for (const method of ['setObjective', 'setSpots', 'setLocked', 'setCinematic', 'say', 'setLiaPose', 'showCloseup', 'hideCloseup', 'setCloseupText', 'setCloseupContinue', 'drawFire', 'drawStar']) s[method] = vi.fn();
    s.wakeEncounter();
    expect(s.showCloseup).not.toHaveBeenCalled();
    expect(s.arrivalActive).toBe(true);
    for (let i = 0; i < 94; i++) s.updateArrival(50);
    const advance = () => s.setCloseupContinue.mock.lastCall[0]();
    const text = () => s.setCloseupText.mock.lastCall[0] as string;
    return { s, world, advance, text };
  }
  it.each([false, true])('keeps every line input-held and the continuous encounter locked (reduced motion %s)', reducedMotion => {
    updateSettings({ reducedMotion });
    const { s, world, advance, text } = encounter();
    const lines: string[] = [];
    expect(s.showCloseup).toHaveBeenLastCalledWith('cinematic-camp-observe');
    expect(s.setLiaPose).toHaveBeenLastCalledWith('lia-sleep');
    for (let i = 0; i < 19; i++) {
      const current = text(); lines.push(current);
      expect(text()).toBe(current);
      expect(s.campStep).toBe('waking');
      expect(world.flags.metFoltanAzar).toBeUndefined();
      expect(s.setLocked).toHaveBeenLastCalledWith(true);
      expect(s.setSpots.mock.lastCall[0].every((spot: any) => !spot.enabled())).toBe(true);
      if (i === 1) expect(s.showCloseup).toHaveBeenLastCalledWith('cinematic-camp-observe');
      if (i === 2) expect(s.showCloseup).toHaveBeenLastCalledWith('cut-camp-wake');
      if (i === 7) expect(s.showCloseup).toHaveBeenLastCalledWith('cut-camp-companions');
      advance();
    }
    expect(lines.join(' ')).toContain('Wir tun dir nichts.');
    expect(lines.join(' ')).toContain('Das mit dem ‚tot‘ war nicht böse gemeint.');
    expect(lines.join(' ')).toContain('Soll der feine Herr Foltan machen, was er für richtig hält.');
    expect(lines.join(' ')).toContain('Kyra mitgenommen');
    expect(lines.join(' ')).toContain('Versprechen können wir dir nichts.');
    expect(text()).toContain('Ich bin nicht mehr allein.');
    expect(s.setCloseupContinue.mock.lastCall[1]).toBe('Lager erkunden');
    expect(s.setLiaPose.mock.calls.flat()).not.toContain('lia-bound-sit');
    expect(s.showCloseup.mock.calls.flat()).not.toContain('cut-camp-capture');
    expect(s.rope).toBeUndefined(); expect(s.caught).toBeUndefined();
    expect(s.tweens.add).not.toHaveBeenCalled(); expect(s.time.delayedCall).not.toHaveBeenCalled();
    advance();
    expect(s.campStep).toBe('star'); expect(world.flags.metFoltanAzar).toBe(true);
    expect(world.flags.journeyRopesReleased).toBeUndefined();
    expect(s.setLocked).toHaveBeenLastCalledWith(false);
    expect(s.hideCloseup).toHaveBeenCalledOnce();
    expect(s.setObjective).toHaveBeenLastCalledWith('Im Lager zur Ruhe kommen oder bis zum Morgen schlafen.');
    s.beginStarReflection = vi.fn(); s.useCampSpot('star');
    expect(s.beginStarReflection).toHaveBeenCalledOnce();
    expect(world.flags.criosObserved).toBeUndefined();
  });
});

describe('first camp ending', () => {
  it('opens the optional reflection without marking Crios observed immediately', () => {
    const s: any = new JourneyScene();
    const world = { flags: { metFoltanAzar: true }, inv: {} };
    s.registry = { get: () => world };
    s.campStep = 'star';
    s.setObjective = vi.fn(); s.setSpots = vi.fn(); s.say = vi.fn(); s.drawStar = vi.fn();
    s.beginStarReflection = vi.fn();
    s.useCampSpot('star');
    expect(s.beginStarReflection).toHaveBeenCalledOnce();
    expect(world.flags).not.toHaveProperty('criosObserved');
  });
});
