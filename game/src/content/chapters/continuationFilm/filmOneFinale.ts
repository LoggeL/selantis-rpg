import type { ContinuationChapterDefinition } from '../../../modules/continuation/types';
import { FILM_ONE_FINALE_AREA } from '../../areas/continuationFilm';

export const FILM_ONE_FINALE: ContinuationChapterDefinition = {
  id: 'film-one-finale', title: 'Ein gemeinsamer Weg', area: FILM_ONE_FINALE_AREA,
  source: ['docs/episode-01.md:18:50-20:17', 'sources/transcripts/01-3PNiiK653uQ.txt:19:18-20:17', 'ADAPTION: lia-film-role; walkable-actions; unhealed-betrayal'],
  atmosphere: 'warm', music: 'exploration',
  actors: [
    { id: 'flick', name: 'Flick', texture: 'flick-walk', at: [90, 190], follow: true },
    { id: 'kyra', name: 'Kyra', texture: 'story-actors', frame: 0, at: [70, 185], follow: true },
  ],
  entry: [
    { id: 'film-one-finale.entry.ruin', line: 'Andernorts, an der Ruine, steht Vardis vor einer schwarzen Kapuzengestalt.', shot: 'cinematic-master-rebuke' },
    { id: 'film-one-finale.entry.failure', line: 'Die Kapuzengestalt sagt "Du hast versagt, Vardis."' },
    { id: 'film-one-finale.entry.admission', line: 'Vardis: Ja, Meister.' },
    { id: 'film-one-finale.entry.wrong', line: 'Die Kapuzengestalt sagt "Du hattest von Anfang an die Falsche."' },
    { id: 'film-one-finale.entry.punishment', line: 'Vardis krümmt sich und geht zu Boden. Die Gestalt sieht auf ihn herab.' },
    { id: 'film-one-finale.entry.warning', line: 'Die Kapuzengestalt sagt "Beim nächsten Mal bin ich nicht so nachsichtig."' },
    { id: 'film-one-finale.entry.forest', line: 'Auf dem Waldweg hält Kyra ihre Schwester am Arm. Flick wartet, bis beide zu ihr aufgeschlossen haben.' },
  ],
  actions: [
    { id: 'support-kyra', label: 'Mit Kyra ein Stück abseits des Lagers gehen', at: [180, 216], radius: 25, completionFlag: 'film.sisters-safe-path', beats: [
      { id: 'film-one-finale.path.tired', line: 'Kyra: Langsam. Dir zittern noch die Beine.' },
      { id: 'film-one-finale.path.together', line: 'Lia: Ich möchte nur nicht wieder stehen bleiben. Komm mit.' },
      { id: 'film-one-finale.path.answer', line: 'Kyra: Wohin du gehst, gehe ich jetzt auch.' },
    ] },
    { id: 'ask-next-way', label: 'Flick nach dem nächsten Weg fragen', at: [354, 214], radius: 26, requires: ['film.sisters-safe-path'], completionFlag: 'film.rebels-proposed', beats: [
      { id: 'film-one-finale.rebels.question', line: 'Lia: Und was machen wir jetzt?' },
      { id: 'film-one-finale.rebels.offer', line: 'Flick: Ich bringe euch zu den Rebellen. Vielleicht wissen sie, was diese Kraft in dir ist.' },
      { id: 'film-one-finale.rebels.betrayal', line: 'Lia: Foltan wusste mehr, als er mir gesagt hat. Dass ich Hilfe brauche, macht seine Lüge nicht besser.' },
      { id: 'film-one-finale.rebels.need', line: 'Lia: Aber ich will wissen, was mit mir passiert ist. Und Kyra kommt mit.' },
      { id: 'film-one-finale.rebels.agreement', line: 'Flick: Klar. Wir gehen zusammen.' },
    ] },
    { id: 'walk-together', label: 'Mit beiden den Waldpfad entlanggehen', at: [534, 182], radius: 25, requires: ['film.rebels-proposed'], completionFlag: 'film.final-banter', beats: [
      { id: 'film-one-finale.banter.adventure', line: 'Flick: Das klingt doch nach Abenteuer.' },
      { id: 'film-one-finale.banter.lia', line: 'Lia: Ich dachte, das hätten wir gerade hinter uns.' },
      { id: 'film-one-finale.banter.kyra', line: 'Lia: Vielleicht nehmen die Rebellen dich diesmal auf.' },
      { id: 'film-one-finale.banter.team', line: 'Flick: Jetzt haben wir gesehen, was wir zusammen schaffen. Wir sind ein richtig gutes Team, und überhaupt...' },
      { id: 'film-one-finale.banter.name', line: 'Lia: Flick?' },
      { id: 'film-one-finale.banter.yes', line: 'Flick: Ja?' },
      { id: 'film-one-finale.banter.last', line: 'Lia: Beruhig dich mal.' },
    ] },
  ],
  exit: { label: 'Gemeinsam weitergehen', at: [607, 156], radius: 23, requires: ['film.final-banter'], to: 'title', completionFlag: 'film.film-one-complete' },
  end: { title: 'Ende des ersten Teils', text: 'Kyra ist frei. Lia kann die Kraft in sich noch nicht erklären. Zusammen mit Flick gehen die Schwestern den Weg zu den Rebellen.', titleTo: 'title' },
};
