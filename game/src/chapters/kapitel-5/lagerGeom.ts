// Kapitel V: geometry of the painted camp map (assets/bg/k5-schattenlager.png, 1280×720): a lone oak above open
// fields, forest edge in the west, rocky outcrop in the north-west. Shared by 'schattenlager' and 'finale'.
import type { BlockDef, HidingSpotDef, OccluderDef, Polygon, SurfaceDef, WalkArea } from '../../world';
import { ellipse } from './geom';

export const LAGER_WALK: (Polygon | WalkArea)[] = [[
  [100, 22], [600, 22], [700, 8], [1280, 8], [1280, 720], [482, 720], [470, 602], [432, 562], [400, 524], [330, 494],
  [300, 446], [240, 410], [200, 386], [150, 340], [104, 306],
]];

export const BUSH = {
  b1: [[292, 192], [320, 168], [370, 168], [392, 196], [384, 226], [300, 228]] as Polygon,
  b2: [[428, 236], [452, 210], [512, 210], [536, 238], [526, 270], [440, 272]] as Polygon,
  b3: [[210, 262], [236, 240], [282, 240], [300, 264], [290, 292], [218, 292]] as Polygon,
  b4: [[454, 430], [490, 404], [560, 404], [586, 432], [574, 478], [466, 480]] as Polygon,
  b6: [[858, 488], [880, 474], [912, 476], [920, 496], [904, 510], [866, 508]] as Polygon,
};

export const FIRE_AT: [number, number] = [836, 346];

export const LAGER_BLOCK: BlockDef[] = [
  { id: 'felsen', poly: [[206, 42], [262, 14], [400, 10], [454, 60], [452, 120], [400, 132], [300, 130], [230, 120], [206, 92]] },
  { id: 'findling', poly: [[114, 142], [150, 128], [188, 140], [186, 172], [120, 174]] },
  { id: 'eiche', poly: [[792, 266], [830, 252], [900, 254], [930, 282], [916, 312], [850, 318], [800, 306]] },
  { id: 'baumstamm', sight: false, poly: [[282, 330], [300, 316], [470, 350], [482, 372], [462, 384], [290, 352]] },
  { id: 'feuerring', sight: false, poly: ellipse(FIRE_AT[0], FIRE_AT[1], 21, 11) },
  { id: 'stange', sight: false, poly: [[918, 300], [1010, 322], [1008, 340], [918, 318]] },
];

export const LAGER_OCCLUDERS: OccluderDef[] = [
  { id: 'eiche', baseline: 306, fade: 0.42, poly: [[605, 160], [640, 70], [720, 20], [840, 0], [980, 10], [1060, 60], [1100, 150], [1090, 230], [1040, 268], [960, 270], [930, 300], [905, 316], [840, 320], [790, 306], [760, 270], [690, 260], [630, 230]] },
  { id: 'baumstamm', baseline: 376, poly: [[276, 330], [300, 306], [380, 318], [470, 340], [484, 372], [464, 388], [286, 356]] },
  { id: 'felsen', baseline: 128, poly: [[204, 40], [262, 10], [404, 6], [456, 56], [454, 124], [400, 136], [300, 134], [228, 124], [204, 92]] },
  { id: 'b1', baseline: 226, fade: 0.6, poly: BUSH.b1 },
  { id: 'b2', baseline: 270, fade: 0.6, poly: BUSH.b2 },
  { id: 'b3', baseline: 290, fade: 0.6, poly: BUSH.b3 },
  { id: 'b4', baseline: 478, fade: 0.6, poly: BUSH.b4 },
  { id: 'b6', baseline: 508, fade: 0.6, poly: BUSH.b6 },
  { id: 'wald-vorne', baseline: 720, fade: 0.6, poly: [[300, 720], [330, 640], [400, 600], [440, 620], [470, 700], [476, 720]] },
];

export const LAGER_HIDING: HidingSpotDef[] = [
  { id: 'b1', kind: 'bush', poly: BUSH.b1 }, { id: 'b2', kind: 'bush', poly: BUSH.b2 }, { id: 'b3', kind: 'bush', poly: BUSH.b3 },
  { id: 'b4', kind: 'bush', poly: BUSH.b4 }, { id: 'b6', kind: 'bush', poly: BUSH.b6 },
];

export const LAGER_SURFACES: SurfaceDef[] = [
  { id: 'feld-sued', kind: 'wheat', poly: [[730, 500], [860, 470], [1000, 440], [1080, 420], [1280, 400], [1280, 720], [700, 720], [700, 600]] },
  { id: 'feld-ost', kind: 'wheat', poly: [[1140, 200], [1280, 190], [1280, 300], [1150, 300]] },
  { id: 'feld-nord', kind: 'wheat', poly: [[400, 22], [600, 22], [640, 90], [640, 130], [560, 130], [470, 70]] },
  { id: 'gras-1', kind: 'wheat', poly: [[96, 240], [190, 236], [196, 284], [100, 290]] },
  { id: 'gras-2', kind: 'wheat', poly: [[376, 302], [470, 296], [576, 330], [578, 368], [480, 370]] },
  { id: 'gras-3', kind: 'wheat', poly: [[388, 528], [486, 526], [490, 580], [400, 584]] },
  { id: 'gras-4', kind: 'wheat', poly: [[466, 602], [586, 600], [590, 668], [476, 672]] },
  { id: 'gras-5', kind: 'wheat', poly: [[580, 408], [650, 404], [652, 480], [584, 484]] },
  { id: 'gras-6', kind: 'wheat', poly: [[300, 236], [376, 236], [378, 262], [300, 262]] },
  { id: 'lager', kind: 'dirt', poly: [[690, 300], [780, 292], [900, 320], [990, 330], [990, 392], [800, 400], [700, 380]] },
  { id: 'pfad', kind: 'path', poly: [[780, 396], [820, 400], [740, 520], [700, 640], [690, 720], [612, 720], [640, 600], [700, 480]] },
];
