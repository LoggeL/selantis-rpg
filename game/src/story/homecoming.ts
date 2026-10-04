import type { WorldState } from '../world/quests';

/** Short adaptation of the sisters' conversation, Roman PDF pp. 9-10. */
export const SISTER_CONVERSATION = [
  'Kyra: Du wolltest mir beim Holz helfen. Das ist zwei Stunden her!',
  'Lia: Schon so spät? Es war gerade spannend. Tut mir leid.',
  'Kyra: Bald gibt es Abendbrot. Mutter wartet auf uns.',
  'Lia: Dafür füttere ich heute Abend die Schweine. Versprochen.',
  'Kyra: Gut. Dann komm nach Hause. Ich gehe schon vor.',
  'Lia: Nur noch diese Seite. Dann komme ich.',
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
