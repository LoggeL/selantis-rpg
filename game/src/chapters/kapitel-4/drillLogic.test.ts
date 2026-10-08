import { describe, expect, it } from 'vitest';
import { DrillClock, dodgeFor, judge, strikePlan } from './drillLogic';

describe('Kapitel IV dodge drill', () => {
  it('keeps active time still during pause and discards the resume interval', () => {
    const clock = new DrillClock(100);
    expect(clock.tick(500, false)).toBe(400);
    expect(clock.tick(516, true)).toBe(400);
    expect(clock.tick(90_516, true)).toBe(400);
    expect(clock.tick(90_532, false)).toBe(400);
    expect(clock.tick(90_548, false)).toBe(416);
    expect(clock.tick(90_550, true)).toBe(416);
    expect(clock.tick(120_550, false)).toBe(416);
    expect(clock.tick(120_566, false)).toBe(432);
  });
  it('dodges away from the blade', () => {
    expect(dodgeFor('left')).toBe('right');
    expect(dodgeFor('right')).toBe('left');
    expect(dodgeFor('high')).toBe('duck');
  });

  it('judges feints by the side the blade finally comes from', () => {
    expect(judge({ side: 'left', windup: 1000 }, 'right')).toBe(true);
    expect(judge({ side: 'left', windup: 1000 }, 'left')).toBe(false);
    expect(judge({ side: 'left', windup: 1000 }, null)).toBe(false);
    expect(judge({ side: 'left', feint: 'right', windup: 1000 }, 'right')).toBe(false);
    expect(judge({ side: 'left', feint: 'right', windup: 1000 }, 'left')).toBe(true);
  });

  it('plans a teaching opening, then a reproducible mix that speeds up', () => {
    const plan = strikePlan(16);
    expect(plan.slice(0, 3).map(s => s.side)).toEqual(['left', 'right', 'high']);
    expect(plan[0].feint).toBeUndefined();
    expect(plan[3].feint).toBe('right');
    expect(strikePlan(16)).toEqual(plan);
    for (let i = 1; i < plan.length; i++) expect(plan[i].windup).toBeLessThanOrEqual(plan[i - 1].windup);
    expect(Math.min(...plan.map(s => s.windup))).toBeGreaterThanOrEqual(780);
    for (const s of plan) if (s.feint) expect(s.feint).not.toBe(s.side);
  });
});
