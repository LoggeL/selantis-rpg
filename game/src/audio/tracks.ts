const root = 'output/audio/scenes/';

/** Authored music, served by the selantis-scene-music Vite plugin from output/audio/scenes/. */
export const MUSIC_TRACKS = {
  battle: `${root}battle-dark-lyria-3-5.mp3`,
  flight: `${root}flight-lyria-3-5.mp3`,
  refuge: `${root}refuge-lyria-3-5.mp3`,
  exploration: `${root}exploration-lyria-3-5.mp3`,
  dread: `${root}dread-lyria-3-5.mp3`,
  grief: `${root}grief-lyria-3-5.mp3`,
} as const;

/** The robbers' song plays in the tavern; copied to public/audio/. */
export const TAVERN_TRACK = 'audio/rauberlied.mp3';
