import type { WorldState } from '../world/quests';

export type CampMealResult = 'ate' | 'already-ate' | 'fire-unlit' | 'no-provisions';

/** A confirmed meal uses one carried ration and can only be recorded once. */
export function consumeCampMeal(world: WorldState): CampMealResult {
  if (world.flags.journeyAte) return 'already-ate';
  if (!world.flags.campfireLit) return 'fire-unlit';
  if (!Number.isFinite(world.inv.proviant) || (world.inv.proviant ?? 0) < 1) return 'no-provisions';
  world.inv.proviant! -= 1;
  if (!world.inv.proviant) delete world.inv.proviant;
  world.flags.journeyAte = true;
  world.flags.journeyProviantPortionUsed = true;
  return 'ate';
}
