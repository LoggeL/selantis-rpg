// Shared geometry of the farmstead (assets/bg/k1-hof.png, 1280×720): the sunken lane from the bottom-left up to the
// yard, the overgrown embankment on its left (Lia's hiding place), house, barn, pig pen, meadow and the stone heap.
import type { BlockDef, HidingSpotDef, OccluderDef, Polygon, SurfaceDef, WalkArea } from '../../world';
import { CELL, type CollisionGrid } from '../../world/grid';
import { rasterizePoly } from '../../world/poly';

/** Lane + embankment band + yard + meadow (one connected area). */
export const HOF_WALK: Polygon = [
  // embankment band (upper edge), bottom-left → yard
  [0, 640], [60, 612], [150, 552], [250, 482], [330, 422], [390, 372], [430, 322], [452, 282], [440, 250], [404, 206],
  // yard (house front, barn front)
  [436, 198], [500, 198], [540, 192], [560, 188], [610, 188], [640, 192], [680, 188], [720, 194], [760, 206], [1130, 206],
  [1166, 220], [1176, 244], [1140, 266], [1084, 284], [1072, 320], [1098, 350], [1078, 396], [1040, 434],
  // meadow above the stone wall, back to the lane
  [940, 446], [880, 472], [800, 492], [720, 516], [620, 544], [520, 556], [430, 568], [360, 612], [280, 672], [230, 720], [0, 720],
];

export const HOF_BLOCK: BlockDef[] = [
  { id: 'trog', poly: [[946, 208], [1020, 208], [1022, 232], [946, 232]] },
  { id: 'holzstapel', poly: [[438, 196], [496, 196], [496, 204], [438, 204]] },
  { id: 'hackklotz', poly: [[502, 192], [526, 192], [526, 206], [502, 206]] },
  { id: 'steinhaufen', poly: [[940, 456], [1000, 446], [1070, 452], [1100, 480], [1080, 506], [960, 506], [930, 482]] },
  { id: 'baum-wiese', poly: [[866, 430], [890, 430], [890, 446], [866, 446]] },
];

export const HOF_OCCLUDERS: OccluderDef[] = [
  { id: 'busch-a', baseline: 566, fade: 0.5, poly: [[190, 500], [210, 482], [270, 480], [304, 512], [290, 556], [220, 568], [186, 540]] },
  { id: 'busch-b', baseline: 506, fade: 0.5, poly: [[306, 446], [326, 424], [384, 420], [404, 456], [384, 500], [330, 508], [306, 480]] },
  { id: 'busch-c', baseline: 414, fade: 0.5, poly: [[392, 352], [410, 330], [446, 326], [470, 350], [466, 398], [422, 416], [392, 390]] },
  { id: 'busch-d', baseline: 318, fade: 0.5, poly: [[460, 262], [480, 246], [530, 252], [566, 288], [552, 320], [490, 318], [458, 292]] },
  { id: 'busch-tor', baseline: 618, fade: 0.5, poly: [[96, 584], [124, 566], [160, 570], [176, 600], [150, 620], [100, 620]] },
  { id: 'baum-wiese', baseline: 444, fade: 0.5, poly: [[820, 384], [846, 352], [902, 350], [932, 390], [914, 430], [890, 446], [866, 446], [830, 422]] },
];

export const HOF_HIDING: HidingSpotDef[] = [
  { id: 'busch-a', kind: 'bush', poly: [[200, 500], [270, 490], [300, 520], [282, 558], [222, 564], [192, 540]] },
  { id: 'busch-b', kind: 'bush', poly: [[318, 446], [380, 428], [400, 460], [382, 498], [332, 504], [312, 478]] },
  { id: 'busch-c', kind: 'bush', poly: [[400, 350], [440, 336], [466, 354], [460, 398], [420, 412], [398, 386]] },
  { id: 'busch-d', kind: 'bush', poly: [[466, 260], [528, 262], [560, 292], [546, 316], [492, 314], [462, 288]] },
  { id: 'busch-tor', kind: 'bush', poly: [[104, 586], [126, 572], [158, 576], [170, 600], [148, 616], [104, 614]] },
];

export const HOF_SURFACES: SurfaceDef[] = [
  { id: 'hohlweg', kind: 'path', poly: [[0, 680], [140, 628], [290, 558], [420, 488], [500, 438], [590, 360], [606, 300], [560, 270], [600, 240], [660, 280], [652, 340], [640, 392], [590, 446], [490, 512], [360, 602], [150, 720], [0, 720]] },
  { id: 'hof', kind: 'dirt', poly: [[436, 198], [760, 206], [1130, 206], [1120, 300], [900, 330], [700, 330], [600, 300], [520, 262], [436, 220]] },
];

/** Pig pen and the path outside its front gate, aligned with the painted fence. */
export const PEN_WALK: WalkArea = { poly: [[194, 150], [204, 136], [300, 106], [410, 118], [408, 156], [350, 190], [312, 198], [264, 188], [212, 174], [188, 160]] };
export const PEN_APPROACH: WalkArea = { poly: [[316, 184], [347, 175], [376, 191], [436, 202], [458, 228], [432, 246], [357, 226], [316, 224]] };
export const PEN_FENCE: BlockDef[] = [
  { id: 'zaun-hinten-links', poly: [[184, 150], [296, 96], [304, 102], [194, 158]] },
  { id: 'zaun-hinten-rechts', poly: [[298, 98], [418, 110], [420, 120], [298, 108]] },
  { id: 'zaun-rechts', poly: [[408, 112], [420, 114], [418, 160], [354, 190], [348, 182], [406, 152]] },
  { id: 'zaun-vorne-links', poly: [[184, 156], [314, 188], [314, 200], [182, 166]] },
];
export const PEN_GATE: BlockDef = { id: 'schweinegatter', poly: [[314, 188], [350, 178], [354, 188], [314, 200]] };
export const PEN_GATE_INSIDE: [number, number] = [332, 170];
export const PEN_GATE_OUTSIDE: [number, number] = [338, 210];
export const PEN_GATE_STAND: [number, number] = [338, 216];

/** Only the gate's cells change; the surrounding fence remains solid. */
export function clearPigpenGate(grid: CollisionGrid): void {
  rasterizePoly(PEN_GATE.poly, CELL, grid.cols, grid.rows, (r, c0, c1) => {
    grid.solid.fill(0, r * grid.cols + c0, r * grid.cols + c1 + 1);
    grid.sight.fill(0, r * grid.cols + c0, r * grid.cols + c1 + 1);
  });
  grid.version++;
}

/** Yard positions used by the raid and the graves. */
export const AT = {
  door: [583, 192] as [number, number],
  father: [560, 216] as [number, number],
  mother: [608, 216] as [number, number],
  orwen: [586, 254] as [number, number],
  kahle: [528, 238] as [number, number],
  kapuze: [652, 240] as [number, number],
  harro: [694, 228] as [number, number],
  hide: [510, 292] as [number, number],
  gate: [112, 596] as [number, number],
};
