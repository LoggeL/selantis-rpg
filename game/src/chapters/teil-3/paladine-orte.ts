// Geometry of the two painted places of e3-paladine (docs/teil-3/assets.md), measured on the images with a 20 px grid:
//  - e3-landstrasse (1280×720): the road from the left edge through stubble fields to the stone bridge over the ditch
//    and on to the right edge; grass verges above and below, hedge walls beyond them. Milestone at (377, 340).
//  - e3-trapas (1280×720): the gate arch at the bottom centre, the street up to the square with the fountain, the
//    smithy on the left, the order house with its stairs at the top. Exported for later scenes on the same square.
// Map ids of the scenes are scene-specific (defineMap ids are global, later scenes on these backgrounds use their own).
import type { OccluderDef, Polygon, SurfaceDef } from '../../world';

type Pt = [number, number];

// ---------------------------------------------------------------------------------------------------------------
// e3-landstrasse
// ---------------------------------------------------------------------------------------------------------------

/** The road with both grass verges; narrower across the bridge (between the parapets). */
export const ROAD_WALK: Polygon[] = [[
  [0, 326], [300, 326], [600, 328], [834, 330], [840, 346], [990, 346], [996, 330], [1100, 326], [1280, 326],
  [1280, 406], [1100, 410], [1004, 404], [990, 378], [842, 378], [830, 426], [600, 436], [300, 440], [0, 446],
]];

/** The milestone's foot (Lia reads it standing below). */
export const MILESTONE: Polygon = [[364, 328], [391, 328], [391, 342], [364, 342]];

export const ROAD_OCCLUDERS: OccluderDef[] = [
  // The milestone itself, drawn over anyone passing behind it on the verge.
  { id: 'meilenstein', baseline: 342, poly: [[364, 300], [391, 300], [391, 342], [364, 342]] },
];

export const ROAD_SURFACES: SurfaceDef[] = [
  { id: 'strasse-west', kind: 'road', poly: [[0, 344], [300, 340], [600, 338], [840, 342], [840, 378], [600, 410], [300, 420], [0, 422]] },
  { id: 'strasse-ost', kind: 'road', poly: [[990, 340], [1280, 338], [1280, 400], [990, 400]] },
  { id: 'bruecke', kind: 'stone', poly: [[840, 344], [990, 344], [990, 378], [840, 378]] },
];

export const ROAD_SPOT = {
  /** Lia enters at the left edge. */
  start: [40, 384] as Pt,
  /** Where Lia reads the milestone. */
  milestone: [377, 354] as Pt,
  /** Where the patrol stops them (Lia, Ignatius beside her). */
  stopLia: [606, 384] as Pt,
  stopMentor: [578, 368] as Pt,
  /** The patrol: leader in front, the young one at his side, the third on the far side. */
  leader: [670, 378] as Pt,
  young: [690, 352] as Pt,
  third: [702, 404] as Pt,
  /** Where the patrol appears (right edge on the road). */
  patrolIn: [1270, 370] as Pt,
};

/** Walking into this band starts the patrol (well before the bridge). */
export const PATROL_ZONE: Polygon = [[560, 320], [600, 320], [600, 452], [560, 452]];

// ---------------------------------------------------------------------------------------------------------------
// e3-trapas
// ---------------------------------------------------------------------------------------------------------------

/**
 * The square, the street down to the gate, the passage through the arch, the smithy floor and the stairs up to the
 * order house portal. Everything else (houses, gardens, the wall) is blocked.
 */
export const TRAPAS_WALK: Polygon[] = [[
  // top edge along the garden walls, up the stairs to the portal and down again
  [445, 198], [572, 196], [580, 190], [588, 124], [692, 124], [700, 190], [708, 196], [868, 198],
  // right edge along the tree and the half-timbered houses
  [866, 240], [858, 300], [852, 340], [848, 470], [800, 478], [740, 482],
  // the street down to the gate and the arch passage
  [736, 548], [690, 552], [690, 720], [590, 720], [588, 552], [545, 548], [545, 482],
  // left: past the tree and into the smithy
  [470, 476], [440, 462], [430, 450], [205, 448], [200, 378], [280, 372], [300, 345], [430, 340],
  [440, 310],
]];

/** Obstacles inside the square: fountain with benches, anvil, the smithy fence, the four banner masts. */
export const TRAPAS_BLOCKS: { id: string; poly: Polygon; sight?: boolean }[] = [
  { id: 'brunnen', sight: false, poly: [[560, 262], [720, 262], [752, 290], [752, 330], [720, 356], [560, 356], [530, 330], [530, 290]] },
  { id: 'amboss', sight: false, poly: [[228, 374], [272, 374], [272, 408], [228, 408]] },
  { id: 'zaun', poly: [[285, 348], [332, 350], [332, 398], [285, 402]] },
  { id: 'mast-nw', poly: [[451, 266], [461, 266], [461, 276], [451, 276]] },
  { id: 'mast-no', poly: [[815, 268], [825, 268], [825, 278], [815, 278]] },
  { id: 'mast-sw', poly: [[474, 448], [484, 448], [484, 458], [474, 458]] },
  { id: 'mast-so', poly: [[795, 448], [805, 448], [805, 458], [795, 458]] },
];

export const TRAPAS_OCCLUDERS: OccluderDef[] = [
  // The town wall with the gate towers: drawn over anyone inside the passage or right behind the wall top; the arch
  // opening and the street between the towers stay open.
  {
    id: 'stadtmauer', baseline: 720,
    poly: [[455, 512], [572, 512], [572, 552], [700, 552], [700, 512], [825, 512], [825, 720], [695, 720], [695, 640],
      [675, 618], [640, 608], [605, 618], [585, 640], [585, 720], [455, 720]],
  },
  // The smithy roof over whoever stands at the forge or the anvil.
  {
    id: 'schmiede-dach', baseline: 446, fade: 0.55,
    poly: [[0, 300], [120, 250], [196, 200], [200, 165], [330, 165], [430, 250], [432, 320], [300, 322], [200, 332],
      [150, 345], [0, 345]],
  },
  // The fountain's bowls and spout over anyone walking behind it.
  {
    id: 'brunnen', baseline: 356,
    poly: [[540, 250], [620, 240], [630, 222], [650, 222], [660, 240], [740, 250], [752, 290], [752, 330], [720, 356],
      [560, 356], [530, 330], [530, 290]],
  },
  // The two trees at the lower corners of the square.
  { id: 'baum-sw', baseline: 456, fade: 0.55, poly: [[364, 380], [380, 364], [430, 360], [470, 372], [478, 410], [460, 440], [436, 452], [410, 456], [380, 440], [364, 415]] },
  { id: 'baum-so', baseline: 470, fade: 0.55, poly: [[806, 380], [850, 370], [880, 390], [882, 440], [860, 466], [820, 470], [806, 440]] },
  // The four banner masts.
  { id: 'mast-nw', baseline: 276, poly: [[448, 180], [480, 180], [480, 250], [462, 252], [462, 276], [450, 276]] },
  { id: 'mast-no', baseline: 278, poly: [[800, 186], [834, 186], [834, 200], [826, 200], [826, 278], [814, 278], [814, 250], [800, 250]] },
  { id: 'mast-sw', baseline: 458, poly: [[472, 352], [505, 352], [505, 430], [486, 432], [486, 458], [474, 458]] },
  { id: 'mast-so', baseline: 458, poly: [[782, 352], [812, 352], [806, 458], [794, 458], [794, 430], [782, 430]] },
];

export const TRAPAS_SURFACES: SurfaceDef[] = [
  { id: 'schmiede', kind: 'dirt', poly: [[200, 372], [300, 345], [430, 340], [430, 450], [200, 450]] },
];

export const TRAPAS_SPOT = {
  /** Inside the arch passage (the escort walks in from here). */
  gate: [640, 690] as Pt,
  /** Just inside the walls. */
  street: [640, 520] as Pt,
  /** The escort's way from the gate to the smithy (left of the fountain). */
  route: [[640, 470], [560, 420], [470, 404], [370, 424]] as Pt[],
  /** Where the leader stops, at the anvil, facing the smith. */
  leaderSmith: [292, 424] as Pt,
  smith: [214, 396] as Pt,
  /** Lia waits here while the leader talks. */
  liaWait: [340, 430] as Pt,
  /** Ignatius and his guard, a few steps away. */
  mentorWait: [522, 440] as Pt,
  mentorGuard: [552, 456] as Pt,
  /** The young paladin watching Lia. */
  youngWait: [420, 410] as Pt,
  /** The notice on the north-west banner mast. */
  notice: [456, 292] as Pt,
  /** Lia's place at the fountain's rim (south-west). */
  fountain: [574, 372] as Pt,
  /** The foot of the stairs and the portal. */
  stairs: [640, 204] as Pt,
  portal: [640, 132] as Pt,
};

/** How far Lia may stray while the leader talks to the smith (an ellipse over the square's west half). */
export const SMITH_LEASH = { cx: 430, cy: 372, rx: 280, ry: 150 };
