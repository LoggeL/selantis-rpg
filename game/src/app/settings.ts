import type Phaser from 'phaser';
export { getSettings, updateSettings, subscribeSettings, motionDuration, ambientPrefs } from '../platform/settings';
export type { GameSettings } from '../platform/settings';

const OVERLAY = 'Settings';
type SettingsControls = {
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  dispose: () => void;
};
const controls = new Map<Phaser.Game, SettingsControls>();
let host: Phaser.Game | undefined;
const forGame = (game = host) => game ? controls.get(game) : undefined;
export const settingsAreOpen = (game = host) => forGame(game)?.isOpen() ?? false;
export function openSettings(game = host) { forGame(game)?.open(); }
export function closeSettings(game = host) { forGame(game)?.close(); }
export function toggleSettings(game = host) { forGame(game)?.toggle(); }

/** A game's overlay owns its paused scenes and input handlers. */
export function installSettingsControls(game: Phaser.Game): () => void {
  const existing = controls.get(game);
  if (existing) return existing.dispose;
  host = game;
  let opened = false;
  let disposed = false;
  const paused = new Map<Phaser.Scene, { input: boolean; shutdown: () => void }>();
  const pauseActiveScenes = () => {
    if (!opened || disposed) return;
    for (const scene of game.scene.getScenes(true)) {
      if (scene.sys.settings.key === OVERLAY || paused.has(scene)) continue;
      const shutdown = () => { paused.delete(scene); };
      paused.set(scene, { input: scene.input.enabled, shutdown });
      scene.events.once('shutdown', shutdown);
      scene.input.keyboard?.resetKeys();
      scene.input.enabled = false;
      game.scene.pause(scene.sys.settings.key);
    }
    game.scene.bringToTop(OVERLAY);
  };
  const open = () => {
    if (disposed || opened || !game.scene.keys[OVERLAY]) return;
    window.dispatchEvent(new Event('selantis:close-character'));
    opened = true;
    pauseActiveScenes();
    game.scene.start(OVERLAY);
    game.scene.bringToTop(OVERLAY);
  };
  const close = () => {
    if (!opened) return;
    opened = false;
    if (game.scene.isActive(OVERLAY)) game.scene.stop(OVERLAY);
    for (const [scene, state] of paused) {
      scene.events.off('shutdown', state.shutdown);
      // Shutdown removes stopped scenes so closing never resurrects them.
      if (game.scene.isPaused(scene.sys.settings.key)) {
        scene.input.enabled = state.input;
        scene.input.keyboard?.resetKeys();
        game.scene.resume(scene.sys.settings.key);
      }
    }
    paused.clear();
  };
  const toggle = () => { if (opened) close(); else open(); };
  const keydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (event.code !== 'KeyO' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || '')) return;
    event.preventDefault();
    toggle();
  };
  window.addEventListener('keydown', keydown);
  game.events.on('prestep', pauseActiveScenes);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('keydown', keydown);
    game.events.off('prestep', pauseActiveScenes);
    game.events.off('destroy', dispose);
    close();
    controls.delete(game);
    if (host === game) host = [...controls.keys()].at(-1);
  };
  controls.set(game, { isOpen: () => opened, open, close, toggle, dispose });
  game.events.once('destroy', dispose);
  return dispose;
}
