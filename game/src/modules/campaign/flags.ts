export const FLAG_GROUPS = {
  Heimweg: ['sisterPromise', 'homeArrived', 'chickReturned'],
  Hof: ['raidWitnessed', 'parentDeath', 'parentsLost', 'kyraTaken', 'packedFood', 'packedWater', 'foundCache', 'packedMedicine', 'packedClothes', 'packedBooks', 'houseClosed', 'pigsReleased', 'departureReady', 'aftermathComplete'],
  Reise: ['streamVisited', 'journeyEastChosen', 'journeyCampReached', 'journeyCloakSpread', 'journeyCloakRecovered', 'journeyStonesGathered', 'journeyFirepitBuilt', 'journeyTwigsGathered', 'campfireLit', 'journeyAte', 'journeyProviantPortionUsed', 'firstCampRested', 'metFoltanAzar', 'criosObserved'],
  Roman: ['novel.kyra-described', 'novel.craupor-questioned', 'novel.desertion-known', 'novel.foltan-false-report', 'novel.war-history-heard', 'novel.festival-remembered', 'novel.reading-fire-ready', 'novel.herb-lexicon-read', 'novel.alana-read', 'novel.companions-promised', 'novel.azar-promised', 'novel.foltan-promised', 'novel.mother-reading-remembered', 'novel.brotherhood-welcomed', 'novel.brotherhood-shelter-shown', 'novel.elnon-sought', 'novel.training-observed', 'novel.brotherhood-trades-seen', 'novel.foltan-lie-heard', 'novel.trust-broken', 'novel.lia-leaves-brotherhood', 'novel.azar-searching', 'novel.promise-remembered'],
  Film: ['film.rain-shelter', 'film.rain-tracks', 'film.flick-met', 'film.flick-helping', 'film.hoofprints', 'film.trail-direction', 'film.flick-rebels-known', 'film.dawn-trail', 'film.transport-known', 'film.camp-route', 'film.rescue-plan', 'film.guards-distracted', 'film.lia-collapsed', 'film.sisters-safe-path', 'film.rebels-proposed', 'film.final-banter', 'film.kyra-unbound', 'film.magic-erupted', 'film.lia-recovered', 'film.sisters-reunited', 'film.film-one-complete'],
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
