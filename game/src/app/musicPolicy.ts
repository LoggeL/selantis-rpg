import { MUSIC_TRACKS } from '../content/audio/tracks';
import type { AmbientKind } from '../modules/audio/types';
export { MUSIC_TRACKS } from '../content/audio/tracks';
export type { AmbientKind } from '../modules/audio/types';

const SCENE_MOODS: Readonly<Record<string, AmbientKind>> = {
  storyprologue: 'dread',
  battle: 'battle', break: 'flight', flight: 'flight', refuge: 'refuge',
  lia: 'exploration', world: 'exploration', raid: 'dread', aftermath: 'grief', journey: 'grief', 'companions-road': 'refuge',
};

/** Story beats may change mood without starting a new Phaser scene. */
export function musicForScene(scene: string, override?: unknown): AmbientKind | undefined {
  if (!Object.hasOwn(SCENE_MOODS, scene)) return undefined;
  return typeof override === 'string' && Object.hasOwn(MUSIC_TRACKS, override)
    ? override as AmbientKind : SCENE_MOODS[scene];
}
