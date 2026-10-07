// Pure rules for „e2-zellengespraeche“: what Flick can learn about the wardens' routine through the bars and when
// nobody watches her hands. The scene script drives the wardens and records the current phase; these functions only
// decide (zellengespraeche-routine.test.ts).

/**
 * The wardens' night routine, repeated until the scene stops it:
 * - `runde`: the key warden walks past the cells and looks in, the other one sits at the guard table;
 * - `treppe`: the key warden waits at the foot of the stairs and listens upwards, the one at the table dozes;
 * - `zu-zweit`: a knock from above, both go up the stairs together (every second round) and the corridor is empty.
 */
export type RoutinePhase = 'runde' | 'treppe' | 'zu-zweit';

/** What Flick has to find out (all three are required). */
export type Observation = 'schluessel' | 'doesen' | 'zu-zweit';
export const OBSERVATIONS: readonly Observation[] = ['schluessel', 'doesen', 'zu-zweit'];

/** How close (map px) the key warden must pass Flick's cell to see where the key bunch hangs. */
export const KEY_SIGHT_PX = 90;

/** Which observation a look through the bars yields right now (null: nothing new to see at this moment). */
export function observationAt(phase: RoutinePhase, keyWardenDist: number): Observation | null {
  if (phase === 'runde') return keyWardenDist <= KEY_SIGHT_PX ? 'schluessel' : null;
  if (phase === 'treppe') return 'doesen';
  return 'zu-zweit';
}

/** Whether nobody watches the cell, so Flick can work at the shackle with the nail. */
export function unwatched(phase: RoutinePhase): boolean {
  return phase !== 'runde';
}

/** Phase order of one round; `pair` = this round ends with the knock and both wardens going up. */
export function roundPhases(round: number): RoutinePhase[] {
  return round % 2 === 1 ? ['runde', 'treppe', 'zu-zweit'] : ['runde', 'treppe'];
}

/** Ways to leave the opened shackle on the wrist so that it still looks locked. */
export interface ShackleOption { readonly id: 'zu' | 'stroh' | 'aermel'; readonly text: string; readonly ok: boolean }
export const SHACKLE_OPTIONS: readonly ShackleOption[] = [
  { id: 'zu', text: 'Den Bügel zudrücken, bis er einrastet.', ok: false },
  { id: 'stroh', text: 'Den Bügel nur einhängen und einen Halm Stroh in den Spalt klemmen.', ok: true },
  { id: 'aermel', text: 'Den Ärmel über die Schelle ziehen und die Hand nicht mehr drehen.', ok: true },
];
