import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {}, Input: { Keyboard: { KeyCodes: { ESC: 27, Q: 81, R: 82, SPACE: 32 } } } } }));
vi.mock('../audio', () => ({ setSceneMusic: vi.fn() }));
vi.mock('../story/StoryScene', () => ({ StoryScene: class { update() { const scene = this as any; if (scene.testWalk) scene.lia.x += 1; } } }));
vi.mock('../dialogue', () => ({ Dialogue: class {
  visible = false; continuation?: () => void;
  setText = vi.fn(() => { this.visible = true; });
  setContinue = vi.fn((callback: () => void) => { this.continuation = callback; });
  advance() { if (!this.visible) return false; this.continuation?.(); return true; }
  hide = vi.fn(() => { this.visible = false; });
} }));
import { JourneyScene } from './JourneyScene';

function object() {
  const result: any = { active: true, x: 288, y: 250 };
  for (const name of ['setStrokeStyle', 'setInteractive', 'setOrigin', 'setDepth', 'setScrollFactor', 'destroy', 'on']) result[name] = vi.fn(() => result);
  result.setPosition = vi.fn((x, y) => { result.x = x; result.y = y; return result; });
  return result;
}
function key() { return { on: vi.fn(), off: vi.fn(), isDown: false }; }
function camp(flags: Record<string, boolean> = { metFoltanAzar: true, campfireLit: true, journeyAte: true }) {
  const scene: any = new JourneyScene();
  const world: any = { flags, inv: {} };
  scene.registry = { get: () => world };
  scene.inCamp = true; scene.campStep = 'star';
  scene.keys = { E: key(), ESC: key(), Q: key(), R: key(), SPACE: key() };
  scene.input = { keyboard: { addKey: key } };
  scene.inventory = { setItemActions: vi.fn(), close: vi.fn(), setVisible: vi.fn() };
  scene.data = { set: vi.fn() };
  scene.lia = object(); scene.azar = object(); scene.azar.x = 397; scene.azar.y = 265;
  scene.time = { delayedCall: vi.fn() };
  scene.add = { rectangle: object, text: object, container: object };
  scene.areaRoot = { add: vi.fn() };
  for (const method of ['setObjective', 'setSpots', 'say', 'setLocked', 'setCinematic', 'setLiaPose', 'goTo', 'updateFire', 'updateArrival', 'drawFire']) scene[method] = vi.fn();
  scene.cloak = { setVisible: vi.fn() }; scene.blanket = { setVisible: vi.fn() };
  return { scene, world };
}

describe('optional first-camp exploration', () => {
  it('shows every camp activity at once after the encounter, with free choice of star, people, sitting and sleep', () => {
    const { scene } = camp(); scene.campSpots();
    const spots = scene.setSpots.mock.lastCall[0];
    for (const id of ['bedroll', 'fire', 'fire-seat', 'star', 'foltan', 'azar', 'road']) {
      const spot = spots.find((value: any) => value.id === id);
      expect(spot.markerVisible()).toBe(true); expect(spot.enabled()).toBe(true);
    }
  });
  it('keeps preparation points visible before their prerequisites are met', () => {
    const { scene } = camp({}); scene.campStep = 'cloak'; scene.campSpots();
    const spots = scene.setSpots.mock.lastCall[0];
    for (const id of ['fire', 'fire-seat', 'bedroll', 'star', 'stones', 'twigs', 'road']) {
      const spot = spots.find((value: any) => value.id === id);
      expect(spot.markerVisible()).toBe(true); expect(spot.markerWhenDisabled).toBe(true);
    }
    expect(spots.find((spot: any) => spot.id === 'fire-seat').enabled()).toBe(false);
    expect(spots.find((spot: any) => spot.id === 'foltan').markerVisible()).toBe(false);
  });
  it('can sleep directly without triggering or completing the optional star reflection', () => {
    const { scene, world } = camp(); scene.beginStarReflection = vi.fn();
    scene.useCampSpot('bedroll');
    expect(scene.goTo).toHaveBeenCalledExactlyOnceWith('companions-road');
    expect(scene.beginStarReflection).not.toHaveBeenCalled();
    expect(world.flags.criosObserved).toBeUndefined();
    expect(world.flags.journeyCloakRecovered).toBe(true);
  });
  it('sits, breathes, and stands with E without locking exploration or triggering any other action', () => {
    const { scene } = camp(); scene.useCampSpot('fire-seat');
    expect(scene.campSeatActive).toBe(true);
    expect(scene.setLiaPose).toHaveBeenLastCalledWith('lia-camp-sit-down');
    scene.time.delayedCall.mock.lastCall[1]();
    expect(scene.setLiaPose).toHaveBeenLastCalledWith('lia-camp-sit');
    scene.useCampSpot('fire-seat'); expect(scene.campSeatActive).toBe(false);
    expect(scene.setLiaPose).toHaveBeenLastCalledWith('lia-camp-stand-up');
    scene.time.delayedCall.mock.lastCall[1](); expect(scene.setLiaPose).toHaveBeenLastCalledWith(null);
    expect(scene.setLocked).not.toHaveBeenCalled();
  });
  it('standing via movement preserves the existing click route and cancels the delayed sitting pose', () => {
    const { scene } = camp(); scene.useCampSpot('fire-seat');
    const sittingCallback = scene.time.delayedCall.mock.lastCall[1];
    const refreshes = scene.setSpots.mock.calls.length;
    scene.testWalk = true; scene.update(100, 16);
    expect(scene.campSeatActive).toBe(false); expect(scene.lia.x).toBe(289);
    expect(scene.setLiaPose).toHaveBeenLastCalledWith(null);
    expect(scene.setSpots.mock.calls.length).toBe(refreshes);
    sittingCallback(); expect(scene.setLiaPose).toHaveBeenLastCalledWith(null);
  });
  it('Azar only snores, without opening a dialogue or changing the quest', () => {
    const { scene, world } = camp(); scene.openCampConversation = vi.fn();
    scene.add.text = vi.fn(object); scene.useCampSpot('azar');
    expect(scene.add.text.mock.calls[0].slice(0, 3)).toEqual([397, 234, 'Zzzzz']);
    expect(scene.openCampConversation).not.toHaveBeenCalled();
    expect(world.flags.criosObserved).toBeUndefined();
  });
  it('lets the reader choose Foltan topics, return to the menu, and leave it with all controls restored', () => {
    const { scene } = camp(); scene.useCampSpot('foltan');
    expect(scene.campConversationActive).toBe(true);
    expect(scene.campDialogue.setText.mock.lastCall[0]).toContain('Foltan:');
    scene.campDialogue.advance();
    expect(scene.campMenu).toBeDefined();
    expect(scene.data.set.mock.calls).toContainEqual(['story:camp-dialogue', { active: true, stage: 'menu', choices: ['kyra', 'road', 'watch', 'back'] }]);
    scene.chooseCampConversation('kyra');
    expect(scene.campDialogue.setText.mock.lastCall[0]).toContain('Kyra');
    scene.campDialogue.advance(); scene.campDialogue.advance(); scene.campDialogue.advance();
    expect(scene.campMenu).toBeDefined();
    scene.chooseCampConversation('back');
    expect(scene.campConversationActive).toBe(false);
    expect(scene.keys.E.off).toHaveBeenCalled(); expect(scene.keys.ESC.off).toHaveBeenCalled();
    expect(scene.setLocked).toHaveBeenLastCalledWith(false);
    expect(scene.inventory.setVisible).toHaveBeenLastCalledWith(true);
    expect(scene.canUseCampSpot('star')).toBe(true);
  });
});
