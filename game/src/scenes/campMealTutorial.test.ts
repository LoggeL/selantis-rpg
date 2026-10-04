import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../audio', () => ({ setSceneMusic: vi.fn() }));
vi.mock('../story/StoryScene', () => ({ StoryScene: class { update() {} } }));
import { JourneyScene } from './JourneyScene';
import { InventoryHud } from '../inventory';
import type { WorldState } from '../world/quests';

function mealCamp() {
  const scene: any = new JourneyScene();
  const world: WorldState = { flags: { campfireLit: true }, inv: { proviant: 2 }, picked: {} };
  scene.registry = { get: () => world };
  scene.inCamp = true;
  scene.campStep = 'meal';
  scene.inventory = { setItemActions: vi.fn(), refresh: vi.fn(), close: vi.fn(), toggle: vi.fn() };
  for (const method of ['setObjective', 'setSpots', 'say', 'setLocked', 'setLiaPose']) scene[method] = vi.fn();
  scene.time = { delayedCall: vi.fn() };
  scene.sleep = vi.fn();
  scene.campSpots();
  const action = scene.inventory.setItemActions.mock.lastCall[0][0];
  return { scene, world, action };
}

describe('first-camp inventory tutorial', () => {
  it('opens the bag at the fire without eating or automatically going to sleep', () => {
    const { scene, world } = mealCamp();
    scene.useCampSpot('fire');
    expect(scene.inventory.toggle).toHaveBeenCalledOnce();
    expect(world.inv.proviant).toBe(2);
    expect(world.flags.journeyAte).toBeUndefined();
    expect(scene.campStep).toBe('meal');
    expect(scene.sleep).not.toHaveBeenCalled();
    expect(scene.time.delayedCall).not.toHaveBeenCalled();
  });

  it('only consumes the selected ration through an open bag action, then leaves sleep to the player', () => {
    const { scene, world, action } = mealCamp();
    expect(action).toMatchObject({ item: 'proviant', label: 'Essen' });
    // Exercise the real inventory gate without constructing the Phaser UI.
    const bag: any = Object.create(InventoryHud.prototype);
    Object.assign(bag, { enabled: true, panel: { visible: false }, inv: world.inv, itemActions: [action] });
    expect(bag.useItem('proviant')).toBe(false);
    bag.panel.visible = true;
    expect(bag.useItem('proviant')).toBe(false);
    bag.selected = 'wasserschlauch';
    expect(bag.useItem('proviant')).toBe(false);
    bag.selected = 'proviant';
    expect(bag.useItem('proviant')).toBe(true);
    expect(world.inv.proviant).toBe(1);
    expect(world.flags.journeyAte).toBe(true);
    expect(scene.campStep).toBe('sleep');
    expect(scene.inventory.refresh).toHaveBeenCalledExactlyOnceWith(world.inv);
    expect(scene.inventory.close).toHaveBeenCalledOnce();
    expect(scene.sleep).not.toHaveBeenCalled();
    expect(scene.time.delayedCall).not.toHaveBeenCalled();
    expect(bag.useItem('proviant')).toBe(false);
    expect(world.inv.proviant).toBe(1);
    expect(scene.inventory.setItemActions.mock.lastCall[0]).toEqual([]);
  });

  it.each(['cloak', 'fire', 'sleep', 'complete'])('rejects a delayed eating action at camp step %s', step => {
    const { scene, world, action } = mealCamp();
    scene.campStep = step;
    expect(action.onUse()).toBe(false);
    expect(world.inv.proviant).toBe(2);
    expect(world.flags.journeyAte).toBeUndefined();
  });

  it('rejects a delayed action outside camp or with an unlit fire', () => {
    const { scene, world, action } = mealCamp();
    scene.inCamp = false;
    expect(action.onUse()).toBe(false);
    scene.inCamp = true;
    world.flags.campfireLit = false;
    expect(action.onUse()).toBe(false);
    expect(world.inv.proviant).toBe(2);
    expect(world.flags.journeyAte).toBeUndefined();
  });

  it('keeps the meal step when the bag has no provisions', () => {
    const { scene, world, action } = mealCamp();
    delete world.inv.proviant;
    expect(action.onUse()).toBe(false);
    expect(scene.campStep).toBe('meal');
    expect(world.flags.journeyAte).toBeUndefined();
    expect(scene.inventory.close).not.toHaveBeenCalled();
  });

  it('prevents sleeping before the meal even if sleep is called directly', () => {
    const { scene, world } = mealCamp();
    scene.campStep = 'sleep';
    (JourneyScene.prototype as any).sleep.call(scene);
    expect(scene.campStep).toBe('meal');
    expect(world.flags.firstCampRested).toBeUndefined();
    expect(scene.time.delayedCall).not.toHaveBeenCalled();
    expect(scene.setLocked).not.toHaveBeenCalled();
  });

  it('starts resting only after the player has eaten and then chooses the bedroll', () => {
    const { scene, world, action } = mealCamp();
    expect(action.onUse()).toBe(true);
    const lia: any = {};
    lia.setPosition = vi.fn(() => lia);
    lia.setDepth = vi.fn(() => lia);
    scene.lia = lia;
    scene.blanket = { setVisible: vi.fn() };
    scene.data = { set: vi.fn() };
    scene.textures = { exists: () => false };
    scene.sleep = (JourneyScene.prototype as any).sleep.bind(scene);
    scene.useCampSpot('bedroll');
    expect(scene.campStep).toBe('waking');
    expect(scene.setLocked).toHaveBeenLastCalledWith(true);
    expect(world.flags.firstCampRested).toBeUndefined();
    expect(scene.time.delayedCall).toHaveBeenCalledOnce();
    scene.time.delayedCall.mock.calls[0][1]();
    expect(world.flags.firstCampRested).toBe(true);
    expect(world.inv.proviant).toBe(1);
  });
});
