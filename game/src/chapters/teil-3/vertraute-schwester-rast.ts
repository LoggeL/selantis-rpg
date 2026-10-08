// „e3-vertraute-schwester“: the sisters' camp in the night thicket, on the reused background `k3-leselager` (640×360,
// painted at night, docs/teil-3/assets.md). The walkable outline is the one measured for Kapitel III's leselager on the
// same picture (copied, not imported, so Teil III does not load Kapitel III); the spots are new. Pure data, checked in
// vertraute-schwester.test.ts.

type P = [number, number][];
export const RAST_WALK: P[] = [[
  [150, 140], [200, 110], [260, 100], [420, 100], [480, 110], [520, 140], [545, 190], [520, 240], [470, 262], [320, 268],
  [306, 290], [300, 360], [232, 360], [234, 290], [200, 262], [150, 250], [120, 215], [118, 170],
]];
export const RAST_SPOT = {
  /** The bare earth in the middle (the fire). */
  fire: [312, 208],
  /** Seats at the fire: Lia west, Kyra east. */
  liaSeat: [280, 228],
  kyraSeat: [346, 226],
  /** Where Lia sleeps (and wakes) on her blanket. */
  bed: [262, 252],
  /** Where Kyra stands over her in the morning. */
  kyraMorning: [298, 246],
  /** Down the path out of the thicket (Kyra waits here in the morning). */
  pathOut: [266, 330],
} as const satisfies Record<string, readonly [number, number]>;
export const WOOD_AT: readonly (readonly [number, number])[] = [[158, 196], [494, 168], [446, 246]];
export const FIRE_HOTSPOT: P = [[290, 196], [336, 196], [336, 220], [290, 220]];
export const PATH_EXIT: P = [[234, 316], [302, 316], [300, 358], [232, 358]];
