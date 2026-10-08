// e3-ignatius-abschied: the farewell's lines, choices and end state (pure, tested in ignatius-abschied.test.ts).
// Newly written; the film (F3 43:38–44:18) only gives the beats: he sees her progress, apologises (cowardly, selfish),
// Gwynn has long been dead, Lia forgives, the body as a shell, he watches from elsewhere, she is never alone.
// His death cannot be prevented: a tincture is offered when Lia carries one and he gently refuses it (it is kept).
import { G } from '../../core/G';
import { STAFF } from '../common/bookContract';

export type Who = 'ignatius' | 'lia' | 'lia-think' | 'kyra' | 'flick';
export interface Line { who: Who; text: string; mood?: string }

export const FAREWELL_FLAGS = { dead: 'e3-ignatius-tot', reconciled: 'e3-versoehnt' } as const;

/** Lia carries Mother's tincture: the attempt is offered (it never helps). */
export function tinctureOffered(): boolean {
  return G.state.has('tincture');
}

/** He opens his eyes when Lia kneels beside him. */
export const WAKE: readonly Line[] = [
  { who: 'ignatius', text: 'Na, sieh an. Die Händlerstochter.', mood: 'pained' },
  { who: 'lia', text: 'Nicht reden. Flick ist gleich da, und Kyra. Die Paladine haben Heiler, die bringen Euch nach Trapas.', mood: 'scared' },
];

export const CARE_CHOICES: readonly string[] = ['Mutters Tinktur aus der Tasche holen', 'Nur seine Hand halten'];

/** The tincture attempt: he closes her fingers round the little bottle. Nothing is used up. */
export const TINCTURE: readonly Line[] = [
  { who: 'lia-think', text: 'Die Tinktur. Meine Finger zittern so, dass ich den Stopfen kaum herausbekomme.' },
  { who: 'ignatius', text: 'Lass. Heb sie dir auf, für eine aufgeschürfte Ferse. Das hier ist keine Wunde, an die ein Tropfen herankommt.', mood: 'sad' },
  { who: 'ignatius', text: 'Was er mir gegeben hat, ist kalt und geht nach innen. Ich spüre, wie es wandert. Ganz ohne Eile.', mood: 'pained' },
];

export const HAND: readonly Line[] = [
  { who: 'lia-think', text: 'Seine Hand ist kalt. Kälter als meine, und meine ist schon kalt vom Gift.' },
  { who: 'ignatius', text: 'Warm hast du es. Immer noch. Das ist gut.', mood: 'pained' },
];

/** He saw her in the duel: no spark that jumped out of her hand, she aimed. */
export const PROGRESS: readonly Line[] = [
  { who: 'ignatius', text: 'Ich hab dich gesehen, eben. Kein Funke, der dir aus der Hand springt, wohin er will. Du hast gezielt.', mood: 'happy' },
  { who: 'lia', text: 'Ihr wart ein grässlicher Lehrer.', mood: 'sad' },
  { who: 'ignatius', text: 'Ich weiß. Und du eine grässliche Schülerin. Wir haben gut zusammengepasst.', mood: 'happy' },
];

/** The apology: the night outside the Großmeister's study, Gwynn. */
export const APOLOGY: readonly Line[] = [
  { who: 'ignatius', text: 'Ich muss dir noch etwas sagen, solange die Luft reicht. In jener Nacht im Ordenshaus …', mood: 'ashamed' },
  { who: 'lia', text: 'Ich weiß. Ich stand im Flur hinter der Tür. Ich habe jedes Wort gehört.', mood: 'sad' },
  { who: 'ignatius', text: 'Dann weißt du, was ich wert war. Ich hätte dich gegen Gwynn eingetauscht und es mir als Mut verkauft.', mood: 'ashamed' },
  { who: 'ignatius', text: 'Es war Angst. Und Eigennutz in einem guten Mantel. Ich wollte etwas zurückhaben, und du warst der Preis.', mood: 'ashamed' },
  { who: 'ignatius', text: 'Gwynn lebt nicht mehr, Lia. Schon lange. Ich habe es gewusst und mir jeden Tag verboten, es zu wissen.', mood: 'sad' },
];

/** How Lia forgives: every option forgives, one asks first, one is angry first. */
export const FORGIVE_CHOICES: readonly string[] = [
  '„Es ist gut. Ich trage Euch nichts nach.“',
  '„Hättet Ihr es getan? Wenn er Ja gesagt hätte?“',
  '„Ihr seid ein sturer, feiger alter Mann!“',
];
export type ForgiveTone = 'gut' | 'frage' | 'wut';
export const FORGIVE_TONES: readonly ForgiveTone[] = ['gut', 'frage', 'wut'];

export const FORGIVE: Record<ForgiveTone, readonly Line[]> = {
  gut: [
    { who: 'lia', text: 'Es ist gut. Ich trage Euch nichts nach. Ihr seid hergerannt, gegen ihn, allein. Das zählt.', mood: 'sad' },
    { who: 'ignatius', text: 'So leicht? Du warst schon immer großzügiger als ich.', mood: 'sad' },
  ],
  frage: [
    { who: 'lia', text: 'Hättet Ihr es getan? Wenn der Großmeister Ja gesagt hätte?', mood: 'sad' },
    { who: 'ignatius', text: 'Ich weiß es nicht. Das ist das Schlimmste daran. Ich weiß es wirklich nicht.', mood: 'ashamed' },
    { who: 'lia', text: 'Dann nehme ich das, was ich weiß: Heute seid Ihr für mich zu Vamir gerannt. Das ist vergeben. Alles davor auch.', mood: 'determined' },
  ],
  wut: [
    { who: 'lia', text: 'Ihr seid ein sturer, feiger alter Mann! Ihr hättet es mir sagen können! Wochenlang!', mood: 'angry' },
    { who: 'ignatius', text: 'Ja. Hätte ich.', mood: 'ashamed' },
    { who: 'lia', text: 'Und trotzdem. Hört Ihr? Es ist vergeben. Ich will nicht, dass Ihr das mitnehmt.', mood: 'sad' },
  ],
};

/** Gwynn, the body as a worn coat, watching from further back (comfort, no map of an afterlife). */
export const LETTING_GO: readonly Line[] = [
  { who: 'ignatius', text: 'Dann kann ich los. Vielleicht wartet Gwynn irgendwo und schimpft, weil ich so lange gebraucht habe.', mood: 'happy' },
  { who: 'lia', text: 'Ihr geht nirgendwohin. Ihr schuldet mir noch hundert Lektionen. Und eine richtige Entschuldigung beim Frühstück.', mood: 'scared' },
  { who: 'ignatius', text: 'Schau nicht so auf das hier. Das ist nur der Mantel, in dem ich herumgelaufen bin. Er ist ziemlich abgewetzt.', mood: 'pained' },
  { who: 'ignatius', text: 'Ich sehe dir weiter zu. Nur von weiter hinten. Wie ein Lehrer, der am Ende des Saals steht und nicht mehr dazwischenredet.', mood: 'sad' },
];

/** Lia's last words to him (her choice). */
export const LAST_CHOICES: readonly string[] = [
  '„Grüßt Gwynn von mir.“',
  '„Danke. Für das Feuer, den Stab, für alles.“',
  'Nichts sagen. Seine Hand festhalten.',
];
export const LAST: readonly (readonly Line[])[] = [
  [
    { who: 'lia', text: 'Dann … grüßt Gwynn von mir. Sagt ihr, Ihr wart zum Schluss gar nicht so übel.', mood: 'sad' },
    { who: 'ignatius', text: 'Das wird sie mir nicht glauben.', mood: 'happy' },
  ],
  [
    { who: 'lia', text: 'Danke. Für das Feuer im Wald und den geliehenen Stab und dass Ihr nie aufgehört habt, mir zu widersprechen.', mood: 'sad' },
    { who: 'ignatius', text: 'Das Widersprechen war das Einfachste.', mood: 'happy' },
  ],
  [
    { who: 'lia-think', text: 'Ich sage nichts. Ich halte nur fest. Wenn ich jetzt rede, weine ich, und dann versteht er kein Wort.' },
    { who: 'ignatius', text: 'Ist gut. Ich hab dich auch so verstanden.', mood: 'happy' },
  ],
];

/** Only while Lia carries Schattentöter: he wants it passed on, not kept. */
export const SCHATTENTOETER: readonly Line[] = [
  { who: 'ignatius', text: 'Und Schattentöter … behalt ihn nicht für immer. Gib ihn einem, der ihn braucht. Du hast deinen eigenen.', mood: 'sad' },
];

/** His last words: she should turn round when it gets quiet; someone will always stand there. */
export const FINAL: readonly Line[] = [
  { who: 'ignatius', text: 'Und Lia … wenn es still wird, dreh dich um. Irgendwer steht immer hinter dir. Das war von Anfang an so.', mood: 'happy' },
];

export const AFTER_DEATH: readonly string[] = [
  'Seine Finger werden schwer in meinen. Dann ganz still.',
  'Der Wind geht durchs Laub, als wäre nichts. Irgendwo ruft ein Vogel. Ich lasse seine Hand nicht los.',
];

/** Kyra and Flick arrive; stillness, few words. */
export const ARRIVAL: readonly Line[] = [
  { who: 'flick', text: 'Hier! Kyra, sie ist hier oben!', mood: 'determined' },
  { who: 'lia-think', text: 'Ich drehe mich um. Da stehen sie. Er hatte recht. Natürlich hatte er recht.' },
  { who: 'flick', text: 'Oh.', mood: 'sad' },
  { who: 'kyra', text: 'Ich bin da. Ich sag nichts. Ich bin nur da.', mood: 'sad' },
  { who: 'flick', text: 'Ich halte Wache. Lasst euch Zeit. So viel ihr braucht.', mood: 'sad' },
];

/**
 * End of the scene: Ignatius is dead, Lia forgave him, the friends travel together from now on. Called right before
 * the transition; repeating it after a reload changes nothing (flags and party are plain values).
 */
export function endFarewell(tone: ForgiveTone | undefined): void {
  G.state.set('e3-abschied-ton', tone ?? 'gut');
  G.state.set(FAREWELL_FLAGS.dead);
  G.state.set(FAREWELL_FLAGS.reconciled);
  G.state.setParty(['kyra', 'flick']);
}

/** Lia still carries his Schattentöter (picked up on the path in e3-vamir). */
export const carriesSchattentoeter = (): boolean => G.state.has(STAFF.borrowed);
