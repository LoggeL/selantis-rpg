import { describe, expect, it } from 'vitest';
import { stakeStart, stakeStep, stakeTug } from './games';
import { beatPosition, BEATS_PER_LINE, LOUD_LINES } from './song';

describe('Der Pflock', () => {
  it('tugs while the men bawl the refrain loosen the stake', () => {
    const r = stakeTug(stakeStart(), true, false);
    expect(r.result).toBe('hit');
    expect(r.state.loose).toBeGreaterThan(0);
  });

  it('quiet lines and the drinking rest make noise; a second tug in the same beat does nothing', () => {
    expect(stakeTug(stakeStart(), false, false).result).toBe('quiet');
    const rest = stakeTug(stakeStart(), false, true);
    expect(rest.result).toBe('rest');
    expect(rest.state.noise).toBeGreaterThan(0.4);
    const once = stakeTug(stakeStart(), true, false).state;
    expect(stakeTug(once, true, false, true)).toEqual({ state: once, result: 'again' });
  });

  it('a soldier looks over at full noise; tugging then is caught', () => {
    let s = { ...stakeStart(), noise: 1, loose: 0.5 };
    const look = stakeStep(s, 0.016);
    expect(look.event).toBe('look');
    s = look.state;
    const r = stakeTug(s, true, false);
    expect(r.result).toBe('caught');
    expect(r.state.loose).toBeLessThan(0.5);
  });

  it('the soldier turns away again', () => {
    let s = { ...stakeStart(), watch: 0.1 };
    const r = stakeStep(s, 0.2);
    s = r.state;
    expect(r.event).toBe('away');
    expect(s.watch).toBe(0);
  });

  it('about two refrains free Kyra', () => {
    let s = stakeStart();
    let n = 0;
    while (s.loose < 1 && n < 40) { s = stakeTug(s, true, false).state; n++; }
    const perVerse = LOUD_LINES.length * BEATS_PER_LINE;
    expect(n).toBeGreaterThan(perVerse);
    expect(n).toBeLessThanOrEqual(perVerse * 2);
  });

  it('the refrain is the end of each verse', () => {
    expect(beatPosition(6 * BEATS_PER_LINE).line).toBe(6);
    expect(LOUD_LINES).toEqual([6, 7]);
  });
});
