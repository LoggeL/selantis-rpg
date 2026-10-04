import type { AmbientKind } from '../../modules/audio/types';

const audioRoot = 'output/audio/scenes/';
export const MUSIC_TRACKS: Readonly<Record<AmbientKind, string>> = {
  battle: `${audioRoot}battle-dark-lyria-3-5.mp3`,
  flight: `${audioRoot}flight-lyria-3-5.mp3`,
  refuge: `${audioRoot}refuge-lyria-3-5.mp3`,
  exploration: `${audioRoot}exploration-lyria-3-5.mp3`,
  dread: `${audioRoot}dread-lyria-3-5.mp3`,
  grief: `${audioRoot}grief-lyria-3-5.mp3`,
};
