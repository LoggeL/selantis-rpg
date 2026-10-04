import type { ContinuationChapterDefinition } from '../../../modules/continuation/types';
import { BETRAYAL_AREA } from '../../areas/continuationNovel';

export const BETRAYAL_CHAPTER = {
  id: 'betrayal' as const, title: 'Das verschwiegene Wissen', area: BETRAYAL_AREA,
  source: [
    'Roman Selantis 2, PDF S. 82-84: Lia nähert sich Elnons Zelt, hört Foltans Bericht über Geweih und Gefangene und wendet sich verletzt ab.',
    'Roman PDF S. 85-90: Foltans Beweggründe, Azars Protest und Suche sowie Foltans spätere Scham sind Männergespräche außerhalb von Lias Wissen. Sie werden hier nicht als Lias Erkenntnis oder spielbarer Perspektivwechsel gezeigt.',
    'Adaption: Lias Rückzug ist ein Gang vom Zelteingang zum Lagerrand. Der Entschluss verbindet den gehörten Bericht mit ihrer Waldflucht; die Regenstation setzt PDF S. 89-90 fort. Foltans Scham bleibt einer nicht spielbaren Erzählerzeile im folgenden Kapitel vorbehalten.',
  ],
  atmosphere: 'night', music: 'dread', actors: [],
  entry: [
    { id: 'novel.betrayal.unwatched-entrance', line: 'Vor Elnons Zelt steht keine Wache. Ein Leinentuch verdeckt den Eingang. Lia hebt die Hand, um sich bemerkbar zu machen. Dann hört sie Foltans Stimme.' },
  ],
  actions: [
    {
      id: 'overhear-report', label: 'An der Zeltplane auf Foltans Worte hören', at: [553, 148], radius: 23,
      completionFlag: 'novel.foltan-lie-heard',
      beats: [
        { id: 'novel.betrayal.foltan-antler-report', line: 'Foltan: "Nach allem, was wir erfahren haben, sind sie hinter dem Geweih her."' },
        { id: 'novel.betrayal.elnon-asks-confidence', line: 'Elnon: "Bist du dir sicher?"' },
        { id: 'novel.betrayal.foltan-trusts-informant', line: 'Foltan: "Mein Informant ist verlässlich. Ich würde ihm mein Leben anvertrauen."' },
        { id: 'novel.betrayal.alastir-outrage', line: 'Eine andere Stimme sagt "Ein Sakrileg. Erst unsere Heimat, nun auch das." Lia hält sich hinter dem Tuch still.' },
        { id: 'novel.betrayal.elnon-five', line: 'Elnon: "Du sagst, dieser Trupp bestand aus fünf Dunkelschatten?"' },
        { id: 'novel.betrayal.foltan-prisoner', line: 'Foltan: "Ja. Sie hatten eine Gefangene. Ich denke, es ist die Schwester des Mädchens, das wir gefunden haben."' },
        { id: 'novel.betrayal.lia-frozen', line: 'Lia kann sich nicht rühren. Im Goldenen Eber hatte er gesagt, Craupor wisse nichts. Dabei hatte er eine Spur.' },
        { id: 'novel.betrayal.lia-remembers-word', line: 'Und gestern am Feuer hatte er es ihr versprochen.' },
      ],
    },
    {
      id: 'leave-brotherhood', label: 'Sich abwenden und zum Lagerrand gehen', at: [132, 267], radius: 24,
      requires: ['novel.foltan-lie-heard'], completionFlag: 'novel.trust-broken',
      flags: { 'novel.lia-leaves-brotherhood': true, 'novel.azar-searching': true },
      disabledHint: 'Hinter der Plane fällt das Wort "Gefangene".',
      beats: [
        { id: 'novel.betrayal.lia-turns-away', line: 'Lia ballt die Fäuste. Sie hat genug gehört. Ohne die Plane zu öffnen, dreht sie sich um.' },
        { id: 'novel.betrayal.lia-walks-camp', line: 'Die Gespräche an den kleinen Feuern gehen weiter. Vorhin war das Lager ein sicherer Ort. Nun will sie nur hinaus.' },
        { id: 'novel.betrayal.lia-keeps-own-promise', line: 'Lia: "Ich werde Kyra finden. Wenn niemand mitkommt, suche ich allein."' },
      ],
    },
    {
      id: 'remember-campfire', label: 'Sich an das Versprechen am Feuer erinnern', at: [493, 288], radius: 22,
      requires: ['novel.foltan-lie-heard'], completionFlag: 'novel.promise-remembered',
      beats: [
        { id: 'novel.betrayal.promise-echo', line: 'Azar hatte Foltan aufgefordert, es laut zu sagen. Lia hört beide Antworten noch genau. Warum hatte Foltan ihr nicht die Wahl gelassen?' },
      ],
    },
  ],
  exit: {
    label: 'Allein in den nächtlichen Wald gehen', at: [58, 232], radius: 24,
    requires: ['novel.trust-broken'], to: 'rain-forest',
  },
} satisfies ContinuationChapterDefinition;
