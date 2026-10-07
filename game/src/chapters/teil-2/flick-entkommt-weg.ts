// „e2-flick-entkommt“: the escape route through the dungeon corridor after the alarm (e2-kerker). Flick starts in
// her own open cell (west), slips along the cell fronts into the empty, open cell in the east, crosses to the dark
// niche beside the crates and climbs the stairs in the north-east while the alarmed warden searches the corridor
// with his lantern and a second one guards the stair foot. Hiding spots are the dark cells and the niche; each one
// is also a stealth checkpoint. All coordinates are map pixels on the painted background (flick-entkommt.test.ts).
import type { GuardDef, HidingSpotDef, Polygon, SpawnDef } from '../../world';
import { KERKER_CELLS, KERKER_EDGE } from './gewoelbe';

type Spot = readonly [number, number];

/** Flick's own cell (west), the cell of Elnon and Kyra (middle) and the empty one (east). */
export const FLICK_CELL = KERKER_CELLS[0];
export const PRISON_CELL = KERKER_CELLS[1];
export const EMPTY_CELL = KERKER_CELLS[2];

/** The dark niche between the last cell and the crates on the east wall. */
export const NICHE: Polygon = [[548, 250], [576, 250], [576, 282], [548, 286]];

export const ESCAPE_HIDING: HidingSpotDef[] = [
  { id: 'zelle-flick', kind: 'crate', poly: FLICK_CELL.floor },
  { id: 'zelle-leer', kind: 'crate', poly: EMPTY_CELL.floor },
  { id: 'nische', kind: 'crate', poly: NICHE },
];

/** Stealth checkpoints (spawn names) in route order, with the trigger area that sets each one. */
export const ESCAPE_CHECKPOINTS: { spawn: string; area: Polygon }[] = [
  { spawn: 'versteck-zelle', area: EMPTY_CELL.floor },
  { spawn: 'versteck-nische', area: NICHE },
];

export const ESCAPE_SPAWNS: Record<string, SpawnDef> = {
  flucht: { at: [150, 118], dir: 'down' },
  'versteck-zelle': { at: [444, 118], dir: 'down' },
  'versteck-nische': { at: [562, 268], dir: 'up' },
};

/** The way out: the top of the stairs in the north-east. */
export const ESCAPE_EXIT: Polygon = KERKER_EDGE.stairs;

/** Where the scuffle happens: halfway from Flick's cell to the passage south (the way to the hall). */
export const SCUFFLE: Spot = [214, 214];
/** Where the key bunch lands. */
export const KEYS_AT: Spot = [246, 230];
/** Top of the stairs (wardens come and go there; hidden behind the arch). */
export const STAIRS_TOP: Spot = [596, 150];

/** Where the alarm comes from: the passage south (towards the hall). */
export const ALARM_FROM: Spot = [306, 300];

/**
 * The alarmed warden searches the cell fronts with his lantern (loop); the stair guard turns between listening up the
 * stairs and watching the corridor (pingpong). Both have short cones so the dark cells and the niche stay safe.
 */
export const ESCAPE_GUARDS: GuardDef[] = [
  {
    id: 'waerter-alarm', preset: 'shadow-club', speaker: 'e2-waerter', lantern: true, mode: 'loop', range: 84, fov: 70, reaction: 1.5,
    suspiciousBarks: ['Wer da? Komm raus!', 'Spitzohr? Bist du das?'], calmBarks: ['Ratten. Nur Ratten.', 'Weiter. Die ist längst oben.'],
    path: [
      { at: [306, 258], wait: 3600, face: 'down' },
      { at: [190, 190], wait: 1800, face: 'left' },
      { at: [318, 184], wait: 300 },
      { at: [446, 182], wait: 2200, face: 'up' },
      { at: [486, 236], wait: 1600, face: 'right' },
    ],
  },
  {
    id: 'posten-treppe', preset: 'shadow-spear', speaker: 'e2-waerter', lantern: true, mode: 'pingpong', range: 80, fov: 64, reaction: 1.5,
    suspiciousBarks: ['Hm? Da unten?', 'Halt! … Oder nicht?'], calmBarks: ['Nichts. Nur Schatten.', 'Bleib, wo du bist, Spitzohr. Ich find dich.'],
    path: [
      { at: [574, 186], wait: 3400, face: 'up' },
      { at: [514, 212], wait: 3000, face: 'left' },
    ],
  },
];
