// What e3-eigener-stab hands over (tested in eigener-stab.test.ts): Lia's own staff exactly once, Schattentöter back
// to Ignatius exactly once, and the Stabstrahl. Inventory is the truth (umsetzung.md §2, Stäbe); repeating a step
// after a reload never duplicates or removes anything twice.
import { G } from '../../core/G';
import { STAFF } from '../common/bookContract';
import { grantOnce, STAFF_PLACE_FLAG } from './shared';

export const STAFF_RECEIVED = 'e3-stab-erhalten';
export const SCHATTENTOETER_BACK = 'e3-schattentoeter-zurueck';
export const STABSTRAHL = 'e3-stabstrahl';

/** The bright willow branch becomes Lia's staff: + e3-lia-staff, staff place 'lia'. */
export function receiveOwnStaff(): boolean {
  return grantOnce(STAFF_RECEIVED, () => {
    if (!G.state.has(STAFF.own)) G.state.give(STAFF.own);
    G.state.set(STAFF_PLACE_FLAG, 'lia');
  });
}

/** Lia hands the borrowed Schattentöter back to Ignatius: − e2-schattentoeter (if she still carries it). */
export function returnSchattentoeter(): boolean {
  return grantOnce(SCHATTENTOETER_BACK, () => {
    const n = G.state.count(STAFF.borrowed);
    if (n > 0) G.state.take(STAFF.borrowed, n);
  });
}

/** The first beam with her own staff teaches the Stabstrahl (once; the toast only the first time). */
export function learnStabstrahl(): boolean {
  if (G.state.knows(STABSTRAHL)) return false;
  G.state.learn(STABSTRAHL);
  return true;
}
