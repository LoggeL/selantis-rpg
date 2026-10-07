// The hermit's clearing (assets/bg/e2-ignatius-lager.png, 1280×720): shared geometry for every Teil-II scene that
// plays at Ignatius' camp (e2-der-fremde, e2-urmacht, e2-konzentration, e2-ignatius, e2-stabtraining, e2-aufbruch).
// Day, dusk and night maps spread `ignatiusBase` (like campBase in kapitel-4/lager.ts) and add their own id, npcs,
// props, lights, exits, time and music. All coordinates are map pixels, measured on the painted background.
import type { BlockDef, LightDef, MapDef, OccluderDef, Polygon, SpawnDef, SurfaceDef } from '../../world';

type P = [number, number][];

/**
 * Named feet positions. Every spot is walkable (checked in ignatius-lager.test.ts) except the ones marked „blocked“,
 * which are the painted objects themselves (aim targets, light anchors).
 */
export const IG_SPOT = {
  /** Centre of the stone fire ring (blocked; light and campfire prop anchor). */
  fire: [628, 362],
  /** Standing or sitting south of the fire, facing it. */
  fireSouth: [628, 416],
  /** Seat in front of the east log (the mentor's usual place). */
  mentorSeat: [704, 382],
  /** Seat in front of the west log. */
  westLogSeat: [516, 424],
  /** Inside the lean-to under the old beech: the bed of furs. */
  bed: [672, 250],
  /** In front of the lean-to opening. */
  shelter: [676, 276],
  /** Hanging lantern of the lean-to (blocked; light anchor). */
  lantern: [655, 192],
  /** Water bucket next to the beech roots (blocked). */
  bucket: [596, 258],
  /** In front of the woodpile. */
  woodpile: [884, 306],
  /** Chopping block with the hatchet (blocked). */
  choppingBlock: [812, 292],
  /** Standing next to the chopping block. */
  chop: [806, 318],
  /** Bank of the stream next to the stepping stones. */
  stream: [990, 392],
  /** Middle of the stepping stones. */
  stones: [1096, 426],
  /** Middle of the practice ground with the stumps. */
  practice: [236, 286],
  /** South path, where it leaves the clearing. */
  pathSouth: [786, 690],
  /** East path behind the stream, at the map edge. */
  pathEast: [1256, 454],
} as const satisfies Record<string, readonly [number, number]>;

/** Practice stumps (base = feet point in front of the stump, top = where a hit lands). */
export const IG_STUMPS = [
  { id: 'stumpf-1', base: [338, 222], top: [338, 186] },
  { id: 'stumpf-2', base: [181, 258], top: [181, 222] },
  { id: 'stumpf-3', base: [289, 278], top: [289, 240] },
  { id: 'stumpf-4', base: [133, 310], top: [133, 274] },
  { id: 'stumpf-5', base: [230, 352], top: [230, 312] },
] as const;

/** Hanging targets on the frame above the practice ground (not reachable on foot; aim points). */
export const IG_TARGETS = [
  { id: 'scheibe-1', at: [201, 150] },
  { id: 'scheibe-2', at: [252, 133] },
  { id: 'scheibe-3', at: [68, 248] },
  { id: 'brett', at: [144, 168] },
] as const;

const STUMP_FEET: P[] = [
  [[324, 204], [352, 204], [352, 216], [324, 216]],
  [[165, 240], [198, 240], [198, 252], [165, 252]],
  [[273, 258], [305, 258], [305, 271], [273, 271]],
  [[117, 290], [150, 290], [150, 303], [117, 303]],
  [[211, 332], [250, 332], [250, 346], [211, 346]],
];

export const IG_WALK: P = [
  [112, 300], [114, 250], [150, 236], [162, 214], [200, 204], [250, 190], [300, 178], [330, 170], [370, 168],
  [420, 172], [462, 180], [482, 206], [500, 240], [522, 262], [600, 266], [632, 258], [640, 238], [716, 238],
  [726, 260], [762, 276], [792, 288], [836, 294], [930, 294], [960, 312], [990, 332], [1004, 360], [1006, 392],
  [1040, 398], [1080, 398], [1120, 404], [1160, 412], [1186, 424], [1230, 430], [1280, 432], [1280, 476], [1220, 478],
  [1176, 464], [1150, 458], [1100, 450], [1050, 448], [1010, 442], [990, 424], [930, 420], [862, 424], [826, 440],
  [800, 470], [796, 520], [806, 580], [818, 640], [830, 700], [836, 720], [742, 720], [738, 680], [724, 620],
  [704, 560], [686, 514], [640, 502], [580, 496], [500, 490], [430, 476], [360, 454], [300, 440], [250, 420],
  [220, 398], [200, 372], [160, 354], [120, 342], [104, 326],
];

export const IG_BLOCKS: BlockDef[] = [
  { id: 'feuerstelle', sight: false, poly: [[574, 362], [590, 340], [628, 332], [668, 340], [684, 362], [668, 386], [628, 394], [590, 386]] },
  { id: 'stamm-west', sight: false, poly: [[476, 372], [488, 360], [562, 398], [556, 416], [540, 420], [476, 386]] },
  { id: 'stamm-ost', sight: false, poly: [[726, 358], [738, 346], [778, 374], [774, 390], [758, 392], [726, 368]] },
  ...STUMP_FEET.map((poly, i) => ({ id: `stumpf-${i + 1}`, poly })),
  { id: 'pfosten-1', poly: [[100, 226], [113, 226], [113, 242], [100, 242]] },
  { id: 'pfosten-2', poly: [[142, 214], [153, 214], [153, 228], [142, 228]] },
  { id: 'eimer', poly: [[586, 252], [606, 252], [606, 266], [586, 266]] },
  { id: 'unterstand-west', poly: [[604, 244], [626, 244], [626, 262], [604, 262]] },
  { id: 'unterstand-ost', poly: [[716, 240], [730, 240], [770, 276], [758, 286], [724, 268]] },
  { id: 'hackklotz', poly: [[794, 284], [832, 284], [832, 300], [794, 300]] },
  { id: 'holzstapel', poly: [[834, 270], [932, 270], [932, 296], [834, 296]] },
];

export const IG_OCCLUDERS: OccluderDef[] = [
  { id: 'stumpf-1', baseline: 214, poly: [[322, 180], [354, 180], [354, 216], [322, 216]] },
  { id: 'stumpf-2', baseline: 250, poly: [[162, 214], [200, 214], [200, 252], [162, 252]] },
  { id: 'stumpf-3', baseline: 268, poly: [[270, 232], [307, 232], [307, 271], [270, 271]] },
  { id: 'stumpf-4', baseline: 300, poly: [[113, 266], [152, 266], [152, 303], [113, 303]] },
  { id: 'stumpf-5', baseline: 343, poly: [[208, 302], [252, 302], [252, 346], [208, 346]] },
  { id: 'stamm-west', baseline: 404, poly: [[474, 356], [490, 352], [566, 396], [560, 420], [536, 422], [474, 388]] },
  { id: 'stamm-ost', baseline: 386, poly: [[724, 344], [740, 342], [780, 372], [776, 392], [756, 394], [724, 370]] },
  { id: 'hackklotz', baseline: 298, poly: [[790, 242], [834, 242], [834, 300], [790, 300]] },
  { id: 'unterstand-ost', baseline: 278, fade: 0.6, poly: [[700, 122], [732, 150], [776, 266], [760, 284], [722, 268]] },
  { id: 'busch-sued', baseline: 530, fade: 0.6, poly: [[300, 470], [420, 488], [520, 500], [610, 506], [688, 514], [700, 560], [300, 560]] },
  { id: 'busch-ost', baseline: 540, fade: 0.6, poly: [[826, 432], [880, 418], [1000, 420], [1010, 470], [1000, 560], [826, 560]] },
];

export const IG_SURFACES: SurfaceDef[] = [
  { id: 'trittsteine', kind: 'stone', poly: [[1008, 396], [1180, 406], [1186, 458], [1008, 446]] },
  { id: 'pfad-sued', kind: 'path', poly: [[686, 500], [800, 474], [838, 720], [740, 720]] },
  { id: 'pfad-ost', kind: 'path', poly: [[1180, 424], [1280, 430], [1280, 478], [1176, 466]] },
  { id: 'lager', kind: 'wood', poly: [[640, 238], [716, 238], [722, 262], [636, 262]] },
];

/** Exit/trigger strips at the two path ends (scenes decide where they lead, or block them). */
export const IG_EDGE: Record<'south' | 'east', Polygon> = {
  south: [[742, 706], [836, 706], [836, 720], [742, 720]],
  east: [[1266, 432], [1280, 432], [1280, 476], [1266, 476]],
};

/** Named spawns every hermit-camp map can use (maps may add or override). */
export const IG_SPAWNS: Record<string, SpawnDef> = {
  bed: { at: IG_SPOT.bed, dir: 'down' },
  fire: { at: IG_SPOT.fireSouth, dir: 'up' },
  practice: { at: IG_SPOT.practice, dir: 'left' },
  woodpile: { at: IG_SPOT.woodpile, dir: 'up' },
  stream: { at: IG_SPOT.stream, dir: 'right' },
  south: { at: [786, 690], dir: 'up' },
  east: { at: [1256, 454], dir: 'left' },
};

/** The camp fire as a light (with flames). Pass a lower intensity for embers. */
export function igFireLight(intensity = 1, flame: boolean | number = 1): LightDef {
  return { id: 'feuer', at: IG_SPOT.fire, kind: 'fire', radius: 150, intensity, flame };
}

/** The lean-to lantern as a light. */
export function igLanternLight(intensity = 0.7): LightDef {
  return { id: 'laterne', at: IG_SPOT.lantern, kind: 'lantern', radius: 46, intensity };
}

/** Common map fields of every hermit-camp map. */
export const ignatiusBase: Pick<MapDef, 'background' | 'walk' | 'block' | 'occluders' | 'surfaces' | 'surface' | 'depthScale' | 'spawns'> = {
  background: 'e2-ignatius-lager',
  walk: [IG_WALK],
  block: IG_BLOCKS,
  occluders: IG_OCCLUDERS,
  surfaces: IG_SURFACES,
  surface: 'dirt',
  depthScale: { y0: 160, s0: 0.95, y1: 720, s1: 1.04 },
  spawns: IG_SPAWNS,
};
