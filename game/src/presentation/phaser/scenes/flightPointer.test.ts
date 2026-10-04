import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {
  Scene: class {},
  Math: { Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)), Distance: {
    Between: (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by),
  } },
} }));
vi.mock("../../../app/audio", () => ({ sfx: { thud: vi.fn() }, startAmbient: vi.fn() }));
vi.mock("../../../app/settings", () => ({ getSettings: () => ({ reducedMotion: true }) }));

import { FlightScene } from "./FlightScene";
import { SceneInputScope } from "../../../platform/input/router";
import { measureRail } from "../../../modules/flight/rail";

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
  scene.controls = new SceneInputScope();
  scene.rail = measureRail([{ x: 200, y: 120 }, { x: 500, y: 120 }]);
  scene.pointAt = (distance: number) => ({ p: { x: 200 + distance, y: 120 }, dir: { x: 1, y: 0 } });
  scene.speed = () => speed;
  scene.fever = vi.fn(); scene.updateMarkers = vi.fn(); scene.hud = { hint: vi.fn(), thought: vi.fn() };
  scene.drawHold = vi.fn();
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
    scene.controls.dispatch({ action: 'move-right', phase: 'begin', source: 'keyboard', owner: 'keyboard:KeyD' });
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

describe('flight hold station input', () => {
  it('freezes a released climb despite movement and advances after accumulated interaction hold', () => {
    const { scene, tick } = flight({ dist: 100 });
    scene.stations = [{ at: 100, kind: 'climb', holdMs: 1800, to: 180 }];
    scene.controls.dispatch({ action: 'move-right', phase: 'begin', source: 'touch' });
    tick(80); expect(scene.dist).toBe(100);
    scene.controls.dispatch({ action: 'interact', phase: 'begin', source: 'keyboard' });
    for (let frame = 0; frame < 10; frame++) tick(80);
    expect(scene.holding).toBe(800); expect(scene.dist).toBeCloseTo(135.55555555555554);
    scene.controls.dispatch({ action: 'interact', phase: 'end', source: 'keyboard' });
    tick(80); expect(scene.holding).toBe(800); expect(scene.dist).toBeCloseTo(135.55555555555554);
    scene.controls.dispatch({ action: 'interact', phase: 'begin', source: 'touch' });
    for (let frame = 0; frame < 13; frame++) tick(80);
    expect(scene.nextStation).toBe(1); expect(scene.dist).toBe(180); expect(scene.safeFloor).toBe(180);
    expect(scene.holding).toBe(0);
    expect(scene.hud.thought).toHaveBeenCalledWith('Es darf ihnen nicht in die Hände fallen.', 2600);
  });

  it('accepts a near-feet held pointer and freezes its brace on release', () => {
    const { scene, pointer, tick } = flight({ dist: 100, held: true });
    scene.stations = [{ at: 100, kind: 'brace', holdMs: 1200 }];
    pointer.worldX = scene.v.x; pointer.worldY = scene.v.y;
    scene.onPointer(pointer); tick(80);
    expect(scene.holding).toBe(80); expect(scene.dist).toBe(100);
    pointer.isDown = false; tick(80);
    expect(scene.holding).toBe(80); expect(scene.dist).toBe(100);
  });
});

class Emitter {
  private handlers = new Map<string, Set<(...args: any[]) => void>>();
  on(event: string, handler: (...args: any[]) => void) {
    const handlers = this.handlers.get(event) ?? new Set(); handlers.add(handler); this.handlers.set(event, handlers);
  }
  once(event: string, handler: (...args: any[]) => void) {
    const once = (...args: any[]) => { this.off(event, once); handler(...args); }; this.on(event, once);
  }
  off(event: string, handler: (...args: any[]) => void) { this.handlers.get(event)?.delete(handler); }
  emit(event: string, ...args: any[]) { for (const handler of [...(this.handlers.get(event) ?? [])]) handler(...args); }
  count(event: string) { return this.handlers.get(event)?.size ?? 0; }
}

describe('flight input lifecycle', () => {
  function boundFlight() {
    const { scene, pointer } = flight();
    scene.events = new Emitter();
    scene.input = Object.assign(new Emitter(), { activePointer: pointer });
    scene.data = { get: vi.fn(), set: vi.fn() };
    scene.onInteract = vi.fn(); scene.glimmer = vi.fn();
    scene.bindInput();
    return { scene, pointer };
  }

  it('uses semantic actions once and reads holds without Phaser keys', () => {
    const { scene } = boundFlight();
    const intent = { action: 'interact', phase: 'begin', source: 'keyboard', owner: 'keyboard:KeyE' } as const;
    scene.controls.dispatch(intent); scene.controls.dispatch(intent);
    expect(scene.onInteract).toHaveBeenCalledTimes(1);
    expect(scene.controls.isHeld('interact')).toBe(true);
    scene.controls.dispatch({ ...intent, phase: 'end' });
    expect(scene.onInteract).toHaveBeenCalledTimes(1);
    expect(scene.controls.isHeld('interact')).toBe(false);
    scene.controls.dispatch({ action: 'beam', phase: 'activate', source: 'touch' });
    scene.controls.dispatch({ action: 'wave', phase: 'activate', source: 'pointer' });
    expect(scene.glimmer).toHaveBeenCalledTimes(2);
  });

  it('releases only the owning pointer on pointerup and pointerupoutside', () => {
    const { scene, pointer } = boundFlight();
    scene.pointerHolding = true; scene.holdPointer = pointer;
    scene.input.emit('pointerup', {});
    expect(scene.pointerHolding).toBe(true);
    scene.input.emit('pointerupoutside', pointer);
    expect(scene.pointerHolding).toBe(false);
    expect(scene.holdPointer).toBeUndefined();
    scene.pointerHolding = true; scene.holdPointer = pointer;
    scene.input.emit('pointerup', pointer);
    expect(scene.pointerHolding).toBe(false);
  });

  it('cancels movement, pointer grip and skip progress on pause', () => {
    const { scene, pointer } = boundFlight();
    scene.controls.dispatch({ action: 'cancel', phase: 'begin', source: 'keyboard' });
    scene.controls.dispatch({ action: 'move-right', phase: 'begin', source: 'touch' });
    scene.pointerHolding = true; scene.holdPointer = pointer; scene.skipHeld = 1400; scene.skipBar.width = 48;
    scene.events.emit('pause');
    expect(scene.controls.isHeld('cancel')).toBe(false);
    expect(scene.controls.isHeld('move-right')).toBe(false);
    expect(scene.pointerHolding).toBe(false);
    expect(scene.holdPointer).toBeUndefined();
    expect(scene.skipHeld).toBe(0); expect(scene.skipBar.width).toBe(0);
  });

  it('removes owned pointer listeners and holds through repeated shutdown and bind', () => {
    const { scene, pointer } = boundFlight();
    const foreign = vi.fn(); scene.input.on('pointerdown', foreign);
    const oldScope = scene.controls;
    oldScope.dispatch({ action: 'cancel', phase: 'begin', source: 'keyboard' });
    scene.pointerHolding = true; scene.holdPointer = pointer; scene.skipHeld = 1400;
    scene.events.emit('shutdown');
    expect(oldScope.isHeld('cancel')).toBe(false);
    expect(scene.pointerHolding).toBe(false); expect(scene.skipHeld).toBe(0);
    expect(scene.input.count('pointerdown')).toBe(1);
    expect(scene.input.count('pointerup')).toBe(0);
    expect(scene.input.count('pointerupoutside')).toBe(0);
    expect(scene.events.count('pause')).toBe(0);
    scene.bindInput();
    expect(scene.input.count('pointerdown')).toBe(2);
    scene.input.emit('pointerdown', pointer);
    expect(foreign).toHaveBeenCalledOnce();
    scene.events.emit('shutdown');
    expect(scene.input.count('pointerdown')).toBe(1);
  });
});
