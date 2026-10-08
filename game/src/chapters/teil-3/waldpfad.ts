// Geometry of the painted autumn forest path e3-waldpfad (1280×720, docs/teil-3/assets.md): the earth path enters at
// the bottom (x ≈ 385–560) and climbs diagonally to the top-right corner; left of it a mossy bank below the trees (the
// place where Ignatius lies), right of it a fallen trunk with fungi. Painted a little closer than the other maps, so
// figures are drawn slightly larger (depthScale). Two maps use it: e3-vamir (the trail and the confrontation) and
// e3-ignatius-abschied (the farewell on the bank). Measured on the image with a 20 px grid, checked with map_tool.
import type { BlockDef, HidingSpotDef, OccluderDef, Polygon, SurfaceDef } from '../../world';

type Pt = [number, number];

/** Path and mossy bank as one area (bottom-left of the path → bank → top of the path → right edge back down). */
export const WALDPFAD_WALK: Polygon[] = [[
  // left edge of the path, bottom → where the bank opens
  [388, 720], [404, 668], [432, 616], [468, 568], [506, 526],
  // lower edge of the bank (bushes below), then up its left side past the trees and the boulder
  [470, 494], [400, 480], [336, 468], [244, 458], [196, 436], [166, 398], [154, 350], [160, 300], [182, 270],
  [238, 268], [278, 240], [300, 196], [342, 172], [420, 162], [520, 158], [612, 152], [676, 168],
  // round the yellow bush at the top of the bank and over to the path
  [690, 214], [716, 252], [776, 270], [832, 292], [868, 288],
  // left edge of the path up to the top-right corner
  [912, 236], [966, 180], [1030, 124], [1096, 70], [1146, 24], [1164, 0],
  // right edge back down, keeping left of the fallen trunk
  [1228, 0], [1214, 40], [1188, 82], [1148, 130], [1098, 180], [1046, 232], [998, 282], [970, 322], [930, 362],
  [894, 398], [852, 434], [804, 470], [756, 504], [708, 540], [664, 578], [626, 622], [592, 672], [570, 720],
]];

/** Obstacles inside the walkable area: the low boulder on the bank and the dark bush in the middle of it. */
export const WALDPFAD_BLOCKS: BlockDef[] = [
  { id: 'felsen-boeschung', poly: [[228, 430], [242, 404], [290, 398], [318, 414], [316, 440], [272, 450], [234, 446]] },
  { id: 'busch', sight: true, poly: [[512, 346], [548, 334], [600, 336], [620, 352], [604, 368], [548, 370], [516, 362]] },
];

export const WALDPFAD_OCCLUDERS: OccluderDef[] = [
  // The bush on the bank: whoever stands behind it is half hidden (fades so Lia stays visible).
  { id: 'busch', baseline: 368, fade: 0.55, poly: [[500, 336], [512, 300], [548, 286], [596, 292], [626, 318], [620, 352], [604, 368], [548, 370], [508, 360]] },
  // The boulder on the bank.
  { id: 'felsen-boeschung', baseline: 448, poly: [[224, 430], [236, 398], [270, 390], [312, 400], [322, 424], [316, 440], [272, 450], [232, 446]] },
  // Foreground leaves along the bottom edge left and right of the path.
  { id: 'laub-links', baseline: 720, fade: 0.6, poly: [[300, 660], [360, 640], [390, 680], [388, 720], [300, 720]] },
  { id: 'laub-rechts', baseline: 720, fade: 0.6, poly: [[580, 690], [620, 640], [680, 640], [700, 720], [570, 720]] },
];

export const WALDPFAD_SURFACES: SurfaceDef[] = [
  {
    id: 'pfad', kind: 'dirt',
    poly: [[388, 720], [440, 604], [530, 506], [640, 430], [760, 350], [880, 270], [1000, 160], [1170, 0], [1228, 0], [1150, 128], [1000, 282],
      [894, 398], [756, 504], [626, 622], [570, 720]],
  },
];

/** Behind the bush Lia cannot be seen from the bank (used for the approach in e3-vamir). */
export const WALDPFAD_HIDE: HidingSpotDef[] = [
  { id: 'busch', kind: 'bush', poly: [[520, 372], [606, 372], [618, 396], [520, 398]] },
];

export const WALDPFAD_SPOT = {
  /** Lia comes up the path from the bottom edge. */
  start: [478, 704] as Pt,
  /** The trail on the lower path (e3-vamir; all low enough that the bank is still out of view). */
  brand: [512, 652] as Pt,
  stab: [596, 606] as Pt,
  spur: [520, 560] as Pt,
  /** Behind the bush on the bank: where Lia hides and watches. */
  hide: [566, 386] as Pt,
  /** Ignatius kneels (e3-vamir) and later lies (e3-ignatius-abschied) on the soft moss of the bank. */
  ignatius: [420, 330] as Pt,
  /** Vamir stands over him, a little up the bank. */
  vamir: [476, 292] as Pt,
  /** Where Lia steps out, between the bush and Ignatius. */
  stepOut: [500, 382] as Pt,
  /** Farewell: where Lia stands after the duel and where she kneels beside him. */
  afterDuel: [560, 404] as Pt,
  kneel: [452, 340] as Pt,
  /** Kyra and Flick come up the path and onto the bank. */
  arrive: [470, 712] as Pt,
  kyraKneel: [474, 352] as Pt,
  flickWatch: [528, 400] as Pt,
};

/** Walking into this band behind the bush starts the confrontation (e3-vamir). */
export const HIDE_ZONE: Polygon = [[512, 372], [624, 372], [624, 412], [512, 412]];
