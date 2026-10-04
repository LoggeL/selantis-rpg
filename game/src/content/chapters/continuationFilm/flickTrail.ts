import type { ContinuationChapterDefinition } from '../../../modules/continuation/types';
import { FLICK_TRAIL_AREA } from '../../areas/continuationFilm';

export const FLICK_TRAIL: ContinuationChapterDefinition = {
  id: 'flick-trail', title: 'Flicks Fährte', area: FLICK_TRAIL_AREA,
  source: ['docs/episode-01.md:09:20-14:21', 'sources/transcripts/01-3PNiiK653uQ.txt:11:39-14:21', 'ADAPTION: rain-flick-encounter; walkable-actions'],
  atmosphere: 'night', music: 'exploration',
  actors: [{ id: 'flick', name: 'Flick', texture: 'flick-walk', at: [93, 190], follow: true }],
  entry: [{ id: 'flick-trail.entry.quiver', line: 'Die Elbin geht leichtfüßig voraus. Über der cremefarbenen Tunika hängt ein burgunderfarbener Umhang. Ihr Bogen stößt leise gegen den Köcher.' }],
  actions: [
    { id: 'follow-hoofprints', label: 'Die Hufspuren am Weg untersuchen', at: [162, 214], radius: 25, completionFlag: 'film.hoofprints', beats: [
      { id: 'flick-trail.tracks.hooves', line: 'Flick: Hier. Mehrere Pferde und schwere Stiefel. Der Regen hat noch nicht alles weggespült.' },
      { id: 'flick-trail.tracks.darkshadows', line: 'Lia: Schwarze Kleidung, Waffen. So sahen die Männer aus.' },
      { id: 'flick-trail.tracks.answer', line: 'Flick: Dunkelschatten. Das sind Diener des Bösen. Wir sollten ihnen nicht offen in die Arme laufen.' },
    ] },
    { id: 'cross-fallen-trunk', label: 'Am umgestürzten Stamm die Spur wiederfinden', at: [311, 219], radius: 25, requires: ['film.hoofprints'], completionFlag: 'film.trail-direction', beats: [
      { id: 'flick-trail.trunk.scout', line: 'Flick geht am Stamm entlang, bis sie auf der anderen Seite eine tiefe Ferse im Lehm findet.', cue: { type: 'move', actor: 'flick', to: [342, 197] } },
      { id: 'flick-trail.trunk.boast', line: 'Flick: Ein paar Stunden Vorsprung, höchstens. Du hast Glück, dass du mich gefunden hast.' },
      { id: 'flick-trail.trunk.lia', line: 'Lia: Und bescheiden bist du auch noch.' },
      { id: 'flick-trail.trunk.reply', line: 'Flick: Wenn du lieber raten möchtest, bitte.' },
    ] },
    { id: 'flick-why-help', label: 'Am trockenen Lagerplatz nach Flicks Hilfe fragen', at: [440, 219], radius: 25, requires: ['film.trail-direction'], completionFlag: 'film.flick-rebels-known', beats: [
      { id: 'flick-trail.rest.why', line: 'Lia: Warum hilfst du mir? Du kennst mich überhaupt nicht.' },
      { id: 'flick-trail.rest.rejected', line: 'Flick: Ich wollte zu den Rebellen. Sie wollten keine Elbin in ihren Reihen.' },
      { id: 'flick-trail.rest.one', line: 'Flick: Also bin ich jetzt meine eigene Rebellengruppe. Ein Mitglied. Sehr kurze Besprechungen.' },
      { id: 'flick-trail.rest.doubt', line: 'Lia: Einer Gruppe zu vertrauen hat mir heute schon gereicht.' },
      { id: 'flick-trail.rest.promise', line: 'Flick: Wir müssen erst deine Schwester finden. Über den Rest kannst du später streiten.' },
    ] },
    { id: 'wait-for-dawn', label: 'Die geschützte Stelle prüfen und bis zum Morgen rasten', at: [536, 182], radius: 24, requires: ['film.flick-rebels-known'], completionFlag: 'film.dawn-trail', beats: [
      { id: 'flick-trail.dawn.shelter', line: 'Hinter den Wurzeln bleibt der Boden trocken. Lia setzt sich erst, als Flick den Waldrand geprüft hat.' },
      { id: 'flick-trail.dawn.rest', line: 'Flick: Ruh dich aus. Im Dunkeln verlieren wir eher die Spur. Morgen früh holen wir sie ein.' },
      { id: 'flick-trail.dawn.goodnight', line: 'Lia: Flick? Gute Nacht.' },
      { id: 'flick-trail.dawn.morning', line: 'Als es hell wird, weckt Flick sie leise. Der Regen hat aufgehört. Am Hang liegt Rauch zwischen den Bäumen.' },
    ] },
  ],
  exit: { label: 'Der Spur bis zum Hang folgen', at: [608, 156], radius: 23, requires: ['film.dawn-trail'], to: 'shadow-camp' },
};
