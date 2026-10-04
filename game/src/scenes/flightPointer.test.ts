import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {
  Scene: class {},
  Math: { Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)), Distance: {
    Between: (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by),
  } },
} }));
vi.mock('../audio', () => ({ sfx: { thud: vi.fn() }, startAmbient: vi.fn() }));
vi.mock('../settings', () => ({ getSettings: () => ({ reducedMotion: true }) }));

import { FlightScene } from './FlightScene';

function flight({ held = false, dist = 98.8, speed = 62 } = {}) {
  const scene: any = new FlightScene();
  const sprite: any = { x: 200 + dist, y: 120, anims: { stop: vi.fn(), timeScale: 1 } };
  for (const method of ['play', 'setTexture', 'setDepth', 'once']) sprite[method] = vi.fn(() => sprite);
  sprite.setPosition = vi.fn((x: number, y: number) => { sprite.x = x; sprite.y = y; return sprite; });
  const visual: any = {};
  visual.setPosition = vi.fn(() => visual); visual.setDepth = vi.fn(() => visual);
  scene.v = sprite; scene.shadow = visual; scene.moon = visual; scene.skipBar = { width: 0 };
  scene.dist = dist; scene.total = 300; scene.dropTimer = 10_000;
  scene.stations = [{ at: 100, kind: 'stumble' }, { at: 200, kind: 'jump', hint: 'Springen', to: 240 }];
  scene.keys = Object.fromEntries(['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'E', 'ESC'].map(key => [key, { isDown: false }]));
  scene.pointAt = (distance: number) => ({ p: { x: 200 + distance, y: 120 }, dir: { x: 1, y: 0 } });
  scene.speed = () => speed;
  scene.fever = vi.fn(); scene.updateMarkers = vi.fn(); scene.hud = { hint: vi.fn() };
  const pointer: any = { x: 450, y: 120, worldX: 450, worldY: 120, isDown: held };
  scene.input = { activePointer: pointer };
  const tick = (delta = 16) => scene.update(0, delta);
  const finishStumble = () => sprite.once.mock.calls.find(([event]: [string]) => event === 'animationcomplete')[1]();
  return { scene, sprite, pointer, tick, finishStumble };
}

beforeEach(() => vi.clearAllMocks());

describe('mouse flight station arrivals', () => {
  for (const held of [false, true]) {
    it(`plays the mandatory stumble for a ${held ? 'held pointer' : 'released click'} beyond the root`, () => {
      const { scene, sprite, pointer, tick, finishStumble } = flight({ held });
      scene.onPointer(pointer);
      expect(scene.railTarget).toBe(100);
      tick();
      expect(sprite.play).toHaveBeenCalledWith('vc-stumble');
      expect(scene.busy).toBe(true);
      expect(scene.nextStation).toBe(0);
      tick(); tick();
      expect(sprite.play.mock.calls.filter(([animation]: [string]) => animation === 'vc-stumble')).toHaveLength(1);
      finishStumble(); tick();
      expect(scene.nextStation).toBe(1);
      expect(scene.busy).toBe(false);
    });
  }

  it('reaches the stumble even with subpixel frame steps', () => {
    const { scene, sprite, pointer, tick } = flight({ speed: 10 });
    scene.onPointer(pointer);
    for (let frame = 0; frame < 10; frame++) tick();
    expect(sprite.play).toHaveBeenCalledWith('vc-stumble');
    expect(scene.busy).toBe(true);
    expect(scene.dist).toBeGreaterThanOrEqual(99.5);
  });

  it('stops a click before the root exactly at its target without overshooting or stumbling', () => {
    const { scene, sprite, pointer, tick } = flight({ dist: 90 });
    pointer.worldX = 296;
    scene.onPointer(pointer);
    expect(scene.railTarget).toBe(96);
    for (let frame = 0; frame < 15; frame++) tick();
    expect(scene.dist).toBe(96);
    expect(scene.railTarget).toBeUndefined();
    expect(scene.busy).toBe(false);
    expect(sprite.play).not.toHaveBeenCalledWith('vc-stumble');
    expect(sprite.anims.stop).toHaveBeenCalled();
  });

  it('clamps backward mouse movement at the target and lets direction keys replace it', () => {
    const { scene, pointer, tick } = flight({ dist: 90 });
    pointer.worldX = 288;
    scene.onPointer(pointer);
    for (let frame = 0; frame < 5; frame++) tick();
    expect(scene.dist).toBe(88);
    scene.onPointer(pointer);
    scene.keys.D.isDown = true;
    tick();
    expect(scene.railTarget).toBeUndefined();
    expect(scene.dist).toBeGreaterThan(88);
  });

  it('stops mouse travel at the jump and still waits for the separate interaction', () => {
    const { scene, pointer, tick } = flight({ dist: 198.8 });
    scene.nextStation = 1;
    scene.onPointer(pointer);
    for (let frame = 0; frame < 5; frame++) tick();
    expect(scene.dist).toBe(200);
    expect(scene.nextStation).toBe(1);
    expect(scene.busy).toBe(false);
    expect(scene.hud.hint).toHaveBeenCalledWith('Springen');
  });
});
