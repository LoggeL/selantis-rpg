import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../audio', () => ({ setSceneMusic: vi.fn(), sfx: { heartbeat: vi.fn(), drone: vi.fn(), step: vi.fn(), select: vi.fn() } }));

import { RaidScene } from './RaidScene';
import { WorldScene } from './WorldScene';
import { RAID_APPROACH_AREA } from '../story/areas/raid';
import { updateSettings } from '../settings';

function actor(x = 0, y = 0) {
  const o: any = { x, y, angle: 0 };
  for (const method of ['setOrigin', 'setDepth', 'setScale', 'setTint', 'setAlpha', 'setTexture', 'play', 'stop', 'destroy', 'add', 'lineStyle', 'lineBetween', 'fillStyle', 'fillTriangle', 'fillRect']) {
    o[method] = vi.fn(() => o);
  }
  o.setAngle = vi.fn((angle: number) => { o.angle = angle; return o; });
  o.setY = vi.fn((value: number) => { o.y = value; return o; });
  o.setPosition = vi.fn((x: number, y: number) => { o.x = x; o.y = y; return o; });
  o.setFlipX = vi.fn((flip: boolean) => { o.flipX = flip; return o; });
  o.setName = vi.fn((name: string) => { o.name = name; return o; });
  o.setFrame = vi.fn((name: number) => { o.frame = { name }; return o; });
  return o;
}

/** Real scene actions and continuation callbacks; replace only rendering and clocks. */
function raid(spearmanAvailable = true, discoveryAvailable = true) {
  const s: any = new RaidScene();
  const pending: Array<() => void> = [];
  const data = new Map<string, unknown>();
  const world = { flags: {}, inv: {}, picked: {} };
  s.registry = { get: () => world };
  s.data = { get: (key: string) => data.get(key), set: (key: string | Record<string, unknown>, value?: unknown) => {
    if (typeof key === 'string') data.set(key, value);
    else Object.entries(key).forEach(([k, v]) => data.set(k, v));
  } };
  s.lia = actor(152, 201);
  s.areaRoot = actor();
  s.add = { graphics: vi.fn(() => actor()), rectangle: actor, triangle: actor, container: actor };
  s.addActor = (texture: string, frame: number, at: [number, number]) => Object.assign(actor(...at), { texture: { key: texture }, frame: { name: frame } });
  s.textures = { exists: (key: string) => key === 'story-actors' || key === 'cinematic-raid-kyra' || key === 'raid-spearman' && spearmanAvailable || key === 'cinematic-raid-kyra-found' && discoveryAvailable };
  s.anims = { exists: () => false };
  s.inventory = { close: vi.fn(), hitTest: () => false };
  s.hud = { hitTest: () => false };
  s.area = RAID_APPROACH_AREA;
  s.areaRoot.getWorldTransformMatrix = () => ({ applyInverse: (x: number, y: number) => ({ x, y }) });
  s.keys = Object.fromEntries(['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT'].map(key => [key, { isDown: false }]));
  s.time = { delayedCall: (_ms: number, callback: () => void) => pending.push(callback) };
  s.tweens = { add: (config: any) => pending.push(() => {
    if (!config.yoyo) for (const target of Array.isArray(config.targets) ? config.targets : [config.targets]) {
      if (typeof config.x === 'number') target.x = config.x;
      if (typeof config.y === 'number') target.y = config.y;
    }
    config.onUpdate?.(); config.onYoyo?.(); config.onComplete?.();
  }) };
  for (const method of ['begin', 'changeArea', 'setObjective', 'say', 'setLocked', 'setCinematic', 'setLiaPose', 'showCloseup', 'hideCloseup', 'setCloseupText', 'setCloseupContinue', 'goTo']) s[method] = vi.fn();
  s.changeArea = vi.fn((area: typeof RAID_APPROACH_AREA) => { s.area = area; s.lia.setPosition(...area.start); });
  s.setSpots = vi.fn((spots: any[]) => { s.spots = spots; });
  const flush = () => { while (pending.length) pending.shift()!(); };
  const progress = () => data.get('story:raid') as { phase: string; step: string; index: number; shot: string; ready: boolean };
  const next = () => {
    const callback = s.setCloseupContinue.mock.calls.at(-1)?.[0];
    expect(typeof callback).toBe('function');
    callback();
  };
  s.create();
  return { s, world, flush, progress, next };
}

beforeEach(() => updateSettings({ reducedMotion: false }));

describe('courtyard raid progression', () => {
  it('shows the protective claim before the unbound daughter comes out of the house', () => {
    for (const discoveryAvailable of [true, false]) {
      const { s, flush, progress, next } = raid(true, discoveryAvailable);
      s.spots[0].onUse(); flush();
      expect(s.kyra).toBeUndefined();
      next();
      expect(progress()).toMatchObject({ step: 'parents-alone', shot: 'cinematic-raid-confrontation', ready: true });
      expect(s.setCloseupText).toHaveBeenLastCalledWith('Vater: Wir sind allein.');
      expect(s.kyra).toBeUndefined();
      next();
      expect(progress()).toMatchObject({ step: 'parents-protect', ready: true });
      expect(s.setCloseupText).toHaveBeenLastCalledWith('Lia (Gedanke): Sie wollen Kyra schützen. Sie ist noch im Haus.');
      next();
      expect(progress()).toMatchObject({ step: 'kyra-found', shot: '', ready: false });
      expect(s.hideCloseup).toHaveBeenCalled();
      expect(s.areaRoot.setScale).toHaveBeenLastCalledWith(2.3);
      expect(s.kyra).toMatchObject({ name: 'raid-kyra', x: 282, y: 177, frame: { name: 0 } });
      expect(s.mother.angle).toBe(0);
      expect(s.father.angle).toBe(0);
      s.advanceDialogue();
      expect(progress().step).toBe('kyra-found');
      flush();
      expect(s.kyra).toMatchObject({ y: 216, frame: { name: 0 } });
      expect(progress()).toMatchObject({ step: 'kyra-found', shot: discoveryAvailable ? 'cinematic-raid-kyra-found' : '', ready: true });
      expect(s.showCloseup.mock.calls.map(([key]: [string]) => key)).not.toContain('cinematic-raid-kyra');
      next();
      expect(progress()).toMatchObject({ step: 'question', shot: discoveryAvailable ? 'cinematic-raid-kyra-found' : '', ready: true });
      expect(s.kyra.frame.name).toBe(0);
    }
  });

  it('faces the standing guards inward, the captor toward Kyra and departing riders to the left', () => {
    const { s, flush } = raid();
    expect(s.raiders.map((guard: any) => [guard.name, guard.texture.key, guard.frame.name, guard.flipX])).toEqual([
      ['raid-spearman', 'raid-spearman', 0, false], ['raid-axeman', 'axe', 0, true],
      ['raid-hooded', 'warrior', 0, true], ['raid-leader', 'story-actors', 2, false],
    ]);
    for (const guard of s.raiders) {
      expect(guard.x).toBeGreaterThanOrEqual(223);
      expect(guard.x).toBeLessThanOrEqual(310);
      expect(guard.y).toBeGreaterThanOrEqual(182);
      expect(guard.y).toBeLessThanOrEqual(224);
    }
    expect(s.add.graphics).not.toHaveBeenCalled();
    const arrived = vi.fn();
    s.bringKyra(arrived); flush();
    expect(arrived).toHaveBeenCalledOnce();
    expect(s.raiders).toHaveLength(5);
    const captor = s.raiders[4], axeman = s.raiders[1];
    expect(captor).toMatchObject({ name: 'raid-captor', texture: { key: 'warrior' }, frame: { name: 0 }, x: 273, y: 216, flipX: false });
    expect(captor.x).toBeLessThan(s.kyra.x);
    s.bindKyra(vi.fn()); flush();
    expect(captor.x).toBeGreaterThan(s.kyra.x);
    expect(captor.flipX).toBe(true);
    expect(axeman.x).toBeLessThan(s.kyra.x);
    expect(axeman.flipX).toBe(false);
    s.depart(vi.fn());
    expect(s.raiders.every((rider: any) => rider.flipX)).toBe(true);
    expect(s.add.graphics).not.toHaveBeenCalled();
    const fallback = raid(false);
    expect(fallback.s.raiders[0]).toMatchObject({ name: 'raid-spearman', texture: { key: 'warrior' }, frame: { name: 0 } });
    expect(fallback.s.add.graphics).not.toHaveBeenCalled();
  });

  it('requires the cover before observation and cannot reach the parents early', () => {
    const { s, flush, progress } = raid();
    expect(s.spots.map((spot: any) => spot.id)).toEqual(['hide']);
    expect(progress()).toMatchObject({ phase: 'approach', step: 'approach', ready: false });
    expect(s.data.get('story:lia-crouched')).toBe(true);
    expect(s.lia.play).toHaveBeenLastCalledWith('lia-crouch-idle-s', true);
    s.vow();
    expect(s.goTo).not.toHaveBeenCalled();
    s.spots[0].onUse();
    expect(s.spots).toEqual([]);
    expect(progress()).toMatchObject({ phase: 'busy', step: 'hiding', ready: false });
    expect(s.lia.play).toHaveBeenLastCalledWith('lia-crouch-walk-w', true);
    expect(s.lia.flipX).toBe(true);
    flush();
    expect(progress()).toMatchObject({ phase: 'hidden', step: 'cover', index: 0, ready: true });
    expect(s.setLocked).toHaveBeenLastCalledWith(true);
  });

  it('preserves the low pose during keyboard movement, stopping and a clicked route into cover', () => {
    const { s, progress } = raid();
    const startX = s.lia.x;
    s.keys.A.isDown = true;
    s.move(50);
    expect(s.lia.x).toBeLessThan(startX);
    expect(startX - s.lia.x).toBeCloseTo(2.2);
    expect(s.lia.play).toHaveBeenLastCalledWith('lia-crouch-walk-w', true);
    expect(s.lia.flipX).toBe(true);
    s.keys.A.isDown = false;
    s.move(50);
    expect(s.lia.play).toHaveBeenLastCalledWith('lia-crouch-idle-w', true);
    s.onPointerDown({ x: 104, y: 185, worldX: 104, worldY: 185 });
    expect(s.destination).toBeDefined();
    for (let frame = 0; frame < 200 && progress().phase === 'approach'; frame++) s.move(50);
    expect(progress()).toMatchObject({ phase: 'busy', step: 'hiding' });
    expect(s.lia.play.mock.calls.every(([key]: [string]) => key.startsWith('lia-crouch-'))).toBe(true);
    expect(s.lia.setScale).not.toHaveBeenCalled();
  });

  it('shows both deaths in order and holds every shot for input before the aftermath and vow', () => {
    const { s, world, flush, progress, next } = raid();
    const killFather = vi.spyOn(s, 'killFather');
    const killMother = vi.spyOn(s, 'killMother');
    s.spots[0].onUse(); flush();
    const father = s.father, mother = s.mother;
    const steps: string[] = [];
    while (progress().phase !== 'parents') {
      const current = progress();
      steps.push(current.step);
      expect(current.ready).toBe(true);
      if (current.step === 'father-stab') {
        expect(current.shot).toBe('cinematic-raid-father-stab');
        expect(father.angle).toBe(-90);
        expect(mother.angle).toBe(0);
      }
      if (current.step === 'father-death') {
        expect(current.shot).toBe('cinematic-raid-father-death');
        expect(father.angle).toBe(-90);
        expect(mother.angle).toBe(0);
      }
      if (['mother-fall', 'mother-last-word', 'mother-death'].includes(current.step)) {
        expect(current.shot).toBe('cinematic-raid-mother-death');
        expect(mother.angle).toBe(-90);
      }
      if (current.step === 'mother-stab') {
        expect(current.shot).toBe('cinematic-raid-mother-stab');
        expect(mother.angle).toBe(-90);
      }
      const line = s.setCloseupText.mock.calls.at(-1)[0];
      if (['father-stab', 'father-death', 'kyra-bound', 'mother-stab', 'mother-fall', 'mother-death', 'departure'].includes(current.step)) {
        expect(line).not.toMatch(/^[^:]+:/);
      }
      if (current.step === 'mother-last-word') expect(line).toBe('Mutter: Kyra ...');
      if (current.step === 'mother-death') expect(line).toBe('Dann stirbt sie.');
      // No animation or timer is allowed to advance an already readable card.
      flush();
      expect(progress()).toEqual(current);
      next();
      if (!progress().ready && progress().phase !== 'parents') {
        const waiting = progress();
        s.advanceDialogue();
        expect(progress()).toEqual(waiting);
      }
      flush();
      expect(steps.length).toBeLessThan(30);
    }
    expect(steps.indexOf('father-stab')).toBeLessThan(steps.indexOf('father-death'));
    expect(steps.indexOf('father-death')).toBeLessThan(steps.indexOf('kyra-bound'));
    expect(steps.indexOf('kyra-bound')).toBeLessThan(steps.indexOf('mother-stab'));
    expect(steps.slice(steps.indexOf('mother-stab'), steps.indexOf('kyra-vow') + 1)).toEqual([
      'mother-stab', 'mother-fall', 'mother-last-word', 'mother-death', 'kyra-vow',
    ]);
    expect(steps.indexOf('mother-death')).toBeLessThan(steps.indexOf('departure'));
    expect(killFather).toHaveBeenCalledTimes(1);
    expect(killMother).toHaveBeenCalledTimes(1);
    expect(s.setCloseupText).toHaveBeenCalledTimes(steps.length);
    expect(s.showCloseup.mock.calls.map(([key]: [string]) => key)).toEqual([
      'cinematic-raid-cover', 'cinematic-raid-confrontation', 'cinematic-raid-kyra-found',
      'cinematic-raid-father-stab', 'cinematic-raid-father-death', 'cinematic-raid-kyra',
      'cinematic-raid-mother-stab', 'cinematic-raid-mother-death', 'cinematic-raid-departure',
    ]);
    for (const key of ['cinematic-raid-father-stab', 'cinematic-raid-father-death', 'cinematic-raid-mother-stab', 'cinematic-raid-mother-death']) {
      expect(s.showCloseup).toHaveBeenCalledWith(key, { fit: 'contain' });
    }
    expect(s.goTo).not.toHaveBeenCalled();
    expect(s.spots.map((spot: any) => spot.id)).toEqual(['parents']);
    expect(progress()).toMatchObject({ step: 'seek-parents', shot: '', ready: false });
    expect(s.data.get('story:lia-crouched')).toBe(false);
    s.keys.D.isDown = true;
    s.move(50);
    expect(s.lia.play).toHaveBeenLastCalledWith('lia-walk-e', true);
    expect(s.lia.flipX).toBe(false);
    s.keys.D.isDown = false;
    expect(world.flags).not.toHaveProperty('parentsLost');
    s.spots[0].onUse(); flush();
    expect(progress()).toMatchObject({ step: 'parents-aftermath', shot: 'cinematic-raid-parents-aftermath', ready: true });
    expect(s.setCloseupText).toHaveBeenLastCalledWith('Lia (Gedanke): Mutter und Vater sind tot. Kyra ist fort.');
    expect(s.goTo).not.toHaveBeenCalled();
    next();
    expect(progress()).toMatchObject({ step: 'vow', shot: 'cinematic-raid-parents-aftermath', ready: true });
    expect(s.setCloseupText).toHaveBeenLastCalledWith('Lia: Ich werde dich finden, Kyra.');
    expect(s.goTo).not.toHaveBeenCalled();
    next();
    expect(progress()).toMatchObject({ step: 'complete', ready: false });
    expect(s.goTo).toHaveBeenCalledExactlyOnceWith('aftermath');
  });

  it('hands normal world homecoming to the raid before painting an empty farm', () => {
    const s: any = new WorldScene();
    const world = { inv: {}, picked: {}, flags: { sisterPromise: true } };
    s.registry = { get: (key: string) => key === 'world' ? world : {}, set: vi.fn() };
    s.add = { image: vi.fn(), sprite: vi.fn() };
    s.scene = { start: vi.fn() };
    s.create({ map: 'hof' });
    expect(s.scene.start).toHaveBeenCalledExactlyOnceWith('raid');
    expect(s.add.image).not.toHaveBeenCalled();
    expect(s.add.sprite).not.toHaveBeenCalled();
    expect(world.flags).toHaveProperty('homeArrived', true);
  });
});
