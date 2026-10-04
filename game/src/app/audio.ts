// Composition installs the audio runtime and owns its browser resources.
import type Phaser from 'phaser';
import { musicForScene } from "./musicPolicy";
import { createAudioRuntime, type AudioRuntime } from "../platform/audio/runtime";
export { createAudioRuntime, type AudioRuntime, type AudioRuntimeOptions } from "../platform/audio/runtime";
export { MUSIC_TRACKS, type AmbientKind } from './musicPolicy';
import type { AmbientKind } from "./musicPolicy";

const runtimes = new WeakMap<Phaser.Game, AudioRuntime>();
const installed = new Map<Phaser.Game, () => void>();
let configured: AudioRuntime | undefined;
const forScene = (scene: Phaser.Scene) => scene.game ? runtimes.get(scene.game) : configured;
export function unlockAudio() { configured?.unlockAudio(); }
export function startAmbient(scene: Phaser.Scene, kind: AmbientKind): () => void {
  return forScene(scene)?.startAmbient(scene, kind) ?? (() => {});
}
export function setSceneMusic(scene: Phaser.Scene, kind: AmbientKind) { forScene(scene)?.setSceneMusic(scene, kind); }
export function startBattleAmbience(): () => void { return configured?.startBattleAmbience() ?? (() => {}); }
// Resolve at call time so existing scene imports follow the installed game lifetime.
export const sfx = new Proxy({} as AudioRuntime['sfx'], {
  get: (_target, name: keyof AudioRuntime['sfx']) => (...args: unknown[]) => {
    const effect = configured?.sfx[name];
    if (effect) (effect as (...values: unknown[]) => void)(...args);
  },
});

export function installSceneAudio(game: Phaser.Game): () => void {
  const existing = installed.get(game);
  if (existing) return existing;
  const runtime = createAudioRuntime();
  runtimes.set(game, runtime);
  configured = runtime;
  const sync = () => {
    const scenes = game.scene.getScenes(false).filter((scene) => musicForScene(scene.sys.settings.key) && (game.scene.isActive(scene.sys.settings.key) || game.scene.isPaused(scene.sys.settings.key)));
    const scene = scenes[scenes.length - 1];
    const kind = scene && musicForScene(scene.sys.settings.key, scene.data.get('audio:mood'));
    if (scene && kind && !runtime.ownsAmbient(scene, kind)) runtime.startAmbient(scene, kind);
  };
  const unlock = () => runtime.unlockAudio();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  game.events.on('prestep', sync);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    game.events.off('prestep', sync);
    game.events.off('destroy', dispose);
    runtime.dispose();
    runtimes.delete(game);
    installed.delete(game);
    if (configured === runtime) {
      const previous = [...installed.keys()].at(-1);
      configured = previous ? runtimes.get(previous) : undefined;
    }
  };
  installed.set(game, dispose);
  game.events.once('destroy', dispose);
  return dispose;
}
