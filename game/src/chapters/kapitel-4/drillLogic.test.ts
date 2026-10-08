import { describe, expect, it } from 'vitest';
import { afterStrike, DrillClock, dodgeFor, drillStart, FAST_WINDUP, HABITS, judge, MAX_STRIKES, nextStrike, READS_PER_HABIT, SHOW_WINDUP } from './drillLogic';

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

  it('shows the first habit slowly once, then only fast blows; three reads switch the habit, then it ends', () => {
    let s = drillStart();
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const k = nextStrike(s);
      expect(k.phase).toBe('show');
      expect(k.windup).toBe(SHOW_WINDUP);
      seen.push(k.side);
      const r = afterStrike(s, true);
      s = r.state;
      if (i === 2) expect(r.event).toBe('speedup');
    }
    expect(seen).toEqual([...HABITS[0]]);
    expect(s.reads).toBe(0);
    // Fast blows: misses do not count, three reads switch to the next habit.
    s = afterStrike(s, false).state;
    expect(nextStrike(s).windup).toBe(FAST_WINDUP);
    let event: string | null = null;
    for (let i = 0; i < READS_PER_HABIT; i++) ({ state: s, event } = afterStrike(s, true));
    expect(event).toBe('switch');
    expect(s.habit).toBe(1);
    expect(nextStrike(s)).toMatchObject({ side: HABITS[1][0], phase: 'fast' });
    for (let i = 0; i < READS_PER_HABIT; i++) ({ state: s, event } = afterStrike(s, true));
    expect(event).toBe('done');
    expect(s.done).toBe(true);
  });

  it('always ends', () => {
    let s = drillStart();
    let n = 0;
    while (!s.done) { s = afterStrike(s, false).state; n++; }
    expect(n).toBe(MAX_STRIKES);
  });
});
