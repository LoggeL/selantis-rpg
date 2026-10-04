import Phaser from 'phaser';
import { BootScene, TitleScene } from "../presentation/phaser/scenes/BootScene";
import { BattleScene } from "../presentation/phaser/scenes/BattleScene";
import { StoryPrologueScene } from "../presentation/phaser/scenes/StoryPrologueScene";
import { BreakScene } from "../presentation/phaser/scenes/BreakScene";
import { FlightScene } from "../presentation/phaser/scenes/FlightScene";
import { RefugeScene } from "../presentation/phaser/scenes/RefugeScene";
import { LiaScene } from "../presentation/phaser/scenes/LiaScene";
import { WorldScene } from "../presentation/phaser/scenes/WorldScene";
import { RaidScene } from "../presentation/phaser/scenes/RaidScene";
import { AftermathScene } from "../presentation/phaser/scenes/AftermathScene";
import { JourneyScene } from "../presentation/phaser/scenes/JourneyScene";
import { CompanionJourneyScene } from "../presentation/phaser/scenes/CompanionJourneyScene";
import { SettingsScene } from "../presentation/phaser/scenes/SettingsScene";
import { installSettingsControls } from "./settings";
import { installSceneAudio } from "./audio";
import { installMobileControls } from "../presentation/dom/mobileControls";
import { installDebugControls } from "../presentation/dom/debug";
import { installCharacterStatsControls } from "../presentation/dom/characterSheetControls";
import { withSceneAssets } from "../platform/assets/sceneAssets";
import { installGameInput } from "../platform/input/router";
import { SCENE_CATALOG, type SceneKey } from "./sceneCatalog";
import { ApplicationLifetime, type Disposer } from "./lifetime";
import { installApplicationViewport } from "./viewport";

import { ContinuationScene } from '../presentation/phaser/scenes/ContinuationScene';
import { NOVEL_CONTINUATION_CHAPTERS } from '../content/chapters/continuationNovel';
import { FILM_CONTINUATION_CHAPTERS } from '../content/chapters/continuationFilm';
import type { ContinuationChapterDefinition } from '../modules/continuation/types';

type SceneConstructor = new () => Phaser.Scene;
export function applicationScenes(): SceneConstructor[] {
  const continuationScene = (id: string): SceneConstructor => {
    const chapter: ContinuationChapterDefinition | undefined = [...NOVEL_CONTINUATION_CHAPTERS, ...FILM_CONTINUATION_CHAPTERS].find(entry => entry.id === id);
    if (!chapter) throw new Error(`Missing continuation chapter: ${id}`);
    return class extends ContinuationScene { constructor() { super(chapter!); } };
  };
  const constructors = {
    'golden-boar': continuationScene('golden-boar'), 'reading-camp': continuationScene('reading-camp'),
    brotherhood: continuationScene('brotherhood'), betrayal: continuationScene('betrayal'),
    'rain-forest': continuationScene('rain-forest'), 'flick-trail': continuationScene('flick-trail'),
    'shadow-camp': continuationScene('shadow-camp'), 'sisters-reunited': continuationScene('sisters-reunited'),
    'film-one-finale': continuationScene('film-one-finale'),
    boot: BootScene, title: TitleScene, storyprologue: StoryPrologueScene, battle: BattleScene,
    break: BreakScene, flight: FlightScene, refuge: RefugeScene, lia: LiaScene, world: WorldScene,
    raid: RaidScene, aftermath: AftermathScene, journey: JourneyScene, 'companions-road': CompanionJourneyScene,
    Settings: SettingsScene,
  } satisfies Record<SceneKey, SceneConstructor>;
  return (Object.keys(SCENE_CATALOG) as SceneKey[]).map(key => key === 'boot' ? constructors[key] : withSceneAssets(constructors[key]));
}

export function applicationConfig(host: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.WEBGL, parent: host, width: 640, height: 360, pixelArt: true, roundPixels: true,
    input: { activePointers: 3 }, backgroundColor: '#07080a',
    scale: { mode: Phaser.Scale.NONE, width: 640, height: 360 }, scene: applicationScenes(),
  };
}

export interface Application { readonly game: Phaser.Game; dispose(): void }
export interface ApplicationOptions { host?: HTMLElement; exposeForPlaytest?: boolean }

declare global { interface Window { game?: Phaser.Game } }

/** The only place that creates the game and installs app-wide adapters. */
export function launchApplication(options: ApplicationOptions = {}): Application {
  const host = options.host ?? document.getElementById('game');
  if (!host) throw new Error('Selantis game host is missing');
  const game = new Phaser.Game(applicationConfig(host));
  const lifetime = new ApplicationLifetime();
  let destroyed = false;
  const add = (dispose: Disposer) => {
    // Installers also support standalone callers. Composition owns their teardown here.
    game.events.off('destroy', dispose);
    lifetime.add(dispose);
  };
  const onDestroy = () => { destroyed = true; lifetime.dispose(); };
  game.events.once('destroy', onDestroy);
  lifetime.add(() => game.events.off('destroy', onDestroy));
  try {
    add(installGameInput(game));
    add(installSettingsControls(game));
    add(installDebugControls(game));
    add(installSceneAudio(game));
    add(installMobileControls(game));
    add(installCharacterStatsControls(game));
    add(installApplicationViewport(game, host, document.getElementById('mobile-controls')));
    if (options.exposeForPlaytest !== false) {
      window.game = game;
      lifetime.add(() => { if (window.game === game) delete window.game; });
    }
  } catch (error) {
    try { lifetime.dispose(); } finally { game.destroy(true); }
    throw error;
  }
  return { game, dispose() {
    if (destroyed) return;
    destroyed = true;
    try { lifetime.dispose(); } finally { game.destroy(true); }
  } };
}
