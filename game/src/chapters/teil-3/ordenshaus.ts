// The order house of the Lichterorden in Trapas: shared geometry for every Teil-III scene upstairs (docs/teil-3/
// umsetzung.md §3: e3-macht-und-schutz, e3-falscher-glaube, e3-kyras-fluchtweg). Two painted backgrounds, measured on
// the images with a 20 px grid (docs/teil-3/assets.md):
//  - `e3-gastzimmer` (640×360): Lia's small room under the roof: bed with chest on the left, window in the back wall,
//    table with candle and stool, washstand with bowl and basket, the door in the right wall.
//  - `e3-ordenshaus` (1280×720): the upper floor as a cut-away. The long corridor with the blue runner in the middle;
//    the library on the left (lectern), the armoury behind a grate at the top centre (staffs and shields on the back
//    wall), the study door in an alcove, the small chapel on the right (coloured window, altar, benches), the door at
//    the east end of the corridor. A flight of stairs leads down from a landing to the guest wing below: two room doors
//    (Lia's on the left, Ignatius' beside it) along a lower passage that the stair foot joins along the bottom ledge.
// Scenes spread `gastzimmerBase` / `ordenshausBase` into their own map ids (day, night) and add npcs, interactables,
// exits and scripts. `ordenshaus.test.ts` checks every spot against the geometry.
import type Phaser from 'phaser';
import { G } from '../../core/G';
import type { BlockDef, GuardDef, HidingSpotDef, LightDef, MapDef, OccluderDef, Polygon, SpawnDef, SurfaceDef, WorldCtx } from '../../world';
import { staffPlace } from './shared';

type Spot = readonly [number, number];
type P = [number, number][];

// ===============================================================================================================
// The guest room (e3-gastzimmer)
// ===============================================================================================================

/** Plank floor between the bed, the back wall with window, table and washstand, and the door in the right wall. */
export const GZ_WALK: P[] = [[
  [50, 104], [520, 104], [548, 110], [556, 238], [588, 248], [588, 356], [20, 356], [20, 250], [50, 238],
]];

export const GZ_BLOCKS: BlockDef[] = [
  { id: 'bett', poly: [[40, 80], [162, 80], [162, 218], [124, 218], [124, 238], [40, 238]] },
  { id: 'nachttisch', poly: [[160, 80], [200, 80], [200, 146], [160, 146]] },
  { id: 'tisch', poly: [[344, 80], [420, 80], [420, 132], [402, 132], [402, 142], [366, 142], [366, 132], [344, 132]] },
  { id: 'waschtisch', poly: [[438, 80], [515, 80], [515, 162], [438, 162]] },
  { id: 'kisten', poly: [[0, 248], [96, 248], [96, 360], [0, 360]] },
  { id: 'kommode', poly: [[586, 230], [640, 230], [640, 360], [586, 360]] },
];

/** Named feet positions in the guest room. GZ_OBJECT_SPOTS are painted objects (light anchors, the bed surface). */
export const GZ_SPOT = {
  /** On the bed, sitting (a figure is placed here by script; the bed is blocked). */
  bedSit: [138, 172],
  /** Standing beside the bed. */
  bedSide: [182, 190],
  /** In front of the table (the doctor's instruments lie on it). */
  tableFront: [386, 164],
  /** Beside the table on the window side (the doctor stands here). */
  tableSide: [326, 128],
  /** The crystal on the table (light anchor). */
  crystal: [392, 92],
  /** The candle on the table (light anchor). */
  candle: [370, 68],
  /** In front of the washstand. */
  washFront: [474, 184],
  /** Beside the washstand (the doctor holds the bowl). */
  washSide: [520, 176],
  /** The bowl on the washstand (light/fx anchor). */
  bowl: [468, 92],
  /** Under the window. */
  window: [305, 114],
  /** The window itself (light anchor). */
  windowLight: [305, 40],
  /** Just inside the door. */
  door: [532, 222],
  /** A paladin posted by the door. */
  doorGuard: [520, 264],
  /** Middle of the room. */
  centre: [300, 240],
} as const satisfies Record<string, Spot>;

export const GZ_OBJECT_SPOTS = ['bedSit', 'crystal', 'candle', 'bowl', 'windowLight'] as const;

/** Where the door interaction sits (the painted door is in the slanted right wall). */
export const GZ_DOOR_AT: Spot = [540, 214];

/** A loop the doctor walks with his candle (all on free floor). */
export const GZ_CANDLE_LOOP: Spot[] = [[300, 170], [220, 250], [330, 320], [470, 300], [500, 220], [400, 190]];

export const GZ_SPAWNS: Record<string, SpawnDef> = {
  bett: { at: GZ_SPOT.bedSide, dir: 'right' },
  tuer: { at: GZ_SPOT.door, dir: 'left' },
};

/** The candle and the window; at night only the moon through the window (the candle is lit by script). */
export function gastzimmerLights(night: boolean): LightDef[] {
  if (night) return [{ id: 'gz-mond', at: GZ_SPOT.windowLight, kind: 'moon', radius: 110, intensity: 0.7, always: true }];
  return [
    { id: 'gz-kerze', at: GZ_SPOT.candle, kind: 'candle', radius: 34, intensity: 0.8 },
    { id: 'gz-fenster', at: GZ_SPOT.windowLight, kind: 'window', radius: 90, intensity: 0.6 },
  ];
}

/** Common fields of every guest-room map. */
export function gastzimmerBase(night: boolean): Pick<MapDef, 'background' | 'walk' | 'block' | 'surface' | 'spawns' | 'lights' | 'time' | 'ambience' | 'ambienceVolume' | 'lookMode' | 'critters' | 'playerLight'> {
  return {
    background: 'e3-gastzimmer',
    walk: GZ_WALK,
    block: GZ_BLOCKS,
    surface: 'wood',
    spawns: GZ_SPAWNS,
    lights: gastzimmerLights(night),
    time: night ? 'night' : 'day',
    ambience: night ? ['night', 'room'] : ['room'],
    ambienceVolume: night ? { night: 0.35, room: 0.5 } : { room: 0.6 },
    lookMode: false,
    critters: false,
    playerLight: night ? 18 : undefined,
  };
}

// ===============================================================================================================
// The upper floor (e3-ordenshaus)
// ===============================================================================================================

/** Named feet positions upstairs (all on free floor). */
export const OH_SPOT = {
  /** In front of Lia's door in the lower passage (left door). */
  liaDoor: [200, 644],
  /** In front of Ignatius' door (right door). */
  ignatiusDoor: [345, 644],
  /** A guard posted beside Ignatius' door (day). */
  ignatiusGuard: [400, 652],
  /** East end of the lower passage. */
  lowerEast: [640, 652],
  /** Along the bottom ledge between the passage and the stair foot. */
  ledge: [790, 690],
  /** Foot and top of the stairs. */
  stairFoot: [934, 684],
  stairTop: [934, 524],
  /** Corridor: west end, in front of the library doorway, in front of the armoury grate. */
  corridorWest: [70, 420],
  libraryDoor: [192, 392],
  /** In the library doorway and inside the library. */
  libraryIn: [192, 300],
  libraryWest: [116, 232],
  /** In front of the lectern (reading place). */
  lectern: [196, 250],
  /** Behind the lectern (a shadow at night). */
  lecternBack: [196, 162],
  /** In front of the armoury grate. */
  armoury: [606, 374],
  /** The novice's place at the little water table. */
  novice: [764, 380],
  /** At the study door (listening place) and the shadows beside it. */
  studyDoor: [895, 262],
  shadowLeft: [842, 276],
  shadowRight: [948, 276],
  /** In front of the alcove, in the corridor (the guard looks into it from here). */
  alcoveFront: [895, 372],
  /** Chapel: in front of the altar, behind the benches. */
  altar: [1124, 258],
  pews: [1084, 292],
  /** East end of the corridor, by the door to the stairs down to the hall. */
  eastDoor: [1172, 420],
} as const satisfies Record<string, Spot>;

/** Free floor: corridor, library with doorway, study alcove, chapel, stair landing, stairs, ledge, lower passage. */
export const OH_WALK: P[] = [
  // The corridor.
  [[20, 362], [1182, 362], [1182, 488], [20, 488]],
  // The library and its doorway down into the corridor.
  [[60, 152], [312, 152], [312, 202], [368, 202], [368, 256], [244, 256], [244, 366], [142, 366], [142, 256], [96, 256], [96, 206], [60, 206]],
  // The alcove in front of the study door.
  [[824, 238], [966, 238], [966, 366], [824, 366]],
  // The chapel, open to the corridor east of its door leaf.
  [[1032, 184], [1252, 184], [1252, 366], [1032, 366]],
  // The landing, the stairs and the stair foot.
  [[838, 484], [1032, 484], [1032, 548], [838, 548]],
  [[850, 540], [1016, 540], [1016, 706], [850, 706]],
  // The bottom ledge from the stair foot to the end of the lower passage.
  [[730, 668], [856, 668], [856, 706], [730, 706]],
  // The lower passage with the two room doors.
  [[106, 622], [740, 622], [740, 672], [106, 672]],
];

export const OH_BLOCKS: BlockDef[] = [
  { id: 'pult', poly: [[146, 176], [242, 176], [242, 240], [146, 240]] },
  { id: 'pflanze-bibliothek', poly: [[62, 150], [108, 150], [108, 196], [62, 196]] },
  { id: 'globus', poly: [[326, 212], [370, 212], [370, 252], [326, 252]] },
  { id: 'altar', poly: [[1072, 186], [1176, 186], [1176, 240], [1072, 240]] },
  { id: 'pflanze-kapelle', poly: [[1216, 206], [1252, 206], [1252, 252], [1216, 252]] },
  { id: 'bank-links', poly: [[1040, 304], [1124, 304], [1124, 338], [1040, 338]] },
  { id: 'bank-rechts', poly: [[1142, 304], [1228, 304], [1228, 338], [1142, 338]] },
  { id: 'pflanze-1', poly: [[132, 616], [164, 616], [164, 634], [132, 634]] },
  { id: 'pflanze-2', poly: [[380, 616], [410, 616], [410, 634], [380, 634]] },
  { id: 'pflanze-3', poly: [[455, 616], [484, 616], [484, 634], [455, 634]] },
  { id: 'tischchen', poly: [[486, 616], [580, 616], [580, 636], [486, 636]] },
  { id: 'pflanze-4', poly: [[668, 616], [738, 616], [738, 640], [668, 640]] },
];

export const OH_OCCLUDERS: OccluderDef[] = [
  { id: 'pult', baseline: 238, poly: [[146, 160], [242, 160], [242, 240], [146, 240]] },
  { id: 'bank-links', baseline: 336, poly: [[1040, 262], [1124, 262], [1124, 338], [1040, 338]] },
  { id: 'bank-rechts', baseline: 336, poly: [[1142, 262], [1228, 262], [1228, 338], [1142, 338]] },
  { id: 'feuerschale-links', baseline: 548, poly: [[786, 470], [840, 470], [840, 548], [786, 548]] },
  { id: 'feuerschale-rechts', baseline: 548, poly: [[1030, 470], [1084, 470], [1084, 548], [1030, 548]] },
];

export const OH_SURFACES: SurfaceDef[] = [
  { id: 'laeufer', kind: 'carpet', poly: [[0, 386], [1182, 386], [1182, 456], [0, 456]] },
  { id: 'bibliothek', kind: 'wood', poly: [[30, 140], [392, 140], [392, 302], [30, 302]] },
];

/** The armoury grate (seen over the wall from the corridor) and where Lia's staff hangs among the weapons. */
export const ARMOURY_GRATE: Polygon = [[576, 176], [640, 176], [640, 352], [576, 352]];

/** Lets the camera look over the wall into the armoury (the back wall is far above the corridor) and back. */
export async function lookIntoArmouryCam(w: WorldCtx, look: () => Promise<void>): Promise<void> {
  await w.camera.pan([560, 170], 700);
  try { await look(); } finally { await w.camera.pan([w.player.x, w.player.y], 500); w.camera.follow(); }
}
export const STAFF_ON_WALL: Spot = [508, 98];

/** Painted doors (hotspots) and the points in front of them. */
export const OH_DOOR = {
  lia: { poly: [[172, 540], [228, 540], [228, 626], [172, 626]] as Polygon, at: OH_SPOT.liaDoor },
  ignatius: { poly: [[318, 540], [374, 540], [374, 626], [318, 626]] as Polygon, at: OH_SPOT.ignatiusDoor },
  study: { poly: [[866, 140], [922, 140], [922, 240], [866, 240]] as Polygon, at: OH_SPOT.studyDoor },
  east: { poly: [[1184, 352], [1206, 352], [1206, 470], [1184, 470]] as Polygon, at: OH_SPOT.eastDoor },
} as const;

/** Lectern, chapel window and altar, bookshelves (hotspot polygons on the painted objects). */
export const OH_HOTSPOT = {
  lectern: [[150, 168], [240, 168], [240, 234], [150, 234]] as Polygon,
  shelves: [[264, 40], [370, 40], [370, 150], [264, 150]] as Polygon,
  chapelWindow: [[1092, 40], [1150, 40], [1150, 170], [1092, 170]] as Polygon,
  altar: [[1076, 176], [1172, 176], [1172, 236], [1076, 236]] as Polygon,
  waterTable: [[728, 322], [800, 322], [800, 362], [728, 362]] as Polygon,
} as const;

/** Where a reader at the lectern stands. */
export const LECTERN_STAND: Spot = OH_SPOT.lectern;

/** The listening place right at the study door, and the two shadows beside the door. */
export const STUDY_LISTEN: Polygon = [[872, 246], [918, 246], [918, 284], [872, 284]];
export const STUDY_SHADOWS: Polygon[] = [
  [[826, 250], [862, 250], [862, 294], [826, 294]],
  [[930, 250], [964, 250], [964, 294], [930, 294]],
];

/** Shadows a crouching Lia can hide in at night (the house is dark between the few lit sconces). */
export const OH_SHADOWS: HidingSpotDef[] = [
  { id: 'schatten-zimmer', kind: 'crate', poly: [[108, 636], [134, 636], [134, 670], [108, 670]] },
  { id: 'schatten-gang', kind: 'crate', poly: [[372, 636], [416, 636], [416, 670], [372, 670]] },
  { id: 'schatten-ost', kind: 'crate', poly: [[690, 642], [738, 642], [738, 672], [690, 672]] },
  { id: 'schatten-bibliothek-l', kind: 'crate', poly: [[144, 258], [166, 258], [166, 302], [144, 302]] },
  { id: 'schatten-bibliothek-r', kind: 'crate', poly: [[220, 258], [242, 258], [242, 302], [220, 302]] },
  { id: 'schatten-pult', kind: 'crate', poly: [[150, 154], [240, 154], [240, 174], [150, 174]] },
  { id: 'schatten-tischchen', kind: 'crate', poly: [[354, 364], [474, 364], [474, 382], [354, 382]] },
  { id: 'schatten-krug', kind: 'crate', poly: [[724, 364], [802, 364], [802, 382], [724, 382]] },
  { id: 'schatten-alkoven-l', kind: 'crate', poly: STUDY_SHADOWS[0] },
  { id: 'schatten-alkoven-r', kind: 'crate', poly: STUDY_SHADOWS[1] },
  { id: 'schatten-bank-l', kind: 'crate', poly: [[1042, 280], [1122, 280], [1122, 302], [1042, 302]] },
  { id: 'schatten-bank-r', kind: 'crate', poly: [[1144, 280], [1226, 280], [1226, 302], [1144, 302]] },
];

export const OH_SPAWNS: Record<string, SpawnDef> = {
  'lia-tuer': { at: OH_SPOT.liaDoor, dir: 'down' },
  bibliothek: { at: OH_SPOT.libraryWest, dir: 'right' },
  alkoven: { at: OH_SPOT.shadowLeft, dir: 'right' },
  treppe: { at: OH_SPOT.stairTop, dir: 'up' },
};

const SCONCES: Spot[] = [[52, 310], [325, 310], [507, 310], [707, 310], [916, 312], [1008, 160], [1275, 160]];
const LOWER_SCONCES: Spot[] = [[120, 560], [420, 560], [635, 560]];
const FIRE_BOWLS: Spot[] = [[808, 500], [1055, 500]];

/**
 * Lights of the upper floor at night: a few dim sconces, the two fire bowls by the stairs, the moon through the chapel
 * window, the doctor's forgotten lamp in the library and the strip of light under the study door. By day the painted
 * candles carry the picture alone.
 */
export function ordenshausNightLights(opts: { studyLit?: boolean; libraryLamp?: boolean } = {}): LightDef[] {
  const lights: LightDef[] = [
    ...SCONCES.map((at, i) => ({ id: `oh-leuchter-${i}`, at, kind: 'candle' as const, radius: 46, intensity: 0.45, always: true })),
    ...LOWER_SCONCES.map((at, i) => ({ id: `oh-gang-${i}`, at, kind: 'candle' as const, radius: 40, intensity: 0.4, always: true })),
    ...FIRE_BOWLS.map((at, i) => ({ id: `oh-schale-${i}`, at, kind: 'fire' as const, radius: 70, intensity: 0.6, always: true })),
    { id: 'oh-mond', at: [1120, 110], kind: 'moon', radius: 120, intensity: 0.55, always: true },
  ];
  if (opts.libraryLamp) lights.push({ id: 'oh-lampe', at: [208, 178], kind: 'candle', radius: 70, intensity: 1.1, always: true });
  if (opts.studyLit) lights.push({ id: 'oh-tuerspalt', at: [895, 236], kind: 'candle', radius: 38, intensity: 0.9, always: true });
  return lights;
}

/** The two paladins with lanterns who walk the house at night. */
export const NIGHT_GUARD = { corridor: 'wache-flur', stairs: 'wache-treppe' } as const;

/**
 * The corridor guard comes in through the east door, looks into the study alcove, walks on to the middle of the
 * corridor and looks west, and back (pingpong); the library end stays dark and quiet. The stairs guard turns at the stair top, then walks down into the lower passage and looks
 * along it. Short cones: the shadows stay safe, standing in the open does not.
 */
export const NIGHT_GUARDS: GuardDef[] = [
  {
    id: NIGHT_GUARD.corridor, preset: 'paladin', speaker: 'e3-paladin', lantern: true, mode: 'pingpong', range: 130, fov: 66, reaction: 1.4,
    suspiciousBarks: ['Hm? Ist da wer?', 'Wer schleicht da herum?'],
    calmBarks: ['Nur das Gemäuer. Es knackt.', 'Ratten. Sogar hier.'],
    path: [
      { at: [1166, 420], wait: 1200, face: 'left' },
      { at: OH_SPOT.alcoveFront, wait: 2600, face: 'up' },
      { at: [560, 420], wait: 3000, face: 'left' },
    ],
  },
  {
    id: NIGHT_GUARD.stairs, preset: 'paladin', speaker: 'e3-paladin', lantern: true, mode: 'pingpong', range: 120, fov: 66, reaction: 1.4,
    suspiciousBarks: ['Wer da? Zeig dich.', 'Da unten … Schritte?'],
    calmBarks: ['Nichts. Ich werde alt.', 'Wieder nur Schatten.'],
    path: [
      { at: [934, 526], wait: 2600, face: 'down' },
      { at: [934, 690], wait: 300 },
      { at: [600, 654], wait: 2600, face: 'left' },
    ],
  },
];

/** Common fields of every upper-floor map (day or night). */
export function ordenshausBase(night: boolean): Pick<MapDef, 'background' | 'walk' | 'block' | 'occluders' | 'surfaces' | 'surface' | 'spawns' | 'time' | 'ambience' | 'ambienceVolume' | 'lookMode' | 'critters' | 'playerLight'> {
  return {
    background: 'e3-ordenshaus',
    walk: OH_WALK,
    block: OH_BLOCKS,
    occluders: OH_OCCLUDERS,
    surfaces: OH_SURFACES,
    surface: 'stone',
    spawns: OH_SPAWNS,
    time: night ? 'night' : 'day',
    ambience: night ? ['night', 'room'] : ['room'],
    ambienceVolume: night ? { night: 0.3, room: 0.45 } : { room: 0.6 },
    lookMode: false,
    critters: false,
    playerLight: night ? 20 : undefined,
  };
}

interface WorldSceneLike { addWorld?: (o: Phaser.GameObjects.GameObject) => unknown }

/**
 * Lia's own staff among the weapons behind the armoury grate – only while it really is there
 * (staffPlace() === 'waffenkammer'). Drawn from its item icon, upright, with a faint pale shimmer (never turquoise:
 * nobody is using it). Removed when the map is left or the scene ends. Call from the map's onEnter.
 */
export function showStaffInArmoury(w: WorldCtx): void {
  if (staffPlace() !== 'waffenkammer') return;
  const scene = w.scene as Phaser.Scene & WorldSceneLike;
  let key: string;
  try { key = G.art.icon(scene, 'e3-lia-staff'); } catch { return; }
  const [x, y] = STAFF_ON_WALL;
  const staff = scene.add.image(x, y, key).setAngle(-45).setScale(2).setDepth(-900);
  const shimmer = scene.add.image(x, y, 'w-glow').setBlendMode(1).setTint(0xf4eedc).setAlpha(0.18).setScale(0.5, 1.1).setDepth(-899);
  scene.addWorld?.(staff);
  scene.addWorld?.(shimmer);
  scene.tweens.add({ targets: shimmer, alpha: 0.32, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const mapId = w.map.id;
  let gone = false;
  const dispose = () => {
    if (gone) return;
    gone = true;
    off();
    scene.tweens.killTweensOf(shimmer);
    staff.destroy();
    shimmer.destroy();
  };
  const off = w.on('map', '*', id => { if (id !== mapId) dispose(); });
  scene.events.once('shutdown', dispose);
}
