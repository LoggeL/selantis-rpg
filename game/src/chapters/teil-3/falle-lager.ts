// „e3-falle“ (and the later visits of the same clearing): the false rebel camp on the painted background
// `e3-falsches-lager` (1280×720, docs/teil-3/assets.md), measured with a 40 px grid. Three linen tents (north-west,
// north-east, west with woodpile and wagon wheel), the stone fire ring in the middle with a bench and firewood, the post
// with the iron shackle (Flick, e3-flicks-hilfe), the cage wagon under a tarp at the east edge, the path at the bottom.
// The palisade on the left and the bushes all round are blocked.
// Pure data and small rules (no engine imports); falle.test.ts checks the geometry and the find rules.
import type { BlockDef, OccluderDef, Polygon, SurfaceDef } from '../../world';

type Spot = readonly [number, number];
type P = [number, number][];

/** The open ground of the clearing and the path down to the bottom edge. */
export const CAMP_WALK: P[] = [[
  [212, 250], [250, 224], [330, 214], [520, 208], [560, 196], [690, 196], [700, 224], [905, 228], [960, 236],
  [1040, 250], [1210, 300], [1210, 392], [1100, 404], [1000, 424], [900, 444], [800, 470], [766, 560], [760, 720],
  [636, 720], [622, 580], [592, 556], [470, 548], [380, 528], [250, 508], [226, 470], [212, 360],
]];

/** The fire ring (low, guards see over it). */
export const FIRE_RING: P = [
  [579, 362], [585, 349], [601, 340], [625, 337], [649, 340], [665, 349], [671, 362], [665, 375], [649, 384], [625, 387],
  [601, 384], [585, 375],
];

export const CAMP_BLOCKS: BlockDef[] = [
  { id: 'zelt-nord', poly: [[330, 214], [525, 214], [525, 248], [330, 248]] },
  { id: 'zelt-ost', poly: [[690, 234], [893, 234], [896, 284], [690, 284]] },
  { id: 'zelt-west', poly: [[195, 352], [440, 346], [462, 372], [460, 402], [365, 410], [360, 442], [300, 442], [195, 446]] },
  { id: 'feuerring', sight: false, poly: FIRE_RING },
  { id: 'bank', sight: false, poly: [[538, 328], [586, 328], [586, 358], [538, 358]] },
  { id: 'brennholz', sight: false, poly: [[668, 320], [730, 320], [730, 356], [668, 356]] },
  { id: 'pfosten', poly: [[916, 264], [942, 264], [942, 282], [916, 282]] },
  { id: 'kaefigwagen', poly: [[1040, 322], [1205, 322], [1205, 388], [1040, 388]] },
  { id: 'deichsel', poly: [[985, 352], [1040, 352], [1040, 370], [985, 370]] },
  { id: 'fass', poly: [[1012, 312], [1042, 312], [1042, 334], [1012, 334]] },
];

export const CAMP_OCCLUDERS: OccluderDef[] = [
  { id: 'zelt-nord', baseline: 246, poly: [[322, 240], [365, 112], [455, 98], [526, 208], [526, 248], [322, 248]] },
  { id: 'zelt-ost', baseline: 282, poly: [[686, 270], [735, 138], [846, 138], [896, 250], [896, 285], [686, 285]] },
  { id: 'zelt-west', baseline: 404, poly: [[235, 336], [268, 278], [392, 278], [445, 372], [463, 372], [463, 404], [235, 404]] },
  { id: 'holzstapel', baseline: 442, poly: [[192, 356], [365, 376], [365, 446], [192, 446]] },
  { id: 'pfosten', baseline: 280, poly: [[912, 136], [946, 136], [946, 282], [912, 282]] },
  { id: 'kaefigwagen', baseline: 386, poly: [[985, 224], [1210, 224], [1210, 390], [985, 390]] },
];

export const CAMP_SURFACES: SurfaceDef[] = [
  { id: 'pfad', kind: 'path', poly: [[630, 548], [770, 548], [762, 720], [634, 720]] },
];

/** Named feet positions. */
export const CAMP_SPOT = {
  /** Where the path enters at the bottom (start of e3-falle). */
  path: [698, 694],
  /** A little way up the path, where the camp comes into view. */
  pathTop: [694, 560],
  /** At the fire: Lia's seat south-west of the ring, Kyra south-east. */
  liaFire: [604, 412],
  kyraFire: [664, 410],
  /** Behind the fire, where the smoke column rises (Vamir steps out of it). */
  smoke: [626, 318],
  /** Baris waits hidden behind the east tent (feet above its baseline: drawn behind the canvas). */
  barisHide: [800, 250],
  barisTrap: [654, 444],
  /** The two henchmen break out of the bushes south-west and south-east of the fire. */
  manWestHide: [520, 584],
  manWestTrap: [580, 418],
  manEastHide: [800, 566],
  manEastTrap: [632, 432],
  /** In front of the wagon's shaft (the cage). */
  cage: [976, 400],
  /** The post with the shackle: Flick stands with her back to it. */
  post: [929, 294],
  /** Around the fire in the evening (Vamir's men). */
  menFire: [[560, 392], [594, 434], [690, 432], [712, 384]] as readonly Spot[],
  vamirFire: [626, 452],
  kyraEvening: [672, 460],
  barisEvening: [748, 410],
  /** In front of Flick at the post (old staging, kept for the trail clues). */
  barisAtPost: [930, 336],
  /** Flick breaks out of the bushes south-east and runs for the wagon; Vamir's spell catches her halfway. */
  flickHide: [860, 560],
  flickStone: [930, 430],
  /** Baris in front of the statue. */
  barisAtStone: [900, 446],
} as const satisfies Record<string, Spot | readonly Spot[]>;

/** Hotspots of the painted objects. */
export const CAMP_HOTSPOT = {
  fire: FIRE_RING,
  wagon: [[1045, 232], [1200, 232], [1200, 384], [1045, 384]] as P,
  wagonStand: [1062, 398] as Spot,
  tentNorth: [[440, 162], [502, 162], [506, 240], [440, 240]] as P,
  tentNorthStand: [472, 260] as Spot,
  tentEast: [[735, 196], [792, 196], [792, 276], [735, 276]] as P,
  tentEastStand: [762, 298] as Spot,
};

// ---------------------------------------------------------------------------------------------------------------
// The three finds (Spurenblick and the tarp) and what Lia makes of them
// ---------------------------------------------------------------------------------------------------------------

export type FindId = 'stiefel' | 'fetzen' | 'kaefig';
export const FIND_IDS: readonly FindId[] = ['stiefel', 'fetzen', 'kaefig'];
/** How many finds spring the trap by themselves (otherwise the fire or Kyra do). */
export const FINDS_FOR_TRAP = 3;

export interface FindDef {
  id: FindId;
  /** Clue id in the journal. */
  clue: string;
  at: Spot;
  /** Lia's first look at the thing itself (always the same). */
  look: string;
}

export const FINDS: Record<FindId, FindDef> = {
  stiefel: {
    id: 'stiefel', clue: 'e3-falle-stiefel', at: [822, 318],
    look: 'Stiefelabdrücke, frisch und tief. Unter den Sohlen sitzen Nägel, ein Muster aus kleinen Punkten.',
  },
  fetzen: {
    id: 'fetzen', clue: 'e3-falle-fetzen', at: [228, 300],
    look: 'An einem Pfahl der Palisade hängt ein Fetzen Stoff. Schwarz und weiß, am Rand ausgefranst.',
  },
  kaefig: {
    id: 'kaefig', clue: 'e3-falle-kaefig', at: [1062, 398],
    look: 'Unter der Plane: Gitterstäbe. Ein Käfig auf Rädern, das Schloss glänzt vor frischem Fett.',
  },
};

/** What Lia thinks after her n-th find (1..3): the picture gets clearer with each one, whatever the order. */
export const FIND_THOUGHTS: readonly string[] = [
  '',
  'Wer im Wald leise sein will, trägt keine Nägel unter den Sohlen. Das sind keine Jägerstiefel.',
  'Die Stiefel, der Stoff. Das passt nicht zu Leuten, die sich verstecken. Das passt zu Leuten, die jemanden erwarten.',
  'Ein Käfig. Stiefel mit Nägeln. Schwarz und weiß. Das ist kein Lager für Rebellen. Das ist ein Lager für mich.',
];

/** Kyra's urging from the fire while Lia looks around (barks, kept short). */
export const KYRA_URGE: readonly string[] = [
  'Lia, komm ans Feuer.',
  'Lass das Zeug liegen.',
  'Die kommen gleich. Setz dich.',
  'Du sollst dich ausruhen.',
];

/** Kyra's answer when Lia shows her a find (after the first and the second find). */
export const KYRA_DEFLECT: readonly string[] = [
  'Rebellen tragen, was sie den Dunkelschatten abnehmen. Komm jetzt.',
  'Du siehst Gespenster, weil du müde bist. Komm ans Feuer.',
];

/** Normalises the stored find count (flag value) to 0..3. */
export function findCount(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(FINDS_FOR_TRAP, Math.floor(n))) : 0;
}

/** Lia's last line before the trap snaps shut, by how much she has seen (0..3). */
export function lastWords(finds: number): { text: string; mood: string } {
  if (finds >= FINDS_FOR_TRAP) return { text: 'Kyra. Das hier ist kein Rebellenlager. Wir müssen weg, sofort. Kyra?', mood: 'scared' };
  if (finds >= 1) return { text: 'Kyra … irgendwas stimmt hier nicht. Wo sind die alle? Und warum hat keiner Angst vor Dunkelschatten?', mood: 'thinking' };
  return { text: 'Endlich sitzen. Ich glaube, meine Beine sind schon vor mir eingeschlafen.', mood: 'hurt' };
}
