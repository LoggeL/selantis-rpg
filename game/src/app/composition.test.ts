import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => {
  const calls: string[] = [];
  const disposers = new Map<string, ReturnType<typeof vi.fn>>();
  const installer = (name: string) => vi.fn((game: { events: { once(event: string, fn: () => void): unknown } }) => {
    const dispose = vi.fn(() => calls.push(name)); disposers.set(name, dispose);
    game.events.once('destroy', dispose); return dispose;
  });
  const scene = (key: string) => class { key = key };
  return { calls, disposers, installer, scene, wrap: vi.fn((base: unknown) => base) };
});

vi.mock('phaser', () => ({ default: {
  WEBGL: 2, Scale: { NONE: 0 },
  Game: class {
    config: unknown;
    listeners = new Map<string, Set<() => void>>();
    events = {
      once: (event: string, fn: () => void) => { let list = this.listeners.get(event); if (!list) this.listeners.set(event, list = new Set()); list.add(fn); },
      off: (event: string, fn: () => void) => { this.listeners.get(event)?.delete(fn); },
      emit: (event: string) => { const list = [...(this.listeners.get(event) ?? [])]; this.listeners.delete(event); for (const fn of list) fn(); },
    };
    constructor(config: unknown) { this.config = config; }
    destroy = vi.fn(() => this.events.emit('destroy'));
  },
} }));
vi.mock("../presentation/phaser/scenes/BootScene", () => ({ BootScene: runtime.scene('boot'), TitleScene: runtime.scene('title') }));
vi.mock("../presentation/phaser/scenes/StoryPrologueScene", () => ({ StoryPrologueScene: runtime.scene('storyprologue') }));
vi.mock('../presentation/phaser/scenes/RescueBattleScene', () => ({ RescueBattleScene: runtime.scene('rescue-battle') }));
vi.mock('../presentation/phaser/scenes/TrackingScene', () => ({ TrackingScene: runtime.scene('tracking') }));
vi.mock("../presentation/phaser/scenes/BattleScene", () => ({ BattleScene: runtime.scene('battle') }));
vi.mock("../presentation/phaser/scenes/BreakScene", () => ({ BreakScene: runtime.scene('break') }));
vi.mock("../presentation/phaser/scenes/FlightScene", () => ({ FlightScene: runtime.scene('flight') }));
vi.mock("../presentation/phaser/scenes/RefugeScene", () => ({ RefugeScene: runtime.scene('refuge') }));
vi.mock("../presentation/phaser/scenes/LiaScene", () => ({ LiaScene: runtime.scene('lia') }));
vi.mock("../presentation/phaser/scenes/WorldScene", () => ({ WorldScene: runtime.scene('world') }));
vi.mock("../presentation/phaser/scenes/RaidScene", () => ({ RaidScene: runtime.scene('raid') }));
vi.mock("../presentation/phaser/scenes/AftermathScene", () => ({ AftermathScene: runtime.scene('aftermath') }));
vi.mock("../presentation/phaser/scenes/JourneyScene", () => ({ JourneyScene: runtime.scene('journey') }));
vi.mock("../presentation/phaser/scenes/CompanionJourneyScene", () => ({ CompanionJourneyScene: runtime.scene('companions-road') }));
vi.mock('../presentation/phaser/scenes/ContinuationScene', () => ({ ContinuationScene: class { key: string; constructor(chapter: { id: string }) { this.key = chapter.id; } } }));
vi.mock("../presentation/phaser/scenes/SettingsScene", () => ({ SettingsScene: runtime.scene('Settings') }));
vi.mock('../platform/assets/sceneAssets', () => ({ withSceneAssets: runtime.wrap }));
vi.mock('../platform/input/router', () => ({ installGameInput: runtime.installer('input') }));
vi.mock("./settings", () => ({ installSettingsControls: runtime.installer('settings') }));
vi.mock("../presentation/dom/debug", () => ({ installDebugControls: runtime.installer('debug') }));
vi.mock("./audio", () => ({ installSceneAudio: runtime.installer('audio') }));
vi.mock("../presentation/dom/mobileControls", () => ({ installMobileControls: runtime.installer('mobile') }));
vi.mock("../presentation/dom/characterSheetControls", () => ({ installCharacterStatsControls: runtime.installer('stats') }));
vi.mock('./viewport', () => ({ installApplicationViewport: runtime.installer('viewport') }));

import { applicationConfig, launchApplication } from "./composition";
import { SCENE_CATALOG } from "./sceneCatalog";

beforeEach(() => {
  runtime.calls.length = 0; runtime.disposers.clear(); vi.clearAllMocks();
  vi.stubGlobal('document', { getElementById: () => null });
  vi.stubGlobal('window', {});
});
afterEach(() => vi.unstubAllGlobals());

describe('app composition', () => {
  it('registers constructors for the complete scene catalog, wrapping every scene after Boot', () => {
    const config = applicationConfig({} as HTMLElement);
    const constructors = config.scene as (new () => { key: string })[];
    expect(constructors.every(scene => typeof scene === 'function')).toBe(true);
    expect(constructors.map(Scene => new Scene().key)).toEqual(Object.keys(SCENE_CATALOG));
    expect(runtime.wrap).toHaveBeenCalledTimes(constructors.length - 1);
    expect(runtime.wrap.mock.calls.some(([Scene]) => new (Scene as new () => { key: string })().key === 'boot')).toBe(false);
  });

  it('owns installed runtime cleanup and clears the intentional playtest game reference', () => {
    const app = launchApplication({ host: {} as HTMLElement });
    expect(window.game).toBe(app.game);
    app.dispose(); app.dispose();
    expect(runtime.calls).toEqual(['viewport', 'stats', 'mobile', 'audio', 'debug', 'settings', 'input']);
    for (const dispose of runtime.disposers.values()) expect(dispose).toHaveBeenCalledOnce();
    expect(window.game).toBeUndefined();
    expect(app.game.destroy).toHaveBeenCalledOnce();
  });

  it('also cleans runtime when Phaser destroys the game externally', () => {
    const app = launchApplication({ host: {} as HTMLElement, exposeForPlaytest: false });
    app.game.events.emit('destroy');
    expect(runtime.calls).toHaveLength(7);
    for (const dispose of runtime.disposers.values()) expect(dispose).toHaveBeenCalledOnce();
    app.dispose(); expect(runtime.calls).toHaveLength(7);
    expect(app.game.destroy).not.toHaveBeenCalled();
  });
});
