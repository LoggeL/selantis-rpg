import type { ContinuationChapterDefinition } from '../../../modules/continuation/types';
import { SHADOW_CAMP_AREA } from '../../areas/continuationFilm';

export const SHADOW_CAMP: ContinuationChapterDefinition = {
  id: 'shadow-camp', title: 'Das Gefangenenlager', area: SHADOW_CAMP_AREA,
  source: ['docs/episode-01.md:14:37-17:00', 'sources/transcripts/01-3PNiiK653uQ.txt:15:09-17:01', 'ADAPTION: baris-vardis-transfer; walkable-actions'],
  atmosphere: 'wind', music: 'dread',
  actors: [
    { id: 'flick', name: 'Flick', texture: 'flick-walk', displaySize: [44, 44], at: [86, 233] },
    { id: 'kyra', name: 'Kyra', texture: 'story-actors', frame: 1, bound: true, at: [592, 140] },
    { id: 'captain', name: 'Vardis', texture: 'warrior', at: [492, 183] },
    { id: 'guard', name: 'Wache', texture: 'raid-spearman', at: [124, 139] },
  ],
  entry: [
    { id: 'shadow-camp.entry.hill', line: 'Unterhalb des Hangs lagern Bewaffnete. Am Baum sitzt eine gefesselte junge Frau. Lia erkennt Kyra.', cue: { type: 'crouch', enabled: true } },
    { id: 'shadow-camp.entry.caution', line: 'Flick: Bleib unten. Bevor sie uns sehen, müssen wir wissen, wie wir an sie herankommen.' },
  ],
  actions: [
    { id: 'listen-to-guards', label: 'In Deckung das Wachgespräch belauschen', at: [83, 248], radius: 23, completionFlag: 'film.transport-known', beats: [
      { id: 'shadow-camp.listen.transfer', line: 'Eine Wache sagt "Baris hat sie uns für den Weitertransport überlassen. Sein Trupp folgt dem Weg zur Grotte. Irgendetwas mit einem Geweih."' },
      { id: 'shadow-camp.listen.command', line: 'Eine Wache sagt "Hier hat Hauptmann Vardis das Kommando. Also lasst die Gefangene in Ruhe."' },
      { id: 'shadow-camp.listen.value', line: 'Vardis: Ihr wird kein Haar gekrümmt. Ihr Leben ist mehr wert als eures. Habe ich mich klar ausgedrückt?' },
      { id: 'shadow-camp.listen.alive', line: 'Lia flacht die Hand auf die Erde. Kyra ist am Leben. Sie muss nur bis zu ihr kommen.' },
    ] },
    { id: 'scout-tree-route', label: 'Vom Hang den verdeckten Weg zum Baum prüfen', at: [117, 258], radius: 24, requires: ['film.transport-known'], completionFlag: 'film.camp-route', beats: [
      { id: 'shadow-camp.route.tree', line: 'Zwischen Gebüsch und Baum bleibt ein schmaler Streifen außer Sicht. Eine Wache steht näher bei der Kiste mit den Waffen.', cue: { type: 'move', actor: 'flick', to: [73, 248] } },
      { id: 'shadow-camp.route.flick', line: 'Flick: Am Rand der Ruine komme ich an den Baum. Aber nur, wenn sie alle in deine Richtung sehen.', cue: { type: 'hide', actor: 'flick' } },
      { id: 'shadow-camp.route.lia', line: 'Lia: Du willst, dass ich da einfach hingehe?' },
    ] },
    { id: 'agree-rescue-plan', label: 'Mit Flick die Ablenkung verabreden', at: [150, 266], radius: 25, requires: ['film.camp-route'], completionFlag: 'film.rescue-plan', beats: [
      { id: 'shadow-camp.plan.priority', line: 'Flick: Erst lösen wir deine Schwester. Solange sie sie haben, können sie uns mit ihr drohen.' },
      { id: 'shadow-camp.plan.hesitation', line: 'Lia: Kann das bitte jemand anders übernehmen?' },
      { id: 'shadow-camp.plan.answer', line: 'Flick: Siehst du hier noch jemanden? Halte sie im Gespräch. Den Rest mache ich.' },
      { id: 'shadow-camp.plan.market', line: 'Lia: Dann frage ich nach dem Markt. Nach einem Weg. Irgendwas werde ich sagen können.' },
    ] },
    { id: 'market-distraction', label: 'Vortreten und nach dem Weg zum Markt fragen', at: [424, 216], radius: 23, requires: ['film.rescue-plan'], completionFlag: 'film.guards-distracted', beats: [
      { id: 'shadow-camp.market.step', line: 'Lia tritt aus der Deckung. Hinter den Wachen bewegt sich Flick lautlos zum Baum.', cues: [{ type: 'crouch', enabled: false }, { type: 'move', actor: 'flick', to: [572, 151] }, { type: 'move', actor: 'guard', to: [447, 207] }] },
      { id: 'shadow-camp.market.question', line: 'Lia: Hallo. Ich suche den Weg zum Markt. Ich möchte dort etwas verkaufen. Könnt ihr mir helfen?' },
      { id: 'shadow-camp.market.goods', line: 'Eine Wache sagt "Du hast doch gar nichts zum Verkaufen dabei."' },
      { id: 'shadow-camp.market.stall', line: 'Lia: Das hole ich noch. Ich wollte erst wissen, ob ich richtig bin.' },
      { id: 'shadow-camp.market.suspicion', line: 'Eine Wache sagt "Du hältst uns wohl für blöd. Raus mit der Sprache!"' },
      { id: 'shadow-camp.market.signal', line: 'Flick hebt hinter der Wache kurz den Kopf. Kyra sieht ihre Schwester. Lia darf jetzt nicht zurückweichen.', cue: { type: 'show', actor: 'flick' } },
    ] },
  ],
  exit: { label: 'Bei Kyra bleiben und Flick die Fesseln lösen lassen', at: [460, 204], radius: 22, requires: ['film.guards-distracted'], to: 'sisters-reunited' },
};
