// Shared campaign catalog: items and abilities used across several chapters.
// Chapters reference these ids; chapter-specific entries live in each chapter's own catalog.
import { registerAbilities, registerItems } from '../../core/catalog';

registerItems([
  { id: 'book-alana', name: 'Die Geschichten der Magierin Alana', icon: 'book-alana', description: 'Brauner Lederband mit Goldtitel. Ein Mitbringsel von Vaters Marktfahrt nach Trapas.', comment: 'Ich muss wissen, wie es mit Alana und Riccard ausgeht.' },
  { id: 'book-herbs', name: 'Cronibus großes Kräuterlexikon', icon: 'book-herbs', description: 'Mutters dickes Buch über Heilpflanzen, mit Zeichnungen und Randnotizen.', comment: 'Mutters Handschrift steht neben dem Speikraut.' },
  { id: 'dagger', name: 'Vaters Dolch', icon: 'dagger', description: 'Ein einfacher Dolch in einer Lederscheide. Vater trug ihn auf den Marktfahrten.', comment: 'Er ist schwerer, als er aussieht.' },
  { id: 'coins', name: 'Münzbeutel', icon: 'coins', description: 'Aus Vaters Geheimfach: 22 Kupfer- und 7 Silbermünzen.', comment: 'Alles, was wir hatten.' },
  { id: 'tincture', name: 'Mutters Wundtinktur', icon: 'tincture', description: 'Ein kleines Fläschchen, das scharf nach Kräutern riecht.', comment: 'Es brennt, aber es hilft.' },
  { id: 'bread', name: 'Brot', icon: 'bread', description: 'Zwei Laibe vom Hof.' },
  { id: 'cheese', name: 'Käse', icon: 'cheese', description: 'Ein halber Laib.' },
  { id: 'bacon', name: 'Speck', icon: 'bacon', description: 'Geräuchert, für unterwegs.' },
  { id: 'waterskin', name: 'Wasserschlauch', icon: 'waterskin', description: 'Aus Leder, randvoll.' },
  { id: 'blanket', name: 'Wolldecke', icon: 'blanket', description: 'Mit einem Riemen an den Beutel geschnallt.' },
  { id: 'cloak', name: 'Grüner Regenmantel', icon: 'cloak', description: 'Lang und warm. Taugt auch als Unterlage.' },
  { id: 'tinder', name: 'Zunder', icon: 'tinder', description: 'Trockene Späne und Zunderschwamm aus der Küche.', comment: 'Damit brennt ein Feuer viel schneller.' },
  { id: 'flowers', name: 'Kornblumen', icon: 'flowers', description: 'Ein kleiner blauer Strauß vom Feldrand.', comment: 'Mutter mag die blauen am liebsten.' },
  { id: 'apple', name: 'Apfel', icon: 'apple', description: 'Rotbackig und süß.' },
  { id: 'honey-cake', name: 'Honig-Apfelkuchen', icon: 'honey-cake', description: 'Vaters Mitbringsel vom Markt. Lias Lieblingsgebäck.' },
  { id: 'chain-pastry', name: 'Kettengebäck', icon: 'chain-pastry', description: 'Süßes Hefegebäck in Kettenform, zum Verbannungsfest.' },
  { id: 'ribbon', name: 'Kyras Haarband', icon: 'ribbon', description: 'Gefunden im Stroh des Stalls im Goldenen Eber.', comment: 'Sie war hier. Kyra war wirklich hier.' },
  { id: 'bead', name: 'Perle von Kyras Halsband', icon: 'bead', description: 'Eine kleine Holzperle. Kyra hat sie absichtlich fallen lassen.', comment: 'Sie legt mir eine Spur.' },
  { id: 'stone', name: 'Stein', icon: 'stone', description: 'Faustgroß und glatt.' },
  { id: 'twig', name: 'Reisig', icon: 'twig', description: 'Trockene Zweige für ein Feuer.' },
  { id: 'rope', name: 'Seil', icon: 'rope', description: 'Ein Stück festes Hanfseil.' },
  { id: 'map', name: 'Karte', icon: 'map', description: 'Eine grob gezeichnete Karte.' },
  { id: 'letter', name: 'Brief', icon: 'letter', description: 'Ein gefaltetes Blatt.' },
  { id: 'key', name: 'Schlüssel', icon: 'key', description: 'Ein kleiner Eisenschlüssel.' },
]);

registerAbilities([
  { id: 'spurenblick', name: 'Spurenblick', key: 'Q', description: 'Lia sieht genau hin. Halte Q, um Spuren und Hinweise hervorzuheben.' },
  { id: 'schleichen', name: 'Schleichen', key: 'C', description: 'Halte C (oder Strg), um geduckt und leise zu gehen. In Büschen bleibt Lia unentdeckt.' },
  { id: 'ausweichen', name: 'Ausweichen', description: 'Im Kampf: Lia weicht dem nächsten Angriff aus.' },
  { id: 'ablenken', name: 'Ablenken', description: 'Im Kampf: Lia zieht die Aufmerksamkeit der Gegner auf sich.' },
  { id: 'urmacht', name: 'Urmacht', description: 'Eine Kraft, die Lia nicht versteht und nicht beherrscht.' },
]);
