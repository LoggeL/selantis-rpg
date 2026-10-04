import type { WorldState } from "../modules/campaign/state";
import type { StoryArea } from "../modules/narrative/types";
import { inPoly } from "../modules/exploration/navigation";

export const COMPANION_ROAD_SCENE = 'companions-road';
export type CompanionPhase = 'morning' | 'afternoon' | 'evening';

export { MIDDAY_REST_LINES, MIDDAY_REST_SEQUENCE } from '../content/chapters/companions/dialogue';

export function companionPhase(st: WorldState): CompanionPhase {
  return st.flags.companionDayComplete ? 'evening' : st.flags.companionRestTaken ? 'afternoon' : 'morning';
}

export function companionObjective(phase: CompanionPhase, st: WorldState): string {
  if (phase === 'evening') return 'Am Abend: Der Goldene Eber · Fortsetzung folgt.';
  if (phase === 'afternoon' || st.flags.companionRestTaken) return 'Foltan und Azar weiter durch den Wald folgen.';
  return 'Mit Foltan und Azar zur Mittagsrast auf die Mooslichtung gehen.';
}

/** Same foot samples as StoryScene; companions stay on the authored path too. */
export function companionFeetWalkable(area: StoryArea, x: number, y: number): boolean {
  const ok = (px: number, py: number) => area.walk.some(poly => inPoly(px, py, poly)) && !area.block.some(poly => inPoly(px, py, poly));
  return ok(x, y) && ok(x - 5, y) && ok(x + 5, y) && ok(x, y - 3);
}
