// „e3-waldgegner“: the Leichenfresser camp in the forest, on the painted background `k5-faehrte` (1280×720, reused, see
// docs/teil-3/assets.md), measured with a 20 px grid. Only the north-east part of the picture is used: the small
// clearing with the stone fire ring and the fallen log, Flick's stake by the roots of the big oak at its east edge, the
// trail that runs down from the clearing to the fork and on to the west. The bramble path to the south-east is not
// part of this map. Ferns and bushes beside the trail are the hiding places on the way out.
// Pure data and small rules (no engine imports); waldgegner.test.ts checks the geometry and the watch cycle.
import { corridor, ellipse } from '../kapitel-5/geom';
import type { BlockDef, GuardDef, HidingSpotDef, OccluderDef, Polygon, SpawnDef, SurfaceDef } from '../../world';

type Spot = readonly [number, number];
type P = [number, number][];

/** The clearing around the fire ring (grass between the bushes and the oak roots). */
export const CLEARING: P = [
  [904, 96], [940, 70], [1000, 64], [1080, 70], [1140, 84], [1162, 120], [1160, 170], [1156, 214], [1120, 220], [1080, 216],
  [1040, 220], [980, 214], [930, 196], [904, 160],
];
/** The trail from the clearing down to the fork, and from the fork west. */
export const TRAIL_NORTH: P = corridor([[1100, 196], [1098, 238], [1086, 281], [1078, 326], [1052, 372], [1040, 412]], 21);
export const TRAIL_WEST: P = corridor([[850, 418], [892, 414], [1017, 407], [1046, 404]], 22);
export const FORK: P = [[1010, 396], [1040, 380], [1072, 392], [1078, 430], [1048, 446], [1012, 428]];

/** Ferns and bushes beside the trail (walkable, a crouching Flick is hidden in them). */
export const FERNS: (HidingSpotDef & { id: string; poly: P })[] = [
  { id: 'farn-ost', kind: 'bush', poly: [[1112, 246], [1152, 246], [1152, 294], [1112, 294]] },
  { id: 'farn-west', kind: 'bush', poly: [[1004, 318], [1062, 318], [1062, 366], [1004, 366]] },
  { id: 'farn-gabel', kind: 'bush', poly: [[926, 426], [996, 426], [996, 480], [926, 480]] },
];

export const GHUL_WALK: P[] = [CLEARING, TRAIL_NORTH, TRAIL_WEST, FORK, ...FERNS.map(f => f.poly)];

export const FIRE: Spot = [1053, 152];

export const GHUL_BLOCKS: BlockDef[] = [
  { id: 'feuerring', sight: false, poly: ellipse(FIRE[0], FIRE[1] + 1, 30, 17) },
  { id: 'baumstamm', sight: false, poly: [[1044, 112], [1114, 116], [1118, 138], [1046, 136]] },
];

export const GHUL_OCCLUDERS: OccluderDef[] = [
  { id: 'baumstamm', baseline: 138, poly: [[1040, 104], [1116, 106], [1122, 140], [1042, 140]] },
  // The painted foliage over a figure crouching in the ferns (see-through while she is inside).
  ...FERNS.map(f => ({ id: f.id, baseline: f.poly[2][1], fade: 0.6, poly: [[f.poly[0][0] - 4, f.poly[0][1] - 18], [f.poly[1][0] + 4, f.poly[1][1] - 18], f.poly[2], f.poly[3]] as P })),
];

export const GHUL_SURFACES: SurfaceDef[] = [
  { id: 'pfad-nord', kind: 'dirt', poly: TRAIL_NORTH },
  { id: 'pfad-west', kind: 'dirt', poly: TRAIL_WEST },
  { id: 'gabel', kind: 'dirt', poly: FORK },
  ...FERNS.map(f => ({ id: f.id, kind: 'forest' as const, poly: f.poly })),
];

/** Named feet positions. */
export const GHUL_SPOT = {
  /** Flick, standing with her back to the stake by the oak roots, hands tied. */
  stake: [1144, 204],
  /** The stake itself (just behind her) and the sharp stone at her feet (props). */
  stakeProp: [1148, 196],
  stone: [1128, 214],
  /** The three Leichenfresser around the fire: the leader (south-west), the long one (west), Ratze (south). */
  leader: [1020, 182],
  long: [1004, 140],
  ratze: [1062, 190],
  /** Where Ratze stops when he comes over to tighten the knot (and forgets it). */
  ratzeHalfway: [1104, 196],
  /** End of the trail west: Flick is out of sight there. */
  escape: [868, 416],
} as const satisfies Record<string, Spot>;

/** The rope at the stone: interaction polygon over the stone. */
export const STONE_HOTSPOT: Polygon = [[1118, 206], [1140, 206], [1140, 220], [1118, 220]];

/** Reaching the west end of the trail ends the escape. */
export const ESCAPE_ZONE: Polygon = [[850, 394], [890, 394], [890, 442], [850, 442]];

export const GHUL_SPAWNS: Record<string, SpawnDef> = {
  pflock: { at: GHUL_SPOT.stake, dir: 'left' },
  'farn-ost': { at: [1132, 270], dir: 'down' },
  'farn-west': { at: [1034, 342], dir: 'down' },
  'farn-gabel': { at: [960, 452], dir: 'left' },
};

const GHUL_BARKS = { suspicious: ['Was raschelt da?', 'Riecht nach Elfe …'], calm: ['Nur ein Igel.', 'Nix. Weiterfressen.'] };

/**
 * After the escape starts, the three become watchers: the leader turns on his spot by the fire (he looks down the trail
 * now and then), the long one looks out east and south, Ratze is sent for firewood down the trail and back.
 */
export const GHUL_GUARDS: GuardDef[] = [
  {
    id: 'ghul-anfuehrer', preset: 'ghoul', speaker: 'e3-ghul', mode: 'loop', range: 118, fov: 70, reaction: 1.3,
    suspiciousBarks: GHUL_BARKS.suspicious, calmBarks: GHUL_BARKS.calm,
    path: [
      { at: GHUL_SPOT.leader, wait: 2600, face: 'right' },
      { at: [GHUL_SPOT.leader[0] + 2, GHUL_SPOT.leader[1]], wait: 3000, face: 'up' },
      { at: GHUL_SPOT.leader, wait: 2400, face: 'down' },
    ],
  },
  {
    id: 'ghul-lang', preset: 'ghoul', speaker: 'e3-ghul', mode: 'loop', range: 110, fov: 66, reaction: 1.4,
    suspiciousBarks: GHUL_BARKS.suspicious, calmBarks: GHUL_BARKS.calm,
    path: [
      { at: GHUL_SPOT.long, wait: 3200, face: 'right' },
      { at: [GHUL_SPOT.long[0], GHUL_SPOT.long[1] + 2], wait: 2600, face: 'down' },
    ],
  },
  {
    id: 'ratze', preset: 'ghoul', speaker: 'e3-ratze', mode: 'pingpong', range: 100, fov: 70, reaction: 1.5, speed: 34,
    suspiciousBarks: ['Hä? Wer da?', 'Bist du das, Spitzohr?'], calmBarks: ['Holz, Holz, immer Holz.', 'Keiner da. Gut.'],
    path: [
      { at: GHUL_SPOT.ratze, wait: 2200, face: 'up' },
      { at: [1088, 300], wait: 800, face: 'down' },
      { at: [1048, 388], wait: 2600, face: 'left' },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------------
// The watch cycle while Flick is tied (who looks over at her)
// ---------------------------------------------------------------------------------------------------------------

export type Watcher = 'ghul-anfuehrer' | 'ghul-lang' | 'ratze';

/** One round of the cycle: nobody / somebody looks over, for how long. */
export const WATCH_CYCLE: readonly { watcher: Watcher | null; ms: number }[] = [
  { watcher: null, ms: 5200 },
  { watcher: 'ghul-lang', ms: 3400 },
  { watcher: null, ms: 4600 },
  { watcher: 'ghul-anfuehrer', ms: 3000 },
  { watcher: null, ms: 5600 },
  { watcher: 'ratze', ms: 2800 },
];

/** Who looks at Flick `t` ms into the cycle (it repeats). */
export function watcherAt(t: number): Watcher | null {
  const total = WATCH_CYCLE.reduce((s, p) => s + p.ms, 0);
  let rest = ((t % total) + total) % total;
  for (const p of WATCH_CYCLE) {
    if (rest < p.ms) return p.watcher;
    rest -= p.ms;
  }
  return null;
}

/** Rubs at the stone until the rope parts. */
export const RUBS_NEEDED = 2;

/** Flick may only rub while nobody looks over and the rope still holds. */
export function canRub(watcher: Watcher | null, rubs: number): boolean {
  return watcher === null && rubs < RUBS_NEEDED;
}
