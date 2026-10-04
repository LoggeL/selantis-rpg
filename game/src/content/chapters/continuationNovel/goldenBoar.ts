import type { ContinuationChapterDefinition } from '../../../modules/continuation/types';
import { GOLDEN_BOAR_AREA } from '../../areas/continuationNovel';

export const GOLDEN_BOAR_CHAPTER = {
  id: 'golden-boar' as const, title: 'Zum Goldenen Eber', area: GOLDEN_BOAR_AREA,
  source: [
    'Roman Selantis 2, PDF S. 46-54: Einkehr, Beschreibung Kyras, Craupors Schuld, Foltans Desertion und falsche Auskunft.',
    'Adaption: Vier Gespräche werden zu frei anlaufbaren Stationen im Gastraum; Craupors Auskunft bleibt außerhalb von Lias Hörweite. Die Kriegsgeschichte ist ein freiwilliger Nachtrag nach Foltans Rückkehr. Die zusätzlichen kurzen Wirt- und Musikbeobachtungen sind Spieltext.',
  ],
  atmosphere: 'warm', music: 'refuge',
  actors: [
    { id: 'foltan', name: 'Foltan', texture: 'foltan-walk', frame: 8, at: [288, 135] },
    { id: 'azar', name: 'Azar', texture: 'azar-walk', frame: 8, at: [230, 136] },
    { id: 'craupor', name: 'Craupor', texture: 'craupor-idle', frame: 0, at: [476, 134] },
  ],
  entry: [
    { id: 'novel.golden-boar.arrival-sign', line: 'Auf dem Schild steht "Zum Goldenen Eber". Azar schiebt die Tür auf. Aus dem Gastraum kommen Stimmen, Trommeln und der Geruch von Eintopf.' },
    { id: 'novel.golden-boar.arrival-seats', line: 'Foltan: "Dort hinten sind noch Plätze. Der Wirt schuldet mir einen Gefallen."' },
  ],
  actions: [
    {
      id: 'sister-description', label: 'Am Tisch von Kyra erzählen', at: [269, 157], radius: 23,
      completionFlag: 'novel.kyra-described',
      beats: [
        { id: 'novel.golden-boar.stew-order', line: 'Azar zieht die dampfende Schüssel näher zu sich. Foltan wartet, bis die Bedienung fort ist.' },
        { id: 'novel.golden-boar.foltan-asks-description', line: 'Foltan: "Kannst du mir deine Schwester beschreiben? Ich frage Craupor, ob die Dunkelschatten hier waren."' },
        { id: 'novel.golden-boar.lia-describes-kyra', line: 'Lia: "Ungefähr so groß wie ich. Lange braune Haare. Sie trug ein beiges Kleid."' },
        { id: 'novel.golden-boar.foltan-promises-question', line: 'Foltan: "Ich werde sehen, was sich herausfinden lässt."' },
      ],
    },
    {
      id: 'craupor-questioning', label: 'Foltan zum Tresen nachsehen', at: [445, 163], radius: 23,
      requires: ['novel.kyra-described'], completionFlag: 'novel.craupor-questioned',
      disabledHint: 'Foltan braucht zuerst eine Beschreibung von Kyra.',
      beats: [
        { id: 'novel.golden-boar.craupor-debt', line: 'Foltan: "Craupor hing einmal kopfüber an einem Balken, als meine Leute und ich hier ankamen. Eine Bande hatte den Gastraum zerlegt. Seitdem lässt er mich nicht hungrig gehen."' },
        { id: 'novel.golden-boar.foltan-leaves-table', line: 'Foltan: "Bleibt am Tisch. Ich frage ihn jetzt aus."', cue: { type: 'move', actor: 'foltan', to: [454, 139], duration: 850 } },
        { id: 'novel.golden-boar.craupor-welcome', line: 'Craupor: "Foltan! Gut, dich wiederzusehen. Was gibt es?"' },
        { id: 'novel.golden-boar.craupor-greeting', line: 'Craupor begrüßt Foltan mit beiden Händen. Dann beugen sich die Männer über den Tresen. Zwischen Trommeln und Gelächter versteht Lia ihre Worte nicht.' },
      ],
    },
    {
      id: 'azar-desertion', label: 'Azar nach Foltans Vergangenheit fragen', at: [228, 168], radius: 24,
      requires: ['novel.craupor-questioned'], completionFlag: 'novel.desertion-known',
      disabledHint: 'Azar wartet, bis Foltan beim Wirt ist.',
      beats: [
        { id: 'novel.golden-boar.lia-asks-motive', line: 'Lia: "Warum will Foltan mir helfen? Was hat er davon?"' },
        { id: 'novel.golden-boar.azar-tax-expedition', line: 'Azar: "Seine Einheit sollte Bauern Steuern abnehmen. Sie hatten nichts mehr. Der Hauptmann ließ sie trotzdem schlagen und foltern."' },
        { id: 'novel.golden-boar.azar-refused-order', line: 'Azar: "Dann sollten ihre Frauen und Kinder getötet werden. Foltan weigerte sich. Sein Hauptmann tat es dennoch."' },
        { id: 'novel.golden-boar.azar-left-guard', line: 'Azar: "Auf dem Rückweg verließ Foltan die Garde. Seither will er denen helfen, die er damals nicht schützen konnte."' },
        { id: 'novel.golden-boar.azar-secret', line: 'Azar: "Von mir hast du das natürlich nicht gehört." Lia nickt. Am Tresen richtet Foltan sich auf.' },
      ],
    },
    {
      id: 'foltan-report', label: 'Foltan nach Craupors Auskunft fragen', at: [311, 161], radius: 23,
      requires: ['novel.desertion-known'], completionFlag: 'novel.foltan-false-report',
      disabledHint: 'Foltan spricht noch mit Craupor. Azar möchte dir etwas erzählen.',
      beats: [
        { id: 'novel.golden-boar.foltan-returns', line: 'Foltan kommt an den Tisch zurück. Lia rutscht auf ihrer Bank nach vorn.', cue: { type: 'move', actor: 'foltan', to: [288, 135], duration: 800 } },
        { id: 'novel.golden-boar.lia-asks-trace', line: 'Lia: "Und? Hat er sie gesehen?"' },
        { id: 'novel.golden-boar.foltan-denies-trace', line: 'Foltan: "Nein. Leider nicht."' },
        { id: 'novel.golden-boar.lia-disappointed', line: 'Lia lässt die Hände sinken. Wieder keine Spur. Der Lärm im Gastraum macht sie plötzlich müde.' },
        { id: 'novel.golden-boar.foltan-no-overnight', line: 'Foltan: "Wir ziehen weiter. Hier zu schlafen ist mir zu unsicher. Man weiß nie, wer sonst noch unter diesem Dach liegt."' },
      ],
    },
    {
      id: 'war-history', label: 'Foltan nach der Bruderschaft fragen', at: [340, 167], radius: 21,
      requires: ['novel.foltan-false-report'],
      completionFlag: 'novel.war-history-heard',
      beats: [
        { id: 'novel.golden-boar.foltan-lower-voice', line: 'Foltan: "Leiser. Nicht jeder hier muss wissen, zu wem wir gehören."' },
        { id: 'novel.golden-boar.foltan-broken-council', line: 'Foltan: "Nach der großen Schlacht war der Rat der Zehn zerbrochen. Zwei abtrünnige Zaubermeister blieben. Die Fürsten zogen sich hinter ihre Mauern zurück."' },
        { id: 'novel.golden-boar.foltan-free-brotherhood', line: 'Foltan: "Die Dunkelschatten verheeren das Land. In der Freien Bruderschaft haben wir uns vom Dienst der Hohen losgesagt. Jemand muss den Leuten draußen helfen."' },
      ],
    },
    {
      id: 'festival-memory', label: 'Den Spielleuten zuhören', at: [151, 153], radius: 25,
      completionFlag: 'novel.festival-remembered',
      beats: [
        { id: 'novel.golden-boar.festival-travellers', line: 'Die Spielleute reisen zum Verbannungsfest nach Trapas. Lia kennt die Geschichte: Die Zehn Götter besiegten Xenovia und verbannten sie ins Meer.' },
        { id: 'novel.golden-boar.father-sweet-bread', line: 'Vater brachte ihr von dort Hefegebäck in Kettenform mit. An diesem Tag sollte man sich freuen und einander beschenken, sagte er. Lia schaut in ihre leere Schüssel.' },
      ],
    },
  ],
  exit: {
    label: 'Mit Foltan und Azar ins Nachtlager ziehen', at: [554, 146], radius: 24,
    requires: ['novel.foltan-false-report'], to: 'reading-camp',
  },
} satisfies ContinuationChapterDefinition;
