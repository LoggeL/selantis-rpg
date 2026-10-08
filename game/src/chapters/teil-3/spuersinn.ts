// Lia's Spürsinn (Spurenblick, hold Q) in every place of Teil III where it makes sense (user request 2026-10-09): one or
// two hidden things per place that only the Spurenblick shows. They never block the story; several of them quietly
// point at what the player will learn later (the doctor works for Vamir, Kyra knows the order house, the trap). Places
// where Lia cannot use it (bound, before the Großmeister, inside herself, at Ignatius' side) say so with a short
// thought (MapDef.lookBlocked). Pure data; the maps spread these in.
import { registerClues } from '../../core/catalog';
import type { ClueDef } from '../../world';

registerClues([
  {
    id: 'e3-spur-zeichen', title: 'Ein Zeichen in Kreide',
    text: 'Am Brunnen in Trapas, fast weggewischt: ein Kreis mit einem Strich. Genau so ein Zeichen war auf den Wagen der Dunkelschatten gemalt.',
  },
  {
    id: 'e3-spur-staub', title: 'Violetter Staub',
    text: 'In der Bibliothek des Ordens, auf dem Pult, wo das alte Buch lag: Krümel wie von violettem Siegellack. Und später derselbe Staub vor dem Zimmer des Doktors.',
  },
  {
    id: 'e3-spur-nass', title: 'Nasse Fußspuren im Ordenshaus',
    text: 'Schmale, nasse Abdrücke von der Kellertreppe herauf, mitten am Tag. Jemand kennt einen Weg ins Haus, den die Wachen nicht kennen.',
  },
]);

/** e3-lichtwald, the clearing with the willow (e3-eigener-stab). */
export const LICHTWALD_CLUES: ClueDef[] = [
  {
    id: 'sp-kerben', at: [770, 322], kind: 'mark', verb: 'Ansehen',
    thought: 'Alte Kerben in einem Stein am Weidenrand. Zehn Striche im Kreis, und einer in der Mitte. Wer ritzt so etwas mitten in den Wald?',
  },
];

/** e3-landstrasse, the road to Trapas (e3-paladine, part 1). */
export const LANDSTRASSE_CLUES: ClueDef[] = [
  {
    id: 'sp-hufe', at: [480, 380], kind: 'hoof', angle: 180,
    thought: 'Hufspuren, frisch. Alle Eisen gleich, mit einem Kreuz im Abdruck. Räuber reiten nicht so ordentlich. Soldaten schon.',
  },
];

/** e3-trapas, between the gate and the smithy (e3-paladine, part 2, on the leash). */
export const TRAPAS_CLUES: ClueDef[] = [
  {
    id: 'sp-kreide', at: [592, 380], kind: 'mark', verb: 'Ansehen', clue: 'e3-spur-zeichen',
    thought: 'Kreide an der Brunnenmauer, halb weggewischt: ein Kreis mit einem Strich. Das hab ich schon mal gesehen. Auf den Wagen der Dunkelschatten.',
  },
];

/** e3-ordenshaus by day (e3-macht-und-schutz, the hub). */
export const ORDENSHAUS_CLUES: ClueDef[] = [
  {
    id: 'sp-pult', at: [176, 236], kind: 'mark', verb: 'Ansehen', clue: 'e3-spur-staub',
    thought: 'Am Fuß des Pults: violette Krümel, wie von Siegellack. Violett. Ausgerechnet. Ich mag diese Farbe nicht mehr.',
  },
  {
    id: 'sp-nass', at: [1120, 440], kind: 'footprint', angle: 270, clue: 'e3-spur-nass',
    thought: 'Nasse Abdrücke, schmal, fast trocken. Sie kommen von der Kellertreppe herauf. Wer geht mittags durch den Keller und wird dabei nass?',
  },
];

/** e3-keller, the water channel (e3-kyras-fluchtweg). */
export const KANAL_CLUES: ClueDef[] = [
  {
    id: 'sp-feile', at: [940, 372], kind: 'mark', verb: 'Ansehen',
    thought: 'Die Gitterstäbe sind unten frisch angefeilt. Der Feilstaub glänzt noch im Wasser. Das war nicht vor Jahren. Das war gestern.',
  },
];

/** e3-waldrast, the morning path (e3-vertraute-schwester). */
export const WALDRAST_CLUES: ClueDef[] = [
  {
    id: 'sp-naegel', at: [270, 300], kind: 'footprint', angle: 90,
    thought: 'Stiefelspuren mit Nagelmuster, ins Dickicht und zurück. Nicht Kyras. Kyra sagt, sie hat nichts gehört. Ich bin bestimmt nur müde.',
  },
];

/** e3-trapas, the square before the ceremony (e3-hueterin). */
export const PLATZ_CLUES: ClueDef[] = [
  {
    id: 'sp-doktor', at: [526, 222], kind: 'mark', verb: 'Ansehen', clue: 'e3-spur-staub',
    thought: 'Vor dem Seiteneingang, wo es zum Zimmer des Doktors geht: ein Ring aus violettem Staub. Derselbe wie am Pult. Wer bist du, Doktor?',
  },
];

/** Places where the Spurenblick does not work, and why (short thoughts, barked when Q is pressed). */
export const NO_LOOK = {
  saal: 'Zu viele Augen auf mir. Ich krieg den Kopf nicht frei.',
  gastzimmer: 'Mein Kopf dröhnt noch. Spuren lesen? Später.',
  nacht: 'Zu dunkel, und die Wachen hören jedes Atmen. Lauschen statt suchen.',
  keller: 'Keine Zeit für Spuren. Kyra zieht mich weiter.',
  innen: 'Hier drinnen gibt es keine Spuren. Nur Erinnerungen.',
  gefesselt: 'Gefesselt sehe ich nur das, was vor meiner Nase ist.',
  halle: 'Nicht hier. Nicht vor ihm.',
  abschied: 'Nicht jetzt. Ich will nur ihn sehen.',
  flick: 'Keine Zeit für Fährten. Erst mal weg hier.',
  verhoer: 'Vor dem Großmeister schnüffeln? Lieber nicht.',
} as const;
