// The Master's vaults: shared geometry for every Teil-II captivity scene. Two painted one-screen backgrounds
// (640×360): the vaulted hall `e2-halle` (dais with the high chair, heavy wooden table, interrogation chair with an
// iron ring in the floor, braziers, stairs down in the south arch, side door to the cells) and the dungeon corridor
// `e2-kerker` (three barred cells, guard table with lantern, stairs up in the north-east, passage south).
// Scenes spread `halleBase` / `kerkerBase(…)` into their own map ids and add npcs, lights, exits, time and music.
// All coordinates are map pixels, measured on the painted backgrounds (gewoelbe.test.ts checks every spot).
import type { CharAnim } from '../../art/api';
import type { Dir } from '../../core/types';
import type { BlockDef, LightDef, MapDef, OccluderDef, Polygon, SpawnDef, WorldCtx } from '../../world';

type P = [number, number][];
type Spot = readonly [number, number];

// ===============================================================================================================
// The hall (e2-halle)
// ===============================================================================================================

/**
 * Named feet positions in the hall. Every spot is walkable on `HALLE_WALK` with `HALLE_BLOCKS`, except the ones in
 * `HALLE_OBJECT_SPOTS` (the painted objects themselves: light anchors, the seat of the chair, the table top).
 */
export const HALLE_SPOT = {
  /** The iron ring set into the floor next to the chair (a chained prisoner stands around it). */
  ring: [505, 186],
  /** Where a prisoner chained to the ring stands by default (just south-west of it, facing the hall). */
  chained: [498, 196],
  /** Seat of the interrogation chair (feet point of a figure sitting on it; blocked unless a scene frees it). */
  chair: [470, 176],
  /** Standing in front of the chair, facing it (the interrogator's place). */
  chairFront: [424, 182],
  /** Behind and beside the chair, south-east (a guard watching the prisoner's hands). */
  chairGuard: [506, 214],
  /** Middle of the heavy table top (feet point of a figure lying on it; blocked unless a scene frees it). */
  tableTop: [128, 162],
  /** Standing at the long front side of the table. */
  tableFront: [132, 214],
  /** Standing at the head end of the table (east). */
  tableHead: [214, 176],
  /** Top step of the dais, in front of the high chair. */
  dais: [320, 86],
  /** Foot of the dais steps. */
  daisFoot: [320, 122],
  /** Middle of the hall. */
  centre: [320, 186],
  /** In front of the side door to the cells (east wall). */
  doorCells: [572, 150],
  /** A guard posted next to the side door. */
  guardCells: [546, 158],
  /** Top of the stairs in the south arch (where people come up from below). */
  doorSouth: [320, 286],
  /** Guards flanking the south arch. */
  guardSouthWest: [262, 246],
  guardSouthEast: [380, 246],
  /** Brazier bowls left and right of the dais (light anchors, off the floor). */
  brazierWest: [218, 70],
  brazierEast: [424, 70],
} as const satisfies Record<string, Spot>;

/** HALLE_SPOT entries that are objects, not standing places. */
export const HALLE_OBJECT_SPOTS = ['chair', 'tableTop', 'brazierWest', 'brazierEast'] as const;

/** Floor of the hall: from the dais front down to the south wall, with the cell-door alcove and the south stairs. */
export const HALLE_FLOOR: P = [
  [50, 150], [56, 116], [130, 112], [160, 108], [200, 106], [240, 110], [402, 110], [440, 106], [500, 110],
  [540, 114], [556, 140], [586, 142], [592, 166], [612, 188], [612, 214], [598, 228], [556, 250], [388, 258],
  [358, 262], [358, 300], [284, 300], [284, 262], [252, 258], [90, 256], [50, 244], [22, 216], [14, 168],
];

/** The dais with its steps (walkable; the high chair itself is cut out). Overlaps the floor at the bottom step. */
export const HALLE_DAIS: P = [
  [248, 64], [300, 64], [300, 76], [340, 76], [340, 64], [394, 64], [402, 114], [238, 114],
];

export const HALLE_WALK: P[] = [HALLE_FLOOR, HALLE_DAIS];

/** Footprint of the heavy table (legs and the ground under the top). */
export const HALLE_TABLE: P = [[58, 122], [198, 122], [198, 200], [58, 200]];
/** Footprint of the interrogation chair. */
export const HALLE_CHAIR: P = [[452, 158], [490, 158], [490, 180], [452, 180]];

export const HALLE_BLOCKS: BlockDef[] = [
  { id: 'tisch', poly: HALLE_TABLE },
  { id: 'stuhl', poly: HALLE_CHAIR, sight: false },
];

export const HALLE_OCCLUDERS: OccluderDef[] = [
  // Arch over the south stairs: whoever climbs up is hidden under it until they step into the hall.
  { id: 'bogen', baseline: 300, poly: [[262, 246], [380, 246], [380, 270], [356, 270], [356, 262], [284, 262], [284, 270], [262, 270]] },
];

/** Exit strips: the stairs down in the south arch; the cell door is an interaction door at HALLE_SPOT.doorCells. */
export const HALLE_EDGE: Record<'south', Polygon> = {
  south: [[290, 290], [352, 290], [352, 300], [290, 300]],
};

export const HALLE_SPAWNS: Record<string, SpawnDef> = {
  chained: { at: HALLE_SPOT.chained, dir: 'left' },
  centre: { at: HALLE_SPOT.centre, dir: 'up' },
  south: { at: HALLE_SPOT.doorSouth, dir: 'up' },
  cells: { at: HALLE_SPOT.doorCells, dir: 'left' },
  chairFront: { at: HALLE_SPOT.chairFront, dir: 'right' },
};

/** The two braziers as flickering fire lights (dim them for later hours). */
export function halleBrazierLights(intensity = 1): LightDef[] {
  return [
    { id: 'becken-west', at: HALLE_SPOT.brazierWest, kind: 'fire', radius: 120, intensity, flame: 0.8, always: true },
    { id: 'becken-ost', at: HALLE_SPOT.brazierEast, kind: 'fire', radius: 120, intensity, flame: 0.8, always: true },
  ];
}

/** Centre of the chain's reach around the floor ring (shifted south-east so the chair stays outside). */
export const HALLE_CHAIN_CENTRE: Spot = [512, 194];

/**
 * A small walk area around a ring a prisoner is chained to: an ellipse (3/4 view) of `rx` × `ry` px around `at`.
 * The ring itself stays walkable; everything beyond the chain's length is blocked.
 */
export function chainArea(at: Spot = HALLE_CHAIN_CENTRE, rx = 28, ry = 16, n = 14): P {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [Math.round(at[0] + Math.cos(a) * rx), Math.round(at[1] + Math.sin(a) * ry)] as [number, number];
  });
}

/** A tiny walk area around a fixed place (the chair, the table top) for a player who must not walk away. */
export function pinArea(at: Spot, r = 8): P {
  return [[at[0] - r, at[1] - r], [at[0] + r, at[1] - r], [at[0] + r, at[1] + r], [at[0] - r, at[1] + r]];
}

/** Common map fields of every hall map (free floor; chained or seated scenes override walk/block). */
export const halleBase: Pick<MapDef, 'background' | 'baked' | 'walk' | 'block' | 'occluders' | 'surface' | 'spawns' | 'sneak' | 'lookMode' | 'critters'> = {
  background: 'e2-halle',
  baked: 'night',
  walk: HALLE_WALK,
  block: HALLE_BLOCKS,
  occluders: HALLE_OCCLUDERS,
  surface: 'stone',
  spawns: HALLE_SPAWNS,
  sneak: false,
  lookMode: false,
  critters: false,
};

// ===============================================================================================================
// The dungeon corridor (e2-kerker)
// ===============================================================================================================

/** Left edge x of each of the three identical cells (west to east). */
const CELL_X = [58, 218, 378] as const;

export interface KerkerCell {
  readonly id: string;
  /** Straw floor inside the bars (walkable when the scene includes the cell). */
  readonly floor: P;
  /** The cell door's opening (walkable only when the door is open). */
  readonly door: P;
  /** Feet positions: inside left, inside right (on the straw), in the doorway, in the corridor in front of it. */
  readonly inLeft: Spot;
  readonly inRight: Spot;
  readonly doorway: Spot;
  readonly front: Spot;
  /** The cell door itself (interaction anchor for the lock). */
  readonly lock: Spot;
}

export const KERKER_CELLS: readonly KerkerCell[] = CELL_X.map((x0, i) => ({
  id: `zelle-${i + 1}`,
  floor: [[x0 + 10, 100], [x0 + 118, 100], [x0 + 118, 130], [x0 + 10, 130]],
  door: [[x0 + 46, 124], [x0 + 76, 124], [x0 + 76, 150], [x0 + 46, 150]],
  inLeft: [x0 + 28, 122],
  inRight: [x0 + 98, 122],
  doorway: [x0 + 61, 132],
  front: [x0 + 61, 160],
  lock: [x0 + 74, 112],
}));

/** Named feet positions in the corridor (all walkable on the corridor alone). */
export const KERKER_SPOT = {
  /** Middle of the corridor. */
  centre: [320, 210],
  /** In front of the guard table, where the key bunch lies at night. */
  guardTable: [152, 240],
  /** Next to the stool at the guard table (a guard sitting there). */
  guardSeat: [104, 284],
  /** Foot of the stairs up (north-east), the way out. */
  stairs: [584, 166],
  /** Beside the crates on the east wall (a hiding place in the shadow). */
  crates: [566, 236],
  /** Top of the passage south (to the hall). */
  passage: [306, 300],
  /** Far end of the passage south, at the map edge. */
  passageEnd: [306, 352],
} as const satisfies Record<string, Spot>;

/** The corridor floor in front of the cells, with the stair foot and the passage south. */
export const KERKER_CORRIDOR: P = [
  [44, 150], [60, 144], [560, 144], [576, 146], [604, 150], [606, 178], [606, 242], [582, 246], [578, 282],
  [536, 290], [536, 298], [454, 298], [452, 276], [378, 276], [376, 360], [238, 360], [236, 276], [182, 276],
  [180, 288], [60, 290], [44, 270],
];

export const KERKER_BLOCKS: BlockDef[] = [
  { id: 'wachtisch', poly: [[42, 212], [140, 212], [140, 266], [42, 266]] },
  { id: 'hocker', poly: [[80, 262], [102, 262], [102, 276], [80, 276]] },
  { id: 'waffenstaender', poly: [[38, 170], [58, 170], [58, 212], [38, 212]] },
  { id: 'kisten', poly: [[580, 244], [612, 244], [612, 282], [580, 282]] },
];

/** x offsets of the vertical bars (and door frame) from a cell's left edge, measured on the painting. */
const BAR_X = [3, 11, 21, 32, 42, 50, 55, 61, 68, 78, 91, 104, 115, 123] as const;

/**
 * The bars in front of each cell as thin strips plus the middle and bottom rails: a figure inside a cell is drawn
 * behind the iron and stays visible between the bars.
 */
export const KERKER_OCCLUDERS: OccluderDef[] = CELL_X.flatMap((x0, i) => [
  ...BAR_X.map((bx, k): OccluderDef => ({
    id: `gitter-${i + 1}-${k}`, baseline: 141, poly: [[x0 + bx - 1, 40], [x0 + bx + 2, 40], [x0 + bx + 2, 141], [x0 + bx - 1, 141]],
  })),
  { id: `riegel-${i + 1}`, baseline: 141, poly: [[x0, 106], [x0 + 126, 106], [x0 + 126, 111], [x0, 111]] },
  { id: `schwelle-${i + 1}`, baseline: 141, poly: [[x0, 127], [x0 + 126, 127], [x0 + 126, 141], [x0, 141]] },
]);

/** Exit strips: the stairs up (north-east) and the passage south. */
export const KERKER_EDGE: Record<'stairs' | 'south', Polygon> = {
  stairs: [[570, 148], [600, 150], [604, 162], [574, 160]],
  south: [[240, 350], [374, 350], [374, 360], [240, 360]],
};

/** Corridor spawns (cell spawns `zelle-1` … `zelle-3` come from kerkerSpawns for the cells a map includes). */
export const KERKER_SPAWNS: Record<string, SpawnDef> = {
  centre: { at: KERKER_SPOT.centre, dir: 'up' },
  stairs: { at: KERKER_SPOT.stairs, dir: 'left' },
  south: { at: KERKER_SPOT.passage, dir: 'up' },
};

/** Spawns for a dungeon map: the cell spawns of the included cells first (a locked-in prisoner), then the corridor. */
export function kerkerSpawns(opts: { corridor?: boolean; cells?: number[] } = {}): Record<string, SpawnDef> {
  const out: Record<string, SpawnDef> = {};
  for (const i of opts.cells ?? []) out[KERKER_CELLS[i].id] = { at: KERKER_CELLS[i].inRight, dir: 'down' };
  return opts.corridor === false ? out : { ...out, ...KERKER_SPAWNS };
}

/** Wall torches between the cells, at the stairs and on the side walls, plus the lantern on the guard table. */
export function kerkerLights(intensity = 1): LightDef[] {
  return [
    { id: 'fackel-1', at: [50, 86], kind: 'fire', radius: 80, intensity, flame: 0.5, always: true },
    { id: 'fackel-2', at: [205, 86], kind: 'fire', radius: 80, intensity, flame: 0.5, always: true },
    { id: 'fackel-3', at: [362, 86], kind: 'fire', radius: 80, intensity, flame: 0.5, always: true },
    { id: 'fackel-treppe', at: [588, 44], kind: 'fire', radius: 70, intensity: intensity * 0.8, flame: 0.4, always: true },
    { id: 'fackel-west', at: [20, 228], kind: 'fire', radius: 70, intensity: intensity * 0.8, always: true },
    { id: 'fackel-ost', at: [620, 226], kind: 'fire', radius: 70, intensity: intensity * 0.8, always: true },
    { id: 'wachlaterne', at: [95, 222], kind: 'lantern', radius: 60, intensity, always: true },
  ];
}

/**
 * Walk areas for a dungeon map: the corridor (unless `corridor: false`, e.g. a prisoner locked in), the floors of
 * the listed cells and the doorways of the open ones.
 */
export function kerkerWalk(opts: { corridor?: boolean; cells?: number[]; open?: number[] } = {}): P[] {
  const out: P[] = [];
  if (opts.corridor !== false) out.push(KERKER_CORRIDOR);
  for (const i of opts.cells ?? []) out.push(KERKER_CELLS[i].floor);
  for (const i of opts.open ?? []) out.push(KERKER_CELLS[i].door);
  return out;
}

/** Common map fields of every dungeon map; pass which cells are part of the walkable area and which stand open. */
export function kerkerBase(opts: { corridor?: boolean; cells?: number[]; open?: number[] } = {}): Pick<MapDef, 'background' | 'baked' | 'walk' | 'block' | 'occluders' | 'surface' | 'spawns' | 'critters'> {
  return {
    background: 'e2-kerker',
    baked: 'night',
    walk: kerkerWalk(opts),
    block: KERKER_BLOCKS,
    occluders: KERKER_OCCLUDERS,
    surface: 'stone',
    spawns: kerkerSpawns(opts),
    critters: false,
  };
}

// ===============================================================================================================
// Holding a prisoner in place
// ===============================================================================================================

interface PlayerBody { walkSpeed: number; runSpeed: number }

/**
 * Keeps the player in a pose on a fixed spot (tied to the chair, bound on the table) while interactions stay
 * possible: no walking speed, the pose as idle animation and the facing pinned. Returns the release function; the
 * scene's shutdown releases it as well.
 */
export function pinPlayer(w: WorldCtx, pose: string, dir: Dir): () => void {
  const body = (w.scene as unknown as { player?: PlayerBody }).player;
  const saved = body ? { walk: body.walkSpeed, run: body.runSpeed } : null;
  if (body) { body.walkSpeed = 0; body.runSpeed = 0; }
  w.player.setIdle(pose as CharAnim);
  w.player.face(dir);
  const onUpdate = () => { if (w.alive && w.player.dir !== dir) w.player.face(dir); };
  // After the scene's own update (which turns the player towards the pressed key).
  w.scene.events.on('postupdate', onUpdate);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    w.scene.events.off('postupdate', onUpdate);
    if (body && saved) { body.walkSpeed = saved.walk; body.runSpeed = saved.run; }
  };
  w.scene.events.once('shutdown', release);
  return release;
}
