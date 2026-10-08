// „Woran hältst du dich?“ (e2-pruefung): while the Urmacht surges out of Lia and two rebels hold her, words and
// pictures whirl around her. The druid said: hold on to yourself, to nothing else. Things that are Lia hold; things
// from outside (Kyra's hand, Elnon's order, the bowl, the rebels' arms) make the light lash out. Pure data, tested in
// pruefung-anker.test.ts; staged by pruefung.ts through G.ui.scenePick.
import type { PickCard, PickLine } from '../../ui/scenePick';

export interface Anchor extends PickCard {
  /** True for what is Lia's own; false for a hand from outside. */
  self: boolean;
  reply: PickLine;
}

export const ANCHORS: readonly Anchor[] = [
  { id: 'eiche', text: 'Die alte Eiche, unter der ich lese', self: true,
    reply: { text: 'Rinde im Rücken, ein Buch auf den Knien. Das Licht wird ruhiger. Ein bisschen.' } },
  { id: 'kyra', text: 'Kyras Hand', self: false,
    reply: { text: 'Ich greif nach ihr, und das Licht greift mit. Kyra reißt die Hand weg, als hätte sie in Glut gefasst.' } },
  { id: 'handschrift', text: 'Mutters Handschrift im Kräuterlexikon', self: true,
    reply: { text: 'Die schiefen Buchstaben am Rand. „Nicht zu viel, Lia.“ Gut. Nicht zu viel.' } },
  { id: 'befehl', text: 'Elnons Befehl: „Nicht loslassen!“', self: false,
    reply: { text: 'Das ist sein Wille, nicht meiner. Das Licht hört den Unterschied und schlägt um sich.' } },
  { id: 'name', text: 'Mein Name. Lia.', self: true,
    reply: { text: 'Lia. Vom Hof hinter den Feldern. Die mit den Büchern. Das bin ich, nicht das hier.' } },
  { id: 'schale', text: 'Die leere Schale', self: false,
    reply: { text: 'Holz und Moosgeruch. Daran ist nichts festzuhalten. Nur ein Splitter mehr im Sturm.' } },
  { id: 'leseratte', text: '„Leseratte“. Ich bin eine.', self: true,
    reply: { text: 'Kyra sagt es wie ein Schimpfwort. Ich trag es wie einen Mantel.' } },
  { id: 'arme', text: 'Die Arme der Rebellen', self: false,
    reply: { text: 'Fremde Hände, fremder Griff. Einer von ihnen fliegt ins Gras.' } },
];

/** Anchors needed to hold on. */
export const ANCHORS_NEEDED = 3;

/** The druid's reminder after a hand from outside. */
export const DRUID_REMINDER: PickLine = { speaker: 'e2-druide', text: 'An dir selbst, Mädchen. An nichts anderem.' };

/** Lia's thought afterwards, by how often she reached outside. */
export function anchorThought(mistakes: number): string {
  if (mistakes === 0) return 'Ich hab mich an mir festgehalten. Nur an mir. Und trotzdem lagen zwei Männer im Gras.';
  if (mistakes === 1) return 'Einmal hab ich nach draußen gegriffen. Einmal war genug, damit es um sich schlägt.';
  return 'Ich hab nach allem gegriffen, nur nicht nach mir. Und das Licht hat jedes Mal zurückgegriffen.';
}
