// „e3-innere-zuflucht“: Lia's inner refuge on the painted background `e3-innenwelt` (640×360, docs/teil-3/assets.md):
// a small summer meadow with an oak, an island in violet-grey cloud. Measured with a 20 px grid. Exported for the second
// visit (e3-hoffnung-und-weigerung), which defines its own map id on the same picture.
// Also the three memories from book one (where they glow, who appears, what is said) and the muffled voices from
// outside. Pure data and small rules (no engine imports); innere-zuflucht.test.ts checks geometry and texts.
import type { BlockDef, OccluderDef, Polygon } from '../../world';

type Spot = readonly [number, number];
type P = [number, number][];

/** The safely walkable meadow (inside the bushes along the rim; the fog all round is blocked). */
export const INNER_WALK: P[] = [[
  [72, 186], [110, 152], [150, 126], [200, 102], [250, 90], [300, 94], [330, 112], [356, 138], [410, 140], [450, 124],
  [470, 136], [470, 160], [540, 176], [552, 192], [530, 216], [480, 244], [420, 268], [360, 290], [300, 296], [240, 286],
  [180, 262], [120, 236], [84, 212],
]];

export const INNER_BLOCKS: BlockDef[] = [
  { id: 'eichenstamm', poly: [[362, 112], [402, 112], [405, 138], [358, 138]] },
];

/** The oak's crown and trunk are drawn over a figure standing behind (north of) the roots. */
export const INNER_OCCLUDERS: OccluderDef[] = [
  { id: 'eiche', baseline: 136, fade: 0.6, poly: [[268, 0], [502, 0], [502, 86], [406, 98], [405, 138], [358, 138], [354, 98], [268, 86]] },
];

export const INNER_SPOT = {
  /** Where Lia finds herself, in the middle of the meadow. */
  start: [282, 206],
  /** Under the oak, in front of the roots (she sits down here at the end). */
  oakSeat: [384, 152],
} as const satisfies Record<string, Spot>;

// ---------------------------------------------------------------------------------------------------------------
// Memories
// ---------------------------------------------------------------------------------------------------------------

export type MemoryId = 'buch' | 'holz' | 'mutter';
export const MEMORY_IDS: readonly MemoryId[] = ['buch', 'holz', 'mutter'];

export interface MemoryLine {
  /** 'lia' (now, in white), 'think', or a speaker id of the remembered person. */
  who: 'lia' | 'think' | 'e3-kyra' | 'mutter';
  text: string;
  mood?: string;
}

export interface MemoryDef {
  id: MemoryId;
  /** The bright place in the fog (hotspot centre) and where Lia stands to remember. */
  at: Spot;
  stand: Spot;
  verb: string;
  /** The fog patch over this part of the meadow (centre and size in map px); it lifts after the memory. */
  fog: { at: Spot; w: number; h: number };
  /** A pale remembered figure (character preset, pose, feet position, facing) and props beside it. */
  figure?: { preset: string; pose: string; at: Spot; facing: 'left' | 'right' | 'up' | 'down' };
  props: { prop: string; at: Spot }[];
  /** The painted memory (Lia's white spirit watches from the edge of the scene) and its caption. */
  plate: { id: string; caption: string };
  lines: MemoryLine[];
}

export const MEMORIES: Record<MemoryId, MemoryDef> = {
  buch: {
    id: 'buch', at: [334, 140], stand: [322, 160], verb: 'Sich erinnern',
    fog: { at: [360, 120], w: 300, h: 130 },
    props: [{ prop: 'alana-book', at: [348, 152] }],
    plate: { id: 'e3-erinnerung-buch', caption: 'Der letzte Sommer' },
    lines: [
      { who: 'think', text: 'Die Eiche hinter dem Hof. Und darunter, aufgeschlagen, *Die Geschichten der Magierin Alana*.' },
      { who: 'think', text: 'Das dritte Mal gelesen, diesen Sommer. Die Ecken weich vom Umblättern, auf Seite vierzig ein Fleck vom Honigkuchen.' },
      { who: 'lia', text: 'Alana, Riccard und Balduin. Und Imandur mit seiner Akademie. Ich könnte jede Seite aufsagen.' },
      { who: 'think', text: 'Hier war die Welt so groß wie ein Buch. Das hat gereicht.' },
    ],
  },
  holz: {
    id: 'holz', at: [138, 200], stand: [160, 206], verb: 'Sich erinnern',
    fog: { at: [130, 200], w: 210, h: 170 },
    figure: { preset: 'kyra', pose: 'idle', at: [130, 204], facing: 'right' },
    props: [{ prop: 'twigs', at: [116, 214] }],
    plate: { id: 'e3-erinnerung-holz', caption: 'Feuerholz' },
    lines: [
      { who: 'e3-kyra', text: 'Lia! Wenn du schon liest, dann wenigstens im Gehen. Und mit Holz unterm Arm.', mood: 'happy' },
      { who: 'lia', text: 'Sie hat immer das Doppelte getragen. Und so getan, als wär es nichts.' },
      { who: 'think', text: 'Abends hat sie mir die Hälfte von ihrem Stapel unter den Arm geschoben, damit Vater mich lobt. Er hat es jedes Mal gemerkt.' },
      { who: 'lia', text: 'Kyra. Wo bist du gerade? Ich meine: du. Nicht das, was aus deinen Augen schaut.', mood: 'sad' },
    ],
  },
  mutter: {
    id: 'mutter', at: [444, 236], stand: [420, 240], verb: 'Sich erinnern',
    fog: { at: [452, 230], w: 230, h: 150 },
    figure: { preset: 'mother', pose: 'kneel', at: [452, 238], facing: 'left' },
    props: [{ prop: 'alana-book', at: [438, 246] }],
    plate: { id: 'e3-erinnerung-mutter', caption: 'A wie Apfel' },
    lines: [
      { who: 'mutter', text: 'Fahr mit dem Finger mit, Lia. Das hier ist ein A. Wie in Apfel. Und wie in Alana.' },
      { who: 'lia', text: 'Ein Apfel für jede Seite, die ich allein geschafft hab. Im ersten Winter hatten wir keine Äpfel mehr.' },
      { who: 'think', text: 'Sie hat es mir beigebracht, weil sie selbst aus der Stadt kam, wo man liest. Aus Trapas. Ich war gerade dort, Mutter.' },
      { who: 'mutter', text: 'So. Und jetzt liest du mir vor, und ich schäle die Kartoffeln. Abgemacht?', mood: 'happy' },
    ],
  },
};

/** The next memory still in the fog (for the objective text), or null when all three are remembered. */
export function openMemories(done: ReadonlySet<MemoryId>): MemoryId[] {
  return MEMORY_IDS.filter(id => !done.has(id));
}

/** Objective text by how many memories are found. */
export function memoryObjective(found: number): string {
  if (found <= 0) return 'Etwas Helles leuchtet im Nebel. Geh hin.';
  if (found === 1) return 'Noch zwei helle Stellen im Nebel.';
  if (found === 2) return 'Noch eine helle Stelle im Nebel.';
  return 'Die Wiese ist ganz. Setz dich unter die Eiche.';
}

// ---------------------------------------------------------------------------------------------------------------
// Voices from outside (Vamir's men at the cage). Lia hears them through the fog, without a picture.
// ---------------------------------------------------------------------------------------------------------------

export interface OutsideLine { who: string; text: string }

/** After the first and after the second memory. Short, muffled, nobody named. */
export const OUTSIDE_VOICES: readonly (readonly OutsideLine[])[] = [
  [
    { who: 'Eine Männerstimme', text: 'Die liegt da wie ein Sack. Atmet die überhaupt noch?' },
    { who: 'Eine zweite', text: 'Finger weg vom Gitter. Der Meister will sie heil.' },
  ],
  [
    { who: 'Eine Männerstimme', text: 'Ich hab sie angestoßen. Mit dem Speer. Nichts. Nicht mal gezuckt.' },
    { who: 'Eine zweite', text: 'Dann lass es. Wenn sie aufwacht und wütend ist, will ich nicht danebenstehen.' },
  ],
];

/** Lia's thought after each burst of voices (she understands they are outside, and that she is not there). */
export const AFTER_VOICES: readonly string[] = [
  'Stimmen. Von irgendwo da draußen, dumpf, wie durch eine Bettdecke. Die reden von mir.',
  'Ich spüre es nicht. Kein Speer, kein Gitter, keine Fesseln. Hier drin kommt nichts an.',
];

/** Lines when she sits down under the oak at the end. */
export const UNDER_THE_OAK: readonly MemoryLine[] = [
  { who: 'think', text: 'Hier tut nichts weh. Nicht die Arme, nicht der Kopf. Das Gift, die Stricke: weit weg.' },
  { who: 'think', text: 'Ich könnte einfach hier sitzen bleiben. Ein Sommer, der nicht aufhört.' },
  { who: 'lia', text: 'Nur hab ich noch nie ein Buch mitten auf der Seite liegen lassen. Nicht mal die langweiligen.', mood: 'thinking' },
];

/** Lines of the framed cut in the false camp at dusk (player knowledge only; Lia never learns of them). */
export interface CampLine { who: string; text: string; mood?: string }
export const CAMP_CUT: { speech: CampLine[]; rescue: CampLine[]; stone: CampLine[]; parting: CampLine[] } = {
  speech: [
    { who: 'e2-vamir', text: 'Räte, Orden, ein alter Narr mit Stab: Alle haben sie vor mir versteckt. Heute liegt sie unter einer Plane.' },
    { who: 'e2-vamir', text: 'Bald fragt in Selantis niemand mehr, wem das Land gehört. Es wird keinen mehr geben, der es anders sagt.' },
    { who: 'e2-vamir', text: 'Kyra. Du warst gehorsam und geduldig. Beides gefällt mir.' },
    { who: 'e2-kyra-gebannt', text: 'Ich tue, was Ihr sagt.', mood: 'devoted' },
  ],
  /** Flick breaks out of the bushes and runs for the wagon. */
  rescue: [
    { who: 'e2-flick', text: 'Leseratte! Halt durch, ich mach den Käfig auf!', mood: 'determined' },
    { who: 'e2-baris', text: 'Das Spitzohr! Packt sie!' },
    { who: 'e2-vamir', text: 'Nicht nötig.' },
  ],
  /** After the spell: Flick stands as stone, mid-run, knife out. */
  stone: [
    { who: 'e2-baris', text: 'Erst läufst du uns davon, dann schleichst du uns einen halben Tag hinterher. Und jetzt stehst du da wie ein Grabstein.' },
    { who: 'e2-baris', text: 'Meister. Ein Hieb mit dem Axtrücken, und sie liegt in Scherben.' },
    { who: 'e2-vamir', text: 'Wozu? Stein hört zu. Sie soll hören, wie der Wagen fährt, und nichts tun können.' },
    { who: 'e2-vamir', text: 'Der Zauber hält bis in die Nacht. Wenn er bricht, gehört sie dem Wald. Die Wölfe hier sind dieses Jahr früh hungrig.' },
    { who: 'e2-baris', text: 'Wie Ihr wollt.' },
  ],
  parting: [
    { who: 'e2-baris', text: 'Und falls du auf die Paladine in Trapas hoffst: Die suchen noch ihr Gästezimmer ab.' },
    { who: 'e2-baris', text: 'Du warst doch immer am liebsten allein, oder? Heute Nacht hast du es ganz für dich.' },
    { who: 'e2-vamir', text: 'Spannt an. Sobald es dunkel ist, fahren wir.' },
  ],
};

