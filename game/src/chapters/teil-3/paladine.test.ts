import { afterEach, describe, expect, it } from 'vitest';
import { G } from '../../core/G';
import { pointInPoly } from '../../world/poly';
import { STAFF } from '../common/bookContract';
import { MILESTONE, PATROL_ZONE, ROAD_SPOT, ROAD_WALK, SMITH_LEASH, TRAPAS_BLOCKS, TRAPAS_SPOT, TRAPAS_WALK } from './paladine-orte';
import {
  confiscateStaffs, coverScore, ESCORT, escortVerdict, GOODS_ANSWERS, insideLeash, leaderVerdict, ROAD_ANSWERS,
} from './paladine-regeln';
import { hasOwnStaff, prepareE3, staffPlace } from './shared';

afterEach(() => G.state.reset());

const walkable = (p: readonly [number, number], walk: typeof TRAPAS_WALK, blocks: { poly: typeof MILESTONE }[] = []) =>
  walk.some(w => pointInPoly(p[0], p[1], w)) && !blocks.some(b => pointInPoly(p[0], p[1], b.poly));

describe('e3-paladine cover story', () => {
  it('offers exactly one fitting answer in each moment, and the slips the paladins can pick at', () => {
    for (const set of [GOODS_ANSWERS, ROAD_ANSWERS]) expect(set.filter(a => a.slip === 'none')).toHaveLength(1);
    expect(GOODS_ANSWERS.map(a => a.slip)).toEqual(expect.arrayContaining(['hof', 'schwester']));
    expect(ROAD_ANSWERS.map(a => a.slip)).toContain('urmacht');
    for (const a of [...GOODS_ANSWERS, ...ROAD_ANSWERS]) expect(a.text.length).toBeLessThanOrEqual(140);
  });

  it('counts the answers that held the story (e3-tarnung 0–2) and picks the leader’s remark from it', () => {
    expect(coverScore(['none', 'none'])).toBe(2);
    expect(coverScore(['hof', 'none'])).toBe(1);
    expect(coverScore(['schwester', 'fest'])).toBe(0);
    expect(leaderVerdict(2)).toBe('familiensinn');
    expect(leaderVerdict(1)).toBe('vernunft');
    expect(leaderVerdict(0)).toBe('vernunft');
  });
});

describe('e3-paladine escort and leash', () => {
  it('walks on when Lia is close, warns when she falls back and fetches her when she runs off', () => {
    expect(escortVerdict(40)).toBe('near');
    expect(escortVerdict(ESCORT.near + 1)).toBe('ok');
    expect(escortVerdict(ESCORT.warn + 1)).toBe('warn');
    expect(escortVerdict(ESCORT.pull + 1)).toBe('pull');
  });

  it('lets her reach the notice, the smith and the fountain, but not the gate or the order house', () => {
    for (const p of [TRAPAS_SPOT.notice, TRAPAS_SPOT.fountain, TRAPAS_SPOT.smith, TRAPAS_SPOT.liaWait, TRAPAS_SPOT.mentorWait]) {
      expect(insideLeash(p[0], p[1], SMITH_LEASH)).toBe(true);
    }
    for (const p of [TRAPAS_SPOT.street, TRAPAS_SPOT.stairs, TRAPAS_SPOT.gate]) expect(insideLeash(p[0], p[1], SMITH_LEASH)).toBe(false);
  });

  it('keeps every place of the scene on walkable ground', () => {
    const blocks = TRAPAS_BLOCKS;
    for (const p of [TRAPAS_SPOT.gate, TRAPAS_SPOT.street, ...TRAPAS_SPOT.route, TRAPAS_SPOT.leaderSmith, TRAPAS_SPOT.smith,
      TRAPAS_SPOT.liaWait, TRAPAS_SPOT.mentorWait, TRAPAS_SPOT.mentorGuard, TRAPAS_SPOT.notice, TRAPAS_SPOT.fountain,
      TRAPAS_SPOT.stairs, TRAPAS_SPOT.portal]) {
      expect(walkable(p, TRAPAS_WALK, blocks), `trapas ${p}`).toBe(true);
    }
    for (const p of [ROAD_SPOT.start, ROAD_SPOT.milestone, ROAD_SPOT.stopLia, ROAD_SPOT.stopMentor, ROAD_SPOT.leader,
      ROAD_SPOT.young, ROAD_SPOT.third, ROAD_SPOT.patrolIn]) {
      expect(walkable(p, ROAD_WALK, [{ poly: MILESTONE }]), `road ${p}`).toBe(true);
    }
    // The patrol stops them only after the milestone.
    expect(Math.min(...PATROL_ZONE.map(p => p[0]))).toBeGreaterThan(ROAD_SPOT.milestone[0]);
  });
});

describe('e3-paladine confiscation', () => {
  it('moves Lia’s own staff to the armoury, once', () => {
    prepareE3('e3-paladine');
    expect(hasOwnStaff()).toBe(true);
    expect(G.state.has(STAFF.borrowed)).toBe(false);
    confiscateStaffs();
    confiscateStaffs();
    expect(hasOwnStaff()).toBe(false);
    expect(G.state.count(STAFF.own)).toBe(0);
    expect(staffPlace()).toBe('waffenkammer');
  });

  it('also takes a borrowed Schattentöter that is still in the bag', () => {
    prepareE3('e3-paladine');
    G.state.give(STAFF.borrowed);
    confiscateStaffs();
    expect(G.state.has(STAFF.borrowed)).toBe(false);
    expect(hasOwnStaff()).toBe(false);
  });

  it('documented entry into e3-schutzreaktion: captured, staff in the armoury, order lore known', () => {
    prepareE3('e3-schutzreaktion');
    expect(G.state.is('e3-gefangen-genommen')).toBe(true);
    expect(hasOwnStaff()).toBe(false);
    expect(staffPlace()).toBe('waffenkammer');
    expect(G.state.data.lore).toContain('e3-lore-lichterorden');
  });
});
