import { describe, expect, it } from 'vitest';
import { FIRST_JOURNEY_CHAPTER, campStepDefinition } from "./camp";
import { CAMP_INTRODUCTION_BEATS, CAMP_OBSERVATION_BEATS, JOURNEY_TEXT } from "./dialogue";
import { CAMP_DIALOGUE_BEATS } from "./campDialogue";
import { STAR_REFLECTION_BEATS } from "./starReflection";
import { FIRST_CAMP_AREA } from "../../areas/journey";

describe('first journey authored chapter', () => {
  it('requires only targets present in the authored clearing', () => {
    const ids = FIRST_CAMP_AREA.targets.map(target => target.id);
    for (const step of Object.keys(FIRST_JOURNEY_CHAPTER.camp) as (keyof typeof FIRST_JOURNEY_CHAPTER.camp)[]) {
      const definition = campStepDefinition(step);
      if (definition.requiredSpot) expect(ids).toContain(definition.requiredSpot);
    }
  });

  it('has stable unique reading beats and a single authored waking cue', () => {
    const beats = [...CAMP_OBSERVATION_BEATS, ...CAMP_INTRODUCTION_BEATS, ...STAR_REFLECTION_BEATS, ...Object.values(JOURNEY_TEXT), ...Object.values(CAMP_DIALOGUE_BEATS).flat()];
    expect(new Set(beats.map(beat => beat.id)).size).toBe(beats.length);
    expect(CAMP_OBSERVATION_BEATS.filter(beat => beat.cue === 'lia-wakes').map(beat => beat.id)).toEqual(['camp-observe/lia-startles']);
  });
});
