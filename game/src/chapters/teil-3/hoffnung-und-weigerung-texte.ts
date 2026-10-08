// „e3-hoffnung-und-weigerung“: the second visit to Lia's inner meadow (the figure, the violet rifts), her refusal in
// Vamir's hall and the framed cut with the contact man. Pure data and small rules (no engine imports);
// hoffnung-und-weigerung.test.ts checks positions, the rift rule and the texts.
// Dialogue is newly written; F3 34:58–38:17 gives the beats only (umsetzung.md §1).

type Spot = readonly [number, number];

export interface Line { who: string; text: string; mood?: string }

// ---------------------------------------------------------------------------------------------------------------
// The meadow: where the figure stands, where the rifts tear
// ---------------------------------------------------------------------------------------------------------------

export const MEADOW_SPOT = {
  /** Where the figure appears (in the open middle of the meadow) and where Lia talks to her. */
  figure: [300, 196],
  /** The fourth rift, the one that does not close: right under Lia, in the middle. */
  lastRift: [292, 214],
} as const satisfies Record<string, Spot>;

/** The three rifts Lia can close, in the order they tear (left among the flowers, right by the stones, front). */
export const RIFTS: readonly Spot[] = [[166, 214], [454, 204], [300, 262]];

/** Walk this close to a rift (map px, feet to the rift's centre) to hear what it whispers. */
export const RIFT_RADIUS = 28;

/** The memories from the first visit (e3-innere-zuflucht) that Lia can hold against a rift. */
export type RiftMemory = 'buch' | 'holz' | 'mutter';
export const RIFT_MEMORIES: readonly RiftMemory[] = ['buch', 'holz', 'mutter'];
export const RIFT_MEMORY_OPTIONS: Record<RiftMemory, string> = {
  buch: 'An das Buch unter der Eiche denken.',
  holz: 'An Kyra mit dem Feuerholz denken.',
  mutter: 'An Mutter und das A wie Apfel denken.',
};

/** Each rift whispers one doubt in Vamir's voice; one memory answers it. */
export const RIFT_DOUBTS: readonly { whisper: string; answer: RiftMemory; lia: InnerLine }[] = [
  {
    whisper: 'Ein Bauernmädchen mit einem Buch. Was glaubst du eigentlich, wer du bist?', answer: 'mutter',
    lia: { who: 'lia', text: 'Eine, die lesen kann. Mutter hat es mir beigebracht, Buchstabe für Buchstabe. Das nimmst du mir nicht.', mood: 'determined' },
  },
  {
    whisper: 'Deine Schwester gehört mir. Sie hat dich längst vergessen.', answer: 'holz',
    lia: { who: 'lia', text: 'Sie hat mir jahrelang die Hälfte von ihrem Holz untergeschoben. So jemand vergisst nicht. Nie.', mood: 'angry' },
  },
  {
    whisper: 'Niemand kommt. Gute Enden gibt es nur in deinen Büchern.', answer: 'buch',
    lia: { who: 'lia', text: 'Dann bin ich eben in einem. Und ich hab noch jedes bis zur letzten Seite gelesen.', mood: 'determined' },
  },
];

/** A memory that does not answer the whisper: the rift widens for a moment. */
export const RIFT_MISS: readonly string[] = [
  'Das wärmt. Aber es antwortet nicht auf das, was er flüstert. Der Riss wird breiter.',
  'Falsche Erinnerung für diesen Satz. Der Riss frisst sie einfach.',
];

/** Objective text for the rifts (text only in the inner world, no marker). */
export function riftObjective(closed: number): string {
  if (closed <= 0) return 'Ein violetter Riss in der Wiese. Geh hin und hör, was er flüstert.';
  if (closed >= RIFTS.length) return 'Die Wiese hält. Noch.';
  return `Noch ein Riss. Hingehen, zuhören, dagegenhalten. (${closed} von ${RIFTS.length} geschlossen)`;
}

// ---------------------------------------------------------------------------------------------------------------
// Part 1: the figure
// ---------------------------------------------------------------------------------------------------------------

/** Who says what: 'lia' (inner portrait), 'think', 'gestalt' (the figure). */
export interface InnerLine { who: 'lia' | 'think' | 'gestalt'; text: string; mood?: string }

export const MEADOW_OPENING: InnerLine[] = [
  { who: 'think', text: 'Immer noch hier. Die Wiese ist ganz, der Nebel steht nur noch am Rand. Und die Eiche rauscht, obwohl kein Wind geht.' },
  { who: 'think', text: 'Da drüben, im Gras. Eben war da noch niemand.' },
];

export const FIGURE_TALK: InnerLine[] = [
  { who: 'gestalt', text: 'Keine Angst. Ich bin nicht von draußen hereingekommen.' },
  { who: 'lia', text: 'Wer bist du dann? Hier ist sonst nur, was ich kenne.', mood: 'surprised' },
  { who: 'gestalt', text: 'Ein Teil von dir. Einen anderen Namen habe ich nicht.' },
  { who: 'lia', text: 'Ein Teil von mir, der aussieht wie eine Fremde. Das steht in keinem Buch, das ich gelesen hab.', mood: 'thinking' },
  { who: 'gestalt', text: 'Wir sind ganz weit drinnen, Lia. Was sie draußen mit dir machen, klopft nur an. Über diese Schwelle lässt die Urmacht es nicht.' },
  { who: 'lia', text: 'Wer klopft da? Und was wollen die von mir?' },
  { who: 'gestalt', text: 'Sie brauchen dich wach. Für sie ist die Urmacht ein Schloss, das nur von innen aufgeht. Valentus hat es dir einst so aufgeschlossen.' },
  { who: 'lia', text: 'Dann schlafe ich eben weiter. Hier ist es warm, und keiner will etwas von mir.' },
  { who: 'gestalt', text: 'Eine Weile geht das. Für immer nicht. Draußen liegt dein Körper, und der braucht dich auch.' },
  { who: 'lia', text: 'Und wer holt mich da raus? Ich zähl dir mal auf, wer mir noch bleibt.', mood: 'angry' },
];

export type Topic = 'kyra' | 'flick' | 'ignatius';
export const TOPICS: readonly Topic[] = ['kyra', 'flick', 'ignatius'];

export const TOPIC_TALK: Record<Topic, { option: string; lines: InnerLine[] }> = {
  kyra: {
    option: '„Kyra steht neben ihm.“',
    lines: [
      { who: 'lia', text: 'Kyra steht neben ihm und schaut durch mich hindurch. Sie hat mich hingebracht. Meine Schwester.', mood: 'sad' },
      { who: 'gestalt', text: 'Und hat sie dich dabei ein einziges Mal angesehen? So, wie sie dich früher angesehen hat?' },
      { who: 'lia', text: 'Nein. Kein einziges Mal. Als würde jemand anderes hinter ihren Augen sitzen.', mood: 'thinking' },
    ],
  },
  flick: {
    option: '„Flick ist weg.“',
    lines: [
      { who: 'lia', text: 'Flick ist weg. Geflohen, um Hilfe zu holen, sagt Kyra. Nur hat Kyra mich auch in eine Falle geführt.', mood: 'sad' },
      { who: 'gestalt', text: 'Seit wann lässt Flick etwas liegen, das sie angefangen hat?' },
      { who: 'lia', text: 'Noch nie. Dafür ist sie zu stur. Sturer als ich, und das will was heißen.', mood: 'thinking' },
    ],
  },
  ignatius: {
    option: '„Und Ignatius …“',
    lines: [
      { who: 'lia', text: 'Und Ignatius. Ich hab ihn gehört, nachts vor der Tür. Er hätte mich dem Orden überlassen, wenn er dafür Gwynn bekommt.', mood: 'angry' },
      { who: 'lia', text: 'Für ihn war ich nie ein Mensch. Eher ein seltenes Buch, das man gut verwahrt, bis sich ein Käufer findet.', mood: 'sad' },
      { who: 'gestalt', text: 'Du hast einen Satz gehört, durch eine Tür. Wie viele Seiten liest du, bevor du über ein Buch urteilst?' },
    ],
  },
};

export const FIGURE_HOPE: InnerLine[] = [
  { who: 'gestalt', text: 'Ich kann nicht hinaussehen. Aber ich spüre, wie es draußen dichter wird. Jemand kommt näher.' },
  { who: 'lia', text: 'Hoffnung also. Die steht in jedem zweiten Buch auf der letzten Seite.', mood: 'thinking' },
  { who: 'gestalt', text: 'Und trotzdem hast du jedes dieser Bücher bis zur letzten Seite gelesen.' },
  { who: 'lia', text: '… Ja. Hab ich.' },
];

/** Lines when each rift tears and closes. */
export const RIFT_LINES: { first: InnerLine[]; closed: InnerLine[][]; last: InnerLine[] } = {
  first: [
    { who: 'lia', text: 'Was ist das? Das Gras … reißt auf. Und darunter ist es kalt und violett.', mood: 'scared' },
    { who: 'gestalt', text: 'Das ist er. Er drückt von außen, mit seiner Magie. Wenn er dich nicht wach bekommt, bricht er dich auf.' },
    { who: 'gestalt', text: 'Er flüstert durch die Risse. Hör hin, und halt etwas dagegen, das wirklich dir gehört.' },
  ],
  closed: [
    [{ who: 'lia', text: 'Zu. Ich hab es zugemacht. Ich!', mood: 'surprised' }, { who: 'gestalt', text: 'Gut. Er hört nicht auf, nur weil es einmal nicht geklappt hat.' }],
    [{ who: 'lia', text: 'Er klopft wie einer, der seine Schulden eintreiben will.', mood: 'angry' }, { who: 'gestalt', text: 'Dann mach ihm nicht auf.' }],
    [{ who: 'gestalt', text: 'Er wird stärker. Ich halte mit dir, solange ich kann.', mood: 'sad' }],
  ],
  last: [
    { who: 'lia', text: 'Nein. Nein, nein, nein, überall …', mood: 'scared' },
    { who: 'gestalt', text: 'Lia! Halt dich an der Wiese fest. Sie gehört dir, nicht ihm!', mood: 'sad' },
  ],
};

/** Muffled voices from outside between the rifts (no picture, nobody named; Vamir is the cold voice). */
export const OUTSIDE_BETWEEN: readonly (readonly { who: string; text: string }[])[] = [
  [
    { who: 'Eine Männerstimme', text: 'Sie wacht nicht auf, Meister. Ich hab ihr schon Wasser ins Gesicht gekippt.' },
    { who: 'Eine leise, kalte Stimme', text: 'Dann hör auf, mit Eimern zu werfen. Geh beiseite. Ich mache es selbst.' },
  ],
  [
    { who: 'Die kalte Stimme', text: 'Du versteckst dich gut, Mädchen. Aber jedes Versteck hat eine Tür.' },
  ],
];

// ---------------------------------------------------------------------------------------------------------------
// Part 2: the refusal in the hall
// ---------------------------------------------------------------------------------------------------------------

export const HALL_WAKE: Line[] = [
  { who: 'think', text: 'Stein unter den Knien. Ein Eisenring im Boden, und ein Strick daran, der zu meinen Handgelenken führt.' },
  { who: 'think', text: 'Keine Wiese mehr. Nur Kälte. Und das Gift in den Armen, schwer wie nasser Sand.' },
  { who: 'e2-vamir', text: 'Da bist du ja. Du hast dich lange versteckt. Beinahe hätte ich Geduld lernen müssen.' },
  { who: 'e2-vamir', text: 'Ich sage es dir ein einziges Mal. Gib mir die Urmacht, aus freien Stücken. Dann gehst du hier hinaus, wohin du willst.' },
  { who: 'e2-vamir', text: 'Oder du lernst Schmerzen kennen, die in keinem deiner Bücher stehen. Ich habe Zeit. Du nicht.' },
];

/** Lia's refusal: every option refuses (umsetzung.md: keine nachgiebige Option). */
export const REFUSALS: readonly { option: string; lia: string; mood: string; vamir: string }[] = [
  { option: '„Nein.“', lia: 'Nein.', mood: 'determined', vamir: 'Ein Wort. Wenigstens verschwendest du nicht meine Zeit.' },
  {
    option: '„Ich weiß nicht mal, wie das ginge. Und wenn: nein.“', lia: 'Ich weiß nicht mal, wie das ginge. Und wenn ich es wüsste: trotzdem nein.', mood: 'angry',
    vamir: 'Ehrlich. Und dumm. Das trifft man selten so sauber beisammen.',
  },
  {
    option: '„Deine Leute haben meine Eltern getötet.“', lia: 'Deine Leute haben meine Eltern getötet. Von mir bekommst du nichts. Gar nichts.', mood: 'angry',
    vamir: 'Deine Eltern haben gelogen, um dich zu verstecken. Das hat sie getötet. Nicht ich.',
  },
];

export const HALL_AFTER: Line[] = [
  { who: 'lia', text: 'Mach, was du willst. Valentus hat sie mir gegeben, nicht dir. Und ich gebe sie nicht weiter.', mood: 'determined' },
  { who: 'e2-vamir', text: 'Wie du willst. Es gibt mehr als einen Weg an das, was du da trägst. Ich werde ihn finden.' },
  { who: 'e2-baris', text: 'Meister. Euer Mann aus Trapas ist eingetroffen. Er sagt, es eilt.' },
  { who: 'e2-vamir', text: 'Bring sie hinaus, in den Käfig. Gib ihr Wasser. Ich will sie wach, wenn es so weit ist.' },
];

// ---------------------------------------------------------------------------------------------------------------
// Part 3: the contact man (framed, player knowledge only)
// ---------------------------------------------------------------------------------------------------------------

export const CONTACT: { arrive: Line[]; book: Line[]; plan: Line[] } = {
  arrive: [
    { who: 'e3-doktor', text: 'Meister. Verzeiht, dass ich so hereinplatze. Ich bin die ganze Nacht durchgeritten, und meine Instrumente haben jeden Stein gespürt.', mood: 'smirk' },
    { who: 'e2-vamir', text: 'Sprich. Und fass dich kurz. Deine Instrumente langweilen mich.' },
    { who: 'e3-doktor', text: 'Ein Jahr lang habe ich für den Großmeister vermessen, wie man der Urmacht beikommt. Zur höheren Ehre von Aros, versteht sich.' },
    { who: 'e3-doktor', text: 'Die Rechnung ist fertig. Der Großmeister wird sie nie zu sehen bekommen. Ihr schon.', mood: 'smirk' },
    { who: 'e2-vamir', text: 'Das Mädchen hat eben Nein gesagt. Was nützt mir deine Rechnung?' },
  ],
  book: [
    { who: 'e3-doktor', text: 'Ihr Nein ist für mein Verfahren unerheblich. In einer fleckigen alten Kopie steht, wie man Xenovia einst leer gemacht hat. Zu zehnt.', mood: 'thinking' },
    { who: 'e3-doktor', text: 'Man legt die Trägerin in einen Kreis. Darum zehn Stücke aus dem Besitz der Ersten, gerichtet wie Nadeln auf einen Pol.' },
    { who: 'e3-doktor', text: 'Dann rinnt die Kraft aus ihr wie Wasser aus einem Krug mit Sprung. Das Blatt über die Folgen für die Trägerin fehlt leider.' },
  ],
  plan: [
    { who: 'e2-baris', text: 'Plunder von den Ersten? Aus den Tempeln haben wir kistenweise welchen. Nur steht auf keinem Stück, wem es mal gehört hat.' },
    { who: 'e2-vamir', text: 'Der Doktor wird es dir zeigen. Er riecht altes Zeug, wie ein Hund Knochen riecht.' },
    { who: 'e2-vamir', text: 'Sucht es zusammen, ihr beide. Bei der nächsten Dämmerung will ich einen Kreis sehen.' },
    { who: 'e2-baris', text: 'Jawohl, Meister.' },
    { who: 'e3-doktor', text: 'Und mein Anteil, Meister? Ich habe in Trapas einiges aufs Spiel gesetzt.' },
    { who: 'e2-vamir', text: 'Du lebst. Das ist mehr, als die meisten von mir bekommen.' },
  ],
};
