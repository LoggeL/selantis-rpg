import { describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { StoryScene } from '../story/StoryScene';
import { WorldScene } from './WorldScene';

function player() {
  const sprite: any = { anims: { currentAnim: { key: 'lia-walk-s' }, isPlaying: true } };
  sprite.play = vi.fn(() => sprite);
  sprite.setFlipX = vi.fn(() => sprite);
  sprite.setOrigin = vi.fn(() => sprite);
  return sprite;
}

describe('the active player uses persistent appearances', () => {
  it('updates an idle story sprite immediately, and restores its outfit after a pose', () => {
    const scene: any = new StoryScene('story');
    const flags: Record<string, boolean> = {};
    scene.registry = { get: () => ({ flags }) };
    scene.area = { id: 'house' }; scene.data = { set: vi.fn() };
    scene.anims = { exists: () => true }; scene.lia = player();
    scene.refreshLiaAppearance();
    expect(scene.lia.play).toHaveBeenLastCalledWith('lia-idle-s', true);
    flags.packedClothes = true; scene.refreshLiaAppearance();
    expect(scene.lia.play).toHaveBeenLastCalledWith('lia-travel-idle-s', true);
    scene.setLiaPose('lia-pack');
    expect(scene.lia.play).toHaveBeenLastCalledWith('lia-pack', true);
    scene.setLiaPose(null);
    expect(scene.lia.play).toHaveBeenLastCalledWith('lia-travel-idle-s', true);
    scene.playLiaMovement('e', true);
    expect(scene.lia.play).toHaveBeenLastCalledWith('lia-travel-walk-e', true);
  });

  it('uses the cloak for world walking, jumping and climbing after the campsite is left', () => {
    const scene: any = new WorldScene();
    scene.st = { flags: { departureReady: true, journeyCloakSpread: true, journeyCloakRecovered: true } };
    scene.map = { id: 'felder' }; scene.data = { set: vi.fn() }; scene.lia = player();
    scene.playLiaMovement('n', true);
    expect(scene.lia.play).toHaveBeenLastCalledWith('lia-cloak-walk-n', true);
    scene.playLiaMovement('n', false);
    expect(scene.lia.play).toHaveBeenLastCalledWith('lia-cloak-idle-n', true);
    expect(scene.data.set).toHaveBeenLastCalledWith('story:lia-appearance', expect.objectContaining({ cloakWorn: true, cloakOnGround: false }));
  });
});
