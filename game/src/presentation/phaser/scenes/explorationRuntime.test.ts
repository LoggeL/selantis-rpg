import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock("../../../app/audio", () => ({ sfx: { step: vi.fn(), bird: vi.fn() }, startAmbient: vi.fn() }));
import { StoryScene } from "../StoryScene";
import { WorldScene } from "./WorldScene";
import { LiaScene } from "./LiaScene";
import { NavigationContext } from "../../../modules/exploration/navigation";
import { SceneInputScope } from "../../../platform/input/router";

function sprite() {
  const result: any = { x: 20, y: 20, active: true, anims: { currentAnim: { key: 'lia-walk-e' }, isPlaying: true } };
  result.setPosition = vi.fn((x, y) => { result.x = x; result.y = y; return result; });
  for (const name of ['setDepth', 'setScale', 'play']) result[name] = vi.fn(() => result);
  return result;
}
function keys() { return Object.fromEntries(['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT'].map(key => [key, { isDown: false }])); }
function scope() {
  const input = new SceneInputScope();
  input.dispatch({ action: 'move-right', phase: 'begin', source: 'touch', owner: 'finger:1' });
  return input;
}

it.each(['story', 'world', 'lia'])('%s consumes the semantic movement scope and stops after held cancellation', kind => {
  const scene: any = kind === 'story' ? new StoryScene('story') : kind === 'world' ? new WorldScene() : new LiaScene();
  const input = scope(); scene.inputScope = input; scene.keys = keys(); scene.lia = sprite();
  scene.shadow = sprite(); scene.inventory = { isOpen: false }; scene.phase = 'free';
  scene.pos = { x: 20, y: 20 }; scene.free = () => true; scene.walkable = () => true;
  scene.playLiaMovement = vi.fn(); scene.idleLia = vi.fn(); scene.pulse = vi.fn(); scene.updateDetails = vi.fn();
  scene.updatePrompt = vi.fn(); scene.collectPickups = vi.fn(); scene.checkExits = vi.fn(); scene.checkTriggers = vi.fn();
  scene.critters = []; scene.exitHints = [];
  const tick = () => kind === 'story' ? scene.move(50) : scene.update(0, 50);
  tick();
  expect(kind === 'lia' ? scene.pos.x : scene.lia.x).toBeCloseTo(23.6);
  // A stale Phaser probe cannot retain held ownership after pause/blur cancellation.
  scene.keys.D.isDown = true;
  input.cancel(); tick();
  expect(kind === 'lia' ? scene.pos.x : scene.lia.x).toBeCloseTo(23.6);
});

describe('scene route arrival', () => {
  it('advances world waypoints before interacting and checks the final prop radius', () => {
    const scene: any = new WorldScene(); scene.lia = sprite(); scene.interact = vi.fn();
    const prop = { id: 'tree', at: [30, 20], radius: 12 };
    scene.targetProp = prop; scene.target = { x: 20, y: 20 }; scene.route = [[25, 20]];
    scene.arrive(); expect(scene.target).toEqual({ x: 25, y: 20 }); expect(scene.interact).not.toHaveBeenCalled();
    scene.arrive(); expect(scene.target).toBeUndefined(); expect(scene.interact).toHaveBeenCalledExactlyOnceWith(prop);
    scene.targetProp = prop; scene.lia.x = 100; scene.arrive(); expect(scene.interact).toHaveBeenCalledOnce();
  });

  it('keeps story routes on their collision segment and cancels stale spots before arrival', () => {
    const scene: any = new StoryScene('story'); scene.keys = keys(); scene.inputScope = new SceneInputScope(); scene.lia = sprite();
    const blocked = (x: number) => x < 21 || x > 22;
    scene.walkable = blocked; scene.navigation = new NavigationContext(blocked); scene.destination = [30, 20];
    scene.playLiaMovement = vi.fn(); scene.idleLia = vi.fn();
    for (let i = 0; i < 7; i++) scene.move(50);
    expect(scene.lia.x).toBe(20); expect(scene.destination).toBeUndefined();
    scene.destination = [30, 20]; scene.routeSpot = { at: [30, 20], radius: 2, enabled: () => false };
    scene.move(50); expect(scene.destination).toBeUndefined(); expect(scene.lia.x).toBe(20);
  });
});
