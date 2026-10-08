// „e3-waldgegner“: the goblin camp of Ratz, Hotze and Fips in the forest, on the painted background `k5-faehrte` (1280×720, reused, see
// docs/teil-3/assets.md), measured with a 20 px grid. Only the north-east part of the picture is used: the small
// clearing with the stone fire ring and the fallen log, the big oak at its east edge (Flick hangs head down from its low branch, later sits tied at its roots), the
// trail that runs down from the clearing to the fork and on to the west. The bramble path to the south-east is not
// part of this map. Ferns and bushes beside the trail are the hiding places on the way out.
// Pure data and small rules (no engine imports); waldgegner.test.ts checks the geometry and the intrigue.
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
  /** Flick under the low oak branch (head down on the rope first, later tied at the roots). */
  stake: [1144, 204],
  /** The three goblins around the fire: Ratz the „chief“ (south-west), Hotze at the pot (west), Fips (south). */
  ratz: [1020, 182],
  hotze: [1004, 140],
  fips: [1062, 190],
  /** Where Fips stands when he cuts her down and ties her to the roots. */
  fipsAtOak: [1112, 200],
  /** The brawl: a heap of goblins next to the fire. */
  brawl: [1040, 192],
  /** End of the trail west: Flick is out of sight there. */
  escape: [868, 416],
} as const satisfies Record<string, Spot>;

/** Reaching the west end of the trail ends the escape. */
export const ESCAPE_ZONE: Polygon = [[850, 394], [890, 394], [890, 442], [850, 442]];

export const GHUL_SPAWNS: Record<string, SpawnDef> = {
  pflock: { at: GHUL_SPOT.stake, dir: 'left' },
  'farn-ost': { at: [1132, 270], dir: 'down' },
  'farn-west': { at: [1034, 342], dir: 'down' },
  'farn-gabel': { at: [960, 452], dir: 'left' },
};

/**
 * After the brawl, the three become watchers: Ratz turns on his spot by the fire (he looks down the trail now and
 * then), Hotze stirs his pot and looks out east and south, Fips is sent for firewood down the trail and back.
 */
export const GHUL_GUARDS: GuardDef[] = [
  {
    id: 'ratz', preset: 'goblin-ratz', speaker: 'e3-ratz', mode: 'loop', range: 118, fov: 70, reaction: 1.3,
    suspiciousBarks: ['Halt! Im Namen des Häuptlings!', 'Wer raschelt ohne Erlaubnis?'], calmBarks: ['Der Häuptling hat nix gesehen.', 'Wird schon ein Igel sein.'],
    path: [
      { at: GHUL_SPOT.ratz, wait: 2600, face: 'right' },
      { at: [GHUL_SPOT.ratz[0] + 2, GHUL_SPOT.ratz[1]], wait: 3000, face: 'up' },
      { at: GHUL_SPOT.ratz, wait: 2400, face: 'down' },
    ],
  },
  {
    id: 'hotze', preset: 'goblin-hotze', speaker: 'e3-hotze', mode: 'loop', range: 110, fov: 66, reaction: 1.4,
    suspiciousBarks: ['Riecht nach Elfe …', 'Hat da wer am Topf genascht?'], calmBarks: ['Fehlt Salz. Fehlt immer Salz.', 'Nix. Weiterrühren.'],
    path: [
      { at: GHUL_SPOT.hotze, wait: 3200, face: 'right' },
      { at: [GHUL_SPOT.hotze[0], GHUL_SPOT.hotze[1] + 2], wait: 2600, face: 'down' },
    ],
  },
  {
    id: 'fips', preset: 'goblin-fips', speaker: 'e3-fips', mode: 'pingpong', range: 100, fov: 70, reaction: 1.5, speed: 34,
    suspiciousBarks: ['Hä? Wer da?', 'Bist du das, Spitzohr?'], calmBarks: ['Holz, Holz, immer Fips.', 'Keiner da. Gut.'],
    path: [
      { at: GHUL_SPOT.fips, wait: 2200, face: 'up' },
      { at: [1088, 300], wait: 800, face: 'down' },
      { at: [1048, 388], wait: 2600, face: 'left' },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------------
// The intrigue: Flick plays the three goblins against each other (choices; a tried wrong line is greyed out)
// ---------------------------------------------------------------------------------------------------------------

export type Goblin = 'ratz' | 'hotze' | 'fips';
export const GOBLINS: readonly Goblin[] = ['ratz', 'hotze', 'fips'];

/** One line Flick can try: who she talks to, what she says and whether it moves the step on. */
export interface Ploy { id: string; to: Goblin; text: string; works: boolean }

/** The three steps of the intrigue, each with exactly one line that works. */
export const STEPS = {
  /** Head down on the branch: somebody has to want her down. */
  runter: [
    { id: 'rechte', to: 'ratz', text: 'Häuptling! Ich bin eine Gefangene. Ich habe Rechte.', works: false },
    { id: 'ohren', to: 'hotze', text: 'Kopfüber läuft mir das Blut in die Ohren. Elfenohren werden davon zäh wie Stiefelleder.', works: true },
    { id: 'netz', to: 'fips', text: 'Du willst mich allein gefangen haben, Kleiner? Mit dem Netz da? Glaub ich nicht.', works: false },
  ],
  /** Hotze wants her down, but the chief has to say so. */
  haeuptling: [
    { id: 'koch', to: 'ratz', text: 'Lässt du dir vom Koch sagen, wann die Beute runterkommt? Ein echter Häuptling …', works: false },
    { id: 'erstes-stueck', to: 'ratz', text: 'Der Häuptling kriegt doch das erste Stück, oder? Das zarteste. Wär schade, wenn es zäh ist.', works: true },
    { id: 'fips-sagt', to: 'ratz', text: 'Fips hat gesagt, du traust dich nicht an mich ran.', works: false },
  ],
  /** At the roots, hands tied: the knot has to get loose and the three have to look elsewhere. */
  knoten: [
    { id: 'glitzer', to: 'fips', text: 'Psst, Fips. In meinem Stiefel steckt eine Spange. Echtes Elbensilber. Deine, wenn der Knoten ein bisschen lockerer sitzt.', works: true },
    { id: 'kraeuter', to: 'hotze', text: 'Ohne Bärlauch schmecke ich nach gar nichts. Nur so als Tipp vom Essen.', works: false },
    { id: 'gnade', to: 'ratz', text: 'Großer Häuptling Ratz, der Gnädige. Klingt doch gut, oder?', works: false },
  ],
  /** Knot loose: the three have to start a fight about something. */
  zank: [
    { id: 'ohren-wem', to: 'hotze', text: 'Sag mal, Hotze, wer kriegt eigentlich die Ohren? Ratz meint, die stehen dem Häuptling zu.', works: true },
    { id: 'petzen', to: 'ratz', text: 'Ratz, Fips hat was Glänzendes in der Tasche. Von mir.', works: false },
    { id: 'lied', to: 'fips', text: 'Fips, sing doch mal was. Irgendwas Lautes.', works: false },
  ],
} as const satisfies Record<string, readonly Ploy[]>;

export type Step = keyof typeof STEPS;
export const STEP_ORDER: readonly Step[] = ['runter', 'haeuptling', 'knoten', 'zank'];

/** The options of a step: tried wrong lines are greyed out, so every step ends after at most three tries. */
export function ployOptions(step: Step, tried: ReadonlySet<string>): { text: string; disabled: boolean }[] {
  return STEPS[step].map(p => ({ text: p.text, disabled: !p.works && tried.has(p.id) }));
}
