// Geometry of the painted autumn forest e3-lichtwald (1280×720, docs/teil-3/assets.md): the earth path from the
// bottom-left up to a mossy clearing with the old weeping willow, the brook on the right with three stepping stones
// and the east path behind it. Two maps use it: e3-valentus (only the path and the meadow beside it, the clearing is
// still closed off) and e3-eigener-stab (path and clearing). Measured on the image with a 20 px grid.
import type { OccluderDef, Polygon, SurfaceDef } from '../../world';

type Pt = [number, number];

/** Left edge of the path from the bottom-left corner up to the grassy nook below the trees (bottom → top). */
const PATH_LEFT: Pt[] = [
  [0, 720], [0, 654], [32, 640], [52, 604], [66, 582], [98, 562], [138, 542], [196, 522], [250, 502], [294, 482],
  [346, 462], [404, 442], [438, 422], [460, 400], [478, 378], [486, 346], [484, 322], [466, 304], [446, 292],
  [440, 262], [448, 228], [476, 218], [522, 226], [530, 252], [526, 286], [514, 298], [512, 330], [540, 342],
];

/** Right edge of the path below the meadow, from the stump back down to the bottom edge (top → bottom). */
const PATH_RIGHT_LOW: Pt[] = [
  [476, 498], [440, 490], [400, 486], [356, 494], [330, 510], [300, 530], [270, 548], [236, 562], [190, 582],
  [144, 604], [116, 636], [84, 668], [64, 700], [58, 720],
];

/** The meadow between the path and the low stone ring of the clearing (top → bottom, left of the ring). */
const MEADOW_EDGE: Pt[] = [
  [580, 376], [596, 402], [612, 430], [650, 452], [700, 478], [738, 494], [744, 530], [720, 570], [690, 580],
  [640, 562], [580, 550], [530, 536], [500, 512],
];

/** e3-valentus: the path, the nook and the meadow; the gap into the clearing (x ≈ 576) is the end of the walk. */
export const PATH_WALK: Polygon[] = [[...PATH_LEFT, [576, 340], ...MEADOW_EDGE, ...PATH_RIGHT_LOW]];

/**
 * e3-eigener-stab: path and clearing. The clearing is bounded by the willow's roots (top), the brook (right; only the
 * stepping stones and the east bank are walkable) and the low stone ring (bottom).
 */
export const CLEARING_WALK: Polygon[] = [[
  ...PATH_LEFT,
  [556, 322], [568, 296], [590, 276], [612, 258], [640, 250], [680, 242], [740, 240], [900, 240], [960, 242], [1000, 254],
  [1006, 280], [1004, 318], [1040, 326], [1098, 342], [1200, 340], [1280, 330], [1280, 362], [1200, 368],
  [1098, 370], [1050, 358], [1008, 358], [1000, 380], [980, 400], [930, 430], [900, 444], [860, 460], [824, 466],
  [790, 448], [750, 446], [720, 450], [690, 438], [650, 414], [620, 396], [600, 378],
  [578, 380], [547, 400], [503, 440], [480, 460], [433, 480], [400, 486],
  ...PATH_RIGHT_LOW.slice(3),
]];

/** The willow's trunk and roots (only the foot; Lia can walk right up to them under the hanging branches). */
export const WILLOW_ROOTS: Polygon = [[790, 252], [800, 228], [830, 214], [872, 220], [894, 248], [862, 256], [812, 258]];

export const OCCLUDERS: OccluderDef[] = [
  // The hanging branches of the weeping willow, drawn over anyone standing beneath them.
  {
    id: 'weide', baseline: 252, fade: 0.55,
    poly: [[622, 80], [650, 40], [700, 0], [1050, 0], [1070, 90], [1066, 200], [1010, 262], [985, 268], [960, 244],
      [900, 240], [880, 252], [800, 252], [740, 242], [700, 264], [660, 262], [630, 240]],
  },
  // Foreground bushes, the tall stump and the fallen log along the bottom edge.
  {
    id: 'busch-vorn', baseline: 720, fade: 0.6,
    poly: [[200, 596], [240, 584], [300, 570], [380, 556], [470, 544], [560, 550], [640, 572], [720, 588],
      [790, 562], [850, 530], [920, 520], [1000, 500], [1010, 720], [200, 720]],
  },
  // The bush with the second stump right of the path (Lia passes in front of it).
  { id: 'stumpf', baseline: 566, fade: 0.6, poly: [[360, 494], [372, 488], [398, 490], [404, 520], [400, 566], [362, 566]] },
];

/** The earth path and the east path (dirt), the stepping stones (stone). Later entries win. */
export const SURFACES: SurfaceDef[] = [
  {
    id: 'pfad', kind: 'path',
    poly: [[0, 720], [0, 654], [32, 640], [52, 604], [66, 582], [98, 562], [138, 542], [196, 522], [250, 502],
      [294, 482], [346, 462], [404, 442], [438, 422], [460, 400], [478, 378], [486, 346], [482, 320], [493, 300],
      [517, 300], [515, 335], [545, 345], [578, 360], [578, 378], [547, 400], [503, 440], [480, 460], [433, 480],
      [340, 500], [317, 520], [287, 540], [233, 560], [187, 580], [140, 600], [110, 640], [67, 680], [55, 720]],
  },
  { id: 'ostpfad', kind: 'path', poly: [[1000, 326], [1098, 340], [1098, 358], [1008, 356]] },
  { id: 'ostufer', kind: 'path', poly: [[1200, 334], [1280, 328], [1280, 364], [1200, 368]] },
  { id: 'trittsteine', kind: 'stone', poly: [[1098, 340], [1200, 338], [1200, 370], [1098, 372]] },
];

/** Named places on the map (px). */
export const SPOT = {
  /** Where the path enters at the bottom-left. */
  start: [36, 690] as Pt,
  /** The gap between the big rock and the stone ring, where the path meets the clearing. */
  gap: [570, 358] as Pt,
  /** Where Valentus' apparition waits at the end of the trail (just inside the clearing). */
  valentusGap: [606, 344] as Pt,
  /** Inside the clearing, a few steps in from the gap. */
  clearing: [600, 352] as Pt,
  /** Where Lia stands to reach for the bright branch (right below the willow's crown). */
  branchStand: [846, 266] as Pt,
  /** The bright branch itself (map px, inside the hanging branches above the roots). */
  branch: [846, 206] as Pt,
  /** Where Lia stands to test her staff on the willow. */
  aim: [846, 300] as Pt,
  /** Valentus near the willow while she practises (left of her, out of the line of fire). */
  valentusWillow: [740, 312] as Pt,
  /** The east bank, where Ignatius comes in across the stepping stones. */
  eastBank: [1262, 346] as Pt,
  /** Where Ignatius stops in front of Lia. */
  ignatiusStop: [906, 314] as Pt,
  /** Lia after Valentus has gone (the reunion starts here). */
  afterWillow: [862, 306] as Pt,
};

/** The willow's crown: three resting places for the light spirits among the branches. */
export const WILLOW_REST: Pt[] = [[742, 176], [838, 150], [930, 182]];
/** Centre and radius of the zone below the willow in which following spirits settle into the branches. */
export const WILLOW_ZONE = { at: [846, 262] as Pt, radius: 74 };
/** Inner clearing as an ellipse (the spirits stay inside it when they flee). */
export const CLEARING_OVAL = { cx: 800, cy: 340, rx: 190, ry: 92 };
