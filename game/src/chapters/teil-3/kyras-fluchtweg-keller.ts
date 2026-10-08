// „e3-kyras-fluchtweg“: geometry of the escape below the order house, measured on the painted background `e3-keller`
// (1280×720, painted at night) with a 20 px grid (docs/teil-3/assets.md):
//  - left: the vaulted cellar with barrels along the walls, wine racks and crates, the round well shaft with iron rungs
//    on its north side, the stairs from the house in the south-west corner;
//  - middle: the walled water channel (knee-deep), a stone wall between it and the cellar;
//  - right: where the channel opens between two pillars into the brook, the reedy bank below.
// The cellar and the channel are not connected on foot (the well shaft is the way down), so they are two maps on the
// same picture: `e3-keller-gewoelbe` and `e3-keller-kanal` (kyras-fluchtweg.ts). kyras-fluchtweg.test.ts checks every
// spot against this geometry.
import type { BlockDef, GuardDef, HidingSpotDef, LightDef, OccluderDef, Polygon, SpawnDef, SurfaceDef } from '../../world';

type Spot = readonly [number, number];
type P = [number, number][];

// ===============================================================================================================
// The cellar (e3-keller-gewoelbe)
// ===============================================================================================================

/**
 * Flagstone floor between the barrels (west), the racks (north), the wall to the channel (east) and the crates, plus
 * the narrow stairs down between the blue pillar and the low wall (south-west).
 */
export const CELLAR_WALK: P[] = [[
  [72, 248], [112, 214], [192, 206], [198, 140], [326, 140], [328, 248], [392, 252], [394, 412], [334, 434], [256, 434],
  [252, 492], [212, 496], [210, 544], [154, 548], [150, 640], [114, 640], [116, 410], [72, 410],
]];

/** The stone ring of the well shaft (blocks movement and sight: the guard cannot see past it). */
export const WELL_RING: P = [
  [205, 262], [245, 266], [270, 286], [276, 318], [266, 350], [240, 370], [205, 376], [170, 370], [144, 350], [134, 318],
  [140, 286], [165, 266],
];

export const CELLAR_BLOCKS: BlockDef[] = [
  { id: 'brunnen', poly: WELL_RING },
  // The small table with jugs and bottles in front of the crates (the crates themselves are outside the floor).
  { id: 'krugtisch', poly: [[256, 436], [332, 436], [332, 450], [256, 450]] },
];

export const CELLAR_OCCLUDERS: OccluderDef[] = [
  // The front half of the well ring, drawn over a figure standing on the north rim (feet behind it).
  { id: 'brunnen', baseline: 376, poly: [[134, 318], [276, 318], [266, 350], [240, 370], [205, 376], [170, 370], [144, 350]] },
];

/** Named feet positions in the cellar (all on free floor). */
export const CELLAR_SPOT = {
  /** Top of the stairs from the house (where the sisters come down). */
  stairs: [132, 616],
  /** In front of the crates by the stairs (first shadow). */
  crates: [200, 520],
  /** In front of the barrels on the west wall (second shadow). */
  barrels: [132, 446],
  /** On the north rim of the well, where the rungs go down. */
  wellRim: [205, 238],
  /** Beside the north rim (Kyra waits here before she climbs down). */
  wellSide: [236, 234],
  /** Where the guard turns at the south end of his round and at the north end. */
  guardSouth: [304, 412],
  guardNorth: [304, 262],
} as const satisfies Record<string, Spot>;

/** The rungs: interaction on the north half of the ring. */
export const WELL_HOTSPOT: Polygon = [[168, 262], [244, 262], [258, 300], [152, 300]];

/**
 * Shadows in which a crouching Lia is hidden, in route order: crates by the stairs, barrels on the west wall, the
 * north rim of the well (the ring hides her from below). Each one is also a checkpoint.
 */
export const CELLAR_SHADOWS: (HidingSpotDef & { id: string; poly: P })[] = [
  { id: 'schatten-kisten', kind: 'crate', poly: [[188, 500], [212, 500], [212, 544], [188, 544]] },
  { id: 'schatten-faesser', kind: 'crate', poly: [[118, 420], [148, 420], [148, 472], [118, 472]] },
  { id: 'schatten-brunnen', kind: 'crate', poly: [[170, 222], [242, 222], [242, 256], [170, 256]] },
];

/** Where Kyra crouches at each step of the way (just beside the shadow Lia should take next). */
export const KYRA_STEPS: Spot[] = [[166, 522], [150, 486], [236, 234]];

export const CELLAR_SPAWNS: Record<string, SpawnDef> = {
  treppe: { at: CELLAR_SPOT.stairs, dir: 'up' },
  kisten: { at: CELLAR_SPOT.crates, dir: 'left' },
  faesser: { at: CELLAR_SPOT.barrels, dir: 'up' },
  brunnen: { at: CELLAR_SPOT.wellRim, dir: 'down' },
};

/** Checkpoint spawn per shadow (spotted = back to the last shadow reached). */
export const SHADOW_CHECKPOINT: Record<string, string> = {
  'schatten-kisten': 'kisten',
  'schatten-faesser': 'faesser',
  'schatten-brunnen': 'brunnen',
};

/** The paladin with the lantern walks the east side of the cellar and looks west at both ends of his round. */
export const CELLAR_GUARD: GuardDef = {
  id: 'keller-wache', preset: 'paladin', speaker: 'e3-paladin', lantern: true, mode: 'pingpong', range: 150, fov: 66, reaction: 1.3,
  suspiciousBarks: ['Ist da unten wer?', 'Ratten? Große Ratten?'],
  calmBarks: ['Nur das Wasser im Schacht.', 'Wieder nichts.'],
  path: [
    { at: CELLAR_SPOT.guardSouth, wait: 2600, face: 'left' },
    { at: CELLAR_SPOT.guardNorth, wait: 2600, face: 'left' },
  ],
};

/** The two painted wall lanterns (dim) and a glimmer from the shaft. */
export const CELLAR_LIGHTS: LightDef[] = [
  { id: 'keller-lampe-1', at: [52, 78], kind: 'candle', radius: 60, intensity: 0.55, always: true },
  { id: 'keller-lampe-2', at: [366, 94], kind: 'candle', radius: 60, intensity: 0.55, always: true },
];

// ===============================================================================================================
// The channel and the bank (e3-keller-kanal)
// ===============================================================================================================

/** Knee-deep water in the channel, out between the pillars, a strip of ford, and the reedy bank below. */
export const CHANNEL: P = [[420, 306], [1000, 306], [1000, 436], [420, 436]];
export const MOUTH: P = [[996, 332], [1046, 332], [1046, 402], [996, 402]];
export const FORD: P = [[1040, 334], [1100, 334], [1112, 404], [1040, 412]];
export const BANK: P = [
  [1040, 404], [1100, 394], [1150, 418], [1230, 440], [1270, 470], [1270, 560], [1120, 566], [1070, 520], [1048, 452],
];
export const KANAL_WALK: P[] = [CHANNEL, MOUTH, FORD, BANK];

export const KANAL_SURFACES: SurfaceDef[] = [
  { id: 'kanal', kind: 'shallow', poly: CHANNEL },
  { id: 'muendung', kind: 'shallow', poly: MOUTH },
  { id: 'furt', kind: 'shallow', poly: FORD },
  { id: 'ufer', kind: 'darkgrass', poly: BANK },
];

export const KANAL_BLOCKS: BlockDef[] = [
  // The big rock at the water's edge.
  { id: 'fels', poly: [[1162, 402], [1222, 402], [1226, 430], [1166, 432]] },
];

/** Named feet positions in the channel and on the bank. */
export const KANAL_SPOT = {
  /** Under the shaft, where the rungs end in the water (west end of the channel). */
  shaft: [446, 372],
  /** Middle of the channel. */
  middle: [700, 372],
  /** In front of the mouth between the pillars (the loosened grate). */
  grate: [976, 366],
  /** On the bank among the leaves (the resting place). */
  rest: [1150, 500],
  restKyra: [1186, 506],
} as const satisfies Record<string, Spot>;

/** Kyra's way through the channel (she waits for Lia at each point). */
export const KANAL_ROUTE: Spot[] = [[560, 368], [700, 376], [840, 368], [960, 366]];

/** The loosened grate in the mouth (no painted grate: the hotspot sits on the dark gap between the pillars). */
export const GRATE_HOTSPOT: Polygon = [[1000, 334], [1040, 334], [1040, 400], [1000, 400]];

/** The leaves on the bank where the sisters rest. */
export const REST_HOTSPOT: Polygon = [[1120, 470], [1200, 470], [1200, 520], [1120, 520]];

export const KANAL_SPAWNS: Record<string, SpawnDef> = {
  schacht: { at: KANAL_SPOT.shaft, dir: 'right' },
  ufer: { at: KANAL_SPOT.rest, dir: 'left' },
};

export const KANAL_LIGHTS: LightDef[] = [
  { id: 'kanal-lampe-1', at: [602, 206], kind: 'candle', radius: 50, intensity: 0.4, always: true },
  { id: 'kanal-lampe-2', at: [930, 206], kind: 'candle', radius: 50, intensity: 0.4, always: true },
  { id: 'kanal-mond', at: [1180, 300], kind: 'moon', radius: 170, intensity: 0.55, always: true },
];
