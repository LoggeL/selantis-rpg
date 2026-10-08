// Geometry of the painted hall of the Lichterorden e3-ordenssaal (640×360, docs/teil-3/assets.md), measured on the
// image with a 20 px grid: the dais with the high chair at the top, the long table on the left, the runner from the
// door at the bottom centre up to the dais, columns along the walls and two pillars with fire bowls beside the door.
// Exported for later scenes in the same hall (they define their own map ids).
import type { LightDef, OccluderDef, Polygon, SurfaceDef } from '../../world';

type Pt = [number, number];

/** The open floor and the door passage at the bottom centre. */
export const HALL_WALK: Polygon[] = [[
  [28, 128], [560, 128], [560, 190], [604, 200], [604, 300], [462, 300], [460, 282], [400, 282], [372, 290],
  [372, 360], [268, 360], [268, 290], [238, 282], [180, 282], [178, 300], [30, 300],
]];

/** The long table with its chairs (it runs diagonally from the top right to the bottom left). */
export const HALL_TABLE: Polygon = [[40, 130], [150, 118], [174, 128], [174, 200], [142, 250], [30, 252], [28, 180]];

export const HALL_BLOCKS: { id: string; poly: Polygon; sight?: boolean }[] = [
  { id: 'tisch', poly: HALL_TABLE },
  { id: 'anrichte', poly: [[560, 140], [604, 140], [604, 186], [560, 186]] },
];

export const HALL_OCCLUDERS: OccluderDef[] = [
  // The two pillars with the fire bowls and the open door leaves at the bottom.
  { id: 'pfeiler-links', baseline: 344, poly: [[178, 262], [240, 262], [272, 290], [272, 360], [178, 360]] },
  { id: 'pfeiler-rechts', baseline: 344, poly: [[368, 290], [400, 262], [462, 262], [462, 360], [368, 360]] },
];

export const HALL_SURFACES: SurfaceDef[] = [
  { id: 'laeufer', kind: 'carpet', poly: [[280, 128], [362, 128], [362, 360], [280, 360]] },
];

/** The candles of the hall (candelabras on the dais, the table, the sideboard, the wall sconces). */
export const HALL_CANDLES: Pt[] = [[280, 64], [360, 64], [125, 130], [108, 160], [82, 176], [607, 130], [130, 48], [510, 48]];

export function hallCandleLights(intensity = 0.8): LightDef[] {
  return HALL_CANDLES.map((at, i) => ({ id: `e3-kerze-${i}`, at, kind: 'candle' as const, radius: 30, intensity, always: true }));
}

export const HALL_SPOT = {
  /** In the door passage. */
  door: [320, 340] as Pt,
  /** The high chair on the dais (the Großmeister sits here; not walkable). */
  chair: [320, 98] as Pt,
  /** Where the prisoners stand before the dais. */
  lia: [306, 206] as Pt,
  mentor: [346, 210] as Pt,
  /** The paladin who holds Lia (behind her, left). */
  holder: [282, 226] as Pt,
  /** The guard at Ignatius' side. */
  mentorGuard: [372, 230] as Pt,
  /** The captain of the guard beside the dais. */
  captain: [420, 150] as Pt,
  /** Two paladins along the runner. */
  sideLeft: [236, 176] as Pt,
  sideRight: [404, 184] as Pt,
  /** In front of the long table's papers. */
  table: [190, 190] as Pt,
};

/** Walking into this area in front of the dais starts the interrogation. */
export const BEFORE_DAIS: Polygon = [[262, 150], [380, 150], [380, 226], [262, 226]];
