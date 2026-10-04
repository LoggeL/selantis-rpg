// World engine: exploration maps, actors, stealth, lighting, weather. See docs/rebuild/world-guide.md.
import type Phaser from 'phaser';
import { G } from '../core/G';
import type { StartWorldOptions } from './api';
import { WORLD_SCENE_KEY, WorldScene } from './WorldScene';

export * from './api';
export { defineMap, getMap, hasMap, mapIds } from './maps';
export { WORLD_SCENE_KEY } from './WorldScene';

export const phaserScenes: Phaser.Types.Scenes.SceneType[] = [WorldScene];

/**
 * Starts the exploration scene with a map (and an optional main script). Use from a chapter scene's start():
 *   start: () => startWorld({ map: 'farm', spawn: 'start', script: async w => { ... } })
 * Resolves once the first map is built and visible.
 */
export function startWorld(opts: StartWorldOptions): Promise<void> {
  return new Promise(resolve => {
    G.stopGameplayScenes();
    G.game.scene.start(WORLD_SCENE_KEY, { opts, ready: resolve });
  });
}

/** The running world scene (debug/e2e). */
export function currentWorld(): WorldScene | undefined {
  const s = G.game?.scene.getScene(WORLD_SCENE_KEY) as WorldScene | undefined;
  return s && s.sys.isActive() ? s : undefined;
}
