import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock("../../../app/audio", () => ({ sfx: {} }));
import { RefugeScene } from "./RefugeScene";
import { sceneInput } from "../../../platform/input/router";
import { dialogueSceneFixture } from "../../../tests/dialogueTestFixture";

function fixture() {
  const scene: any = new RefugeScene();
  const f = dialogueSceneFixture(); Object.assign(scene, f.scene);
  const pointerHandlers = new Map<string, Set<(...args: any[]) => void>>();
  scene.input = {
    on: (event: string, callback: (...args: any[]) => void) => {
      if (!pointerHandlers.has(event)) pointerHandlers.set(event, new Set()); pointerHandlers.get(event)!.add(callback);
    },
    off: (event: string, callback: (...args: any[]) => void) => pointerHandlers.get(event)?.delete(callback),
  };
  scene.cameras = { remove: vi.fn() };
  scene.inspectRoom = vi.fn(() => false); scene.tryStep = vi.fn(); scene.raiseHand = vi.fn(); scene.primaryAction = vi.fn();
  const pointer = (event: string, value: any) => { for (const cb of pointerHandlers.get(event) ?? []) cb(value); };
  return { scene, pointer, pointerHandlers, emit: f.emit };
}

describe('refuge input lifetime', () => {
  it('releases pointer and semantic input on shutdown before a later visit', () => {
    const { scene, pointer, pointerHandlers, emit } = fixture();
    scene.bindControls(); scene.phase = 'rise';
    const held = { worldX: 10, worldY: 20, isDown: true };
    pointer('pointerdown', held);
    expect(scene.risePointer).toBe(held);
    const scope = sceneInput(scene);
    scope.dispatch({ action: 'interact', phase: 'begin', source: 'keyboard' });
    expect(scope.isHeld('interact')).toBe(true);
    emit('pause'); expect(scene.risePointer).toBeUndefined(); expect(scope.isHeld('interact')).toBe(false);
    const timer = { remove: vi.fn() }; scene.cine = [timer];
    const reader = { destroy: vi.fn() }; scene.dialogue = reader;
    emit('shutdown');
    expect([...pointerHandlers.values()].every(handlers => handlers.size === 0)).toBe(true);
    expect(timer.remove).toHaveBeenCalledExactlyOnceWith(false); expect(reader.destroy).toHaveBeenCalledOnce();
    scene.bindControls(); scene.dialogue = undefined;
    pointer('pointerdown', held);
    expect(scene.tryStep).toHaveBeenCalledTimes(2);
    expect(pointerHandlers.get('pointerdown')?.size).toBe(1);
  });
});
