import type { StoryArea } from '../../modules/narrative/types';

/** Generated tavern furniture ends above y135; the painted floor stays open. */
export const GOLDEN_BOAR_AREA: StoryArea = {
  id: 'golden-boar', name: 'Zum Goldenen Eber', bg: 'bg-golden-boar', start: [548, 162],
  walk: [[[50, 132], [585, 132], [585, 325], [50, 325]]],
  block: [],
  targets: [],
};

/** Follow the painted bare ground, including the narrow path at the right. */
export const READING_CAMP_AREA: StoryArea = {
  id: 'reading-camp', name: 'Bücher am Lagerfeuer', bg: 'bg-first-camp-night', start: [517, 232],
  walk: [[[125, 168], [190, 145], [305, 154], [377, 157], [427, 178], [443, 211],
    [474, 223], [534, 191], [585, 185], [609, 201], [593, 230], [527, 252],
    [474, 242], [433, 239], [402, 252], [324, 267], [252, 253], [191, 242], [153, 233], [118, 201]]],
  block: [[[300, 211], [334, 211], [334, 238], [300, 238]]],
  targets: [],
};

/** The tents stay above y130; the lower-left stump and rocks are off the path. */
export const BROTHERHOOD_AREA: StoryArea = {
  id: 'brotherhood', name: 'Das Lager der Freien Bruderschaft', bg: 'bg-brotherhood-camp', start: [133, 267],
  walk: [[[50, 133], [593, 133], [593, 263], [552, 289], [490, 316],
    [210, 320], [170, 295], [134, 276], [110, 250], [50, 241]]],
  block: [],
  targets: [],
};

/** Lia remains outside the command tent. The interior is never a playable POV. */
export const BETRAYAL_AREA: StoryArea = {
  id: 'betrayal', name: 'Vor Elnons Zelt', bg: 'bg-brotherhood-camp', start: [509, 201],
  walk: BROTHERHOOD_AREA.walk,
  block: BROTHERHOOD_AREA.block,
  targets: [],
};
