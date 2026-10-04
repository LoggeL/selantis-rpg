import { describe, expect, it } from 'vitest';
import { MAPS } from './world/maps';
import { FARM_DAWN_AREA, FARM_INTERIOR_AREA } from './story/areas/aftermath';
import { RAID_AREA, RAID_APPROACH_AREA } from './story/areas/raid';
import { ROAD_EAST_AREA, FIRST_CAMP_AREA } from './story/areas/journey';
import { GUIDES, currentGuide } from './walkthrough';

describe('current context', () => {
  it('selects maps, story areas and encounter without changing context', () => {
    for (const [context, id] of [
      [{ scene: 'world', map: 'waldrand' }, 'world:waldrand'],
      [{ scene: 'aftermath', area: 'farm-interior' }, 'farm-interior'],
      [{ scene: 'raid', area: 'raid-approach', beat: 'hidden' }, 'raid-farm'],
      [{ scene: 'raid', area: 'raid-approach' }, 'raid-approach'],
      [{ scene: 'journey', area: 'first-camp', campStep: 'cloak' }, 'first-camp'],
      [{ scene: 'journey', area: 'first-camp', campStep: 'waking' }, 'strangers'],
      [{ scene: 'journey', area: 'first-camp', campStep: 'complete' }, 'strangers'],
      [{ scene: 'battle' }, 'battle'],
    ] as const) {
      const before = JSON.stringify(context);
      expect(currentGuide(context)?.id).toBe(id);
      expect(JSON.stringify(context)).toBe(before);
    }
    expect(currentGuide({ scene: 'unknown' })).toBeUndefined();
  });
});

describe('walkthrough coverage', () => {
  it('covers every map and authored story area exactly once, plus all playable scenes and the encounter', () => {
    const expected = ['title', 'battle', 'break', 'flight', 'refuge', 'lia', ...Object.keys(MAPS).map(id => `world:${id}`), ...[RAID_APPROACH_AREA, RAID_AREA, FARM_DAWN_AREA, FARM_INTERIOR_AREA, ROAD_EAST_AREA, FIRST_CAMP_AREA].map(area => area.id), 'strangers'];
    expect(GUIDES.map(g => g.id).sort()).toEqual(expected.sort());
    for (const guide of GUIDES) { expect(guide.steps.length).toBeGreaterThan(1); expect(guide.completion.length).toBeGreaterThan(10); }
  });
});
