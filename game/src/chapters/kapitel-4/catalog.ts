// Kapitel IV „Die Freie Bruderschaft“: speakers, lore, memories and clues of this chapter (ids prefixed k4-).
// Shared items/abilities (ausweichen, ablenken, tincture, ribbon …) live in chapters/common.
import { registerClues, registerLore, registerMemories, registerSpeakers } from '../../core/catalog';

registerSpeakers([
  { id: 'k4-lia', name: 'Lia', portrait: 'lia-cloak', voice: { pitch: 330, wave: 'triangle' }, color: '#d98b5f' },
  { id: 'k4-ilvy', name: 'Ilvy', portrait: 'elf-f', voice: { pitch: 300, wave: 'sine' }, color: '#7fb37a' },
  { id: 'k4-gundrik', name: 'Gundrik', portrait: 'dwarf', voice: { pitch: 92, wave: 'square' }, color: '#b0563e' },
  { id: 'k4-berta', name: 'Berta', portrait: 'villager-f', voice: { pitch: 250, wave: 'triangle' }, color: '#b9876a' },
  { id: 'k4-jorin', name: 'Jorin', portrait: 'villager-m', voice: { pitch: 185, wave: 'triangle' }, color: '#a4875f' },
  { id: 'k4-wache', name: 'Torwache', portrait: 'guard-brotherhood', voice: { pitch: 140, wave: 'triangle' }, color: '#b44a4a' },
  { id: 'k4-faelan', name: 'Faelan', portrait: 'elf-m', voice: { pitch: 160, wave: 'sine' }, color: '#8fb0a0' },
]);

registerLore([
  {
    id: 'k4-lore-ebaril', title: 'Ebaril',
    text: 'Die Stadt der Elfen galt als die schönste in ganz Selantis: weiße Brücken, Gärten über dem Fluss. Die Dunkelschatten belagerten sie und brannten sie nieder. Drei Tage stand der Himmel in Flammen. Viele Überlebende kämpfen heute in der Freien Bruderschaft, darunter Elnon, einst Hauptmann der Garde von Ebaril.',
  },
  {
    id: 'k4-lore-destar', title: 'Destar und Rega',
    text: 'Destar ist der Gott der Elfen. Rega, sein weißer Hirsch, trug ihn durch die ersten Wälder. Das Geweih Regas gilt als heilig: Wer es raubt, schändet Destar selbst. Die Elfen sagen, wo Rega das Geweih abwarf, wachsen bis heute keine Dornen.',
  },
  {
    id: 'k4-lore-bruderschaft', title: 'Die Freie Bruderschaft',
    text: 'Menschen aus Trapas, Zwerge aus Moneda, Elfen aus Ebaril: Freischärler, die nicht länger warten, bis die Fürsten ihre Städte verlassen. Ihr Kodex: Niemand wird zurückgelassen, den Schwachen wird geholfen. Ihr gewählter Anführer ist Elnon. Ihr Leitsatz: „Damit es kein zweites Ebaril gibt.“',
  },
  {
    id: 'k4-lore-moneda', title: 'Moneda',
    text: 'Die Zwergenstadt im Gebirge, berühmt für Schmiedekunst und tiefe Schatzkammern. Seit Dunkelhain hält Moneda die Tore geschlossen. Wer von den Zwergen trotzdem kämpfen will, kommt zur Bruderschaft, in Dunkelrot und Gold.',
  },
]);

registerMemories([
  {
    id: 'k4-mem-weiher', title: 'Wasserschlacht am Weiher',
    text: 'Letzten Sommer hat Kyra mich in den Weiher geschubst, mitsamt meinem Buch. Ich habe drei Tage nicht mit ihr geredet. Am vierten hat sie mir die getrockneten Seiten zurückgebracht, jede einzeln geglättet.',
  },
  {
    id: 'k4-mem-stockfechten', title: 'Stockfechten mit Kyra',
    text: 'Kyra hat mit Haselstöcken gegen mich gefochten, Ritterin gegen Bücherwurm. Sie hat immer gewonnen. Nur einmal nicht: als ich mich einfach geduckt habe und sie in den Misthaufen gestolpert ist.',
  },
  {
    id: 'k4-mem-eintopf', title: 'Mutters Linseneintopf',
    text: 'Mutter hat Lorbeer in den Eintopf getan und behauptet, das sei ein Geheimrezept aus Trapas. Vater hat jedes Mal gesagt, er schmecke nach Wald. Und hat jedes Mal drei Teller gegessen.',
  },
]);

registerClues([
  {
    id: 'k4-clue-fuenf', title: 'Fünf Dunkelschatten und eine Gefangene',
    text: 'Foltan wusste es seit dem Goldenen Eber: Craupor hat ihm von einem Trupp aus fünf Dunkelschatten erzählt, mit einer Gefangenen, auf die meine Beschreibung von Kyra passt. Sie sind hinter dem Geweih Regas her. Er hat geschwiegen.',
  },
]);
