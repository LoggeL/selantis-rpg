export const FLAG_GROUPS = {
  Heimweg: ['sisterPromise', 'homeArrived', 'chickReturned'],
  Hof: ['raidWitnessed', 'parentDeath', 'parentsLost', 'kyraTaken', 'packedFood', 'packedWater', 'foundCache', 'packedMedicine', 'packedClothes', 'packedBooks', 'houseClosed', 'pigsReleased', 'departureReady', 'aftermathComplete'],
  Reise: ['streamVisited', 'journeyEastChosen', 'journeyCampReached', 'journeyCloakSpread', 'journeyCloakRecovered', 'journeyStonesGathered', 'journeyFirepitBuilt', 'journeyTwigsGathered', 'campfireLit', 'journeyAte', 'journeyProviantPortionUsed', 'firstCampRested', 'metFoltanAzar', 'criosObserved'],
  Gefährten: ['companionMorningStarted', 'companionRestTaken', 'companionBreakfastRemembered', 'companionDayComplete'],
} as const;
export type CampaignFlag = typeof FLAG_GROUPS[keyof typeof FLAG_GROUPS][number];
export type CampaignFlags = Partial<Record<CampaignFlag, boolean>> & Record<string, boolean>;
export const FLAGS: readonly CampaignFlag[] = Object.values(FLAG_GROUPS).flat();
export const isCampaignFlag = (key: string): key is CampaignFlag => (FLAGS as readonly string[]).includes(key);

/** Dynamic discovery/drop keys remain supported, while prototype keys are rejected. */
export const isCampaignKey = (key: unknown): key is string => typeof key === 'string'
  && key.length > 0 && key.length <= 512 && !/[\u0000-\u001f]/.test(key)
  && !['__proto__', 'prototype', 'constructor'].includes(key);
