import type { ContinuationChapterDefinition } from '../../../modules/continuation/types';
import { SISTERS_REUNITED_AREA } from '../../areas/continuationFilm';

export const SISTERS_REUNITED: ContinuationChapterDefinition = {
  id: 'sisters-reunited', title: 'Kyra befreien', area: SISTERS_REUNITED_AREA,
  source: ['docs/episode-01.md:17:10-18:37', 'sources/transcripts/01-3PNiiK653uQ.txt:17:19-18:37', 'ADAPTION: lia-film-role; walkable-actions'],
  music: 'dread',
  actors: [
    { id: 'flick', name: 'Flick', texture: 'flick-walk', at: [572, 151] },
    { id: 'kyra', name: 'Kyra', texture: 'story-actors', frame: 1, at: [592, 140] },
    { id: 'captain', name: 'Vardis', texture: 'warrior', at: [492, 183], hideFlags: ['film.magic-erupted'] },
    { id: 'guard', name: 'Wache', texture: 'raid-spearman', at: [447, 207], hideFlags: ['film.magic-erupted'] },
  ],
  entry: [{ id: 'sisters-reunited.entry.seconds', line: 'Die Wache greift nach ihrer Waffe. Hinter ihr ist Flick schon an Kyras Fesseln. Lia hat nur einen Augenblick.' }],
  actions: [
    { id: 'hold-guards-attention', label: 'Die Wache aufhalten, während Flick Kyra befreit', at: [460, 204], radius: 26, completionFlag: 'film.kyra-unbound', beats: [
      { id: 'sisters-reunited.free.lia', line: 'Lia: Seht mich an. Ich rede mit euch!' },
      { id: 'sisters-reunited.free.flick', line: 'Flick löst den Knebel und schneidet die Fesseln durch. Kyra zieht die Hände an sich.', shot: 'cinematic-sisters-reunion', cues: [{ type: 'move', actor: 'flick', to: [585, 146] }, { type: 'unbind', actor: 'kyra' }] },
      { id: 'sisters-reunited.free.fight', line: 'Die Wache dreht sich um. Flick stellt sich ihr in den Weg und fängt den Schwerthieb ab.', cues: [{ type: 'move', actor: 'flick', to: [550, 167] }, { type: 'move', actor: 'guard', to: [536, 171] }, { type: 'pose', actor: 'guard', angle: -18 }] },
      { id: 'sisters-reunited.free.retreat', line: 'Flick drängt die Wache zurück. Kyra löst sich vom Baum. Vardis wendet sich den Schwestern zu.', cues: [{ type: 'move', actor: 'guard', to: [475, 194] }, { type: 'move', actor: 'kyra', to: [573, 168] }, { type: 'move', actor: 'captain', to: [537, 193] }] },
    ] },
    { id: 'protect-kyra', label: 'Zwischen Kyra und Vardis treten', at: [561, 192], radius: 25, requires: ['film.kyra-unbound'], completionFlag: 'film.magic-erupted', flags: { 'film.lia-collapsed': true }, beats: [
      { id: 'sisters-reunited.burst.captain', line: 'Vardis: Jetzt reicht es. Weg da!', cue: { type: 'move', actor: 'captain', to: [535, 195] } },
      { id: 'sisters-reunited.burst.fear', line: 'Lia breitet die Arme vor Kyra aus. Der Hauptmann kommt immer näher. Sie kann keinen klaren Gedanken fassen.', cue: { type: 'move', actor: 'lia', to: [561, 192] } },
      { id: 'sisters-reunited.burst.light', line: 'Blaues Licht bricht aus Lia hervor. Ein heller Kern flackert darin. Der Stoß schleudert Vardis vom Baum weg.', shot: 'cinematic-magic-awakening', cue: { type: 'burst', target: 'captain', to: [481, 216], color: 0x397fc1, duration: 850 } },
      { id: 'sisters-reunited.burst.collapse', line: 'Dann gibt Lias Körper nach. Sie bricht zusammen.', cue: { type: 'collapse', actor: 'lia' } },
      { id: 'sisters-reunited.burst.care', line: 'Kyra kniet bei ihr. Flick hält die übrigen Bewaffneten fern.', cues: [{ type: 'move', actor: 'kyra', to: [563, 195] }, { type: 'move', actor: 'flick', to: [517, 209] }] },
      { id: 'sisters-reunited.burst.flight', line: 'Vardis taumelt fort. Die Wache zieht sich mit ihm zurück. Niemand verfolgt die Schwestern.', cues: [{ type: 'move', actor: 'captain', to: [335, 135] }, { type: 'hide', actor: 'captain' }, { type: 'hide', actor: 'guard' }] },
    ] },
    { id: 'answer-kyra', label: 'Auf Kyras Stimme antworten', at: [561, 192], radius: 29, requires: ['film.magic-erupted'], completionFlag: 'film.lia-recovered', flags: { 'film.sisters-reunited': true, 'film.lia-collapsed': false, kyraTaken: false }, beats: [
      { id: 'sisters-reunited.care.voice', line: 'Kyra: Lia? Lia, hörst du mich? Bleib bei mir.' },
      { id: 'sisters-reunited.care.wake', line: 'Lia öffnet die Augen. Kyras Hand liegt an ihrer Schulter. Sie braucht einen Moment, bevor sie sich aufrichten kann.', cue: { type: 'recover', actor: 'lia' } },
      { id: 'sisters-reunited.care.question', line: 'Lia: Was ist passiert?' },
      { id: 'sisters-reunited.care.flick', line: 'Flick: Du hast den Hauptmann weggeschleudert. Und die anderen gleich mit vertrieben. Ziemlich beeindruckend.' },
      { id: 'sisters-reunited.care.confused', line: 'Lia: Ich? Aber ich habe gar nichts gemacht. Ich wusste nicht einmal, was ich tun sollte.' },
      { id: 'sisters-reunited.care.sister', line: 'Kyra: Du warst da. Jetzt bin ich hier. Mehr müssen wir gerade nicht schaffen.' },
      { id: 'sisters-reunited.care.touch', line: 'Lia hält Kyras Hand fest. Erst jetzt glaubt sie, dass die Fesseln wirklich fort sind.', shot: 'cinematic-sisters-reunion' },
    ] },
  ],
  exit: { label: 'Mit Kyra und Flick das Lager verlassen', at: [334, 264], radius: 24, requires: ['film.lia-recovered', 'film.sisters-reunited'], to: 'film-one-finale' },
};
