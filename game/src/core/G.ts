import type Phaser from 'phaser';
import type { ArtApi } from '../art/api';
import type { AudioApi } from '../audio/api';
import type { UiApi } from '../ui/api';
import { events } from './events';
import { findScene } from './registry';
import { settings } from './settings';
import { GameState } from './state';

/**
 * Global game facade. Subsystems are attached in main.ts.
 * Chapters use: G.state, G.ui, G.audio, G.goto(sceneId).
 */
export const G = {
  game: undefined as unknown as Phaser.Game,
  state: new GameState(),
  settings,
  events,
  ui: undefined as unknown as UiApi,
  audio: undefined as unknown as AudioApi,
  art: undefined as unknown as ArtApi,
  currentScene: '' as string,

  /** Switches to a story scene by id. Autosaves at the scene start. */
  async goto(id: string, params?: Record<string, unknown>): Promise<void> {
    const found = findScene(id);
    if (!found) throw new Error(`Unknown scene ${id}`);
    G.currentScene = id;
    G.state.save(found.chapter.id, id, params);
    events.emit('scene:goto', { id, chapter: found.chapter.id });
    await found.scene.start(params);
  },

  /** Direct warp (debug, ?scene=, chapter select): prepares state, then starts. */
  async warp(id: string): Promise<void> {
    const found = findScene(id);
    if (!found) throw new Error(`Unknown scene ${id}`);
    G.state.reset();
    found.scene.prepare?.();
    await G.goto(id);
  },

  /** Stops all running gameplay Phaser scenes (except persistent ones). Call before starting a new one. */
  stopGameplayScenes(): void {
    for (const scene of G.game.scene.getScenes(true)) {
      if (scene.scene.key !== 'Boot') G.game.scene.stop(scene.scene.key);
    }
  },
};

if (typeof window !== 'undefined') (window as unknown as { G: typeof G }).G = G; // for e2e tests and debugging
