import type { WorldState } from "../campaign/state";
import { executeCampAction } from "./progression";

export type CampMealResult = 'ate' | 'already-ate' | 'fire-unlit' | 'no-provisions';

/** Map the camp command result to the inventory meal outcome. */
export function consumeCampMeal(world: WorldState): CampMealResult {
  if (world.flags.journeyAte) return 'already-ate';
  if (!world.flags.campfireLit) return 'fire-unlit';
  const result = executeCampAction(world, 'eat');
  return result.accepted ? 'ate' : 'no-provisions';
}
