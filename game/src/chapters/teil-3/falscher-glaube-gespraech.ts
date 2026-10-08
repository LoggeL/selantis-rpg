// What Lia reads and hears on the night of „e3-falscher-glaube“ (docs/teil-3/umsetzung.md §3, F3 16:30–20:01).
// Pure data and small rules (no engine imports), unit-tested in falscher-glaube.test.ts.
//  - The doctor's book: an old copy without a title. Three places Lia reads: the making of the world, „what belonged to
//    the first“ (smudged, a ring of ten marks drawn beside it, no list of objects), a page cut out with a fresh margin
//    note. Nothing in it is a recipe.
//  - The conversation behind the study door in three sections; between them a guard walks past and Lia has to hide.
//    1. The Großmeister wants the Urmacht to carry the faith in Aros into every village; Ignatius: that is force.
//    2. Ignatius: she could die, she is no goddess. The Großmeister: then one dies and thousands live; Ignatius ran
//       into the woods when the people needed him.
//    3. Gwynn: the Großmeister says Ignatius only wants the power to free her. Ignatius denies it – and then offers
//       the girl in exchange for Gwynn. Refused, with a threat of a court for desertion.
// All lines are written new (no film wording), at most ~140 characters per box.

export type Speaker = 'e3-grossmeister' | 'e2-ignatius' | 'think';

export interface Line {
  /** Who speaks behind the door, or 'think' for Lia's own thought in between. */
  who: Speaker;
  text: string;
  mood?: string;
}

/** The three sections behind the study door. */
export const STUDY_SECTIONS: readonly (readonly Line[])[] = [
  [
    { who: 'e2-ignatius', text: 'Ihr habt sie untersuchen lassen wie ein Kalb auf dem Markt. Ich frage Euch noch einmal: Was wollt Ihr von ihr?', mood: 'grim' },
    { who: 'e3-grossmeister', text: 'Nicht von ihr. Von dem, was in ihr steckt. Ein Mädchen vom Land weiß damit nichts anzufangen. Ich schon.' },
    { who: 'e2-ignatius', text: 'Und was fangt Ihr damit an?' },
    { who: 'e3-grossmeister', text: 'Ich trage das Licht des Aros in jedes Dorf, bis an die Küste. Keine Kulte mehr in den Wäldern. Kein Hof ohne Schutz.', mood: 'determined' },
    { who: 'e3-grossmeister', text: 'Zum Wohl der Menschen, Ignatius. Sie brauchen Halt, und ich hätte endlich die Kraft, ihn allen zu geben.' },
    { who: 'e2-ignatius', text: 'Und wer Euren Halt nicht will, bekommt ihn trotzdem. Das ist kein Licht. Das ist ein Knüppel mit Kerze dran.', mood: 'grim' },
    { who: 'e3-grossmeister', text: 'Vorsicht. Ihr seid hier Gast. Gäste dürfen gehen. Oder bleiben, ganz wie ich es bestimme.', mood: 'angry' },
    { who: 'e2-ignatius', text: 'Droht ruhig. Ich bin ein alter Mann mit leerem Beutel. Da ist nicht mehr viel, woran Ihr ziehen könnt.' },
    { who: 'think', text: 'Das Licht des Aros. In jedes Dorf. Und ich bin die Kerze, mit der er es anzündet.' },
  ],
  [
    { who: 'e3-grossmeister', text: 'Der Doktor sucht einen Weg, die Kraft aus ihr herauszulösen. Er sagt, er sei nah dran.', mood: 'thinking' },
    { who: 'e2-ignatius', text: 'Sie ist aus Fleisch, Großmeister. Keine Göttin, die man ausleert und wieder füllt. Das überlebt sie vielleicht nicht.', mood: 'worried' },
    { who: 'e3-grossmeister', text: 'Dann stirbt ein Mädchen, und Tausende leben. Ich habe diese Rechnung oft gemacht. Sie geht jedes Mal auf.', mood: 'grim' },
    { who: 'e2-ignatius', text: 'Ihr meint: Tausende knien. Leben würden sie auch ohne Euch.', mood: 'grim' },
    { who: 'e3-grossmeister', text: 'Ihr wollt mir von Opfern erzählen? Ihr? Wo wart Ihr denn, als nach Dunkelhain die Dörfer brannten?', mood: 'angry' },
    { who: 'e3-grossmeister', text: 'Im Wald. Unter Moos und Selbstmitleid. Ihr habt geschworen, die Menschen zu schützen, und dann seid Ihr gegangen.', mood: 'angry' },
    { who: 'e3-grossmeister', text: 'Ich bin geblieben. Ich habe die Gräber gezählt. Kommt mir also nicht mit Gewissen.', mood: 'grim' },
    { who: 'e2-ignatius', text: '… Ja. Ich bin gegangen. Euer Plan wird davon nicht besser.', mood: 'sad' },
    { who: 'think', text: 'Ausleeren. Wie einen Krug. Und wenn nichts mehr drin ist, wird er weggestellt.' },
  ],
  [
    { who: 'e3-grossmeister', text: 'Und jetzt kommt Ihr plötzlich aus dem Wald. Mit einem Mädchen, das die Urmacht trägt. Was für ein Zufall.', mood: 'thinking' },
    { who: 'e3-grossmeister', text: 'Gwynn. So hieß sie doch, Eure Zauberin. Sie sitzt hinter Schloss und Riegel, und Ihr kommt nicht an sie heran.', mood: 'grim' },
    { who: 'e2-ignatius', text: 'Lasst Gwynn aus dem Spiel.', mood: 'grim' },
    { who: 'e3-grossmeister', text: 'Ihr seid nicht des Mädchens wegen hier, sondern wegen Gwynn. Mit der Urmacht bekämt Ihr jede Zellentür auf.' },
    { who: 'e2-ignatius', text: 'Das ist nicht wahr. Ich würde Lia niemals für so etwas in Gefahr bringen.', mood: 'worried' },
    { who: 'e3-grossmeister', text: 'Sie steckt längst mittendrin, mit Euch oder ohne Euch.' },
    { who: 'e2-ignatius', text: '… Dann gebt mir Männer. Lasst mich Gwynn holen.', mood: 'sad' },
    { who: 'e2-ignatius', text: 'Danach gehört das Mädchen Euch. Ich stelle mich Euch nicht mehr in den Weg. Mein Wort darauf.', mood: 'sad' },
    { who: 'e3-grossmeister', text: 'Für alte Liebschaften habe ich keine Männer übrig.', mood: 'determined' },
    { who: 'e3-grossmeister', text: 'Ein Wort von mir, und die Richter des Ordens verhandeln Eure Fahnenflucht von damals. Haltet still, dann bleibt es ungesagt.', mood: 'angry' },
    { who: 'e3-grossmeister', text: 'Die Kerze ist fast heruntergebrannt. Gute Nacht, Ignatius.' },
  ],
];

/** The line in which Ignatius offers Lia for Gwynn (the bargain must be unmistakable). */
export const BARGAIN_LINE = STUDY_SECTIONS[2].find(l => l.text.startsWith('Danach gehört das Mädchen Euch'))!;

/** Lia's reaction right after the last section (thoughts, newly worded). */
export const AFTER_BARGAIN: readonly string[] = [
  '„Danach gehört das Mädchen Euch.“ Einfach so. Wie man einen Sack Korn über den Tisch schiebt.',
  'Wer ist Gwynn? Und wie viel bin ich wert, wenn man mich gegen sie eintauscht?',
];

/** What Lia thinks in bed afterwards. */
export const BACK_IN_BED: readonly string[] = [
  'Ich dachte, er bringt mir das Zaubern bei, weil … Ich weiß nicht mehr, was ich dachte.',
  'Morgen sehe ich ihn an und weiß, was er gesagt hat. Und er weiß nicht, dass ich es weiß.',
];

export interface Passage {
  key: 'anfang' | 'ersten' | 'seite';
  /** The bookmark Lia picks in the choice. */
  pick: string;
  /** What the book says (narrated), and what Lia makes of it. */
  book: string;
  thought: string;
}

/** The three places Lia reads in the doctor's book (no title, no list of objects, no recipe). */
export const BOOK_PASSAGES: readonly Passage[] = [
  {
    key: 'anfang', pick: 'Die erste Seite, mit dem Bild von Wasser und Erde.',
    book: '„Im Anfang war nur sie, und sie war allein. Da nahm sie Erde, Wasser und Atem und machte zehn, die mit ihr reden sollten.“',
    thought: 'Zehn, die mit ihr reden sollten. Das klingt nicht nach einer Hexe. Das klingt nach jemandem, der einsam war.',
  },
  {
    key: 'ersten', pick: 'Die Stelle mit dem Kreis am Rand.',
    book: '„Was den Ersten gehörte, behält etwas von ihnen. Bringt man es zusammen und wendet es gegen sie, so …“ Der Rest ist verwischt.',
    thought: 'Daneben ein Kreis aus zehn Strichen, mit Tinte, die noch glänzt. Wie ein Becher, der noch nach jemandem riecht? Unheimlich.',
  },
  {
    key: 'seite', pick: 'Die Lücke, wo eine Seite fehlt.',
    book: 'Zwischen zwei Seiten fehlt eine. Nicht herausgefallen: herausgeschnitten, sauber, mit einem sehr scharfen Messer.',
    thought: 'Am Rand, frisch und ordentlich, ein einziges Wort: „Freiwillig?“ Mit Fragezeichen. Das gefällt mir überhaupt nicht.',
  },
];

/** Passages Lia has not read yet (in book order). */
export function unreadPassages(read: ReadonlySet<string>): Passage[] {
  return BOOK_PASSAGES.filter(p => !read.has(p.key));
}

/**
 * Listening rule: a section may start only while Lia stands at the door and the corridor guard is far away (or gone),
 * and, after the first one, only once the guard has walked past the alcove since the previous section.
 */
export function canListen(opts: { atDoor: boolean; guardFar: boolean; passedSinceLast: boolean; section: number }): boolean {
  if (!opts.atDoor || !opts.guardFar) return false;
  return opts.section === 0 || opts.passedSinceLast;
}
