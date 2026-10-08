// e3-epilog: places on the meadow behind the farm (the painted k1-wiese of the very first scene, reused) and the texts
// of the epilogue (pure, tested in epilog.test.ts). The epilogue mirrors Teil I's opening on purpose (user request
// 2026-10-09): Lia reads under the old oak, Kyra comes out of the wood with firewood and sneaks up on her, they bicker
// with the same three kinds of answer – and then Flick joins them, proud in her new outfit as Lia's guard. Kyra tells
// Lia about Elnon here (umsetzung.md §3): Lia only learns now that he is dead and that Kyra's report was Vamir's lie.
// At the end the three walk off along the path to the east, as Kyra did in the summer, and under the oak Valentus and
// Ignatius appear and watch them go. Newly written; the film (F3 45:44–46:59) only gives the beats.
import { G } from '../../core/G';
import type { Polygon } from '../../world';

type Pt = [number, number];

/** Feet positions on k1-wiese (same geometry as kapitel-1/wiese.ts). */
export const WIESE_SPOT = {
  /** Lia's seat under the oak (the first scene's OAK_SEAT). */
  oakSeat: [500, 470] as Pt,
  /** Kyra comes out of the wood path in the north-west and drops her firewood there. */
  kyraIn: [276, 112] as Pt,
  kyraWood: [290, 190] as Pt,
  woodProp: [306, 196] as Pt,
  /** Her sneaking path round the oak and where she ends up next to Lia. */
  kyraSneak: [[360, 300], [430, 470]] as Pt[],
  kyraAtLia: [474, 476] as Pt,
  /** Where Lia jumps to when tickled, and where her book falls. */
  liaUp: [520, 478] as Pt,
  book: [540, 486] as Pt,
  /** Flick comes along the path from the east and stops in front of the two. */
  flickIn: [1210, 640] as Pt,
  flickStop: [580, 470] as Pt,
  /** The birch with the nest (empty now), the cornflowers and the apple trees. */
  nest: [449, 132] as Pt,
  /** Under the oak, in the foreground: where the two apparitions stand at the end. */
  valentus: [462, 500] as Pt,
  ignatius: [548, 504] as Pt,
  /** Where the three walk off to (the path out of the picture to the east). */
  away: [1270, 666] as Pt,
  /** Camera at the end: the oak and the two apparitions, the three small on the path behind. */
  endCamera: [640, 470] as Pt,
};

/** Leaving to the south: the east end of the path (the first scene's „heimgehen“ zone). */
export const LEAVE_ZONE: Polygon = [[1236, 600], [1280, 600], [1280, 712], [1236, 712]];
export const CORNFLOWERS: Polygon = [[880, 140], [960, 170], [1010, 192], [1004, 210], [950, 192], [874, 160]];
export const APPLES: Polygon = [[996, 366], [1070, 366], [1074, 386], [992, 386]];

/** Steps of the epilogue (flags reset when the scene starts). */
export const EP = {
  opening: 'e3-ep-anfang', book: 'e3-ep-buch', nest: 'e3-ep-nest', flowers: 'e3-ep-blumen', apples: 'e3-ep-aepfel', end: 'e3-ep-ende',
} as const;
export const resetEpilog = (): void => { for (const f of Object.values(EP)) G.state.set(f, false); };

// ---------------------------------------------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------------------------------------------

export type Who = 'lia' | 'lia-think' | 'kyra' | 'flick' | 'narrator';
export interface Line { who: Who; text: string; mood?: string }

/** Narration over the plate (mirrors „Sechzehn Sommer waren vergangen …“). */
export const OPENING_NARRATION: readonly string[] = [
  'Der Sommer war vorbei. Über der alten Eiche hinter dem Hof färbten sich die ersten Blätter gelb.',
  'Lia saß unter ihr und las, wie früher. Nur lag jetzt ein Stab neben ihr im Gras, und am Morgen war sie bei zwei Steinhügeln gewesen.',
];
export const OPENING: readonly Line[] = [
  { who: 'lia', text: '„… und Alana hob die Hand, und das Licht gehorchte ihr.“', mood: 'happy' },
  { who: 'lia-think', text: 'Manchmal gehorcht es. Manchmal nicht. Das hat Alana nie erwähnt.' },
  { who: 'lia-think', text: 'Früher hab ich mir gewünscht, hier würde endlich etwas passieren. Das nehme ich zurück. Alles davon.' },
];

/** Lia's sharper senses: she hears Kyra coming this time. */
export const SNEAK: readonly Line[] = [
  { who: 'lia-think', text: 'Schritte im Laub. Links hinter der Eiche. Kyra schleicht wie eine Kuh durchs Kornfeld.' },
  { who: 'lia', text: 'Ich hör dich, Kyra.', mood: 'smirk' },
  { who: 'kyra', text: 'Ach ja?', mood: 'happy' },
];

export const BANTER_OPEN: readonly Line[] = [
  { who: 'lia', text: 'Was sollte das denn?', mood: 'surprised' },
  { who: 'kyra', text: 'Wer faulenzt, hat es nicht anders verdient. Das gilt auch für Hüterinnen.', mood: 'happy' },
  { who: 'kyra', text: 'Ich schlepp Holz für heute Nacht, und du blätterst um. Manche Dinge ändern sich nie.', mood: 'smirk' },
];
/** The same three kinds of answer as in the summer. */
export const BANTER_CHOICES: readonly string[] = [
  '„Ich wollte gleich nachkommen. Ehrlich.“',
  '„Aber Alana war gerade an der besten Stelle!“',
  '„Holz sammeln kannst du eben besser. Jeder hat seine Talente.“',
];
export const BANTER_ANSWERS: readonly (readonly Line[])[] = [
  [
    { who: 'lia', text: 'Ich wollte gleich nachkommen. Ehrlich.', mood: 'sad' },
    { who: 'kyra', text: 'Das hast du im Sommer auch gesagt. Wort für Wort.', mood: 'smirk' },
    { who: 'lia', text: 'Und? Bin ich nachgekommen?', mood: 'thinking' },
    { who: 'kyra', text: 'Nie. Und weißt du was? Ich hab es vermisst.', mood: 'happy' },
  ],
  [
    { who: 'lia', text: 'Aber Alana war gerade an der besten Stelle!', mood: 'happy' },
    { who: 'kyra', text: 'Verschon mich mit deiner Alana. Die mistet keinen Stall aus.', mood: 'smirk' },
    { who: 'kyra', text: '… Na gut. Eine Stelle. Lies sie mir heute Abend vor. Am Feuer.', mood: 'happy' },
  ],
  [
    { who: 'lia', text: 'Holz sammeln kannst du eben besser. Jeder hat seine Talente.', mood: 'smirk' },
    { who: 'kyra', text: 'Und deins ist Rumsitzen? Pass auf, sonst kitzle ich dich gleich noch mal.', mood: 'angry' },
    { who: 'lia', text: 'Bloß nicht! Ich ergebe mich! Schon wieder!', mood: 'happy' },
  ],
];

/** Since the summer; the parents would be proud. */
export const SOMMER: readonly Line[] = [
  { who: 'kyra', text: 'Weißt du, was im Sommer mein größtes Problem war? Dass du unter dieser Eiche liest, während ich das Holz schleppe.', mood: 'happy' },
  { who: 'lia', text: 'Ein ernstes Problem. Du hast es sehr laut vorgetragen.', mood: 'smirk' },
  { who: 'kyra', text: 'Und jetzt hat dir ein Baum einen Stab geschenkt, und ein ganzer Orden nennt dich Hüterin.', mood: 'neutral' },
  { who: 'lia', text: 'Ich würde trotzdem lieber lesen. Nur damit das klar ist.', mood: 'happy' },
];
export const SOMMER_CHOICES: readonly string[] = [
  '„Was hätte Mutter wohl gesagt?“',
  '„Vater hätte die Fibel auf dem ganzen Markt herumgezeigt.“',
  '„Heute früh am Grab war mir, als hörten sie zu.“',
];
export const SOMMER_ANSWERS: readonly (readonly Line[])[] = [
  [
    { who: 'lia', text: 'Was hätte Mutter wohl dazu gesagt?', mood: 'sad' },
    { who: 'kyra', text: 'Erst geschimpft, weil wir so dünn sind. Und dann wäre sie so stolz gewesen, dass sie es keinem gezeigt hätte.', mood: 'sad' },
  ],
  [
    { who: 'lia', text: 'Vater hätte die Fibel auf dem ganzen Markt herumgezeigt. Jedem. Zweimal.', mood: 'happy' },
    { who: 'kyra', text: 'Und dazu erzählt, du hättest das Lesen von ihm. Was nicht stimmt. Stolz wäre er gewesen. Auf dich.', mood: 'happy' },
  ],
  [
    { who: 'lia', text: 'Heute früh an den Steinhügeln war mir, als hörten sie zu. Nur so lange, wie sie dürfen.', mood: 'sad' },
    { who: 'kyra', text: 'Dann hoffe ich, sie haben alles gehört. Sie wären stolz. Mehr als das.', mood: 'sad' },
  ],
];
export const SOMMER_END: readonly Line[] = [
  { who: 'lia', text: 'Auf uns beide.', mood: 'neutral' },
  { who: 'kyra', text: 'Mal sehen.', mood: 'sad' },
];

/** Flick comes along the path in her new outfit, very proud of it. */
export const FLICK_IN: readonly Line[] = [
  { who: 'kyra', text: 'Was glänzt denn da auf dem Weg? Ist das … Flick?', mood: 'surprised' },
  { who: 'flick', text: 'Umgebung gesichert. Ein Eichhörnchen, sehr verdächtig. Ich hab es verwarnt.', mood: 'smirk' },
  { who: 'flick', text: 'Na? Na? Sagt was. Ich stehe hier extra so, dass die Sonne auf die Fibel fällt.', mood: 'happy' },
];
export const FLICK_CHOICES: readonly string[] = [
  '„Du siehst aus wie eine richtige Paladinin.“',
  '„Hast du den Umhang geklaut?“',
  '„Dreh dich mal. Langsam.“',
];
export const FLICK_ANSWERS: readonly (readonly Line[])[] = [
  [
    { who: 'lia', text: 'Du siehst aus wie eine richtige Paladinin.', mood: 'happy' },
    { who: 'flick', text: 'Besser. Paladine müssen beten. Ich muss nur aufpassen. Und gut aussehen. Beides klappt.', mood: 'happy' },
  ],
  [
    { who: 'lia', text: 'Hast du den Umhang geklaut?', mood: 'smirk' },
    { who: 'flick', text: 'Geschenkt bekommen! Vom Großmeister persönlich. Er hat dabei nur ein bisschen gezuckt.', mood: 'angry' },
    { who: 'flick', text: 'Gut, die Stiefel hab ich mir selbst ausgesucht. Aus der Kammer. Mit Erlaubnis. Fast.', mood: 'smirk' },
  ],
  [
    { who: 'lia', text: 'Dreh dich mal. Langsam.', mood: 'happy' },
    { who: 'flick', text: 'So? Der Umhang weht von allein, wenn man richtig geht. Ich hab den ganzen Weg geübt.', mood: 'happy' },
    { who: 'kyra', text: 'Sie hat den ganzen Weg geübt, Lia. Den ganzen.', mood: 'smirk' },
  ],
];

/** Flick on her new job. */
export const SCHUTZ: readonly Line[] = [
  { who: 'flick', text: 'Der Großmeister hat mich zu deinem Schutz abgestellt. Offiziell. Mit Siegel. Ich hab es mir dreimal vorlesen lassen.', mood: 'smirk' },
  { who: 'flick', text: 'Wenn dir was passiert, lässt er mir das Fell gerben. Gesagt hat er das nicht. Aber geguckt.', mood: 'smirk' },
  { who: 'lia', text: 'Du passt also auf mich auf? Du?', mood: 'surprised' },
  { who: 'flick', text: 'Schutztruppe der Hüterin, eine Frau stark. Bezahlt in Äpfeln. Irgendwer muss es ja machen.', mood: 'happy' },
  { who: 'kyra', text: 'Und wer passt auf dich auf?', mood: 'neutral' },
  { who: 'flick', text: 'Ihr. Aber sagt es keinem.', mood: 'smirk' },
];

/** Kyra sits down: Elnon, the blade in her hand, the lie in the forest. */
export const ELNON: readonly Line[] = [
  { who: 'kyra', text: 'Lia. Bevor wir gehen. Ich muss dir etwas sagen. Wenn ich jetzt aufstehe, sage ich es nie.', mood: 'scared' },
  { who: 'kyra', text: 'Im Wald hab ich dir erzählt, ich hätte Elnon im Durcheinander verloren. Das war gelogen.', mood: 'ashamed' },
  { who: 'kyra', text: 'Es kommt zurück. Nicht alles. Aber die Klinge in meiner Hand. Und sein Gesicht, als er gemerkt hat, dass ich es bin.', mood: 'scared' },
  { who: 'kyra', text: 'Er ist tot. Ich hab ihn umgebracht. Und dann hab ich dir ins Gesicht gelogen, als wäre es nichts.', mood: 'sad' },
  { who: 'lia-think', text: 'Elnon. Der Elf, der mir nie über den Weg getraut hat. Und Kyra hat die ganze Zeit neben mir gelächelt.' },
];
/** Lia's thought in the hug answer: the push at the stone only happened if she tried to hug Kyra there (pick 2). */
const HUG_REFUSED = 'Ich sage nichts. Ich halte sie fest. Am Stein hat sie mich weggeschoben.';
const HUG_FIRST = 'Ich sage nichts. Ich halte sie fest. Am Stein wollte sie allein sein. Jetzt nicht mehr.';

export const ELNON_CHOICES: readonly string[] = [
  '„Das war nicht deine Hand. Er hat sie geführt.“',
  'Sie festhalten, ohne etwas zu sagen.',
  '„Die Lüge auch. Die gehört ihm, nicht dir.“',
];
export const ELNON_ANSWERS: readonly (readonly Line[])[] = [
  [
    { who: 'lia', text: 'Das war nicht deine Hand. Er hat sie geführt, so wie er deinen Mund geführt hat.', mood: 'determined' },
    { who: 'kyra', text: 'Es fühlt sich aber an wie meine.', mood: 'sad' },
    { who: 'lia', text: 'Ich weiß. Und trotzdem war es nicht dein Wille. Keinen Augenblick lang.', mood: 'sad' },
  ],
  [
    { who: 'lia-think', text: HUG_REFUSED },
    { who: 'kyra', text: 'Diesmal lass ich dich.', mood: 'sad' },
    { who: 'lia', text: 'Es war nicht dein Wille, Kyra. Das weiß ich. Ich hab dir in die Augen gesehen, damals.', mood: 'sad' },
  ],
  [
    { who: 'lia', text: 'Die Lüge auch. Die gehört ihm, nicht dir. Du hättest mir so etwas nie erzählt.', mood: 'determined' },
    { who: 'kyra', text: 'Woher willst du das wissen?', mood: 'sad' },
    { who: 'lia', text: 'Weil du die schlechteste Lügnerin auf dem ganzen Hof warst. Es war nicht dein Wille.', mood: 'sad' },
  ],
];
/** The answer to the Elnon talk, matched to what Lia did at the stone (flag e3-ra-kyra-antwort: 2 = the hug). */
export function elnonAnswer(pick: number, stonePick: number | undefined): readonly Line[] {
  const lines = ELNON_ANSWERS[pick];
  if (pick !== 1 || stonePick === 2) return lines;
  return lines.map(l => (l.text === HUG_REFUSED ? { ...l, text: HUG_FIRST } : l));
}

export const ELNON_END: readonly Line[] = [
  { who: 'flick', text: 'Er hat mich vor allen einen Mischling genannt. Ich hab ihm oft was an den Hals gewünscht. Das nicht.', mood: 'sad' },
  { who: 'lia', text: 'Und Foltan? Azar, Alastir? Die warten vielleicht noch auf ihn und wissen von nichts.', mood: 'sad' },
  { who: 'kyra', text: 'Dann sollen sie es von mir hören, nicht als Gerücht aus irgendeiner Schenke.', mood: 'determined' },
  { who: 'kyra', text: 'Baris hat in der Halle geflucht, die meisten seien nach Süden entwischt. Azar bestimmt. Der quatscht sich an jeder Wache vorbei.', mood: 'neutral' },
  { who: 'lia', text: 'Dann gehen wir nach Süden. Morgen früh.', mood: 'determined' },
  { who: 'flick', text: 'Und bis dahin? Holz, Feuer, Äpfel. Die Schutztruppe hat Hunger.', mood: 'smirk' },
];

/** Free time on the meadow: small mirrors of the summer. */
export const BOOK_PICKUP = 'Mein Buch. Diesmal hätte ich es fast wieder liegen lassen. Manche Dinge ändern sich wirklich nie.';
export const NEST_LINES: readonly Line[] = [
  { who: 'lia-think', text: 'Das Nest in der Birke. Im Sommer hab ich ein Küken zurückgesetzt, das herausgefallen war.' },
  { who: 'lia-think', text: 'Jetzt ist es leer. Ausgeflogen, alle drei. Irgendwohin, wo es warm ist.' },
];
export const FLOWER_LINE = 'Die letzten Kornblumen des Jahres. Für Mutters Stein, bevor wir gehen.';
export const APPLE_LINES: readonly Line[] = [
  { who: 'lia-think', text: 'Fallobst, schon ein bisschen runzlig. Die Schutztruppe wird nicht meckern.' },
  { who: 'flick', text: 'Sold! Endlich. Ich hab schon gedacht, ihr lasst mich verhungern.', mood: 'happy' },
];
export const LEAVE_EARLY = 'Mein Buch liegt noch unter der Eiche. Das lasse ich nicht im Gras.';

/** The end (narrator over the plate e3-epilog-geister). */
export const ENDING: readonly Line[] = [
  { who: 'narrator', text: 'Am nächsten Morgen gingen sie nach Süden, zu dritt, in einen Herbst hinein, der noch lange dauern sollte.' },
  { who: 'narrator', text: 'Vamir war fort. Wohin die zehn Dinge vom Hügel gekommen waren und wo der Doktor steckte, wusste niemand.' },
  { who: 'narrator', text: 'Unter der alten Eiche standen für einen Atemzug zwei, die keiner sah: ein alter Mann in Türkis und einer in warmem Bernstein.' },
  { who: 'narrator', text: 'Die ~Urmacht~ ruhte in ihrer Trägerin. Und zum ersten Mal seit dem Sommer fühlte sich das nicht wie eine Last an.' },
];

export const FINISHED_LINE = 'Das dritte Buch ist zu Ende erzählt. Lia, Kyra und Flick sind auf dem Weg nach Süden.';

/** Journal: what Kyra told her (the forest report is corrected, not deleted). */
export const ELNON_CLUE = 'e3-elnon-wahrheit';
