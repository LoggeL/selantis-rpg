import type { ContinuationChapterDefinition } from '../../../modules/continuation/types';
import { RAIN_FOREST_AREA } from '../../areas/continuationFilm';

export const RAIN_FOREST: ContinuationChapterDefinition = {
  id: 'rain-forest', title: 'Allein im Sommerregen', area: RAIN_FOREST_AREA,
  source: ['Roman Selantis 2.pdf S. 89-90', 'docs/novel-analysis.md:245-251', 'ADAPTION: distant-camp-coda; rain-flick-encounter'],
  atmosphere: 'rain', music: 'grief',
  actors: [{ id: 'flick', name: 'Flick', texture: 'flick-walk', at: [487, 198] }],
  entry: [
    { id: 'rain-forest.entry.alone', line: 'Lia geht weiter, ohne zu wissen, wohin. Hauptsache fort vom Lager. Wenn niemand ihr hilft, wird sie Kyra allein suchen.' },
    { id: 'rain-forest.entry.stars', line: 'Der Wind zerrt an ihren rotblonden Haaren. Wolken nehmen ihr den Mond und die vertrauten Sterne. Aus dem Nieseln wird schwerer Sommerregen.' },
    { id: 'rain-forest.entry.azar', line: 'Im entfernten Lager tritt Azar durchnässt ans Zelt. "Sie ist nirgends zu finden." Er hat die Suche nicht aufgegeben.' },
    { id: 'rain-forest.entry.foltan', line: 'Foltan blickt zu Boden. Vielleicht hat sie irgendwo Schutz gefunden. Die Scham über seine Lüge lässt ihn nicht los.' },
    { id: 'rain-forest.entry.return', line: 'Im Wald läuft Lia der Regen übers Gesicht. Sie hört nur die Äste und ihre eigenen Schritte.' },
  ],
  actions: [
    { id: 'rain-shelter', label: 'Unter den überhängenden Ästen Schutz suchen', at: [157, 198], radius: 24, completionFlag: 'film.rain-shelter', beats: [
      { id: 'rain-forest.shelter.dripping', line: 'Das Laub hält kaum etwas ab. Lia wringt einen Ärmel aus. Ihr Kleid klebt kalt an den Beinen.' },
      { id: 'rain-forest.shelter.betrayal', line: 'Lia (Gedanke): Er hat es gewusst. Die ganze Zeit. Und mich trotzdem weiterlaufen lassen.' },
    ] },
    { id: 'rain-tracks', label: 'Den festeren Boden am Pfad suchen', at: [311, 218], radius: 24, requires: ['film.rain-shelter'], completionFlag: 'film.rain-tracks', beats: [
      { id: 'rain-forest.tracks.footing', line: 'Im aufgeweichten Boden sinkt Lia bis zu den Knöcheln ein. Zwischen den Wurzeln findet sie einen schmalen Pfad.' },
      { id: 'rain-forest.tracks.sound', line: 'Vor ihr knackt ein Zweig. Lia bleibt stehen. Jemand steht zwischen den Bäumen.' },
    ] },
    { id: 'meet-flick', label: 'Die Fremde zwischen den Bäumen ansprechen', at: [475, 205], radius: 26, requires: ['film.rain-tracks'], completionFlag: 'film.flick-met', flags: { 'film.flick-helping': true }, beats: [
      { id: 'rain-forest.flick.introduction', line: 'Flick: Ruhig. Ich wollte dir gerade sagen, dass es da vorn trockenere Stellen gibt. Ich heiße Flick.', shot: 'cinematic-flick-meeting' },
      { id: 'rain-forest.flick.lia', line: 'Lia: Lia. Ich suche meine Schwester. Bewaffnete haben sie mitgenommen.' },
      { id: 'rain-forest.flick.trust', line: 'Flick: Allein in diesem Wetter? Kannst du mir sagen, wohin sie gezogen sind?' },
      { id: 'rain-forest.flick.limit', line: 'Lia: Nicht sicher. Mir haben schon genug Leute gesagt, sie würden mir helfen.' },
      { id: 'rain-forest.flick.offer', line: 'Flick: Dann verlange ich auch nicht, dass du mir glaubst. Komm bis zum Weg. Dort kann ich nach Spuren sehen.' },
      { id: 'rain-forest.flick.accept', line: 'Lia: Bis zum Weg. Mehr verspreche ich nicht.' },
    ] },
  ],
  exit: { label: 'Mit Flick den Waldpfad erreichen', at: [603, 209], radius: 23, requires: ['film.flick-met'], to: 'flick-trail' },
};
