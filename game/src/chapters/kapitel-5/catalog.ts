// Kapitel V „Regen“: chapter-specific catalog entries (speakers, items, lore, memories, clues).
// Shared ids (bead, dagger, book-*, abilities …) come from ../common.
import { registerClues, registerItems, registerLore, registerMemories, registerSpeakers } from '../../core/catalog';
import '../common';

registerSpeakers([
  // Lia in her travel cloak (same voice as 'lia', portrait lia-cloak).
  { id: 'k5-lia', name: 'Lia', portrait: 'lia-cloak', voice: { pitch: 330, wave: 'triangle' }, color: '#d98b5f' },
  // Kyra tied to the tree.
  { id: 'k5-kyra-bound', name: 'Kyra', portrait: 'kyra-bound', voice: { pitch: 300, wave: 'triangle' }, color: '#b07a4f' },
  // Baris after the Master's punishment.
  { id: 'k5-baris-scarred', name: 'Baris', portrait: 'baris-scarred', voice: { pitch: 72, wave: 'sawtooth' }, color: '#8a3a32' },
  // The third man of Baris' troop (crossbow).
  { id: 'k5-schuetze', name: 'Dunkelschatten', portrait: 'shadow-crossbow', voice: { pitch: 140, wave: 'square' }, color: '#8c8c96' },
]);

registerItems([
  { id: 'k5-brombeeren', name: 'Brombeeren', icon: 'apple', description: 'Eine Handvoll dunkler, süßer Beeren aus dem Dornengestrüpp.', comment: 'Wenigstens hat sich der Umweg gelohnt.' },
]);

registerMemories([
  { id: 'k5-mem-gewitter', title: 'Die hohle Weide', text: 'Als wir sieben waren, flohen Kyra und ich vor einem Gewitter in die hohle Weide am Bach. Ich zitterte bei jedem Donner. Kyra sagte, die Götter würden nur Möbel rücken. Sie hielt meine Hand, bis es vorbei war.' },
  { id: 'k5-mem-steine', title: 'Steine über dem Wasser', text: 'Kyra konnte Steine fünfmal über den Weiher springen lassen. Ich schaffte nie mehr als zwei. „Du denkst zu viel“, sagte sie. „Wirf einfach.“' },
  { id: 'k5-mem-perlen', title: 'Kyras Halsband', text: 'Vater brachte Kyra die Holzperlen vom Markt in Trapas mit, mir ein Buch. Kyra meinte, Perlen hätten den Vorteil, dass man sie nicht auswendig lernen muss.' },
]);

registerLore([
  { id: 'k5-lore-leichenfresser', title: 'Leichenfresser', text: 'Maskierte Gestalten, die seit Dunkelhain durch die Wälder streifen und fleddern, was Krieg und Räuber liegen lassen. Wer allein unterwegs ist, wird ihre Beute.' },
  { id: 'k5-lore-rega', title: 'Regas Steine', text: 'Alte Grenzsteine mit dem Bild eines Hirsches: Rega, das Tier Destars, des Gottes der Elfen. Sie markierten einst, wo die Wälder der Elfen begannen, lange bevor Ebaril brannte.' },
  { id: 'k5-lore-grunwald', title: 'Die Elfen von Grunwald', text: 'Flicks eigene Rebellengruppe. Mitglieder: Flick. Die Freie Bruderschaft wollte sie nicht haben, und warum, erzählt sie nicht.' },
  { id: 'k5-lore-tuerkis', title: 'Türkises Licht', text: 'Ein Ring aus versengtem Gras, wo Lia stand. Flick sagt, das Licht sei türkis gewesen und Lias Augen hätten blau geleuchtet. Lia erinnert sich an nichts, nur an ein Rauschen wie Regen.' },
]);

registerClues([
  { id: 'k5-spur-hufe', title: 'Sechs Pferde', text: 'Hufabdrücke von sechs beschlagenen Pferden, fünf tief eingedrückt, eins leichter. Kyra reitet mit ihnen, und sie ziehen nach Osten.' },
  { id: 'k5-spur-zweige', title: 'Abgeknickte Zweige', text: 'Frisch abgeknickte Zweige auf der Höhe eines Reiters. Hier sind Pferde durchgebrochen, keine Rehe.' },
  { id: 'k5-spur-frisch', title: 'Frische Eisen', text: 'An der zweiten Gabelung: alte, überwachsene Abdrücke ohne Eisen nach Süden, frische, tiefe Hufeisen nach Norden.' },
  { id: 'k5-spur-perlen', title: 'Kyras Perlen', text: 'Holzperlen von Kyras Halsband, eine nach der anderen auf dem Weg. Sie legt mir eine Spur.' },
  { id: 'k5-spur-asche', title: 'Warme Asche', text: 'Eine Feuerstelle, die Asche noch warm. Der Trupp war heute Morgen hier. Nur ein paar Stunden Vorsprung.' },
  { id: 'k5-lager-wachen', title: 'Das Lager am Baum', text: 'Sechs Pferde an einer Stange, drei Wachen, ein Feuer unter der großen Eiche. Und ein Hüne in schwarzer Rüstung: der Hauptmann.' },
  { id: 'k5-lager-kyra', title: 'Kyra am Baum', text: 'Kyra ist an den Stamm der Eiche gefesselt. Sie lebt. Und sie hat ihr loses Mundwerk nicht verloren.' },
  { id: 'k5-lager-weg', title: 'Der Weg zum Baum', text: 'Hohes Gras und Haselbüsche reichen fast bis an die Eiche heran. Von dort kommt man ungesehen an Kyra heran.' },
]);
