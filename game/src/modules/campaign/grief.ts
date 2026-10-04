import type { CampaignState } from './state';

/** Preserve farm progress when returning or importing a state from before the grief sequence. */
export function needsAftermathGrief(st: CampaignState, entry: { from?: string; at?: unknown } = {}) {
  if (entry.from || entry.at || st.flags.aftermathGriefSeen) return false;
  return !['packedFood', 'packedWater', 'foundCache', 'packedMedicine', 'packedClothes', 'packedBooks',
    'houseClosed', 'pigsReleased', 'aftermathComplete'].some(flag => st.flags[flag])
    && !st.picked['farewell-mother'] && !st.picked['farewell-father'];
}
