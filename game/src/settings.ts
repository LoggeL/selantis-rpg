import type Phaser from 'phaser';

export type GameSettings = Readonly<{
  musicVolume: number;
  effectsVolume: number;
  reducedMotion: boolean;
  particles: boolean;
}>;

const STORAGE_KEY = 'selantis.settings.v1';
const defaults: GameSettings = {
  musicVolume: 0.45,
  effectsVolume: 0.65,
  reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  particles: true,
};

function normalize(value: unknown, base: GameSettings): GameSettings {
  const result = { ...base };
  if (!value || typeof value !== 'object') return Object.freeze(result);
  const input = value as Record<string, unknown>;
  for (const key of ['musicVolume', 'effectsVolume'] as const) {
    const v = input[key];
    if (typeof v === 'number' && Number.isFinite(v)) result[key] = Math.max(0, Math.min(1, v));
  }
  for (const key of ['reducedMotion', 'particles'] as const) {
    if (typeof input[key] === 'boolean') result[key] = input[key];
  }
  return Object.freeze(result);
}

function load(): GameSettings {
  try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'), defaults); }
  catch { return Object.freeze({ ...defaults }); }
}

let current = load();
const listeners = new Set<(settings: GameSettings) => void>();
export const getSettings = (): GameSettings => current;
export function updateSettings(patch: Partial<GameSettings>): GameSettings {
  const next = normalize(patch, current);
  if (Object.keys(next).every((key) => next[key as keyof GameSettings] === current[key as keyof GameSettings])) return current;
  current = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* Private mode and full storage remain playable. */ }
  for (const listener of listeners) { try { listener(current); } catch { /* One stale scene must not interrupt other listeners. */ } }
  return current;
}
export function subscribeSettings(listener: (settings: GameSettings) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => { listeners.delete(listener); };
}
export const motionDuration = (ms: number): number => current.reducedMotion ? 0 : ms;
export const ambientPrefs = () => ({ reducedMotion: current.reducedMotion, particles: current.particles && !current.reducedMotion });

const OVERLAY = 'Settings';
let host: Phaser.Game | undefined;
let opened = false;
const paused = new Map<Phaser.Scene, { input: boolean; shutdown: () => void }>();

function pauseActiveScenes() {
  if (!opened || !host) return;
  for (const scene of host.scene.getScenes(true)) {
    if (scene.sys.settings.key === OVERLAY || paused.has(scene)) continue;
    const shutdown = () => { paused.delete(scene); };
    paused.set(scene, { input: scene.input.enabled, shutdown });
    scene.events.once('shutdown', shutdown);
    scene.input.keyboard?.resetKeys();
    scene.input.enabled = false;
    host.scene.pause(scene.sys.settings.key);
  }
  host.scene.bringToTop(OVERLAY);
}

export const settingsAreOpen = () => opened;
export function openSettings(game = host) {
  if (!game || opened || !game.scene.keys[OVERLAY]) return;
  host = game;
  opened = true;
  pauseActiveScenes();
  game.scene.start(OVERLAY);
  game.scene.bringToTop(OVERLAY);
}
export function closeSettings() {
  if (!opened || !host) return;
  const game = host;
  opened = false;
  if (game.scene.isActive(OVERLAY)) game.scene.stop(OVERLAY);
  for (const [scene, state] of paused) {
    scene.events.off('shutdown', state.shutdown);
    // A stopped/restarted scene is removed by its shutdown event, so never resurrect it.
    if (game.scene.isPaused(scene.sys.settings.key)) {
      scene.input.enabled = state.input;
      scene.input.keyboard?.resetKeys();
      game.scene.resume(scene.sys.settings.key);
    }
  }
  paused.clear();
}
export function toggleSettings(game = host) { if (opened) closeSettings(); else openSettings(game); }

/** Pauses new scenes too if an asynchronous transition completes beneath the overlay. */
export function installSettingsControls(game: Phaser.Game): () => void {
  host = game;
  const keydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (event.code !== 'KeyO' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || '')) return;
    event.preventDefault();
    toggleSettings(game);
  };
  window.addEventListener('keydown', keydown);
  game.events.on('prestep', pauseActiveScenes);
  const dispose = () => {
    window.removeEventListener('keydown', keydown);
    game.events.off('prestep', pauseActiveScenes);
    closeSettings();
    if (host === game) host = undefined;
  };
  game.events.once('destroy', dispose);
  return dispose;
}
