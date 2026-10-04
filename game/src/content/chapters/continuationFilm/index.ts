import { RAIN_FOREST } from './rainForest';
import { FLICK_TRAIL } from './flickTrail';
import { SHADOW_CAMP } from './shadowCamp';
import { SISTERS_REUNITED } from './sistersReunited';
import { FILM_ONE_FINALE } from './filmOneFinale';

export { RAIN_FOREST, FLICK_TRAIL, SHADOW_CAMP, SISTERS_REUNITED, FILM_ONE_FINALE };
export { FILM_CONTINUATION_PROVENANCE } from './provenance';
export const FILM_CONTINUATION_CHAPTERS = [RAIN_FOREST, FLICK_TRAIL, SHADOW_CAMP, SISTERS_REUNITED, FILM_ONE_FINALE] as const;
