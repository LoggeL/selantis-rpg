export type AmbientKind = 'battle' | 'flight' | 'refuge' | 'exploration' | 'dread' | 'grief';

const audioRoot = `${import.meta.env.BASE_URL}output/audio/scenes/`;
export const MUSIC_TRACKS: Readonly<Record<AmbientKind, string>> = {
  battle: `${audioRoot}battle-dark-lyria-3-5.mp3`,
  flight: `${audioRoot}flight-lyria-3-5.mp3`,
  refuge: `${audioRoot}refuge-lyria-3-5.mp3`,
  exploration: `${audioRoot}exploration-lyria-3-5.mp3`,
  dread: `${audioRoot}dread-lyria-3-5.mp3`,
  grief: `${audioRoot}grief-lyria-3-5.mp3`,
};

const SCENE_MOODS: Readonly<Record<string, AmbientKind>> = {
  storyprologue: 'dread',
  battle: 'battle', break: 'flight', flight: 'flight', refuge: 'refuge',
  lia: 'exploration', world: 'exploration', raid: 'dread', aftermath: 'grief', journey: 'grief',
};

/** Story beats may change mood without starting a new Phaser scene. */
export function musicForScene(scene: string, override?: unknown): AmbientKind | undefined {
  if (!Object.hasOwn(SCENE_MOODS, scene)) return undefined;
  return typeof override === 'string' && Object.hasOwn(MUSIC_TRACKS, override)
    ? override as AmbientKind : SCENE_MOODS[scene];
}
