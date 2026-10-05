// Kapitel I catalog: speakers that Lia cannot name yet, memories, lore, clues (shared items live in ../common).
import { registerClues, registerLore, registerMemories, registerSpeakers } from '../../core/catalog';
import '../common';

registerSpeakers([
  // Lia does not know their names yet (DESIGN.md §7.2): name bands describe what she sees.
  { id: 'k1-narbige', name: 'Der Narbige', portrait: 'algard', voice: { pitch: 128, wave: 'square' }, color: '#8a7a6a' },
  { id: 'k1-kahle', name: 'Der Kahlgeschorene', portrait: 'maedchen', voice: { pitch: 182, wave: 'square' }, color: '#c08080' },
  { id: 'k1-kapuze', name: 'Der mit der Kapuze', portrait: 'shadow-club', voice: { pitch: 150, wave: 'square' }, color: '#9a9a9a' },
  { id: 'k1-wache', name: 'Wachposten', portrait: 'shadow-sword', voice: { pitch: 120, wave: 'square' }, color: '#c8c8c8' },
]);

registerMemories([
  { id: 'k1-mem-nest', title: 'Das Amselnest', text: 'Als wir sieben waren, fiel ein Amselküken aus der Hecke. Kyra kletterte, ich las vor, was Amseln fressen. Am Ende fütterten wir es mit Regenwürmern – Kyra fing sie, ich gab ihnen Namen.' },
  { id: 'k1-mem-versprechen', title: 'Ehrenwort', text: '„Denk dran, die Schweine zu füttern. Du hast es versprochen.“ – „Darauf kannst du dich verlassen.“ Das waren unsere letzten Worte auf der Wiese.' },
  { id: 'k1-mem-markt', title: 'Vaters Marktfahrten', text: 'Vater fuhr vor Sonnenaufgang mit dem Karren nach Trapas und kam in der Dämmerung zurück. Kyra und ich rannten ihm bis zum Hohlweg entgegen, um zu sehen, was unter der Plane lag.' },
  { id: 'k1-mem-trapas', title: 'Mutters Wahl', text: 'Mutter kam aus einer reichen Händlerfamilie in Trapas. Sie gab alles auf, um mit Vater Rüben zu ziehen. „Ich würde es wieder genauso machen“, sagte sie. Jedes Mal.' },
  { id: 'k1-mem-fest', title: 'Zu jung für das Fest', text: 'Jeden Sommer fuhr Vater zum Verbannungsfest nach Trapas und brachte Kettengebäck mit. „Nächstes Jahr nehme ich euch mit. Dann seid ihr alt genug.“ Nächstes Jahr. Jedes Jahr.' },
  { id: 'k1-mem-ofen', title: 'Winterabende', text: 'Im Winter saßen wir alle am Ofen. Vater schnitzte, Mutter flickte, Kyra wärmte ihre Füße an meinen, und ich las vor, bis die Kerze herunterbrannte.' },
  { id: 'k1-mem-lesen', title: 'Lesestunden', text: 'Jeden Morgen nach dem Frühstück zeigte Mutter auf die Buchstaben. Kyra kippelte, rollte die Augen und schlief einmal fast auf dem Tisch ein. Irgendwann lernte nur noch ich.' },
  { id: 'k1-mem-kuchen', title: 'Honig und Äpfel', text: 'Wenn der Markt gut lief, roch der ganze Karren nach Honig: Vater brachte Honig-Apfelkuchen mit. Mein Lieblingsgebäck. Kyra bekam immer das größere Stück, weil sie mehr gearbeitet hatte.' },
  { id: 'k1-mem-betten', title: 'Zwei Betten', text: 'Kyras Bett: glatt gezogen, die Decke auf Kante. Meins: ein Schlachtfeld. Warum etwas aufräumen, das man abends sowieso wieder zerwühlt?' },
]);

registerLore([
  { id: 'lore-alana', title: 'Alana und Riccard', text: '„Die Geschichten der Magierin Alana“: Alana zieht mit ihrem treuen Gefährten Riccard durch die Lande, verliebt sich in den fahrenden Ritter Balduin und will an Imandurs Magierakademie aufgenommen werden. Lias Lieblingsbuch, von Vaters Marktfahrt nach Trapas.' },
  { id: 'lore-nach-dunkelhain', title: 'Nach Dunkelhain', text: 'Seit die Dunkelschatten vor sechzehn Jahren bei Dunkelhain gesiegt haben, sind die Höfe schutzlos. Die Fürsten verschanzen sich in ihren Reichsstädten und überlassen das Land Räubern und Marodeuren.' },
  { id: 'lore-dunkelschatten', title: 'Dunkelschatten', text: 'Schwarz-weiß geviertelte Wappenröcke, uneinheitlich bewaffnet: Spieß, Axt, Knüppel, Schwert. Räuber, Söldner und bewaffnete Bauern, die bei Dunkelhain für die abtrünnigen Magier kämpften. Lia kannte sie nur aus Büchern.' },
]);

registerClues([
  { id: 'k1-stille', title: 'Verstummte Vögel', text: 'Auf dem Heimweg hörten die Vögel plötzlich auf zu singen. Als hätte etwas sie verscheucht.' },
  { id: 'k1-hufspuren', title: 'Frische Hufspuren', text: 'Beschlagene Pferde, mindestens fünf, eher sechs. Sie kamen von der Hauptstraße und ritten zum Hof. Wir haben kein einziges Pferd.' },
  { id: 'k1-zertrampelt', title: 'Zertrampeltes Korn', text: 'Jemand ist quer durchs Korn geritten. Kein Bauer würde das tun.' },
  { id: 'k1-pferde', title: 'Pferde am Hof', text: 'Vor der Scheune standen fremde Pferde mit schwarzen Satteldecken.' },
  { id: 'k1-spur-osten', title: 'Die Spur der Reiter', text: 'Die Hufspuren führen den Hohlweg hinunter zur Hauptstraße. Sechs Pferde, eins davon trägt schwerer. Kyra.' },
]);
