// „Was du gesehen hast“ (e2-flick-entkommt): the scuffle in the corridor. Flick has watched the wardens for two
// nights (e2-zellengespraeche) and loosened the shackle with the nail; now the key warden bends over her hands. What
// works is what she knows: how she hid the open shackle, and that he always looks up the stairs when he straightens.
// Ideas she has no grounds for get her hurt or pushed back; the beat simply repeats (no failure, no game over).
// Pure data, tested in flick-entkommt.test.ts; staged by flick-entkommt.ts through G.ui.scenePick.
import type { PickCard } from '../../ui/scenePick';

export interface ScuffleIdea extends PickCard { ok: boolean; reply: string }
export interface ScuffleBeat { id: 'losreissen' | 'zuschlagen'; prompt: string; ideas: ScuffleIdea[] }

/** The two beats of the scuffle; the first one depends on how Flick hid the open shackle ('stroh' or 'aermel'). */
export function scuffleBeats(shackle: string | undefined): ScuffleBeat[] {
  const free: ScuffleIdea = shackle === 'aermel'
    ? { id: 'schelle', text: 'Den Ärmel zurück, die Hand aus der offenen Schelle', tag: 'Ärmel', ok: true,
      reply: 'Ärmel zurück, Hand raus. Die Schelle bleibt mir als Eisen in der Faust.' }
    : { id: 'schelle', text: 'Ein Ruck: Der Strohhalm fällt, die Schelle springt auf', tag: 'Stroh', ok: true,
      reply: 'Ein Ruck, der Halm fällt, der Bügel springt. Die Hand ist frei, die Schelle schwer in der Faust.' };
  return [
    {
      id: 'losreissen', prompt: 'Der mit dem Bund beugt sich über meine Hände. Der mit dem Knüppel hält hinten die Kette.',
      ideas: [
        { id: 'kette', text: 'Mit aller Kraft an der Kette reißen', ok: false,
          reply: 'Der hinten hält die Kette wie einen Hundestrick. Ich reiß mir nur die Schulter auf.' },
        free,
        { id: 'beissen', text: 'Ihm in die Hand beißen, wie Kyra es täte', ok: false,
          reply: 'Ich krieg nur Leder zwischen die Zähne. Er flucht und zieht die Hand weg. Noch mal, Flick. Mit Kopf.' },
      ],
    },
    {
      id: 'zuschlagen', prompt: 'Die Hand ist frei. Der mit dem Bund richtet sich auf. Der Knüppel hinter mir hebt sich.',
      ideas: [
        { id: 'knueppel', text: 'Erst herumfahren, zum Knüppel', ok: false,
          reply: 'Der Knüppel ist schneller. Er trifft die verbundene Hand. Ich schrei nicht. Fast nicht.' },
        { id: 'schluessel', text: 'Nach dem Schlüsselbund am Gürtel greifen', ok: false,
          reply: 'Er steht noch und packt mein Handgelenk. Erst der Mann, dann der Bund.' },
        { id: 'treppe', text: 'Wenn er sich aufrichtet, sieht er zur Treppe. Genau dann: die Schelle an die Schläfe', tag: 'Beobachtet', ok: true,
          reply: 'Er hebt den Kopf zur Treppe, wie jede Nacht. Die Schelle trifft ihn an der Schläfe.' },
      ],
    },
  ];
}
