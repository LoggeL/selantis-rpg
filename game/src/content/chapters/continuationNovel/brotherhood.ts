import type { ContinuationChapterDefinition } from '../../../modules/continuation/types';
import { BROTHERHOOD_AREA } from '../../areas/continuationNovel';

export const BROTHERHOOD_CHAPTER = {
  id: 'brotherhood' as const, title: 'Die Freie Bruderschaft', area: BROTHERHOOD_AREA,
  source: [
    'Roman Selantis 2, PDF S. 75-82: Bach und Ferse, Augenbinde, Elnon und Alastir, Lagergemeinschaft, Azars Handwerk und Lias Gang zu Elnon.',
    'Adaption: Lias Fußverletzung bleibt gemäß der bisherigen Spielhandlung ausgelassen. Der Weg mit verbundenen Augen bleibt eine kurze Ankunftserzählung. Schlafplatz und eigener Entschluss sind drei erforderliche Stationen. Beobachtung des belegten Schwerttrainings auf S. 81 und eine einfache Standübung sind freiwillig; die Standübung ist Spielentwurf.',
  ],
  atmosphere: 'warm', music: 'refuge',
  actors: [
    { id: 'azar', name: 'Azar', texture: 'azar-walk', frame: 0, at: [155, 155] },
    { id: 'foltan', name: 'Foltan', texture: 'foltan-walk', frame: 0, at: [497, 148], hideFlags: ['novel.brotherhood-welcomed'] },
    { id: 'elnon', name: 'Elnon', texture: 'elnon-idle', frame: 0, at: [534, 145], hideFlags: ['novel.brotherhood-welcomed'] },
  ],
  entry: [
    { id: 'novel.brotherhood.morning-stream', line: 'Am Morgen wäscht Lia sich am Bach. Azar ruft sie zum Aufbruch.' },
    { id: 'novel.brotherhood.blindfold-rule', line: 'Azar: "Du musst eine Augenbinde tragen. Niemand von außerhalb soll unser Lager finden. Ich führe dich."' },
    { id: 'novel.brotherhood.blindfold-walk', line: 'Über trockene Erde und Wurzeln hält Azar sie vorsichtig auf dem Weg. Erst zwischen fremden Stimmen nimmt Foltan ihr die Binde ab.' },
    { id: 'novel.brotherhood.first-sight', line: 'Lia blinzelt. Menschen, Elfen und Zwerge stehen zwischen kleinen Zelten. Hinter ihnen ragen eine Palisade und Wachtürme auf.' },
  ],
  actions: [
    {
      id: 'elnon-welcome', label: 'Elnon begegnen', at: [512, 174], radius: 24,
      completionFlag: 'novel.brotherhood-welcomed',
      beats: [
        { id: 'novel.brotherhood.elnon-arrives', line: 'Ein schwarzhaariger Elf in einer grünen Tunika tritt aus dem großen Zelt. Neben ihm geht ein silberhaariger Elf mit einer Brandnarbe.' },
        { id: 'novel.brotherhood.elnon-asks-delay', line: 'Elnon: "Ihr habt euch Zeit gelassen, Foltan. Ich warte auf euren Bericht."' },
        { id: 'novel.brotherhood.foltan-explains-lia', line: 'Foltan: "Dunkelschatten haben ihren Hof überfallen. Wir konnten sie nicht im Wald zurücklassen."' },
        { id: 'novel.brotherhood.elnon-orders', line: 'Elnon: "Wir helfen den Schutzlosen. Foltan, du kommst mit mir. Azar, zeig ihr einen Schlafplatz."' },
        { id: 'novel.brotherhood.lia-waits', line: 'Schon wenden sie sich zum Zelt. Lia bleibt bei Azar. Sie hat noch gar nicht nach Kyra fragen können.' },
      ],
    },
    {
      id: 'azar-shelter', label: 'Azar zum gemeinsamen Zelt folgen', at: [154, 180], radius: 25,
      requires: ['novel.brotherhood-welcomed'], completionFlag: 'novel.brotherhood-shelter-shown',
      disabledHint: 'Elnon begrüßt die Rückkehrenden zuerst.',
      beats: [
        { id: 'novel.brotherhood.azar-shares-tent', line: 'Azar: "Das ist Foltans und mein Zelt. Für dich richten wir hier auch etwas ein."' },
        { id: 'novel.brotherhood.lia-asks-elnon', line: 'Lia: "Wer ist Elnon?"' },
        { id: 'novel.brotherhood.elnon-history', line: 'Azar: "Unser gewählter Anführer. Er war Hauptmann der Garde von Ebaril, bevor die Dunkelschatten die Stadt niederbrannten. Viele Elfen hier haben die Belagerung überlebt."' },
        { id: 'novel.brotherhood.lia-sees-soldiers', line: 'An der Palisade klirren Übungsschwerter. Die Kämpfer tragen die Farben von Trapas, Moneda und Ebaril. Lia kennt sie bisher nur aus Büchern.' },
        { id: 'novel.brotherhood.azar-smith-place', line: 'Azar: "Ich halte mit ihnen im Kampf kaum mit. Aber jeder Kämpfer braucht einen Schmied. Kettenpanzer flicken, Klingen schärfen, Helme ausbeulen. Hier werde ich gebraucht."' },
      ],
    },
    {
      id: 'seek-elnon', label: 'Elnons Zelt aufsuchen', at: [490, 198], radius: 23,
      requires: ['novel.brotherhood-shelter-shown'], completionFlag: 'novel.elnon-sought',
      disabledHint: 'Azar zeigt Lia zuerst ihren Platz im Lager.',
      beats: [
        { id: 'novel.brotherhood.lia-declines-food', line: 'Azar bietet ihr Brot an. Lia schüttelt den Kopf. "Ich möchte mich noch etwas umsehen."' },
        { id: 'novel.brotherhood.azar-warns', line: 'Azar: "Verlauf dich nicht. Komm wieder, damit wir deinen Schlafplatz einrichten können."' },
        { id: 'novel.brotherhood.lia-wants-report', line: 'Vielleicht hat ein Spähtrupp Kyra gesehen. Dann muss Elnon es wissen. Lia geht zwischen den Zelten auf die größere Plane zu.' },
      ],
    },
    {
      id: 'training-observation', label: 'Freiwillig beim Schwerttraining zusehen', at: [422, 161], radius: 23,
      requires: ['novel.brotherhood-shelter-shown'], completionFlag: 'novel.training-observed',
      beats: [
        { id: 'novel.brotherhood.training-footwork', line: 'Zwei Rebellen üben an der Palisade. Lia schaut auf ihre Füße: Sie stehen versetzt und halten Abstand, statt blind aufeinander einzuschlagen.' },
        { id: 'novel.brotherhood.training-try-stance', line: 'Ohne eine Waffe zu ziehen, stellt Lia ihre Füße ebenso auf. Ihr Gewicht liegt sicherer. Mehr nimmt sie sich heute nicht vor. Sie muss nach Kyra fragen.' },
      ],
    },
    {
      id: 'camp-trades', label: 'Die Arbeiten im Lager beobachten', at: [254, 159], radius: 22,
      completionFlag: 'novel.brotherhood-trades-seen',
      beats: [
        { id: 'novel.brotherhood.camp-work', line: 'An den Feuern wird Suppe gekocht. Andere pflegen ihre Ausrüstung, während die Wachen von den Türmen ins Umland sehen. Dieses Lager hält mehr zusammen als Schwerter.' },
      ],
    },
  ],
  exit: {
    label: 'Vor Elnons Zelt nach Kyra fragen', at: [553, 148], radius: 23,
    requires: ['novel.elnon-sought'], to: 'betrayal',
  },
} satisfies ContinuationChapterDefinition;
