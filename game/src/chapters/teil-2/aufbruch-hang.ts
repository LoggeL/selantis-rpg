// The autumn slope of e2-aufbruch (assets/bg/e2-herbsthang.png, 1280×720): geometry measured on the painting.
// A winding dirt path from the lower left corner up to the top edge on the right; the red bush with the strip of
// white linen right of the path; a small grassy rest below that bush. Tested in aufbruch.test.ts.
import type { Polygon } from '../../world';
import { corridor } from '../kapitel-5/geom';

/** Centre line of the painted path (measured row by row on the background). */
export const HANG_PATH: [number, number][] = [
  [52, 720], [96, 702], [130, 682], [180, 660], [224, 638], [248, 616], [276, 598], [318, 578], [352, 564], [388, 552],
  [440, 541], [500, 529], [538, 514], [554, 496], [556, 478], [564, 461], [582, 446], [608, 430], [640, 413], [698, 397],
  [728, 381], [746, 364], [752, 346], [760, 326], [780, 307], [800, 286], [840, 263], [896, 241], [958, 223], [1018, 206],
  [1044, 189], [1044, 170], [1044, 153], [1062, 133], [1090, 117], [1124, 104], [1150, 87], [1160, 62], [1166, 30], [1168, 0],
];

/** Grass at the foot of the red bush (where Lia rests, with the linen above her). */
export const HANG_REST: [number, number][] = [
  [786, 326], [824, 348], [866, 362], [930, 366], [1000, 350], [1044, 334], [1076, 346], [1080, 384], [1052, 416],
  [960, 426], [880, 420], [820, 402], [776, 362],
];

export const HANG_WALK: [number, number][][] = [corridor(HANG_PATH, 30), HANG_REST];

/** Named points (all walkable, checked in aufbruch.test.ts). */
export const HANG_SPOT = {
  start: [104, 694],
  rest: [930, 394],
  /** Where the pale shape passes: close behind the resting Lia (north of her, in front of the bush). */
  passFrom: [872, 374],
  passTo: [1000, 368],
  top: [1166, 20],
} as const satisfies Record<string, readonly [number, number]>;

/** The strip of white linen caught in the red bush (hotspot over the painted cloth). */
export const HANG_LINEN: Polygon = [[984, 264], [1000, 262], [1060, 284], [1132, 292], [1128, 318], [1076, 322], [1000, 300], [986, 286]];

/** The trigger strip where the path leaves the map at the top. */
export const HANG_TOP: Polygon = [[1136, 0], [1200, 0], [1200, 30], [1136, 30]];

/** Spurenblick clues on the way up: none of them is Flick's (only game and old paths). */
export const HANG_CLUES = {
  stiefel: [318, 584],
  reh: [560, 470],
  kerbe: [744, 376],
} as const satisfies Record<string, readonly [number, number]>;

/** Foreground crowns the path passes behind. */
export const HANG_OCCLUDERS = [
  { id: 'baum-sued', baseline: 640, fade: 0.6, poly: [[362, 556], [420, 540], [478, 560], [492, 612], [452, 646], [376, 640]] as [number, number][] },
];
