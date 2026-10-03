export type AmbientKind = 'battle' | 'flight' | 'refuge' | 'exploration' | 'dread' | 'grief';

export const MUSIC_TRACKS: Readonly<Record<AmbientKind, string>> = {
  battle: '/output/audio/scenes/battle-dark-lyria-3-5.mp3',
  flight: '/output/audio/scenes/flight-lyria-3-5.mp3',
  refuge: '/output/audio/scenes/refuge-lyria-3-5.mp3',
  exploration: '/output/audio/scenes/exploration-lyria-3-5.mp3',
  dread: '/output/audio/scenes/dread-lyria-3-5.mp3',
  grief: '/output/audio/scenes/grief-lyria-3-5.mp3',
};

const SCENE_MOODS: Readonly<Record<string, AmbientKind>> = {
  battle: 'battle', break: 'flight', flight: 'flight', refuge: 'refuge',
  lia: 'exploration', world: 'exploration', raid: 'dread', aftermath: 'grief', journey: 'grief',
};

/** Story beats may change mood without starting a new Phaser scene. */
export function musicForScene(scene: string, override?: unknown): AmbientKind | undefined {
  if (!Object.hasOwn(SCENE_MOODS, scene)) return undefined;
  return typeof override === 'string' && Object.hasOwn(MUSIC_TRACKS, override)
    ? override as AmbientKind : SCENE_MOODS[scene];
}
