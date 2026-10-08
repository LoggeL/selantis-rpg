// e3-epilog: the field track e3-feldweg (geometry, measured on the 1280×720 image with a 20 px grid) and the talks on
// the way (pure, tested in epilog.test.ts). Newly written; the film (F3 45:44–46:59) only gives the beats: Kyra on how
// much has changed and that the parents would be proud, Flick as the sisters' guard on the Großmeister's orders, all
// three walk on, Valentus' apparition in the foreground. Kyra tells Lia about Elnon here (umsetzung.md §3): Lia only
// learns now that he is dead and that Kyra's report in the forest was Vamir's lie.
import { G } from '../../core/G';
import type { OccluderDef, Polygon, SurfaceDef } from '../../world';

type Pt = [number, number];

/** Track centre line from the bottom-left corner to the top-right (bottom → top). */
export const TRACK: readonly Pt[] = [[120, 720], [270, 600], [415, 520], [570, 440], [650, 400], [805, 320], [925, 240], [1035, 160], [1165, 80], [1192, 56]];

/**
 * The track with the grass strips between the fences (≈ 50 px left, 40 px right of the centre line), widened round
 * the lone tree so Lia can step under it. Everything else (stubble behind the fences, the hills) is blocked.
 */
export const FELDWEG_WALK: Polygon[] = [[
  // left edge, bottom → top
  [40, 720], [70, 690], [200, 600], [340, 520], [470, 452], [540, 410], [585, 372], [610, 336], [640, 322], [690, 326],
  [720, 340], [760, 300], [860, 236], [980, 152], [1100, 82], [1170, 40], [1196, 30],
  // right edge, top → bottom
  [1222, 48], [1206, 76], [1180, 104], [1066, 186], [956, 268], [842, 352], [706, 434], [604, 482], [450, 562],
  [316, 640], [210, 720],
]];

/** The lone tree's trunk and roots (Lia stands below it). */
export const TREE_BLOCK: Polygon = [[630, 336], [646, 318], [670, 318], [690, 336], [676, 352], [640, 352]];

export const FELDWEG_OCCLUDERS: OccluderDef[] = [
  // The lone tree's crown and trunk over whoever stands behind it.
  { id: 'baum', baseline: 352, fade: 0.55, poly: [[556, 230], [580, 168], [640, 148], [710, 158], [752, 210], [744, 276], [700, 300], [690, 336], [676, 352], [640, 352], [630, 336], [600, 298], [560, 280]] },
];

export const FELDWEG_SURFACES: SurfaceDef[] = [
  {
    id: 'weg', kind: 'dirt',
    poly: [[100, 720], [250, 600], [400, 512], [560, 432], [790, 312], [915, 232], [1025, 154], [1160, 72], [1192, 50], [1208, 60], [1176, 88],
      [1045, 168], [935, 248], [820, 328], [585, 450], [430, 528], [290, 610], [150, 720]],
  },
];

export const FELDWEG_SPOT = {
  start: [120, 690] as Pt,
  /** Under the lone tree (the promise about the graves). */
  tree: [660, 368] as Pt,
  /** Where Valentus' apparition stands in the foreground at the end (on the track behind the three). */
  valentus: [690, 404] as Pt,
  /** Where the three walk to at the end (out of the picture towards the horizon). */
  away: [1188, 60] as Pt,
  /** Camera at the end: the apparition low in the frame, the three walking away up the track. */
  endCamera: [900, 280] as Pt,
};

/** Talks along the track: each fires in its zone, in this order (zones cross the whole walkable width). */
export interface TalkZone { id: TalkId; poly: Polygon }
export type TalkId = 'sommer' | 'elnon' | 'schutz';
export const TALK_ORDER: readonly TalkId[] = ['sommer', 'elnon', 'schutz'];
export const TALK_ZONES: readonly TalkZone[] = [
  { id: 'sommer', poly: [[220, 540], [300, 540], [380, 640], [300, 660]] },
  { id: 'elnon', poly: [[470, 420], [540, 380], [620, 470], [560, 500]] },
  { id: 'schutz', poly: [[780, 260], [840, 220], [920, 300], [860, 340]] },
];
/** The end of the walk: the three go on, the apparition appears. */
export const END_ZONE: Polygon = [[920, 180], [990, 130], [1060, 200], [990, 250]];

export const talkFlag = (id: TalkId): string => `e3-ep-${id}`;
export const talksDone = (): boolean => TALK_ORDER.every(id => G.state.is(talkFlag(id)));
/** The next talk that has not happened yet (talks never skip one another). */
export const nextTalk = (): TalkId | undefined => TALK_ORDER.find(id => !G.state.is(talkFlag(id)));

// ---------------------------------------------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------------------------------------------

export type Who = 'lia' | 'lia-think' | 'kyra' | 'flick' | 'narrator';
export interface Line { who: Who; text: string; mood?: string }

export const OPENING: readonly Line[] = [
  { who: 'lia-think', text: 'Morgens ist das Land weit. Nebel über den Hügeln, Stoppeln, ein Weg, der nirgends aufhört.' },
  { who: 'lia-think', text: 'Meine Beine tragen wieder. Nicht gut, aber freiwillig.' },
];

/** Since the summer; the parents would be proud. */
export const SOMMER: readonly Line[] = [
  { who: 'kyra', text: 'Weißt du, was im Sommer mein größtes Problem war? Dass du unter der Eiche liest, während ich das Holz schleppe.', mood: 'happy' },
  { who: 'lia', text: 'Ein ernstes Problem. Du hast es sehr laut vorgetragen.', mood: 'smirk' },
  { who: 'kyra', text: 'Und jetzt hat dir ein Baum einen Stab geschenkt, und ein ganzer Orden nennt dich Hüterin.', mood: 'neutral' },
  { who: 'lia', text: 'Ich würde trotzdem lieber lesen. Nur damit das klar ist.', mood: 'happy' },
];
export const SOMMER_CHOICES: readonly string[] = [
  '„Was hätte Mutter wohl gesagt?“',
  '„Vater hätte die Fibel auf dem ganzen Markt herumgezeigt.“',
  '„Manchmal denke ich, sie gehen ein Stück neben uns her.“',
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
    { who: 'lia', text: 'Manchmal denke ich, sie gehen ein Stück neben uns her. Nur so weit, wie sie dürfen.', mood: 'sad' },
    { who: 'kyra', text: 'Dann hoffe ich, sie sehen, was du getan hast. Sie wären stolz. Mehr als das.', mood: 'sad' },
  ],
];
export const SOMMER_END: readonly Line[] = [
  { who: 'lia', text: 'Auf uns beide.', mood: 'neutral' },
  { who: 'kyra', text: 'Mal sehen.', mood: 'sad' },
];

/** Kyra stops: Elnon, the blade in her hand, the lie in the forest. */
export const ELNON: readonly Line[] = [
  { who: 'kyra', text: 'Lia. Warte. Ich muss dir etwas sagen. Wenn ich jetzt weitergehe, sage ich es nie.', mood: 'scared' },
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
  { who: 'lia', text: 'Dann gehen wir nach Süden.', mood: 'determined' },
];

/** Flick on her new job. */
export const SCHUTZ: readonly Line[] = [
  { who: 'flick', text: 'Übrigens: Der Großmeister hat mich zu eurem Schutz abgestellt. Mit Fibel und allem.', mood: 'smirk' },
  { who: 'flick', text: 'Wenn euch was passiert, lässt er mir das Fell gerben. Gesagt hat er das nicht. Aber geguckt.', mood: 'smirk' },
  { who: 'lia', text: 'Du passt also auf uns auf? Du?', mood: 'surprised' },
  { who: 'flick', text: 'Schutztruppe des Lichterordens, eine Frau stark. Bezahlt in Äpfeln. Irgendwer muss es ja machen.', mood: 'happy' },
  { who: 'kyra', text: 'Und wer passt auf dich auf?', mood: 'neutral' },
  { who: 'flick', text: 'Ihr. Aber sagt es keinem.', mood: 'smirk' },
];

/** Optional, under the lone tree: the parents' graves as a promise (no visit). */
export const TREE: readonly Line[] = [
  { who: 'lia', text: 'Wenn das alles vorbei ist, gehen wir heim. Zu den zwei Steinhügeln vor dem Haus. Ich hab es ihnen versprochen.', mood: 'sad' },
  { who: 'kyra', text: 'Wir beide. Und wir erzählen ihnen alles. Auch das mit dem Orden?', mood: 'sad' },
  { who: 'lia', text: 'Vor allem das mit dem Orden. Vater hätte sich nicht mehr eingekriegt.', mood: 'happy' },
];

/** The end of the walk (narrator over the plate e3-epilog). */
export const ENDING: readonly Line[] = [
  { who: 'narrator', text: 'So gingen sie weiter, zu dritt, in einen Herbst hinein, der noch lange dauern sollte.' },
  { who: 'narrator', text: 'Vamir war fort. Wohin die zehn Dinge vom Hügel gekommen waren und wo der Doktor steckte, wusste niemand.' },
  { who: 'narrator', text: 'Am Wegrand hinter ihnen schimmerte für einen Atemzug etwas Türkises, ein alter Mann mit grauem Bart, der ihnen nachsah.' },
  { who: 'narrator', text: 'Die ~Urmacht~ ruhte in ihrer Trägerin. Und zum ersten Mal seit dem Sommer fühlte sich das nicht wie eine Last an.' },
];

export const FINISHED_LINE = 'Das dritte Buch ist zu Ende erzählt. Lia, Kyra und Flick sind auf dem Weg nach Süden.';

/** Journal: what Kyra told her (the forest report is corrected, not deleted). */
export const ELNON_CLUE = 'e3-elnon-wahrheit';
