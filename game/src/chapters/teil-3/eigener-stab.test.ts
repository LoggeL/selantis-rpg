import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { STAFF } from '../common/bookContract';
import { allResting, clampToOval, makeSpirits, stepSpirits, type Spirit, type SpiritRules } from './eigener-stab-geister';
import { learnStabstrahl, receiveOwnStaff, returnSchattentoeter } from './eigener-stab-gaben';
import { AIM_START, allPodsDown, evaluateBeam, nextInDirection, POD_IDS, WILLOW_OBJECTS } from './eigener-stab-ziele';
import { CLEARING_OVAL, WILLOW_REST, WILLOW_ZONE } from './lichtwald';
import { hasOwnStaff, prepareE3, staffPlace } from './shared';

afterEach(() => G.state.reset());

const RULES: SpiritRules = {
  runSpeed: 150, gentleSpeed: 90, catchWalk: 40, catchGentle: 68, scareRadius: 120, fleeDistance: 110, fleeSeconds: 1.2,
  zone: WILLOW_ZONE, restAt: WILLOW_REST, oval: CLEARING_OVAL,
};
const WALK = 112, RUN = 189, SNEAK = 60;

/** Runs the spirits for `seconds` with Lia standing at `at` (feet) moving at `speed`. */
function run(spirits: Spirit[], at: readonly [number, number], speed: number, seconds: number) {
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) events.push(...stepSpirits(spirits, at, speed, 0.05, t, RULES, () => 0.5));
  return events;
}

describe('e3-eigener-stab light spirits', () => {
  it('flee from a running Lia instead of following her', () => {
    const s = makeSpirits([[700, 300]]);
    const events = run(s, [700, 350], RUN, 0.1);
    expect(events).toEqual([{ kind: 'scared', id: 0 }]);
    expect(s[0].mode).toBe('flee');
    run(s, [700, 350], 0, 2);
    expect(s[0].mode).toBe('drift');
    expect(Math.hypot(s[0].x - 700, s[0].y - 320)).toBeGreaterThan(60);
  });

  it('join a careful Lia from further away than a walking one', () => {
    const walking = makeSpirits([[700, 260]]);
    run(walking, [700, 340], WALK, 0.1); // light 50 px from her head: too far while walking
    expect(walking[0].mode).toBe('drift');
    const sneaking = makeSpirits([[700, 260]]);
    expect(run(sneaking, [700, 340], SNEAK, 0.1)).toEqual([{ kind: 'caught', id: 0 }]);
    expect(sneaking[0].mode).toBe('follow');
  });

  it('scatter when Lia starts running with them, and settle for good in the willow zone', () => {
    const s = makeSpirits([[700, 290], [720, 290]]);
    run(s, [710, 330], SNEAK, 0.2);
    expect(s.map(x => x.mode)).toEqual(['follow', 'follow']);
    expect(new Set(s.map(x => x.slot)).size).toBe(2);
    expect(run(s, [710, 330], RUN, 0.05).map(e => e.kind)).toEqual(['scared', 'scared']);
    run(s, [710, 330], 0, 2);
    // Caught again carefully, then brought under the willow.
    for (const sp of s) { sp.mode = 'follow'; sp.slot = sp.id; }
    const settled = run(s, WILLOW_ZONE.at, WALK, 0.1);
    expect(settled.map(e => e.kind)).toEqual(['settled', 'settled']);
    expect(new Set(s.map(x => x.rest)).size).toBe(2);
    run(s, WILLOW_ZONE.at, RUN, 1); // running no longer scares resting spirits
    expect(s.every(x => x.mode === 'rest')).toBe(true);
    expect(allResting(s)).toBe(true);
  });

  it('never flee out of the clearing', () => {
    const [x, y] = clampToOval(2000, 340, CLEARING_OVAL);
    expect(x).toBeCloseTo(CLEARING_OVAL.cx + CLEARING_OVAL.rx);
    expect(y).toBeCloseTo(340);
  });
});

describe('e3-eigener-stab first beam', () => {
  it('has three pods, the resting spirits and the brook as forbidden, and starts on the trunk', () => {
    expect(POD_IDS).toEqual(['kapsel-links', 'kapsel-mitte', 'kapsel-rechts']);
    expect(WILLOW_OBJECTS.filter(o => o.kind === 'forbidden').map(o => o.id).sort()).toEqual(['bach', 'geist-links', 'geist-mitte', 'geist-rechts']);
    expect(evaluateBeam([], AIM_START)).toBe('neutral');
  });

  it('counts each pod once and never a forbidden object', () => {
    expect(evaluateBeam([], 'kapsel-links')).toBe('hit');
    expect(evaluateBeam(['kapsel-links'], 'kapsel-links')).toBe('again');
    expect(evaluateBeam([], 'bach')).toBe('forbidden');
    expect(evaluateBeam([], 'geist-mitte')).toBe('forbidden');
    expect(allPodsDown(['kapsel-links', 'kapsel-mitte'])).toBe(false);
    expect(allPodsDown([...POD_IDS])).toBe(true);
  });

  it('moves the aim spatially and reaches every object from the trunk', () => {
    expect(nextInDirection('kapsel-rechts', 1, 0)).toBe('bach');
    expect(nextInDirection('kapsel-links', 0, 1)).toBe('kapsel-links');
    const seen = new Set([AIM_START]);
    const queue = [AIM_START];
    while (queue.length) {
      const id = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = nextInDirection(id, dx, dy);
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    expect(seen.size).toBe(WILLOW_OBJECTS.length);
  });
});

describe('e3-eigener-stab hand-overs', () => {
  it('gives the own staff once and takes Schattentöter back once (inventory is the truth)', () => {
    prepareE3('e3-eigener-stab');
    expect(G.state.has(STAFF.borrowed)).toBe(true);
    expect(hasOwnStaff()).toBe(false);
    expect(receiveOwnStaff()).toBe(true);
    expect(receiveOwnStaff()).toBe(false);
    expect(G.state.count(STAFF.own)).toBe(1);
    expect(staffPlace()).toBe('lia');
    expect(returnSchattentoeter()).toBe(true);
    expect(returnSchattentoeter()).toBe(false);
    expect(G.state.count(STAFF.borrowed)).toBe(0);
    expect(learnStabstrahl()).toBe(true);
    expect(learnStabstrahl()).toBe(false);
    expect(G.state.data.abilities.filter(a => a === 'e3-stabstrahl')).toHaveLength(1);
  });

  it('matches the documented direct-entry state of the next scene', () => {
    prepareE3('e3-eigener-stab');
    receiveOwnStaff();
    returnSchattentoeter();
    learnStabstrahl();
    const played = { inv: { ...G.state.data.inventory }, abilities: [...G.state.data.abilities].sort() };
    expect(played.inv[STAFF.own]).toBe(1);
    expect(played.inv[STAFF.borrowed]).toBeUndefined();
    // prepareE3('e3-paladine') replays e3-eigener-stab from the documented table: same staffs, same abilities.
    G.state.reset();
    prepareE3('e3-paladine');
    expect({ inv: { ...G.state.data.inventory }, abilities: [...G.state.data.abilities].sort() }).toEqual(played);
    expect(G.state.is('e3-stab-erhalten') && G.state.is('e3-schattentoeter-zurueck')).toBe(true);
  });
});
