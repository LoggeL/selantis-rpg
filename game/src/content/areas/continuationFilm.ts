import type { Pt, StoryArea } from '../../modules/narrative/types';

/** Broad footpath corridors; all objectives and exits stay on connected ground. */
const FOREST_PATH: Pt[] = [
  [0, 164], [100, 171], [220, 190], [320, 166], [440, 156], [540, 146], [640, 129],
  [640, 268], [540, 270], [440, 273], [320, 270], [220, 258], [100, 243], [0, 233],
];
/** Clearing below the ruined wall, with an approach to the tree root at (592,140). */
const CAMP_GROUND: Pt[] = [[20, 130], [120, 130], [180, 134], [330, 128], [480, 120], [550, 123], [610, 131], [624, 165], [620, 285], [380, 285], [220, 281], [20, 268]];
/** Same painted foot edges as the existing companion forest background. */
const FLICK_PATH: Pt[] = [
  [0, 167], [55, 170], [105, 181], [160, 188], [210, 193], [250, 178], [274, 154], [296, 157], [336, 164], [365, 180],
  [420, 183], [475, 161], [520, 144], [570, 132], [640, 119], [640, 161], [600, 178], [560, 195], [510, 210],
  [455, 218], [405, 234], [353, 249], [300, 252], [247, 248], [198, 236], [150, 223], [107, 209], [70, 193], [0, 201],
];

const area = (id: string, name: string, bg: string, start: Pt, walk: Pt[]): StoryArea => ({
  id, name, bg, start, walk: [walk], block: [], targets: [],
});

export const RAIN_FOREST_AREA = area('rain-forest', 'Allein im Sommerregen', 'bg-rain-forest', [52, 207], FOREST_PATH);
export const FLICK_TRAIL_AREA = area('flick-trail', 'Flicks Fährte', 'bg-companion-forest-trail', [45, 184], FLICK_PATH);
export const SHADOW_CAMP_AREA = area('shadow-camp', 'Oberhalb des Gefangenenlagers', 'bg-shadow-camp', [55, 240], CAMP_GROUND);
export const SISTERS_REUNITED_AREA = area('sisters-reunited', 'Kyra am Lagerbaum', 'bg-shadow-camp', [460, 226], CAMP_GROUND);
export const FILM_ONE_FINALE_AREA = area('film-one-finale', 'Gemeinsam auf dem Waldweg', 'bg-companion-forest-trail', [48, 184], FLICK_PATH);
