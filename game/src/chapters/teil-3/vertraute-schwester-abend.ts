// What is said in „e3-vertraute-schwester“ (docs/teil-3/umsetzung.md §3, F3 25:51–28:18). Pure data and small rules (no
// engine imports), unit-tested in vertraute-schwester.test.ts.
//  - The camp evening: Lia finally tells Kyra everything, topic by topic (any order, at least two). Kyra listens with
//    half an ear – except when it is about Trapas and the paladins: then she asks exact questions.
//  - The tea, Lia's remark that Kyra hardly talks any more, Kyra shutting it down.
//  - The framed cut in Vamir's hall: the poison would kill anyone else, the Urmacht only lets it weaken her; Kyra
//    leads her to a remote camp, Baris springs the trap; a spy in the order house, and the paladins have other worries.
//  - The morning: Kyra wakes her harshly; Lia is weak and slow (poisoned), the tincture does nothing.
// All lines are written new (no film wording), at most ~140 characters per box.

export interface Line {
  /** 'lia', 'kyra', 'kyra-cold' (Kyra with the faint hint of the spell in the portrait), 'think' (Lia's thought). */
  who: 'lia' | 'kyra' | 'kyra-cold' | 'think';
  text: string;
  mood?: string;
}

export type TopicKey = 'ignatius' | 'valentus' | 'trapas' | 'gehoert';

export interface Topic {
  key: TopicKey;
  pick: string;
  /** Kyra listens closely (exact questions) – only Trapas and the paladins. */
  close: boolean;
  lines: readonly Line[];
}

export const TOPICS: readonly Topic[] = [
  {
    key: 'ignatius', close: false,
    pick: 'Von Ignatius erzählen',
    lines: [
      { who: 'lia', text: 'Nach dem Lager hat mich ein alter Mann aufgelesen. Ignatius. Einer von den Zehn, stell dir vor. Ein echter.' },
      { who: 'lia', text: 'Er hat mir beigebracht, das Licht zu lenken, statt es nur rauszulassen. Mit einem geliehenen Stab und viel Geschimpfe.', mood: 'happy' },
      { who: 'kyra', text: 'Hm.' },
      { who: 'lia', text: 'Er war streng. Und komisch, auf eine knorrige Art. Ich dachte, ich kann ihm trauen.', mood: 'sad' },
      { who: 'kyra', text: 'Dachtest du.' },
    ],
  },
  {
    key: 'valentus', close: false,
    pick: 'Von Valentus und dem Stab erzählen',
    lines: [
      { who: 'lia', text: 'Und dann stand Valentus im Wald. Der Magier, der mir als Kind das Licht gegeben hat. Durchsichtig wie Nebel.' },
      { who: 'lia', text: 'Er hat Lichter aus einer Weide gelockt, und ein Ast ist in meiner Hand zu einem Stab geworden. Zu meinem eigenen.', mood: 'happy' },
      { who: 'kyra', text: 'Den du jetzt nicht mehr hast.' },
      { who: 'lia', text: 'Danke. Daran hatte ich seit einer halben Stunde nicht gedacht.', mood: 'angry' },
    ],
  },
  {
    key: 'trapas', close: true,
    pick: 'Von Trapas und den Paladinen erzählen',
    lines: [
      { who: 'lia', text: 'In Trapas haben uns die Paladine festgenommen. Der Großmeister hat mich untersuchen lassen wie einen seltenen Käfer.' },
      { who: 'kyra', text: 'Wie viele Paladine hat er? Ziehen sie oft aus der Stadt?' },
      { who: 'lia', text: 'Keine Ahnung. Viele. Auf jedem Gang einer mit Laterne. Wieso?', mood: 'thinking' },
      { who: 'kyra', text: 'Nur so. Und dieser Großmeister – glaubt er, dass du ihm gehörst?' },
      { who: 'lia', text: 'Er glaubt, ich gehöre seinem Gott. Das ist fast noch schlimmer.' },
      { who: 'kyra', text: 'Wissen sie, wohin wir gegangen sind?' },
      { who: 'lia', text: 'Woher denn? Ich weiß es ja selbst nicht. Du führst.' },
    ],
  },
  {
    key: 'gehoert', close: false,
    pick: 'Erzählen, was ich vor dem Arbeitszimmer gehört habe',
    lines: [
      { who: 'lia', text: 'In der letzten Nacht hab ich an einer Tür gelauscht. Ignatius und der Großmeister.' },
      { who: 'lia', text: 'Ignatius hat angeboten, mich einzutauschen. Gegen eine Frau, die er befreien will. Gwynn.', mood: 'sad' },
      { who: 'kyra', text: 'Dann ist es gut, dass du weg bist. Von allen.' },
      { who: 'lia', text: 'Von allen außer dir.' },
      { who: 'kyra', text: '… Ja. Außer mir.' },
    ],
  },
];

/** Topics not told yet, in display order. */
export function openTopics(told: ReadonlySet<TopicKey>): Topic[] {
  return TOPICS.filter(t => !told.has(t.key));
}

/** At least this many topics before Lia may stop talking. */
export const MIN_TOPICS = 2;

/** The options of the next round: open topics, plus „enough“ once Lia has told enough. */
export function eveningOptions(told: ReadonlySet<TopicKey>): { picks: string[]; topics: Topic[]; canStop: boolean } {
  const topics = openTopics(told);
  const canStop = told.size >= MIN_TOPICS && topics.length > 0;
  return { picks: [...topics.map(t => t.pick), ...(canStop ? ['Genug von mir. Ich bin todmüde.'] : [])], topics, canStop };
}

/** Kyra makes tea, Lia drinks; afterwards the remark and Kyra shutting it down. */
export const BEFORE_TEA: readonly Line[] = [
  { who: 'kyra', text: 'Ich mach dir was Warmes. Gegen das kalte Wasser in deinen Knochen.' },
];
export const AFTER_TEA: readonly Line[] = [
  { who: 'lia', text: 'Bitter. Mutter hätte Honig reingetan. Aber es wärmt. Danke.' },
  { who: 'lia', text: 'Weißt du, du redest kaum noch. Früher hast du mich nie ausreden lassen, nicht ein einziges Mal.', mood: 'thinking' },
  { who: 'kyra', text: 'Lass es. Bitte.' },
  { who: 'lia', text: 'Entschuldige. Es war bestimmt furchtbar bei ihm. Du musst nichts erzählen. Nie, wenn du nicht willst.', mood: 'sad' },
  { who: 'kyra', text: 'Schlaf. Bis zu dem Lager ist es ein halber Tag.' },
  { who: 'lia', text: 'Mir ist komisch. Ganz schwer im Kopf. Der Schacht und das kalte Wasser holen mich wohl gerade ein.', mood: 'hurt' },
];

/** The framed cut in Vamir's hall (player knowledge only). */
export const HALL_CUT: readonly { who: 'e2-vamir' | 'e2-baris'; text: string; mood?: string }[] = [
  { who: 'e2-baris', text: 'Meister. Die Wachen sagen, Ihr wollt mich sprechen.' },
  { who: 'e2-vamir', text: 'Bleib stehen. Es dauert nicht lange.' },
  { who: 'e2-vamir', text: 'Kyra hat ihre Schwester gefunden. Brav, wie sie ist. Sie hat ihr sogar Tee gekocht, mit ein paar Tropfen von mir darin.' },
  { who: 'e2-baris', text: 'Gift? Ihr braucht das Mädchen doch lebend.' },
  { who: 'e2-vamir', text: 'Jeden anderen würde es umbringen. Bei ihr lässt das Licht das nicht zu. Es lässt nur zu, dass sie schwach wird. Jeden Tag mehr.' },
  { who: 'e2-vamir', text: 'Schwach genug, dass sie nicht mehr wegläuft. Mehr verlange ich gar nicht.' },
  { who: 'e2-baris', text: 'Und wo soll ich sie mir holen?' },
  { who: 'e2-vamir', text: 'Kyra bringt sie in ein Lager weit draußen im Wald. Rebellen, glaubt die Schwester. Du wartest dort. Und diesmal packst du die Richtige.' },
  { who: 'e2-baris', text: 'Und die Paladine? Die schnüffeln seit Wochen an jeder Straße herum.', mood: 'pained' },
  { who: 'e2-vamir', text: 'Ich habe ein Ohr in ihrem Haus. Es erzählt mir alles, was ich wissen muss.' },
  { who: 'e2-vamir', text: 'Und im Augenblick sucht der ganze Orden seinen entlaufenen Gast. Die haben andere Sorgen als dich.' },
];

/** The harsh morning. */
export const MORNING: readonly Line[] = [
  { who: 'lia', text: 'Kyra? Ist schon … Morgen?' },
  { who: 'kyra-cold', text: 'Hoch mit dir. Gähnen kannst du unterwegs. Die Sonne wartet nicht auf dich.', mood: 'cold' },
  { who: 'lia', text: 'Ich spiel nichts. Mir dreht sich alles. Meine Beine sind wie aus nassem Brot.', mood: 'hurt' },
  { who: 'kyra', text: 'Dann eben langsam. Aber du gehst.' },
];

/** Lia's barks when she staggers on the way (round robin). */
export const STAGGER_BARKS: readonly string[] = [
  'Der Boden kippt.',
  'Gleich. Gleich geht’s wieder.',
  'Meine Knie sind aus Wolle.',
  'Warum ist der Wald so schief?',
];

/** Kyra's impatient barks while she waits ahead. */
export const KYRA_WAIT_BARKS: readonly string[] = ['Weiter.', 'Wir haben nicht ewig.', 'Komm schon.'];

/** The tincture against the poison: nothing (same words as the bag action in catalog.ts). */
export const TINCTURE_THOUGHT = 'Ich reibe ein paar Tropfen auf die Schläfen. Es riecht nach Zuhause und hilft kein bisschen. Das hier ist kein Kratzer. Das sitzt tiefer.';

/** While poisoned, Lia staggers every so often when she walks (ms of walking between two staggers). */
export const STAGGER_EVERY_MS = 5200;
