import { applyCampaignCommand } from "../campaign/commands";
import type { WorldState } from "../campaign/state";

export type CampStep = 'cloak' | 'stones' | 'ring' | 'twigs' | 'fire' | 'meal' | 'sleep' | 'waking' | 'star' | 'complete';

export type CampAction = 'spread-cloak' | 'gather-stones' | 'build-firepit' | 'gather-twigs' | 'light-fire' | 'eat' | 'rest' | 'introduce-companions' | 'observe-crios' | 'recover-cloak';
export type CampRejection = 'already-complete' | 'wrong-step' | 'missing-cloak' | 'missing-stones' | 'missing-wood' | 'no-provisions' | 'fire-unlit' | 'invalid-inventory';
export type CampResult = { accepted: true; step: CampStep } | { accepted: false; reason: CampRejection; step: CampStep };

/** Progress belongs to the campaign. Scene animations may temporarily lock input. */
export function campStep(world: WorldState): CampStep {
  const f = world.flags;
  if (f.metFoltanAzar) return f.criosObserved ? 'complete' : 'star';
  if (f.firstCampRested) return 'waking';
  if (f.journeyAte) return 'sleep';
  if (f.campfireLit) return 'meal';
  if (f.journeyTwigsGathered) return 'fire';
  if (f.journeyFirepitBuilt) return 'twigs';
  if (f.journeyStonesGathered) return 'ring';
  if (f.journeyCloakSpread) return 'stones';
  return 'cloak';
}

export function canUseCampSpot(world: WorldState, id: string, definition: { requiredSpot?: string }): boolean {
  const step = campStep(world), f = world.flags;
  if (step === 'waking') return false;
  if (id === 'road') return true;
  if (id === 'fire-seat') return !!f.campfireLit;
  if (id === 'foltan' || id === 'azar' || id === 'star') return !!f.metFoltanAzar;
  if (id === 'bedroll' && f.metFoltanAzar) return true;
  if (id === 'fire' && f.campfireLit) return true;
  return id === definition.requiredSpot;
}

/** Normalize only documented legacy construction facts, never grant resources. */
export function restoreCamp(world: WorldState): void {
  if (world.flags.campfireLit) applyCampaignCommand(world, { type: 'transaction', flags: { journeyStonesGathered: true, journeyFirepitBuilt: true } });
}

const ACTIONS: Record<CampAction, { step?: CampStep; once: string; flags?: Record<string, boolean>; items?: { item: 'steine' | 'zunderholz' | 'proviant'; delta: number }[] }> = {
  'spread-cloak': { step: 'cloak', once: 'journeyCloakSpread', flags: { journeyCloakRecovered: false } },
  'gather-stones': { step: 'stones', once: 'journeyStonesGathered', items: [{ item: 'steine', delta: 6 }] },
  'build-firepit': { step: 'ring', once: 'journeyFirepitBuilt', items: [{ item: 'steine', delta: -6 }] },
  'gather-twigs': { step: 'twigs', once: 'journeyTwigsGathered', items: [{ item: 'zunderholz', delta: 1 }] },
  'light-fire': { step: 'fire', once: 'campfireLit', items: [{ item: 'zunderholz', delta: -1 }] },
  eat: { step: 'meal', once: 'journeyAte', flags: { journeyProviantPortionUsed: true }, items: [{ item: 'proviant', delta: -1 }] },
  rest: { step: 'sleep', once: 'firstCampRested' },
  'introduce-companions': { step: 'waking', once: 'metFoltanAzar' },
  'observe-crios': { step: 'star', once: 'criosObserved' },
  'recover-cloak': { once: 'journeyCloakRecovered' },
};

/** The same preconditions apply when opening a minigame and committing its result. */
export function campActionRejection(world: WorldState, action: CampAction): CampRejection | undefined {
  const step = campStep(world), spec = ACTIONS[action];
  const count = (item: keyof WorldState['inv'], required: number) => Number.isSafeInteger(world.inv[item]) && (world.inv[item] ?? 0) >= required;
  if (world.flags[spec.once]) return 'already-complete';
  if (spec.step && spec.step !== step) return 'wrong-step';
  if (action === 'recover-cloak' && !world.flags.metFoltanAzar) return 'wrong-step';
  if (action === 'spread-cloak' && !count('reisezeug', 1)) return 'missing-cloak';
  if (action === 'build-firepit' && !count('steine', 6)) return 'missing-stones';
  if (action === 'light-fire' && (!world.flags.journeyFirepitBuilt || !count('zunderholz', 1))) return 'missing-wood';
  if ((action === 'eat' || action === 'rest') && !world.flags.campfireLit) return 'fire-unlit';
  if (action === 'eat' && !count('proviant', 1)) return 'no-provisions';
}

/** Validate the whole interaction before a single atomic campaign transaction. */
export function executeCampAction(world: WorldState, action: CampAction): CampResult {
  const step = campStep(world), spec = ACTIONS[action];
  const reason = campActionRejection(world, action);
  if (reason) return { accepted: false, reason, step };
  if (!applyCampaignCommand(world, { type: 'transaction', once: spec.once, flags: { ...spec.flags, [spec.once]: true }, items: spec.items })) return { accepted: false, reason: 'invalid-inventory', step };
  return { accepted: true, step: campStep(world) };
}
