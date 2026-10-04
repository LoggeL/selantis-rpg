import { CAMPAIGN_CHECKPOINTS, isCampaignCheckpoint, type CampaignCheckpointId } from "../modules/campaign/checkpoints";
import { MAPS } from "../content/maps/index";

export const CHAPTER_CATALOG = {
  opening: { title: 'Die Chroniken von Selantis' },
  valentus: { title: 'Valentus' },
  homecoming: { title: 'Lias Heimweg' },
  farm: { title: 'Der Hof' },
  firstJourney: { title: 'Die erste Reise' },
  companions: { title: 'Mit Foltan und Azar' },
} as const;
export type ChapterId = keyof typeof CHAPTER_CATALOG;

interface SceneDefinition { title: string; chapter?: ChapterId; startup: boolean }
/** App metadata is independent of Phaser constructors and asset loading. */
export const SCENE_CATALOG = {
  boot: { title: 'Laden', startup: false },
  title: { title: 'Die Chroniken von Selantis', chapter: 'opening', startup: true },
  storyprologue: { title: 'Vor Dunkelhain', chapter: 'valentus', startup: true },
  battle: { title: 'Valentus · Schlachtutorial', chapter: 'valentus', startup: true },
  break: { title: 'Verwundung', chapter: 'valentus', startup: true },
  flight: { title: 'Flucht', chapter: 'valentus', startup: true },
  refuge: { title: 'Zuflucht', chapter: 'valentus', startup: true },
  lia: { title: 'Lia · Gespräch mit Kyra', chapter: 'homecoming', startup: true },
  world: { title: 'Heimweg', chapter: 'homecoming', startup: true },
  raid: { title: 'Überfall', chapter: 'farm', startup: true },
  aftermath: { title: 'Hof · Reisevorbereitung', chapter: 'farm', startup: true },
  journey: { title: 'Reise', chapter: 'firstJourney', startup: true },
  'companions-road': { title: 'Reise · Aufbruch und Waldrast', chapter: 'companions', startup: true },
  Settings: { title: 'Einstellungen', startup: false },
} as const satisfies Record<string, SceneDefinition>;

export type SceneKey = keyof typeof SCENE_CATALOG;
export type StartupSceneKey = Exclude<SceneKey, 'boot' | 'Settings'>;
export const DEBUG_STARTUPS = CAMPAIGN_CHECKPOINTS;
export function isSceneKey(key: string): key is SceneKey { return Object.hasOwn(SCENE_CATALOG, key); }
export function isStartupSceneKey(key: string): key is StartupSceneKey { return isSceneKey(key) && SCENE_CATALOG[key].startup; }

export interface StartupRoute {
  scene: StartupSceneKey;
  data: { map?: string };
  checkpoint?: CampaignCheckpointId;
  direct: boolean;
}

function checkpointRoute(checkpoint: CampaignCheckpointId): StartupRoute {
  if (checkpoint.startsWith('world:')) return { scene: 'world', data: { map: checkpoint.slice('world:'.length) }, checkpoint, direct: true };
  const scene = ['road', 'camp', 'strangers'].includes(checkpoint) ? 'journey' : checkpoint;
  // Named checkpoints must target a registered, startable scene.
  if (!isStartupSceneKey(scene)) return { scene: 'title', data: {}, direct: false };
  return { scene, data: {}, checkpoint, direct: true };
}

/** Invalid URL input never reaches Phaser's scene manager. */
export function resolveStartup(search: string | URLSearchParams): StartupRoute {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const requested = params.get('scene');
  if (!requested) return { scene: 'title', data: {}, direct: false };
  if (requested === 'world') {
    const requestedMap = params.get('map') ?? 'wiese';
    const map = Object.hasOwn(MAPS, requestedMap) ? requestedMap : 'wiese';
    const checkpoint = `world:${map}`;
    if (isCampaignCheckpoint(checkpoint)) return checkpointRoute(checkpoint);
  }
  if (requested === 'journey') return checkpointRoute('road');
  if (isCampaignCheckpoint(requested)) return checkpointRoute(requested);
  if (isStartupSceneKey(requested)) return { scene: requested, data: {}, direct: true };
  return { scene: 'title', data: {}, direct: false };
}
