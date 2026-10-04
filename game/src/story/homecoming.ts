import type { WorldState } from '../world/quests';

/** Condensed adaptation of the sisters' conversation, Roman PDF pp. 9-10. */
export const SISTER_CONVERSATION = [
  'Kyra: „Ich komme gleich nach“, hast du gesagt. Das war vor zwei Stunden!',
  'Lia: Schon so spät? Herrje. Tut mir leid, es war gerade so spannend.',
  'Kyra: Bei dir ist es immer gerade spannend. Das ganze Holz hab ich allein gesammelt.',
  'Lia: Hier ist es eben so öde. In meinem Buch gibt es mutige Helden und schöne Königstöchter.',
  'Kyra: Sei froh drum. Seit Dunkelhain ziehen Dunkelschatten und Räuber durchs Land. Ein Wunder, dass sie uns bisher verschont haben.',
  'Lia: Siehst du? Selbst denen ist es hier zu langweilig.',
  'Kyra: Lia!',
  'Lia: Ja, schon gut. Dafür füttere ich heute Abend die Schweine. Versprochen.',
  'Kyra: Das hoffe ich für dich. Kommst du mit? Gleich gibt es Abendbrot, und Mutter macht sich sonst Sorgen.',
  'Lia: Geh ruhig schon vor. Ich bleibe noch kurz und …',
  'Kyra: … liest. Hätte ich mir denken können. Aber denk an die Schweine!',
  'Lia: Noch ein Kapitel. Darauf kannst du dich verlassen.',
] as const;

// Lia has already entered the sunken lane before the chapter title. Use the
// next map's validated entry, not her coordinates in the illustrated meadow.
export const HOME_PATH_ENTRY = { map: 'hohlweg', from: 'wiese' } as const;

const HOME_ROUTE: Record<string, { exit?: string; text: string }> = {
  wiese: { exit: 'hohlweg', text: 'Nach Hause · Den Hohlweg nach Süden nehmen.' },
  waldrand: { exit: 'wiese', text: 'Nach Hause · Nach Osten zur Wiese.' },
  felder: { exit: 'hof', text: 'Nach Hause · Dem Feldweg nach Süden folgen.' },
  hohlweg: { exit: 'hof', text: 'Nach Hause · Dem Weg nach Osten folgen.' },
  hof: { text: 'Nach Hause · Am Hof sofort in der Böschung verstecken.' },
};

/** Optional discoveries never replace the single main objective. */
export function homecomingObjective(st: WorldState, map = 'wiese'): string {
  return st.flags.homeArrived ? 'Nach Hause · abgeschlossen' : HOME_ROUTE[map]?.text ?? 'Nach Hause';
}

export const homewardExit = (map: string) => HOME_ROUTE[map]?.exit;

/** Completes on entering the farm, before the raid takes over. Returns true only once. */
export function completeHomecoming(st: WorldState): boolean {
  if (st.flags.homeArrived) return false;
  st.flags.homeArrived = true;
  return true;
}
