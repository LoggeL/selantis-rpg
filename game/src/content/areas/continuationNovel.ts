import type { StoryArea } from '../../modules/narrative/types';

/** Generated tavern furniture ends above y135; the painted floor stays open. */
export const GOLDEN_BOAR_AREA: StoryArea = {
  id: 'golden-boar', name: 'Zum Goldenen Eber', bg: 'bg-golden-boar', start: [548, 162],
  walk: [[[50, 132], [585, 132], [585, 325], [50, 325]]],
  block: [],
  targets: [],
};

/** Reuses the existing night clearing's painted fire and seating anchors. */
export const READING_CAMP_AREA: StoryArea = {
  id: 'reading-camp', name: 'Bücher am Lagerfeuer', bg: 'bg-first-camp-night', start: [517, 285],
  walk: [[[105, 180], [555, 180], [555, 315], [105, 315]]],
  block: [[[300, 211], [334, 211], [334, 238], [300, 238]]],
  targets: [],
};

/** The tents remain above y130, with the command entrance at upper right. */
export const BROTHERHOOD_AREA: StoryArea = {
  id: 'brotherhood', name: 'Das Lager der Freien Bruderschaft', bg: 'bg-brotherhood-camp', start: [94, 286],
  walk: [[[50, 133], [593, 133], [593, 320], [50, 320]]],
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
