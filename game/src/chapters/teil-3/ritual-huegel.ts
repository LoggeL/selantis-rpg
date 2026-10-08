// „e3-ritual“ and the beat after „e3-ritualangriff“: the bare hilltop on the painted background `e3-ritualhuegel`
// (1280×720, docs/teil-3/assets.md), measured on a 20 px grid. A long flat stone in the middle, ten wooden stands in a
// ring around it, four torch holders, forest left, bottom and right, the path climbing from the lower left. The
// distant view at the top is blocked.
// Also Flick's approach below the hill (three posts to spot, three ways up) and the small rules of both scenes.
// Pure data and small rules (no engine imports); ritual.test.ts checks the geometry and the rules.
import type { BlockDef, OccluderDef } from '../../world';
import type { RitualWeg } from './ritualangriff-battle';

type Spot = readonly [number, number];
type P = [number, number][];

// ---------------------------------------------------------------------------------------------------------------
// The painted objects
// ---------------------------------------------------------------------------------------------------------------

/** The ten stands: centre x, top of the cap and the foot (where the post meets the ground). */
export interface Stand { x: number; top: number; base: number }
export const STANDS: readonly Stand[] = [
  { x: 512, top: 188, base: 226 }, { x: 653, top: 182, base: 219 }, { x: 795, top: 197, base: 235 },
  { x: 395, top: 247, base: 291 }, { x: 382, top: 311, base: 352 }, { x: 906, top: 250, base: 295 },
  { x: 916, top: 312, base: 352 }, { x: 486, top: 374, base: 417 }, { x: 646, top: 384, base: 430 },
  { x: 807, top: 377, base: 417 },
];

/** The flat stone in the middle (outline of the whole rock, top and front face). */
export const STONE_POLY: P = [[546, 278], [750, 278], [754, 330], [544, 330]];
/** Where Lia lies on the stone (feet point of the lying figure). */
export const STONE_LIE: Spot = [648, 306];
/** Above the stone: where the turquoise sphere forms. */
export const SPHERE: Spot = [648, 252];

/** The four torch holders: the basket (light) and the foot. */
export const TORCHES: readonly { light: Spot; base: Spot }[] = [
  { light: [362, 136], base: [362, 180] }, { light: [1030, 192], base: [1030, 240] },
  { light: [202, 380], base: [202, 432] }, { light: [1055, 462], base: [1055, 515] },
];

const standFoot = (s: Stand): P => [[s.x - 9, s.base - 7], [s.x + 9, s.base - 7], [s.x + 9, s.base + 2], [s.x - 9, s.base + 2]];

/** Stands and torch feet (the stone is added by the maps that let people walk round it). */
export const HILL_BLOCKS: BlockDef[] = [
  ...STANDS.map((s, i) => ({ id: `staender-${i + 1}`, poly: standFoot(s) })),
  ...TORCHES.slice(0, 2).map((t, i) => ({ id: `fackel-${i + 1}`, poly: [[t.base[0] - 10, t.base[1] - 8], [t.base[0] + 10, t.base[1] - 8], [t.base[0] + 10, t.base[1] + 2], [t.base[0] - 10, t.base[1] + 2]] as P })),
];

export const STONE_BLOCK: BlockDef = { id: 'stein', sight: false, poly: [[546, 284], [750, 284], [754, 330], [544, 330]] };

/** Each stand is drawn over a figure standing behind it. */
export const HILL_OCCLUDERS: OccluderDef[] = STANDS.map((s, i) => ({
  id: `staender-${i + 1}`, baseline: s.base, poly: [[s.x - 15, s.top - 6], [s.x + 15, s.top - 6], [s.x + 15, s.base + 2], [s.x - 15, s.base + 2]],
}));

// ---------------------------------------------------------------------------------------------------------------
// Walkable ground
// ---------------------------------------------------------------------------------------------------------------

/** The hilltop: dirt and low grass inside the forest edge, from the upper-left rocks to the bushes on the right. */
export const HILL_TOP: P = [
  [240, 206], [300, 176], [420, 156], [560, 152], [700, 160], [840, 168], [960, 192], [1060, 240], [1120, 266],
  [1162, 302], [1162, 388], [1124, 438], [1080, 466], [1020, 486], [900, 492], [760, 484], [620, 478], [480, 470],
  [400, 462], [300, 456], [244, 440], [228, 384], [202, 322], [202, 252],
];

/**
 * Flick's ground below the hill: the sunken path from the bottom-left and the grass beside it, up to where the bushes
 * end (higher up the path lies open under the guards' eyes).
 */
export const ANSTIEG_WALK: P = [
  [0, 636], [40, 604], [96, 584], [138, 552], [176, 524], [208, 506], [250, 500], [330, 500], [342, 512], [326, 530],
  [290, 568], [252, 606], [226, 650], [214, 720], [0, 720],
];

export const HILL_SPOT = {
  /** Flick arrives at the bottom-left edge with the paladins behind her. */
  forestEdge: [96, 676],
  /** Where Ignatius and the two paladins wait below (feet points; on the path behind Flick). */
  ignatius: [52, 694],
  paladin1: [130, 704],
  paladin2: [20, 668],
  /** Behind the stone (Vamir), beside the stone (Baris, Kyra). */
  vamir: [648, 268],
  baris: [574, 352],
  kyra: [728, 350],
  /** After the fight: Kyra on her knees, Flick, the two paladins, where Lia starts. */
  kyraAfter: [724, 360],
  flickAfter: [600, 372],
  paladinAfter1: [452, 448],
  paladinAfter2: [520, 452],
  liaAfter: [646, 352],
  /** The relic stand Lia can look at after the fight (front-middle) and where she stands for it. */
  relicStand: [646, 430],
  relicStandAt: [646, 446],
  /** Where Vamir vanished (violet ash) and the start of Ignatius' track east. */
  ash: [660, 262],
  trackStart: [960, 300],
  /** East edge into the forest, where the track leads. */
  eastEdge: [1150, 340],
} as const satisfies Record<string, Spot>;

/** Exit strip at the east edge of the hilltop (into the forest after Ignatius). */
export const EAST_EXIT: P = [[1136, 300], [1162, 300], [1162, 384], [1136, 384]];

// ---------------------------------------------------------------------------------------------------------------
// Flick's approach: three posts and three ways up
// ---------------------------------------------------------------------------------------------------------------

export type PostId = 'fackel' | 'kreis' | 'hang';
export const POST_IDS: readonly PostId[] = ['fackel', 'kreis', 'hang'];

export interface PostDef {
  id: PostId;
  /** Where the guard stands on the hill (feet point; outside Flick's ground). */
  at: Spot;
  preset: string;
  dir: 'left' | 'right' | 'up' | 'down';
  /** Flick's line when she points him out, and the paladin's quiet answer. */
  flick: string;
  answer: string;
}

export const POSTS: Record<PostId, PostDef> = {
  fackel: {
    id: 'fackel', at: [226, 424], preset: 'shadow-sword', dir: 'down',
    flick: 'Einer am Feuerkorb links. Sitzt auf den Steinen und tut, als würde er wachen.',
    answer: 'Gesehen. Der kommt nicht dazu, aufzustehen.',
  },
  kreis: {
    id: 'kreis', at: [432, 384], preset: 'shadow-crossbow', dir: 'left',
    flick: 'Armbrust zwischen den Ständern. Der sieht von da oben den ganzen Hang.',
    answer: 'Dann gehen wir nicht dort hinauf, wo er hinschaut.',
  },
  hang: {
    id: 'hang', at: [548, 452], preset: 'shadow-spear', dir: 'down',
    flick: 'Speer, rechts am Hang über den Büschen. Der passt auf den Weg auf.',
    answer: 'Einer mit Speer. Den übernehme ich.',
  },
};

/** How far Flick can make out a guard in the dusk with the Spurenblick (map px). */
export const SPOT_RANGE = 260;

/** A post is made out while Flick holds the Spurenblick and stands close enough. */
export function canSpot(flick: Spot, post: Spot, lookActive: boolean, range = SPOT_RANGE): boolean {
  return lookActive && Math.hypot(post[0] - flick[0], post[1] - flick[1]) <= range;
}

/** Objective text by the number of posts shown to the others. */
export function postObjective(shown: number): string {
  if (shown <= 0) return 'Späh die Wachen auf dem Hügel aus und zeig sie den anderen.';
  if (shown >= POST_IDS.length) return 'Alle drei Wachen gezeigt. Such einen Weg hinauf.';
  return `Wachen gezeigt: ${shown} von ${POST_IDS.length}.`;
}

export interface AscentDef {
  weg: RitualWeg;
  /** Where Flick stands to choose this way, and its verb. */
  at: Spot;
  verb: string;
  /** Ignatius' quick judgement and Flick's decision line. */
  judgement: string;
  decision: string;
}

/** The three ways up (e3-ritual-weg; ritualangriff-battle START positions differ by this choice). */
export const ASCENTS: readonly AscentDef[] = [
  {
    weg: 'hohlweg', at: [200, 540], verb: 'Durch den Hohlweg',
    judgement: 'Der Hohlweg. Eng und dunkel, die Böschung deckt euch bis fast hinauf. Oben steht ihr aber dicht gedrängt.',
    decision: 'Hohlweg. Wenn sie uns sehen, sind wir schon da.',
  },
  {
    weg: 'felsen', at: [140, 572], verb: 'Über die Felsen',
    judgement: 'Über die Felsen links. Von oben hast du freies Schussfeld. Die Paladine in Eisen müssen unten herum.',
    decision: 'Felsen. Ich will sehen, worauf ich schieße.',
  },
  {
    weg: 'offen', at: [318, 510], verb: 'Offen den Hang hinauf',
    judgement: 'Gerade hinauf, offen über das Gras. Der weiteste Weg, aber die Schilde gehen vorn und fangen die Bolzen.',
    decision: 'Offen. Die Schilde vorn, ich dahinter. Sollen sie ruhig gucken.',
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Ritual lines (own words; F3 38:29–40:41 gives the beats only)
// ---------------------------------------------------------------------------------------------------------------

export interface RitualLine { who: string; text: string; mood?: string }

/** Lia's three answers to Baris on the stone; each with his reaction. */
export const BARIS_RETORTS: readonly { text: string; lia: string; mood: string; baris: string }[] = [
  {
    text: '„Letztes Mal bist du geflogen.“', lia: 'Letztes Mal bist du ins Kornfeld geflogen. Ich weiß nicht mehr, wie ich das gemacht hab. Aber ich hab es gemacht.', mood: 'angry',
    baris: 'Heute bist du festgebunden. Und dein Licht gehört gleich einem anderen.',
  },
  {
    text: '„Ich hab keine Angst vor dir.“', lia: 'Ich hab keine Angst vor dir.', mood: 'determined',
    baris: 'Musst du auch nicht. Vor mir nicht. Vor dem, was gleich kommt, schon.',
  },
  { text: 'Schweigen und an ihm vorbeisehen', lia: '', mood: '', baris: 'Stumm wie ein Fisch. Das hab ich lieber so.' },
];

export const ON_THE_STONE: { wake: RitualLine[]; baris: RitualLine[]; kyra: RitualLine[]; speech: RitualLine[]; ritual: RitualLine[] } = {
  wake: [
    { who: 'think', text: 'Stein unter dem Rücken. Kalt, auch durch den Mantel. Und Stricke, die sich bei jedem Atemzug melden.' },
    { who: 'think', text: 'Dämmerung. Ein Kreis aus Holzständern um mich herum, und auf jedem liegt etwas unter einem Tuch.' },
  ],
  baris: [
    { who: 'e2-baris', text: 'Na, aufgewacht? Gut. Der Meister will, dass du dabei bist, wenn es passiert.', mood: 'smirk' },
    { who: 'e2-baris', text: 'Alles ist bereit. Zehn Ständer, ein Stein, eine Zauberin. Fehlt nur noch, dass du leer wirst.' },
  ],
  kyra: [
    { who: 'lia', text: 'Kyra! Kyra, ich bin’s. Sieh mich an. Bitte.', mood: 'scared' },
    { who: 'think', text: 'Sie steht da und schaut auf einen Punkt über meinem Kopf. Als wäre da etwas Interessanteres als ich.' },
    { who: 'e2-vamir', text: 'Ruf, so laut du willst. Bei ihr kommt nur noch eine Stimme an, und das ist meine.' },
    { who: 'lia', text: 'Das ist meine Schwester. Nicht dein Hund.', mood: 'angry' },
    { who: 'e2-baris', text: 'Halt den Mund, oder ich stopf ihn dir.', mood: 'angry' },
  ],
  speech: [
    { who: 'e2-vamir', text: 'Männer. Wie lange haben wir in Höhlen geschlafen und in Ruinen gegessen? Das ist heute zu Ende.' },
    { who: 'e2-vamir', text: 'Die letzten Städte, die sich noch frei nennen, werden morgen vor uns knien. Freiwillig oder nicht.' },
    { who: 'e2-vamir', text: 'Wer sich uns in den Weg stellt, der stellt sich nur einmal hin. Und dann gehört uns, was er hatte.' },
    { who: 'e2-vamir', text: 'Ab heute zählt man die Jahre neu. Von dieser Nacht an.' },
  ],
  ritual: [
    { who: 'e2-vamir', text: 'Nehmt die Tücher ab. Alle zehn. Und richtet sie auf sie.' },
    { who: 'think', text: 'Ein Horn. Eine Schale. Ein Reif. Dinge, die älter aussehen als jedes Buch, das ich je in der Hand hatte.' },
    { who: 'think', text: 'Und alle zeigen auf mich.' },
    { who: 'lia', text: 'Was … was macht ihr? Es zieht. Mitten aus der Brust, wie ein Faden.', mood: 'scared' },
    { who: 'e2-vamir', text: 'Wehr dich ruhig. Es hilft dir nicht, aber es sieht hübsch aus.' },
  ],
};

/** Flick's approach: arrival, after the posts, the first arrow. */
export const APPROACH: { arrive: RitualLine[]; allShown: RitualLine[]; arrow: RitualLine[] } = {
  arrive: [
    { who: 'e2-flick', text: 'Da oben. Auf dem Stein. Das ist sie.', mood: 'determined' },
    { who: 'e2-ignatius', text: 'Und das Licht über ihr … sie haben angefangen. Viel Zeit bleibt uns nicht.', mood: 'worried' },
    { who: 'e3-paladin', text: 'Wie viele sind es? Von hier unten sehe ich nur Fackeln.' },
    { who: 'e2-flick', text: 'Ich seh nach. Ihr bleibt im Wald, in Eisen hört man euch bis nach Trapas.', mood: 'smirk' },
  ],
  allShown: [
    { who: 'e2-ignatius', text: 'Drei Wachen außen, dazu Baris, seine Leute am Stein und Kyra. Und er selbst.', mood: 'grim' },
    { who: 'e3-paladin', text: 'Wir sind nur die Vorhut, zu viert. Der Rest ist eine Stunde hinter uns. Also alle zugleich, von einer Seite.' },
    { who: 'e2-flick', text: 'Dann sucht euch keinen schönen Weg aus. Sucht einen kurzen.', mood: 'determined' },
  ],
  arrow: [
    { who: 'e2-baris', text: 'Pfeil! Woher kam der?', mood: 'angry' },
    { who: 'e2-flick', text: 'Von hier unten, Baris. Ich hab noch mehr davon.', mood: 'smirk' },
    { who: 'e2-baris', text: 'Das Spitzohr. Natürlich. Alle Mann zu mir!', mood: 'angry' },
  ],
};
