import type Phaser from 'phaser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class Events {
  listeners = new Map<string, Set<() => void>>();
  on(name: string, listener: () => void) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(listener);
  }
  once(name: string, listener: () => void) {
    const once = () => { this.off(name, once); listener(); };
    // Match Phaser's ability to remove a once-listener by its original function.
    Object.assign(once, { original: listener });
    this.on(name, once);
  }
  off(name: string, listener: () => void) {
    for (const item of this.listeners.get(name) ?? []) {
      if (item === listener || (item as { original?: () => void }).original === listener) this.listeners.get(name)!.delete(item);
    }
  }
  emit(name: string) { for (const listener of [...this.listeners.get(name) ?? []]) listener(); }
  count(name: string) { return this.listeners.get(name)?.size ?? 0; }
}

function gameFixture() {
  const events = new Events();
  const scenes = ['world', 'journey', 'Settings'].map(key => ({
    sys: { settings: { key } }, input: { enabled: key !== 'journey', keyboard: { resetKeys: vi.fn() } }, events: new Events(),
  }));
  const states = new Map([['world', 'active'], ['journey', 'stopped'], ['Settings', 'stopped']]);
  const manager = {
    keys: Object.fromEntries(scenes.map(scene => [scene.sys.settings.key, scene])),
    getScenes: (active: boolean) => active ? scenes.filter(scene => states.get(scene.sys.settings.key) === 'active') : scenes,
    isActive: (key: string) => states.get(key) === 'active',
    isPaused: (key: string) => states.get(key) === 'paused',
    pause: (key: string) => states.set(key, 'paused'),
    resume: vi.fn((key: string) => states.set(key, 'active')),
    start: (key: string) => states.set(key, 'active'),
    stop: (key: string) => { states.set(key, 'stopped'); manager.keys[key].events.emit('shutdown'); },
    bringToTop: vi.fn(),
  };
  return { game: { scene: manager, events } as unknown as Phaser.Game, scenes, states, events, manager };
}

describe('settings game lifetime', () => {
  const stored = new Map<string, string>();
  beforeEach(() => {
    vi.resetModules(); stored.clear();
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key), setItem: (key: string, value: string) => stored.set(key, value) });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('preserves normalization, persisted preferences and reduced motion', async () => {
    const settings = await import("../app/settings");
    expect(settings.getSettings().reducedMotion).toBe(true);
    settings.updateSettings({ musicVolume: 2, effectsVolume: -1, particles: true });
    expect(settings.getSettings().musicVolume).toBe(1);
    expect(settings.getSettings().effectsVolume).toBe(0);
    expect(settings.motionDuration(600)).toBe(0);
    expect(settings.ambientPrefs()).toEqual({ reducedMotion: true, particles: false });
    vi.resetModules();
    expect((await import("../app/settings")).getSettings()).toEqual(settings.getSettings());
  });

  it('pauses transitions beneath the overlay and preserves disabled input on close', async () => {
    const settings = await import("../app/settings"); const fixture = gameFixture();
    const dispose = settings.installSettingsControls(fixture.game);
    expect(settings.installSettingsControls(fixture.game)).toBe(dispose);
    settings.openSettings(fixture.game);
    expect(fixture.states.get('world')).toBe('paused');
    expect(fixture.scenes[0].input.enabled).toBe(false);
    fixture.states.set('journey', 'active'); fixture.events.emit('prestep');
    expect(fixture.states.get('journey')).toBe('paused');
    settings.closeSettings(fixture.game);
    expect(fixture.scenes[0].input.enabled).toBe(true);
    expect(fixture.scenes[1].input.enabled).toBe(false);
    expect(fixture.states.get('journey')).toBe('active');
    dispose();
    expect(fixture.events.count('prestep')).toBe(0);
    expect(fixture.events.count('destroy')).toBe(0);
  });

  it('does not resume a stopped scene and clears handlers when its game is destroyed', async () => {
    const settings = await import("../app/settings"); const fixture = gameFixture();
    const dispose = settings.installSettingsControls(fixture.game);
    settings.openSettings(fixture.game);
    fixture.manager.stop('world');
    fixture.events.emit('destroy'); dispose();
    expect(settings.settingsAreOpen(fixture.game)).toBe(false);
    expect(fixture.manager.resume).not.toHaveBeenCalled();
    expect(fixture.scenes[0].events.count('shutdown')).toBe(0);
    expect(fixture.events.count('prestep')).toBe(0);
    const key = new Event('keydown'); Object.assign(key, { code: 'KeyO' }); window.dispatchEvent(key);
    expect(fixture.states.get('Settings')).toBe('stopped');
  });

  it('disposes the owning overlay without closing another game', async () => {
    const settings = await import("../app/settings"); const first = gameFixture(); const second = gameFixture();
    const disposeFirst = settings.installSettingsControls(first.game);
    const disposeSecond = settings.installSettingsControls(second.game);
    settings.openSettings(first.game); settings.openSettings(second.game);
    disposeFirst();
    expect(settings.settingsAreOpen(first.game)).toBe(false);
    expect(settings.settingsAreOpen(second.game)).toBe(true);
    disposeSecond();
  });
});
