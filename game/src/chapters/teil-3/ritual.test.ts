import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { pointInPoly } from '../../world/poly';
import {
  ANSTIEG_WALK, APPROACH, ASCENTS, BARIS_RETORTS, canSpot, EAST_EXIT, HILL_BLOCKS, HILL_SPOT, HILL_TOP, ON_THE_STONE, POST_IDS,
  postObjective, POSTS, SPOT_RANGE, STANDS, STONE_BLOCK, STONE_LIE, STONE_POLY,
} from './ritual-huegel';
import { hasOwnStaff, prepareE3, staffPlace } from './shared';

afterEach(() => G.state.reset());

type Spot = readonly [number, number];
const onHill = (at: Spot) =>
  pointInPoly(at[0], at[1], HILL_TOP) && ![...HILL_BLOCKS, STONE_BLOCK].some(b => pointInPoly(at[0], at[1], b.poly as [number, number][]));
const onApproach = (at: Spot) => pointInPoly(at[0], at[1], ANSTIEG_WALK);

describe('the hilltop (e3-ritualhuegel)', () => {
  it('has exactly ten stands in a ring round the stone, Lia lying on top of it', () => {
    expect(STANDS.length).toBe(10);
    expect(pointInPoly(STONE_LIE[0], STONE_LIE[1], STONE_POLY)).toBe(true);
    for (const s of STANDS) expect(s.base).toBeGreaterThan(s.top);
  });

  it('keeps everyone after the fight on free ground, and the track leads to the east exit', () => {
    for (const k of ['liaAfter', 'kyraAfter', 'flickAfter', 'paladinAfter1', 'paladinAfter2', 'relicStandAt', 'ash', 'trackStart', 'eastEdge'] as const) {
      expect(onHill(HILL_SPOT[k]), k).toBe(true);
    }
    expect(pointInPoly(HILL_SPOT.eastEdge[0], HILL_SPOT.eastEdge[1], EAST_EXIT)).toBe(true);
    expect(HILL_SPOT.trackStart[0]).toBeGreaterThan(HILL_SPOT.ash[0]);
  });
});

describe('Flick below the hill', () => {
  it('starts Flick and the others on the path and offers three different ways up there', () => {
    for (const k of ['forestEdge', 'ignatius', 'paladin1', 'paladin2'] as const) expect(onApproach(HILL_SPOT[k]), k).toBe(true);
    expect(ASCENTS.map(a => a.weg).sort()).toEqual(['felsen', 'hohlweg', 'offen']);
    for (const a of ASCENTS) expect(onApproach(a.at), a.weg).toBe(true);
  });

  it('puts the three guards up on the hill, each visible from somewhere on Flick’s ground but not from the start', () => {
    const ground: Spot[] = [...ASCENTS.map(a => a.at), [250, 506], [330, 506]];
    for (const id of POST_IDS) {
      const at = POSTS[id].at;
      expect(onApproach(at), id).toBe(false);
      expect(ground.some(g => canSpot(g, at, true)), id).toBe(true);
      expect(canSpot(HILL_SPOT.forestEdge, at, true), id).toBe(false);
    }
  });

  it('only makes a guard out while the Spurenblick is held and he is in range', () => {
    expect(canSpot([0, 0], [100, 0], false)).toBe(false);
    expect(canSpot([0, 0], [SPOT_RANGE, 0], true)).toBe(true);
    expect(canSpot([0, 0], [SPOT_RANGE + 1, 0], true)).toBe(false);
    expect(postObjective(0)).toMatch(/Späh/);
    expect(postObjective(2)).toMatch(/2 von 3/);
    expect(postObjective(3)).toMatch(/Weg hinauf/);
  });
});

describe('texts', () => {
  const all = [
    ...BARIS_RETORTS.flatMap(r => [r.text, r.lia, r.baris]), ...Object.values(ON_THE_STONE).flat().map(l => l.text),
    ...Object.values(APPROACH).flat().map(l => l.text), ...ASCENTS.flatMap(a => [a.judgement, a.decision]),
    ...POST_IDS.flatMap(id => [POSTS[id].flick, POSTS[id].answer]),
  ];

  it('keeps every line short enough for one box and uses only the established names', () => {
    for (const t of all) expect(t.length, t).toBeLessThanOrEqual(140);
    const joined = all.join(' ');
    expect(joined).not.toMatch(/Elbe|Vardis|Triss/);
  });

  it('names none of the ten relics', () => {
    const joined = all.join(' ');
    expect(joined).not.toMatch(/Geweih|Regas/);
  });
});

describe('the direct entry', () => {
  it('starts the ritual with the relic plan known, Lia poisoned and the staff with Flick', () => {
    prepareE3('e3-ritual');
    expect(G.state.is('e3-relikte-plan')).toBe(true);
    expect(G.state.is('e3-geweigert')).toBe(true);
    expect(G.state.is('e3-vergiftet')).toBe(true);
    expect(staffPlace()).toBe('flick');
    expect(hasOwnStaff()).toBe(false);
    expect(G.state.is('e3-ritual-begonnen')).toBe(false);
  });

  it('starts the battle with the ritual begun and ends with the staff back and Kyra free', () => {
    prepareE3('e3-ritualangriff');
    expect(G.state.is('e3-ritual-begonnen')).toBe(true);
    G.state.reset();
    prepareE3('e3-vamir');
    expect(G.state.is('e3-kyra-frei')).toBe(true);
    expect(G.state.is('e3-ritual-gebrochen')).toBe(true);
    expect(hasOwnStaff()).toBe(true);
    expect(G.state.data.lore).toContain('e3-lore-relikte');
  });
});
