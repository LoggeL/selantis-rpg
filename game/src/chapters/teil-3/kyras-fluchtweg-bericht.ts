// What is said on the escape night of „e3-kyras-fluchtweg“ (docs/teil-3/umsetzung.md §3, F3 20:07–23:24). Pure data and
// small rules (no engine imports), unit-tested in kyras-fluchtweg.test.ts.
//  - The staff: Lia wants to fetch it from the armoury, Kyra says no; every answer gives in (only the tone differs).
//  - Kyra's report on the bank, three questions in any order: how she got away, Flick, Elnon. The report is part of
//    the trap. The Elnon answer is a lie the player recognises (Teil II showed his death); it comes smooth and without
//    a pause, nobody in the scene comments on it. Kyra asks nothing back.
// All lines are written new (no film wording), at most ~140 characters per box.

export interface Line {
  /** 'lia' = Lia (travel portrait), 'kyra' = Kyra, 'kyra-cold' = Kyra with the faint hint of the spell (player only). */
  who: 'lia' | 'kyra' | 'kyra-cold';
  text: string;
  mood?: string;
}

// ---------------------------------------------------------------------------------------------------------------
// The staff stays behind
// ---------------------------------------------------------------------------------------------------------------

export type StaffTone = 'vorerst' | 'schwer' | 'mutter';

/** Lia gives in, in her own way. Every option leaves the staff in the armoury. */
export const STAFF_ANSWERS: readonly { tone: StaffTone; pick: string; lia: Line; kyra: Line }[] = [
  {
    tone: 'vorerst',
    pick: '„Gut. Dann bleibt er eben hier. Vorerst.“',
    lia: { who: 'lia', text: 'Gut. Dann bleibt er eben hier. Vorerst. Ich komme ihn holen, und dann klopfe ich nicht.', mood: 'determined' },
    kyra: { who: 'kyra', text: 'Vorerst. Komm jetzt.' },
  },
  {
    tone: 'schwer',
    pick: '„Er ist das Einzige, was wirklich mir gehört. Aber … du hast recht.“',
    lia: { who: 'lia', text: 'Er ist das Einzige, das wirklich mir gehört. Nicht geliehen, nicht geschenkt. Aber … du hast recht.', mood: 'sad' },
    kyra: { who: 'kyra', text: 'Du hast ja jetzt mich.' },
  },
  {
    tone: 'mutter',
    pick: '„Wenn du so guckst, bist du schlimmer als Mutter.“',
    lia: { who: 'lia', text: 'Wenn du so guckst, bist du schlimmer als Mutter. Schön. Ohne Stab. Aber ich beschwere mich den ganzen Weg.', mood: 'angry' },
    kyra: { who: 'kyra', text: 'Mutter hätte dich längst am Kragen rausgetragen.' },
  },
];

/** The talk about the staff only happens while it really hangs in the armoury. */
export function staffTalkNeeded(place: string | undefined, carriesOwnStaff: boolean): boolean {
  return place === 'waffenkammer' && !carriesOwnStaff;
}

// ---------------------------------------------------------------------------------------------------------------
// Kyra's report on the bank
// ---------------------------------------------------------------------------------------------------------------

export type ReportKey = 'flucht' | 'flick' | 'elnon';

export interface Question {
  key: ReportKey;
  pick: string;
  lines: readonly Line[];
}

export const REPORT_QUESTIONS: readonly Question[] = [
  {
    key: 'flucht',
    pick: '„Wie bist du da rausgekommen?“',
    lines: [
      { who: 'lia', text: 'Wie bist du da rausgekommen? Aus dieser Halle, weg von ihm?' },
      { who: 'kyra', text: 'Es gab einen Überfall. Rebellen, nur eine Handvoll, aber laut. Alle sind durcheinandergerannt.' },
      { who: 'kyra', text: 'Ich bin mitgerannt. Einfach raus, in den Wald. In dem Lärm hat keiner auf mich geachtet.' },
      { who: 'lia', text: 'Rebellen. Dann waren das vielleicht Elnons Leute. Die Bruderschaft hat ihn also nicht aufgegeben.', mood: 'thinking' },
      { who: 'kyra', text: 'Vielleicht.' },
    ],
  },
  {
    key: 'flick',
    pick: '„Und Flick? Weißt du was von Flick?“',
    lines: [
      { who: 'lia', text: 'Und Flick? Weißt du irgendwas von Flick?' },
      { who: 'kyra', text: 'Die war schon vorher weg. Abgehauen, um Hilfe zu holen.' },
      { who: 'lia', text: 'Sie ist frei? Flick ist frei! Das ist das Beste, was ich seit Tagen gehört habe. Seit Wochen.', mood: 'happy' },
      { who: 'lia', text: 'Und danach? Hast du noch was von ihr gehört?' },
      { who: 'kyra', text: 'Kein Wort. Wer allein durch diese Wälder läuft, kommt nicht immer irgendwo an.' },
    ],
  },
  {
    key: 'elnon',
    pick: '„Und Elnon? War er bei dir?“',
    lines: [
      { who: 'lia', text: 'Und Elnon? War er bei dir?' },
      // Smooth, no pause, the faint violet hint only in the portrait (player knowledge, Teil II showed his death).
      { who: 'kyra-cold', text: 'Wir sind zusammen gerannt. Dann war er weg, mitten im Gedränge. Ich hab ihn verloren.', mood: 'cold' },
      { who: 'lia', text: 'Verloren. Dann lebt er vielleicht noch irgendwo da draußen. Wir müssen ihn suchen, Kyra.', mood: 'determined' },
      { who: 'kyra', text: 'Ja. Das müssen wir.' },
    ],
  },
];

/** The questions not asked yet, in their fixed display order. */
export function openQuestions(asked: ReadonlySet<ReportKey>): Question[] {
  return REPORT_QUESTIONS.filter(q => !asked.has(q.key));
}

/** After the three questions: the camp of the scattered rebels, the staff, and Kyra putting everything off till tomorrow. */
export const REPORT_END: readonly Line[] = [
  { who: 'lia', text: 'Aber wie, nur wir zwei? Ich bin keine Kriegerin. Und du siehst aus, als hättest du seit Tagen nichts gegessen.', mood: 'worried' },
  { who: 'kyra', text: 'Nicht weit von hier haben sich ein paar Versprengte versteckt. Rebellen. Zusammen mit denen geht es.' },
  { who: 'kyra', text: 'Und du trägst doch dieses Licht in dir. Oder hast du das vergessen?' },
  { who: 'lia', text: 'Ein bisschen zaubern kann ich jetzt. Ein bisschen. Aber mein Stab hängt in Trapas an der Wand.', mood: 'sad' },
  { who: 'kyra', text: 'Ein bisschen reicht.' },
  { who: 'lia', text: 'Ich muss dir so viel erzählen. Da war ein Magier aus Licht, und eine Weide, und auf einmal hatte ich …', mood: 'happy' },
  { who: 'kyra', text: 'Morgen. Am Feuer. Jetzt schlaf, ich halte Wache.' },
];

/** Lia's last thought on the bank (dramatic irony: the player knows more than she does). */
export const LAST_THOUGHT = 'Kyra ist da. Flick ist frei. Elnon finden wir auch. Zum ersten Mal seit Tagen bekomme ich richtig Luft.';

/** Lia's barks while she wades through the cold channel (round robin). */
export const COLD_BARKS: readonly string[] = [
  'Kalt. Kalt. Kalt.',
  'Meine Zehen melden sich ab.',
  'Da hat mich was am Bein berührt.',
  'Nie wieder baden. Nie wieder.',
  'Ich spüre meine Knie nicht mehr.',
];
