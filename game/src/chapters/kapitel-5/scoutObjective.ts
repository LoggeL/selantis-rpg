import type { GameState } from '../../core/state';
import type { WorldCtx } from '../../world';

const SCOUT = ['k5-sp-felsen', 'k5-sp-stamm', 'k5-lauschen'];
type ScoutWorld = Pick<WorldCtx, 'setObjective' | 'completeObjective'>;

export function updateScoutObjective(w: ScoutWorld, state: Pick<GameState, 'is'>): void {
  const n = SCOUT.filter(flag => state.is(flag)).length;
  const next = n >= 3 ? null : !state.is('k5-sp-felsen') ? 'felsen' : !state.is('k5-sp-stamm') ? 'stamm' : [888, 492] as [number, number];
  w.setObjective('k5-auskundschaften', `Kundschafte das Lager aus, ohne gesehen zu werden (${n}/3).`, next);
}

/** Store the last vantage point's count before moving the completed task into journal history. */
export function completeScouting(w: ScoutWorld, state: Pick<GameState, 'is'>): void {
  updateScoutObjective(w, state);
  w.completeObjective('k5-auskundschaften');
  w.setObjective('k5-zurueck', 'Schleich zurück zu Flick an den Waldrand.', 'flick');
}
