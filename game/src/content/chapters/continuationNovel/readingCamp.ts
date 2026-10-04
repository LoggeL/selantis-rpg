import type { ContinuationChapterDefinition } from '../../../modules/continuation/types';
import { READING_CAMP_AREA } from '../../areas/continuationNovel';

export const READING_CAMP_CHAPTER = {
  id: 'reading-camp' as const, title: 'Ein Versprechen am Feuer', area: READING_CAMP_AREA,
  source: [
    'Roman Selantis 2, PDF S. 60-62 und 65-67: geschützte Feuerstelle, Lias Lesekunst, Speikraut, Alana und Riccard, Trauer und beide Versprechen.',
    'Roman PDF S. 75-77: Morgenwäsche, heilende Ferse und Augenbinde auf dem Weg zur Bruderschaft.',
    'Adaption: Die erzählte Feuerstelle und Lesereihenfolge sind vier Interaktionen. Der morgendliche Aufbruch wird beim Verlassen des Lagers verdichtet. Die parallel erzählten Gefangenenszenen werden nicht spielbar.',
  ],
  atmosphere: 'night', music: 'exploration',
  actors: [
    { id: 'foltan', name: 'Foltan', texture: 'foltan-walk', frame: 0, at: [355, 244] },
    { id: 'azar', name: 'Azar', texture: 'azar-walk', frame: 8, at: [252, 260] },
    { id: 'reading-fire-ring', name: 'Feuerstelle', texture: 'camp-fire-ring-detailed', at: [317, 238], displaySize: [50, 27], requires: ['novel.reading-fire-ready'] },
    { id: 'reading-logs', name: 'Feuerholz', texture: 'camp-logs-detailed', at: [317, 238], displaySize: [32, 26], requires: ['novel.reading-fire-ready'] },
    { id: 'reading-fire', name: 'Lagerfeuer', texture: 'camp-fire-detailed', at: [317, 225], displaySize: [24, 47], requires: ['novel.reading-fire-ready'] },
  ],
  entry: [
    { id: 'novel.reading-camp.shelter', line: 'Abseits der Handelsstraße schlagen sie ihr Lager auf. Der Waldboden ist trocken. Foltan trägt dünne Äste heran, während Azar mit dem Feuerstein ringt.' },
    { id: 'novel.reading-camp.lia-hope', line: 'Lia: "Ich hatte gehofft, im Eber etwas über Kyra zu hören."' },
    { id: 'novel.reading-camp.azar-hope', line: 'Azar: "Hoffnung ist wichtig. Sonst wären wir gar nicht erst losgezogen."' },
  ],
  actions: [
    {
      id: 'safe-fire', label: 'Die Steine um das Feuer zurechtrücken', at: [343, 263], radius: 22,
      completionFlag: 'novel.reading-fire-ready',
      beats: [
        { id: 'novel.reading-camp.stone-ring', line: 'Lia schließt den Steinring um die Feuerstelle. Ein Funke soll nicht das trockene Laub erreichen.', cue: { type: 'crouch', enabled: true } },
        { id: 'novel.reading-camp.fire-catches', line: 'Beim fünften Versuch fängt Azars Zunder endlich Feuer. Foltan setzt sich ihnen gegenüber.', cues: [
          { type: 'crouch', enabled: false },
          { type: 'show', actor: 'reading-fire-ring' },
          { type: 'show', actor: 'reading-logs' },
          { type: 'show', actor: 'reading-fire' },
        ] },
        { id: 'novel.reading-camp.reading-question', line: 'Foltan: "Du kennst solche Redewendungen aus Büchern? Kannst du etwa lesen?"' },
        { id: 'novel.reading-camp.reading-answer', line: 'Lia: "Ja. Meine Mutter hat es mir beigebracht. Ich zeige es euch."' },
      ],
    },
    {
      id: 'herb-lexicon', label: 'Cronibus großes Kräuterlexikon aufschlagen', at: [230, 283], radius: 22,
      requires: ['novel.reading-fire-ready'], completionFlag: 'novel.herb-lexicon-read',
      disabledHint: 'Am Feuer werden die Männer auf Lias Bücher aufmerksam.',
      beats: [
        { id: 'novel.reading-camp.lexicon-open', line: 'Lia schlägt Cronibus großes Kräuterlexikon auf. Ihr Finger bleibt bei "Speikraut" stehen.' },
        { id: 'novel.reading-camp.lexicon-speikraut', line: 'Lia liest den Eintrag vor. Das Kraut wächst auf Wiesen und am Waldrand. Es verursacht Übelkeit und Erbrechen. Das Buch beschreibt seine Verwendung bei Vergiftungen.' },
        { id: 'novel.reading-camp.lexicon-proves-skill', line: 'Lia: "Soll ich weiterlesen, oder glaubt ihr mir jetzt?"' },
        { id: 'novel.reading-camp.foltan-cannot-read', line: 'Foltan: "Ich bin beeindruckt. Sei uns nicht böse. Wir können beide nicht lesen."' },
        { id: 'novel.reading-camp.azar-asks-story', line: 'Azar: "Vielleicht hätte ich mit dieser Kunst weniger Schulden gemacht. Liest du uns noch etwas vor?"' },
      ],
    },
    {
      id: 'alana-story', label: 'Aus den Geschichten der Magierin Alana lesen', at: [289, 263], radius: 21,
      requires: ['novel.herb-lexicon-read'], completionFlag: 'novel.alana-read',
      disabledHint: 'Lia zeigt den beiden zuerst, dass sie lesen kann.',
      beats: [
        { id: 'novel.reading-camp.alana-ending', line: 'Lia liest vom Ende des Abenteuers: Alana und Riccard vertreiben den Dämon gemeinsam. In Imandur forschen sie an der Magierakademie, bevor sie in den Rat der Zehn berufen werden.' },
        { id: 'novel.reading-camp.alana-azar-dreams', line: 'Azar: "Eine schöne Geschichte. Wenn es im Leben doch auch so zuginge."' },
        { id: 'novel.reading-camp.alana-foltan-doubts', line: 'Foltan: "Das Zaubererpaar gab es. Aber ob alle diese Abenteuer stimmen?"' },
        { id: 'novel.reading-camp.alana-lia-defends', line: 'Lia: "Vorn im Buch steht, dass die Geschichte auf wahren Begebenheiten beruht."' },
        { id: 'novel.reading-camp.alana-stars', line: 'Azar: "Vielleicht sitzen sie noch immer zusammen dort oben auf den Sternen." Er schaut über das Feuer in den Himmel.' },
      ],
    },
    {
      id: 'parents-and-promise', label: 'Über die Eltern sprechen und ein Versprechen verlangen', at: [383, 273], radius: 22,
      requires: ['novel.alana-read'], completionFlag: 'novel.companions-promised',
      flags: { 'novel.azar-promised': true, 'novel.foltan-promised': true },
      disabledHint: 'Die Geschichte bringt das Gespräch auf die Sterne und die Verstorbenen.',
      beats: [
        { id: 'novel.reading-camp.parents-question', line: 'Lia: "Meint ihr, meine Eltern sind auch dort oben?"' },
        { id: 'novel.reading-camp.parents-comfort', line: 'Azar: "Vielleicht auf dem Stern neben Alana und Riccard. Vielleicht wachen sie über dich."' },
        { id: 'novel.reading-camp.lia-grief', line: 'Lia: "Ich hatte kaum Zeit zu trauern. Manchmal fällt mir erst wieder ein, dass sie nicht mehr da sind. Ich fühle mich allein. Aber Kyra hat doch auch niemanden mehr."' },
        { id: 'novel.reading-camp.lia-needs-word', line: 'Lia: "Nehmt ihr mich ernst? Bitte versprecht mir, dass ihr mir helft, sie zu finden."' },
        { id: 'novel.reading-camp.azar-promises', line: 'Azar: "Ich verspreche es dir."' },
        { id: 'novel.reading-camp.azar-insists', line: 'Azar: "Du auch, Foltan. Sag es ihr."' },
        { id: 'novel.reading-camp.foltan-promises', line: 'Foltan: "Ich verspreche es dir auch."' },
        { id: 'novel.reading-camp.lia-not-alone', line: 'Azar: "Du bist nicht mehr allein, Lia." Für einen Moment kann sie die Schultern sinken lassen.' },
      ],
    },
    {
      id: 'mother-reading-memory', label: 'An Mutters Lesestunden denken', at: [155, 204], radius: 23,
      completionFlag: 'novel.mother-reading-remembered',
      beats: [
        { id: 'novel.reading-camp.mother-reading', line: 'Die Buchstaben sind noch dieselben wie zu Hause. Mutter hat sie ihr beigebracht. Lia streicht über den Einband und legt das Buch wieder sicher in ihren Beutel.' },
      ],
    },
  ],
  exit: {
    label: 'Am Morgen mit den beiden zur Bruderschaft gehen', at: [532, 283], radius: 24,
    requires: ['novel.companions-promised'], to: 'brotherhood',
  },
} satisfies ContinuationChapterDefinition;
