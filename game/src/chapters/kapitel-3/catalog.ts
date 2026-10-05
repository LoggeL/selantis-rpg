// Kapitel III catalog: speakers, items, clues (with the deductions of the clue board), lore and memories.
// Shared campaign items/abilities (ribbon, chain-pastry, books, …) live in chapters/common.
import { registerClues, registerItems, registerLore, registerMemories, registerSpeakers } from '../../core/catalog';
import '../common';

registerSpeakers([
  // Lia in her travel clothes (green cloak) – same voice as 'lia'.
  { id: 'k3-lia', name: 'Lia', portrait: 'lia-cloak', voice: { pitch: 330, wave: 'triangle' }, color: '#d98b5f' },
  // Kyra with tied hands (Kyra interlude).
  { id: 'k3-kyra-bound', name: 'Kyra', portrait: 'kyra-bound', voice: { pitch: 290, wave: 'triangle' }, color: '#b07a4a' },
  // Voices heard through the tent canvas (Kyra listens from outside).
  { id: 'k3-baris-zelt', name: 'Baris (im Zelt)', portrait: 'baris', voice: { pitch: 78, wave: 'sawtooth' }, color: '#8a3a32' },
  { id: 'k3-orwen-zelt', name: 'Orwen (im Zelt)', portrait: 'orwen', voice: { pitch: 115, wave: 'sawtooth' }, color: '#9a9aa2' },
  { id: 'k3-spielmann', name: 'Spielmann', portrait: 'bard', voice: { pitch: 200, wave: 'triangle' }, color: '#c2a05a' },
  { id: 'k3-reisende', name: 'Reisende', portrait: 'villager-f', voice: { pitch: 270, wave: 'sine' }, color: '#9a8a6a' },
  { id: 'k3-reisender', name: 'Reisender', portrait: 'villager-m', voice: { pitch: 150, wave: 'triangle' }, color: '#8a7a5a' },
]);

registerItems([
  { id: 'k3-notizen', name: 'Lias Notizen', icon: 'letter', description: 'Ein Stück Papier und ein Kohlestift. Hier ordnet Lia, was sie herausfindet.', comment: 'Mutter hat immer gesagt: Was man aufschreibt, vergisst man nicht.' },
  { id: 'k3-stein', name: 'Feldstein', icon: 'stone', description: 'Faustgroß, für den Ring um die Feuerstelle.' },
]);

/** Clues found in the Golden Boar. The k3-schluss-* entries are deductions made on the clue board. */
registerClues([
  { id: 'k3-seilfasern', title: 'Seilfasern am Pfeiler', text: 'Am Mittelpfeiler kleben Hanffasern, in Sitzhöhe. Daneben Kratzer von einem Hocker. Hier war jemand festgebunden.' },
  { id: 'k3-kette', title: 'Die Kette im Stall', text: 'Am Stützbalken im Stall hängt eine kurze Kette mit einer offenen Fußschelle. Klein. Für einen schmalen Knöchel.' },
  { id: 'k3-kornsack', title: 'Der zerwühlte Kornsack', text: 'Neben dem Balken liegt ein leerer Kornsack, zerknüllt wie eine Decke. Jemand hat hier gefroren.' },
  { id: 'k3-haarband', title: 'Kyras Haarband', text: 'Im Stroh am Stützbalken: Kyras Haarband. Ich würde es unter tausend erkennen.' },
  { id: 'k3-schminke', title: 'Das „geliehene“ Schminktäschchen', text: 'Ein kahler Dunkelschatten hat der Schankmaid ihr Schminktäschchen abgenommen. Für ein Mädchen, das dem Hauptmann gefallen soll.' },
  { id: 'k3-zwerg', title: 'Der Zwerg in der Ecke', text: 'Ein Mädchen am Pfeiler hat den Zwerg um Hilfe gebeten. Er hat sie abgewiesen. Im Morgengrauen ritten die Männer nach Osten.' },
  { id: 'k3-wette', title: 'Die Wette', text: 'Die Spielleute haben die Männer prahlen hören: ein neues Dienstmädchen für ihren Hauptmann. Sie wetten, wie lange sie überlebt.' },
  { id: 'k3-fuenf', title: 'Fünf Mann', text: 'An der Theke hat Craupor zu Foltan gesagt: „Fünf Mann. Und das Mädchen bei sich.“' },
  { id: 'k3-schluss-pfeiler', title: 'Schluss: Kyra am Pfeiler', text: 'Die Fasern und der Zwerg passen zusammen: Kyra war hier, in dieser Schankstube, an den Pfeiler gebunden.' },
  { id: 'k3-schluss-stall', title: 'Schluss: Die Nacht im Stall', text: 'Die Kette, der Sack, ihr Haarband: Sie haben Kyra nachts im Stall angekettet. Sie hat gefroren. Aber sie hat gelebt.' },
  { id: 'k3-schluss-hauptmann', title: 'Schluss: Der Hauptmann', text: 'Schminke und Wette: Sie bringen Kyra zu ihrem Hauptmann, als Dienstmädchen. Sie brauchen sie lebend. Noch.' },
  { id: 'k3-schluss-lebt', title: 'Kyra lebt', text: 'Kyra war letzte Nacht hier, in derselben Nacht, in der ich Crios gesehen habe. Im Morgengrauen sind sie nach Osten weiter. Sie lebt.' },
]);

registerLore([
  { id: 'k3-lore-verbannungsfest', title: 'Das Verbannungsfest', text: 'Jeden Sommer feiert Trapas den Sieg der Zehn Götter über ihre Schöpferin Xenovia, die auf den Meeresgrund verbannt wurde. Das Kettengebäck erinnert an die gebrochene Knechtschaft. Foltan findet, es gehe nur noch ums Saufen.' },
  { id: 'k3-lore-bruderschaft', title: 'Die Freie Bruderschaft', text: 'Freischärler, die sich vom Dienst der Fürsten losgesagt haben. Manche aus Idealismus, manche, weil sie nichts mehr zu verlieren haben. Sie jagen die Dunkelschatten. Ihr Lager ist geheim.' },
  { id: 'k3-lore-nach-dunkelhain', title: 'Nach Dunkelhain', text: 'Seit der großen Schlacht steht niemand mehr über den Fürsten. Aus Angst vor den zwei überlebenden Abtrünnigen verkriechen sie sich in ihren Städten und überlassen das Land den Dunkelschatten.' },
  { id: 'k3-lore-rat-der-drei', title: 'Der Rat der Drei (Gerücht)', text: 'Ein Händler erzählt vom Rat der Drei in Trapas. Sein Großmeister sei verrückt geworden und jage fremde Kulte, statt die Höfe zu schützen.' },
  { id: 'k3-lore-alana', title: 'Alana und Riccard', text: 'Das berühmte Zaubererpaar aus Lias Buch. Sie forschten an der Magierakademie von Imandur und wurden im Jahre 256 vor Dunkelhain in den Rat der Zehn aufgenommen.' },
  { id: 'k3-lore-speikraut', title: 'Speikraut', text: 'Aus Cronibus großem Kräuterlexikon: ein Knöterichgewächs von Wiesen und Waldrändern. Es löst heftiges Erbrechen aus und wird nur bei Vergiftungen gegeben.' },
  { id: 'k3-lore-geweih', title: 'Das Geweih Regas', text: 'Kyra hat es durch die Zeltwand gehört: Baris sucht im Auftrag des Meisters ein Geweih in einer Grotte. Seine Späher haben die Grotte nicht gefunden. Jetzt reitet er selbst, mit fünf Mann.' },
]);

registerMemories([
  { id: 'k3-mem-fest', title: 'Zu jung für das Fest', text: 'Jeden Sommer fuhr Vater zum Verbannungsfest nach Trapas. „Dafür bist du noch zu jung“, sagte er. Und brachte uns Kettengebäck mit, noch warm in ein Tuch geschlagen.' },
  { id: 'k3-mem-crios', title: 'Derselbe Stern', text: 'Durch das Stalldach sieht man Crios. Kyra hat hier gelegen, in derselben Nacht, in der ich ihn im Wald gesehen habe. Wir haben denselben Stern angeschaut.' },
  { id: 'k3-mem-lesestunde', title: 'Lesestunden am Küchentisch', text: 'Mutter zeigte mit dem Finger auf die Buchstaben, und ich sprach sie nach. Kyra rannte nach dem dritten Wort hinaus zu den Schweinen.' },
  { id: 'k3-mem-kyra-lektion', title: 'Kyras geschwänzte Lektion', text: 'Kyra: „Wozu lesen, wenn Lia es kann?“ Mutter hatte nur geseufzt. Heute Nacht hätte Kyra viel für einen Blick auf diese Krakel gegeben.' },
]);
