// e3-hueterin: places on the square of e3-trapas, the round before the ceremony, the ceremony's words and the end state
// (pure, tested in hueterin.test.ts). Newly written; the film (F3 44:47–45:28) only gives the beats: the Großmeister's
// eyes were opened, the order's task is now protecting people instead of spreading the faith, Lia is named Hüterin
// under the order's protection. Open threads stay open (the Doktor gone, the relics' whereabouts).
import { G } from '../../core/G';
import { STAFF } from '../common/bookContract';
import { grantOnce } from './shared';

type Pt = [number, number];
export type Who = 'lia' | 'lia-think' | 'gm' | 'heilerin' | 'paladin' | 'haendler' | 'kyra' | 'flick' | 'narrator';
export interface Line { who: Who; text: string; mood?: string }

/** Positions on the square (all on open ground of paladine-orte.TRAPAS_WALK, checked in the test). */
export const HUETERIN_SPOT = {
  /** Lia, Kyra and Flick come up the street from the gate. */
  start: [640, 530] as Pt,
  healer: [704, 390] as Pt,
  merchant: [396, 436] as Pt,
  paladinDoctor: [552, 214] as Pt,
  novice: [748, 214] as Pt,
  bannerWest: [600, 200] as Pt,
  bannerEast: [680, 200] as Pt,
  crowd: [[500, 236], [784, 240], [470, 304], [812, 318], [520, 420], [770, 430]] as Pt[],
  /** Ceremony: Lia at the foot of the stairs, the Großmeister a few steps up, the sisters' friends to the sides. */
  liaCeremony: [640, 228] as Pt,
  kyraCeremony: [604, 244] as Pt,
  flickCeremony: [678, 244] as Pt,
  gmPortal: [640, 130] as Pt,
  gmStairs: [640, 168] as Pt,
  /** In front of the portal (laying Schattentöter down in the order house). */
  portal: [640, 132] as Pt,
};

/** Standing here starts the ceremony (only after the healer). */
export const STAIRS_ZONE: [number, number][] = [[600, 206], [680, 206], [680, 252], [600, 252]];

export const HUETERIN_FLAGS = {
  healer: 'e3-hu-heilerin',
  merchant: 'e3-hu-haendler',
  doctor: 'e3-hu-doktor',
  ceremony: 'e3-hu-zeremonie',
  laidDown: 'e3-schattentoeter-niedergelegt',
  fibula: 'e3-fibel-erhalten',
  done: 'e3-hueterin',
  poisonFading: 'e3-gift-abklingend',
  task: 'e3-orden-auftrag',
} as const;

export const ARRIVAL_CARD = 'Zwei Tage später stand Lia wieder auf dem Platz vor dem Ordenshaus von Trapas. Diesmal ohne Strick um die Hände.';

export const OPENING: readonly Line[] = [
  { who: 'lia-think', text: 'Zwei Tage fast nur geschlafen. Meine Beine sind noch immer aus Wolle, aber sie tragen.' },
  { who: 'flick', text: 'Halb Trapas steht hier. Ich glaube, die wollen dich sehen, Leseratte.', mood: 'smirk' },
  { who: 'kyra', text: 'Die Heilerin am Brunnen hat nach dir gefragt. Geh erst zu ihr. Bitte.', mood: 'sad' },
];

export const HEALER: readonly Line[] = [
  { who: 'heilerin', text: 'Da bist du ja. Zeig mir deine Hände. Kalt. Und die Nägel ganz blass.' },
  { who: 'heilerin', text: 'Das ist kein Gift, das ich kenne. Ein Gegenmittel habe ich nicht, und ich fürchte, es gibt auch keins.' },
  { who: 'heilerin', text: 'Was hilft, ist Ruhe. Schlafen, essen, nicht zaubern, wenn es nicht sein muss. Es wird schwächer, Tag für Tag.' },
  { who: 'lia', text: 'Wie lange dauert das?', mood: 'worried' },
  { who: 'heilerin', text: 'Bis es weg ist. Ich bin Heilerin, keine Wahrsagerin.' },
];
export const HEALER_KYRA_CHOICES: readonly string[] = ['„Und meine Schwester?“', '„Danke. Ich versuche es mit der Ruhe.“'];
export const HEALER_KYRA: readonly Line[] = [
  { who: 'lia', text: 'Und meine Schwester? Sie schläft kaum. Sie redet fast nicht.', mood: 'worried' },
  { who: 'heilerin', text: 'Ihr fehlt nichts, was ich verbinden kann. Gib ihr Zeit. Und dräng sie nicht, auch wenn du es gut meinst.' },
];
export const HEALER_REST: readonly Line[] = [
  { who: 'lia', text: 'Danke. Ich versuche es mit der Ruhe. Ich bin nur nicht besonders gut darin.' },
  { who: 'heilerin', text: 'Das sagen alle, die es nötig haben.' },
];
export const HEALER_AGAIN = 'Ruhe, hab ich gesagt. Eine Zeremonie zählt nur halb.';

export const DOCTOR: readonly Line[] = [
  { who: 'lia', text: 'Wo ist der Doktor? Der mit den Kristallen und der schlechten Laune.' },
  { who: 'paladin', text: 'Fort. Sein Zimmer ist leer, die Instrumente auch. Er ist in der Nacht gegangen, als wir ausrückten.' },
  { who: 'paladin', text: 'Der Großmeister lässt nach ihm suchen. Bisher ohne Erfolg.' },
  { who: 'lia-think', text: 'In derselben Nacht. Das ist kein Zufall. Aber beweisen kann ich nichts.' },
];
export const DOCTOR_AGAIN = 'Wenn wir ihn finden, erfahrt Ihr es als Erste.';

export const MERCHANT: readonly Line[] = [
  { who: 'haendler', text: 'Verzeihung, junge Frau … Euer Gesicht. Ihr habt die Augen einer Familie, die oben am Markt ihren Laden hatte.' },
  { who: 'haendler', text: 'Eine von den Töchtern ist damals mit einem Bauern aufs Land gezogen. Halb Trapas hat sich das Maul zerrissen.' },
  { who: 'lia', text: 'Das war meine Mutter.', mood: 'surprised' },
  { who: 'haendler', text: 'Na, so was. Dann grüßt sie von mir. Sie wird sich nicht an mich erinnern, aber grüßt sie trotzdem.' },
  { who: 'lia', text: 'Das geht nicht mehr. Sie ist im Sommer gestorben.', mood: 'sad' },
  { who: 'haendler', text: 'Oh. Das … tut mir leid. Sie hat damals am Brunnen immer Geschichten vorgelesen. Den Kleinen. Mir auch.' },
  { who: 'lia-think', text: 'Mutter hat hier vorgelesen. Auf diesem Platz. Ich wusste das nicht.' },
];
export const MERCHANT_AGAIN = 'Am Brunnen. Genau da drüben. Lang her.';

export const LAY_DOWN: readonly Line[] = [
  { who: 'narrator', text: 'In der Kapelle des Ordenshauses legte Lia Schattentöter unter das blaue Fenster.' },
  { who: 'lia-think', text: 'Hier liegt er gut. Bis einer kommt, der ihn braucht. So wollte er es.' },
];

export const CROWD_BARKS: readonly string[] = [
  'Das ist sie. Die aus dem Saal.',
  'Hüterin? Was soll das sein?',
  'So jung. Und so blass.',
  'Der Großmeister selbst kommt raus.',
  'Mein Junge hat sie im Wald gesehen.',
];

/** The ceremony: the Großmeister on the stairs before the crowd (plate e3-hueterin). */
export const SPEECH: readonly Line[] = [
  { who: 'gm', text: 'Bürger von Trapas. Ihr kennt mich als einen, der selten zugibt, dass er sich geirrt hat. Heute tue ich es vor euch allen.', mood: 'grim' },
  { who: 'gm', text: 'Ich ließ dieses Mädchen festhalten. Ich wollte ihre Kraft für unseren Glauben und hätte ihr Leben dafür hergegeben. Ihres, nicht meins.', mood: 'ashamed' },
  { who: 'gm', text: 'Eine Elfe mit einem Bogen, ein Einsiedler aus dem Wald und zwei Schwestern haben mir gezeigt, wie klein das gedacht war.', mood: 'ashamed' },
  { who: 'gm', text: 'Von heute an trägt der Lichterorden sein Schwert nicht mehr vor dem Glauben her. Er stellt sich vor die Menschen. Vor jeden.', mood: 'determined' },
  { who: 'gm', text: 'Ob einer zu Aros betet oder zu niemandem: Wer Schutz braucht, bekommt ihn. Das ist unser Auftrag, nichts sonst.', mood: 'determined' },
  { who: 'gm', text: 'Ignatius von Ignis, einer der Zehn, ist im Wald gefallen, als er Vamir stellte. Er hätte über diese Rede gelacht. Und sie dann geprüft.', mood: 'grim' },
  { who: 'gm', text: 'Lia. Die Urmacht hat dich gewählt, nicht wir. Wir können nur eines: dich schützen, wohin du auch gehst.', mood: 'neutral' },
  { who: 'gm', text: 'Darum ernenne ich dich zur Hüterin der Urmacht. Der Orden steht hinter dir. Nicht über dir.', mood: 'determined' },
];

/** Lia's answer: three tones, none of them claims to rule anyone. */
export const ANSWER_CHOICES: readonly string[] = [
  '„Ich nehme es an. Aber Hüterin heißt nicht, dass ich jemandem gehöre.“',
  '„Ich weiß nicht, ob ich das kann. Aber ich versuche es.“',
  '„Wenn das heißt, dass Ihr niemanden mehr einsperrt: gern.“',
];
export type AnswerTone = 'fest' | 'ehrlich' | 'trocken';
export const ANSWER_TONES: readonly AnswerTone[] = ['fest', 'ehrlich', 'trocken'];
export const ANSWER: Record<AnswerTone, readonly Line[]> = {
  fest: [
    { who: 'lia', text: 'Ich nehme es an. Aber Hüterin heißt nicht, dass ich jemandem gehöre. Euch nicht und keinem anderen.', mood: 'determined' },
    { who: 'gm', text: 'So ist es gemeint. Ich habe gelernt, auf diesen Unterschied zu achten.', mood: 'neutral' },
  ],
  ehrlich: [
    { who: 'lia', text: 'Ich weiß nicht, ob ich das kann. Diesen Sommer hab ich noch Schweine gefüttert. Aber ich versuche es. Mit den beiden da.', mood: 'worried' },
    { who: 'gm', text: 'Dann sind wir schon zwei. Ich lerne mein Amt auch gerade noch einmal neu.', mood: 'neutral' },
  ],
  trocken: [
    { who: 'lia', text: 'Wenn das heißt, dass Ihr niemanden mehr für Euren Glauben einsperrt, nehme ich es gern.', mood: 'smirk' },
    { who: 'gm', text: 'Das heißt es. Und ich habe es verdient, dass du es vor allen sagst.', mood: 'ashamed' },
  ],
};

export const FIBULA: readonly Line[] = [
  { who: 'gm', text: 'Nimm das. Trag sie oder steck sie weg, sie gilt so oder so. Jeder Paladin im Land wird wissen, wer du bist.', mood: 'neutral' },
];

export const CLOSING: readonly Line[] = [
  { who: 'flick', text: 'Hüterin. Klingt nach einem sehr großen Schlüsselbund.', mood: 'smirk' },
  { who: 'kyra', text: 'Mutter hätte darauf bestanden, dass du dafür dein gutes Kleid anziehst. Und dann geweint.', mood: 'sad' },
  { who: 'lia-think', text: 'Ignatius hätte gefragt, ob ich den Stab auch richtig halte. Und dann nichts mehr gesagt. Das war bei ihm Lob.' },
];

// ---------------------------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------------------------

/** The order's fibula, exactly once (same once-flag as the direct-entry state in shared.ts). */
export function grantFibula(): boolean {
  return grantOnce(HUETERIN_FLAGS.fibula, () => G.state.give('e3-ordensfibel'));
}

/** Lia may lay Schattentöter down in the order house while she carries it (optional). */
export const canLayDown = (): boolean => G.state.has(STAFF.borrowed) && !G.state.is(HUETERIN_FLAGS.laidDown);

/** Lays Schattentöter down in the chapel (− e2-schattentoeter; once). */
export function layDownSchattentoeter(): boolean {
  if (!canLayDown()) return false;
  G.state.take(STAFF.borrowed, G.state.count(STAFF.borrowed));
  G.state.set(HUETERIN_FLAGS.laidDown);
  return true;
}

/** End of the scene (contract flags, umsetzung.md §2): Hüterin, fibula, the poison fading, the order's new task. */
export function endCeremony(tone: AnswerTone | undefined): void {
  if (tone) G.state.set('e3-hueterin-antwort', tone);
  grantFibula();
  G.state.set(HUETERIN_FLAGS.done);
  G.state.set(HUETERIN_FLAGS.poisonFading);
  G.state.set(HUETERIN_FLAGS.task, 'schutz');
}
